use ignore::gitignore::{Gitignore, GitignoreBuilder};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub children: Option<Vec<FileNode>>,
    pub is_lazy_loaded: Option<bool>,
    pub has_children: Option<bool>,
    pub modified_time: Option<u64>,
    pub size: Option<u64>,
    pub is_git_ignored: Option<bool>,
}

#[derive(Debug, Clone)]
struct CachedEntry {
    node: FileNode,
    cached_at: u64,
}

pub struct DirectoryTreeBuilder {
    cache: Arc<Mutex<HashMap<String, CachedEntry>>>,
    cache_ttl: u64, // Cache TTL in seconds
}

impl Default for DirectoryTreeBuilder {
    fn default() -> Self {
        Self {
            cache: Arc::new(Mutex::new(HashMap::new())),
            cache_ttl: 30, // 30 seconds cache
        }
    }
}

impl DirectoryTreeBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    fn get_current_timestamp() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    }

    fn get_file_metadata(path: &Path) -> Option<(u64, u64)> {
        if let Ok(metadata) = path.metadata() {
            let modified = metadata
                .modified()
                .ok()?
                .duration_since(UNIX_EPOCH)
                .ok()?
                .as_secs();
            let size = metadata.len();
            Some((modified, size))
        } else {
            None
        }
    }

    fn normalize_path(path: &Path) -> String {
        path.to_string_lossy().replace('\\', "/")
    }

    /// Build a gitignore matcher for the given root path
    fn build_gitignore_matcher(root_path: &Path) -> Option<Gitignore> {
        let mut builder = GitignoreBuilder::new(root_path);
        let gitignore_path = root_path.join(".gitignore");
        if gitignore_path.exists() {
            let _ = builder.add(&gitignore_path);
        }
        builder.build().ok()
    }

    /// Build directory tree with immediate first-level loading
    pub fn build_directory_tree_fast(
        &self,
        root_path: &str,
        max_immediate_depth: usize,
    ) -> Result<FileNode, String> {
        let root = Path::new(root_path);
        if !root.exists() {
            return Err("Directory does not exist".to_string());
        }

        let now = Self::get_current_timestamp();
        let path_key = Self::normalize_path(root);

        // Check cache first
        if let Ok(cache) = self.cache.lock() {
            if let Some(cached) = cache.get(&path_key) {
                if now - cached.cached_at <= self.cache_ttl {
                    return Ok(cached.node.clone());
                }
            }
        }

        // Build gitignore matcher
        let gitignore = Self::build_gitignore_matcher(root);

        // Build tree with immediate depth loading
        let node = Self::build_node_recursive(root, 0, max_immediate_depth, &gitignore)?;

        // Cache the result
        if let Ok(mut cache) = self.cache.lock() {
            cache.insert(
                path_key,
                CachedEntry {
                    node: node.clone(),
                    cached_at: now,
                },
            );
        }

        Ok(node)
    }

    fn build_node_recursive(
        path: &Path,
        current_depth: usize,
        max_depth: usize,
        gitignore: &Option<Gitignore>,
    ) -> Result<FileNode, String> {
        let name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let path_str = Self::normalize_path(path);
        let timestamp = Self::get_current_timestamp();
        let (modified_time, size) = Self::get_file_metadata(path).unwrap_or((timestamp, 0));

        // Check if this path is git-ignored
        let is_ignored = gitignore
            .as_ref()
            .map(|gi| gi.matched(path, path.is_dir()).is_ignore())
            .unwrap_or(false);

        if path.is_file() {
            return Ok(FileNode {
                name,
                path: path_str,
                is_directory: false,
                children: None,
                is_lazy_loaded: None,
                has_children: None,
                modified_time: Some(modified_time),
                size: Some(size),
                is_git_ignored: Some(is_ignored),
            });
        }

        // Handle directory
        let entries = match std::fs::read_dir(path) {
            Ok(entries) => entries.flatten().collect::<Vec<_>>(),
            Err(_) => {
                return Err(format!("Failed to read directory: {}", path_str));
            }
        };

        // If we're at max depth or directory is too large, use lazy loading
        let should_lazy_load = current_depth >= max_depth || entries.len() > 100;

        if should_lazy_load {
            let has_children = !entries.is_empty();

            return Ok(FileNode {
                name,
                path: path_str,
                is_directory: true,
                children: Some(Vec::new()),
                is_lazy_loaded: Some(true),
                has_children: Some(has_children),
                modified_time: Some(modified_time),
                size: Some(size),
                is_git_ignored: Some(is_ignored),
            });
        }

        // Process children synchronously for now (can be optimized later with proper async handling)
        let mut children = Vec::new();

        for entry in entries {
            let entry_path = entry.path();
            let entry_name = entry.file_name().to_string_lossy().to_string();

            // Skip parent directory reference and .git directory
            if entry_name == ".." || (entry_path.is_dir() && entry_name == ".git") {
                continue;
            }

            if let Ok(child) =
                Self::build_node_recursive(&entry_path, current_depth + 1, max_depth, gitignore)
            {
                children.push(child);
            }
        }

        // Sort children: directories first, then files, both alphabetically
        children.sort_by(|a, b| match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });

        Ok(FileNode {
            name,
            path: path_str,
            is_directory: true,
            children: Some(children),
            is_lazy_loaded: Some(false),
            has_children: None,
            modified_time: Some(modified_time),
            size: Some(size),
            is_git_ignored: Some(is_ignored),
        })
    }

    /// Find the git root directory by looking for .git folder
    fn find_git_root(path: &Path) -> Option<&Path> {
        let mut current = path;
        loop {
            if current.join(".git").exists() {
                return Some(current);
            }
            match current.parent() {
                Some(parent) => current = parent,
                None => return None,
            }
        }
    }

    /// Load children for a lazy-loaded directory
    pub fn load_directory_children(&self, dir_path: &str) -> Result<Vec<FileNode>, String> {
        let path = Path::new(dir_path);
        if !path.exists() || !path.is_dir() {
            return Err("Invalid directory path".to_string());
        }

        let now = Self::get_current_timestamp();
        let cache_key = format!("{}_children", Self::normalize_path(path));

        // Check cache
        if let Ok(cache) = self.cache.lock() {
            if let Some(cached) = cache.get(&cache_key) {
                if now - cached.cached_at <= self.cache_ttl {
                    if let Some(children) = &cached.node.children {
                        return Ok(children.clone());
                    }
                }
            }
        }

        // Build gitignore matcher from git root
        let gitignore = Self::find_git_root(path).and_then(Self::build_gitignore_matcher);

        // Build children
        let entries = match std::fs::read_dir(path) {
            Ok(entries) => entries.flatten().collect::<Vec<_>>(),
            Err(_) => {
                return Err("Failed to read directory".to_string());
            }
        };

        let mut children = Vec::new();

        for entry in entries {
            let entry_path = entry.path();
            let entry_name = entry.file_name().to_string_lossy().to_string();

            // Skip parent directory reference and .git directory
            if entry_name == ".." || (entry_path.is_dir() && entry_name == ".git") {
                continue;
            }

            if let Ok(child) = Self::build_node_recursive(&entry_path, 1, 2, &gitignore) {
                children.push(child);
            }
        }

        children.sort_by(|a, b| match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });

        // Cache the result
        if let Ok(mut cache) = self.cache.lock() {
            cache.insert(
                cache_key,
                CachedEntry {
                    node: FileNode {
                        name: String::new(),
                        path: String::new(),
                        is_directory: true,
                        children: Some(children.clone()),
                        is_lazy_loaded: None,
                        has_children: None,
                        modified_time: None,
                        size: None,
                        is_git_ignored: None,
                    },
                    cached_at: now,
                },
            );
        }

        Ok(children)
    }

    /// Clear cache (useful for file system changes)
    pub fn clear_cache(&self) {
        if let Ok(mut cache) = self.cache.lock() {
            cache.clear();
        }
    }

    /// Invalidate specific path cache
    pub fn invalidate_path(&self, path: &str) {
        if let Ok(mut cache) = self.cache.lock() {
            let normalized = Self::normalize_path(Path::new(path));
            cache.remove(&normalized);
            cache.remove(&format!("{}_children", normalized));
        }
    }
}

// Global instance
lazy_static::lazy_static! {
    static ref DIRECTORY_TREE_BUILDER: DirectoryTreeBuilder = DirectoryTreeBuilder::new();
}

#[tauri::command]
pub fn build_directory_tree(
    root_path: String,
    max_immediate_depth: Option<usize>,
) -> Result<FileNode, String> {
    let depth = max_immediate_depth.unwrap_or(2); // Default to 2 levels deep
    DIRECTORY_TREE_BUILDER.build_directory_tree_fast(&root_path, depth)
}

#[tauri::command]
pub fn load_directory_children(dir_path: String) -> Result<Vec<FileNode>, String> {
    DIRECTORY_TREE_BUILDER.load_directory_children(&dir_path)
}

#[tauri::command]
pub fn clear_directory_cache() {
    DIRECTORY_TREE_BUILDER.clear_cache();
}

#[tauri::command]
pub fn invalidate_directory_path(path: String) {
    DIRECTORY_TREE_BUILDER.invalidate_path(&path);
}
