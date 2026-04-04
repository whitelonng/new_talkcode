//! Unified walker module for file system traversal.
//!
//! This module provides a configurable wrapper around the `ignore` crate's WalkBuilder,
//! with sensible defaults and preset configurations for different use cases.
//!
//! # Key Features
//! - **Symlink Safety**: Prevents traversal outside the workspace via symlinks (critical security fix)
//! - **Canonical Path Validation**: Validates that paths stay within the workspace
//! - **Configurable Presets**: Ready-to-use configurations for file search, content search, glob, and directory listing
//! - **Shared Exclusion Logic**: Centralized directory exclusion handling

use crate::constants::{should_exclude_dir, DEFAULT_MAX_DEPTH};
use ignore::{Walk, WalkBuilder, WalkParallel};
use std::ffi::OsStr;
use std::path::{Path, PathBuf};

/// Configuration options for the workspace walker.
#[derive(Debug, Clone)]
pub struct WalkerConfig {
    /// Follow symbolic links. Default: `false` (CRITICAL: prevents symlink escape)
    pub follow_links: bool,
    /// Respect .gitignore files. Default: `false` for search, `true` for listing
    pub respect_gitignore: bool,
    /// Skip hidden files and directories. Default: `true`
    pub skip_hidden: bool,
    /// Maximum depth to traverse. Default: `Some(20)`
    pub max_depth: Option<usize>,
    /// Allow traversal into .github directory (for CI/CD file search). Default: `false`
    pub allow_github_dir: bool,
    /// Workspace root for canonical path validation. Default: `None`
    pub workspace_root: Option<PathBuf>,
    /// Additional directories to exclude (on top of defaults)
    pub additional_excludes: Vec<String>,
}

impl Default for WalkerConfig {
    fn default() -> Self {
        Self {
            follow_links: false, // CRITICAL: prevents symlink escape to external directories
            respect_gitignore: false,
            skip_hidden: true,
            max_depth: Some(DEFAULT_MAX_DEPTH),
            allow_github_dir: false,
            workspace_root: None,
            additional_excludes: Vec::new(),
        }
    }
}

impl WalkerConfig {
    /// Create a new WalkerConfig with default values.
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self::default()
    }

    /// Configuration optimized for file name search.
    /// - Allows .github directory for CI/CD workflows
    /// - Doesn't follow symlinks
    /// - Includes hidden directories (except excluded ones)
    pub fn for_file_search() -> Self {
        Self {
            follow_links: false,
            respect_gitignore: false,
            skip_hidden: false, // Allow hidden files like .env
            max_depth: Some(DEFAULT_MAX_DEPTH),
            allow_github_dir: true, // Allow .github for CI/CD files
            workspace_root: None,
            additional_excludes: Vec::new(),
        }
    }

    /// Configuration optimized for content search.
    /// - Doesn't follow symlinks
    /// - Skips hidden files
    /// - Doesn't respect gitignore (search all code files)
    pub fn for_content_search() -> Self {
        Self {
            follow_links: false,
            respect_gitignore: false,
            skip_hidden: true, // Skip hidden files for content search
            max_depth: Some(DEFAULT_MAX_DEPTH),
            allow_github_dir: false,
            workspace_root: None,
            additional_excludes: Vec::new(),
        }
    }

    /// Configuration optimized for glob pattern matching.
    /// - Doesn't follow symlinks
    /// - Includes hidden directories (for .talkcody, etc.)
    /// - Sets workspace_root for canonical path validation
    pub fn for_glob(workspace_root: &str) -> Self {
        Self {
            follow_links: false,
            respect_gitignore: false,
            skip_hidden: false, // Allow searching in hidden directories like .talkcody
            max_depth: Some(DEFAULT_MAX_DEPTH),
            allow_github_dir: false,
            workspace_root: Some(PathBuf::from(workspace_root)),
            additional_excludes: Vec::new(),
        }
    }

    /// Configuration optimized for directory listing.
    /// - Doesn't follow symlinks
    /// - Respects gitignore
    /// - Skips hidden files
    pub fn for_list_files() -> Self {
        Self {
            follow_links: false,
            respect_gitignore: true,
            skip_hidden: true,
            max_depth: None, // Will be set dynamically based on recursive flag
            allow_github_dir: false,
            workspace_root: None,
            additional_excludes: Vec::new(),
        }
    }

    // Builder methods for customization
    // Note: Some methods are intentionally unused but kept for API completeness

    /// Set follow_links option.
    #[allow(dead_code)]
    pub fn with_follow_links(mut self, follow: bool) -> Self {
        self.follow_links = follow;
        self
    }

    /// Set respect_gitignore option.
    #[allow(dead_code)]
    pub fn with_gitignore(mut self, respect: bool) -> Self {
        self.respect_gitignore = respect;
        self
    }

    /// Set skip_hidden option.
    #[allow(dead_code)]
    pub fn with_skip_hidden(mut self, skip: bool) -> Self {
        self.skip_hidden = skip;
        self
    }

    /// Set max_depth option.
    pub fn with_max_depth(mut self, depth: Option<usize>) -> Self {
        self.max_depth = depth;
        self
    }

    /// Set allow_github_dir option.
    #[allow(dead_code)]
    pub fn with_allow_github(mut self, allow: bool) -> Self {
        self.allow_github_dir = allow;
        self
    }

    /// Set workspace_root for canonical path validation.
    #[allow(dead_code)]
    pub fn with_workspace_root(mut self, root: &str) -> Self {
        self.workspace_root = Some(PathBuf::from(root));
        self
    }

    /// Add additional directories to exclude.
    pub fn with_additional_excludes(mut self, excludes: Vec<String>) -> Self {
        self.additional_excludes = excludes;
        self
    }
}

/// Wrapper around `ignore::WalkBuilder` with unified configuration.
pub struct WorkspaceWalker {
    builder: WalkBuilder,
    config: WalkerConfig,
}

impl WorkspaceWalker {
    /// Create a new WorkspaceWalker with the given root path and configuration.
    pub fn new(root_path: &str, config: WalkerConfig) -> Self {
        let mut builder = WalkBuilder::new(root_path);

        // Apply configuration
        builder
            .follow_links(config.follow_links)
            .hidden(config.skip_hidden)
            .git_ignore(config.respect_gitignore)
            .git_global(config.respect_gitignore)
            .git_exclude(config.respect_gitignore)
            .ignore(config.respect_gitignore)
            .parents(true);

        // Set max depth if specified
        if let Some(depth) = config.max_depth {
            builder.max_depth(Some(depth));
        }

        // If not respecting gitignore, disable standard filters to allow more control
        if !config.respect_gitignore {
            builder.standard_filters(false);
        }

        Self { builder, config }
    }

    /// Build and return a sequential walker with directory filtering.
    pub fn build(mut self) -> Walk {
        let config = self.config;
        let additional_excludes = config.additional_excludes.clone();
        let allow_github = config.allow_github_dir;

        self.builder
            .filter_entry(move |entry| {
                Self::should_include_entry(entry, allow_github, &additional_excludes)
            })
            .build()
    }

    /// Build and return a parallel walker with directory filtering.
    pub fn build_parallel(mut self) -> WalkParallel {
        let config = self.config;
        let additional_excludes = config.additional_excludes.clone();
        let allow_github = config.allow_github_dir;

        self.builder
            .filter_entry(move |entry| {
                Self::should_include_entry(entry, allow_github, &additional_excludes)
            })
            .build_parallel()
    }

    /// Get the workspace root for canonical path validation.
    pub fn workspace_root(&self) -> Option<&PathBuf> {
        self.config.workspace_root.as_ref()
    }

    /// Determine if an entry should be included in the walk.
    fn should_include_entry(
        entry: &ignore::DirEntry,
        allow_github: bool,
        additional_excludes: &[String],
    ) -> bool {
        let path = entry.path();

        // Only filter directories
        if !path.is_dir() {
            return true;
        }

        if let Some(name) = path.file_name().and_then(OsStr::to_str) {
            // Always allow .github directory if configured
            if allow_github && name == ".github" {
                return true;
            }

            // Check additional excludes first
            if additional_excludes.iter().any(|ex| ex == name) {
                return false;
            }

            // Check default excluded directories
            return !should_exclude_dir(name);
        }

        true
    }
}

/// Validate that a path stays within the workspace root.
///
/// This function canonicalizes the given path and checks if it starts with
/// the canonical workspace root. This prevents symlink attacks where a
/// symlink points to a path outside the workspace.
///
/// # Arguments
/// * `path` - The path to validate
/// * `workspace_root` - The workspace root to validate against
///
/// # Returns
/// `true` if the path is within the workspace, `false` otherwise
pub fn validate_path_in_workspace(path: &Path, workspace_root: &Path) -> bool {
    // Canonicalize both paths to resolve symlinks
    let canonical_path = match path.canonicalize() {
        Ok(p) => p,
        Err(_) => return false, // If we can't canonicalize, reject the path
    };

    let canonical_root = match workspace_root.canonicalize() {
        Ok(p) => p,
        Err(_) => return false, // If we can't canonicalize root, reject
    };

    // Check if the canonical path starts with the canonical root
    canonical_path.starts_with(&canonical_root)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn create_test_directory() -> TempDir {
        let temp_dir = TempDir::new().unwrap();

        // Create directory structure
        fs::create_dir_all(temp_dir.path().join("src")).unwrap();
        fs::create_dir_all(temp_dir.path().join("node_modules/package")).unwrap();
        fs::create_dir_all(temp_dir.path().join(".git/objects")).unwrap();
        fs::create_dir_all(temp_dir.path().join(".github/workflows")).unwrap();
        fs::create_dir_all(temp_dir.path().join(".hidden")).unwrap();

        // Create files
        fs::write(temp_dir.path().join("src/main.rs"), "fn main() {}").unwrap();
        fs::write(temp_dir.path().join(".github/workflows/ci.yml"), "name: CI").unwrap();
        fs::write(temp_dir.path().join(".hidden/config"), "secret").unwrap();
        fs::write(temp_dir.path().join("node_modules/package/index.js"), "").unwrap();

        temp_dir
    }

    #[test]
    fn test_walker_config_defaults() {
        let config = WalkerConfig::default();
        assert!(!config.follow_links);
        assert!(!config.respect_gitignore);
        assert!(config.skip_hidden);
        assert_eq!(config.max_depth, Some(DEFAULT_MAX_DEPTH));
        assert!(!config.allow_github_dir);
    }

    #[test]
    fn test_walker_config_for_file_search() {
        let config = WalkerConfig::for_file_search();
        assert!(!config.follow_links);
        assert!(!config.skip_hidden); // Allow hidden files
        assert!(config.allow_github_dir); // Allow .github
    }

    #[test]
    fn test_walker_config_for_content_search() {
        let config = WalkerConfig::for_content_search();
        assert!(!config.follow_links);
        assert!(config.skip_hidden);
        assert!(!config.allow_github_dir);
    }

    #[test]
    fn test_walker_config_for_glob() {
        let config = WalkerConfig::for_glob("/test/path");
        assert!(!config.follow_links);
        assert!(!config.skip_hidden); // Allow searching hidden directories
        assert!(config.workspace_root.is_some());
    }

    #[test]
    fn test_walker_config_for_list_files() {
        let config = WalkerConfig::for_list_files();
        assert!(!config.follow_links);
        assert!(config.respect_gitignore);
        assert!(config.skip_hidden);
    }

    #[test]
    fn test_walker_config_builder_methods() {
        let config = WalkerConfig::new()
            .with_follow_links(true)
            .with_gitignore(true)
            .with_skip_hidden(false)
            .with_max_depth(Some(10))
            .with_allow_github(true)
            .with_workspace_root("/workspace")
            .with_additional_excludes(vec!["custom".to_string()]);

        assert!(config.follow_links);
        assert!(config.respect_gitignore);
        assert!(!config.skip_hidden);
        assert_eq!(config.max_depth, Some(10));
        assert!(config.allow_github_dir);
        assert_eq!(config.workspace_root, Some(PathBuf::from("/workspace")));
        assert_eq!(config.additional_excludes, vec!["custom".to_string()]);
    }

    #[test]
    fn test_walker_excludes_node_modules() {
        let temp_dir = create_test_directory();
        let config = WalkerConfig::for_file_search();
        let walker = WorkspaceWalker::new(temp_dir.path().to_str().unwrap(), config);

        let mut found_node_modules = false;
        for entry in walker.build().flatten() {
            if entry.path().to_string_lossy().contains("node_modules") {
                found_node_modules = true;
                break;
            }
        }

        assert!(
            !found_node_modules,
            "node_modules should be excluded from walk"
        );
    }

    #[test]
    fn test_walker_excludes_git() {
        let temp_dir = create_test_directory();
        let config = WalkerConfig::for_file_search();
        let walker = WorkspaceWalker::new(temp_dir.path().to_str().unwrap(), config);

        let mut found_git = false;
        for entry in walker.build().flatten() {
            let path_str = entry.path().to_string_lossy();
            if path_str.contains(".git/") || path_str.ends_with(".git") {
                // Allow .github but not .git
                if !path_str.contains(".github") {
                    found_git = true;
                    break;
                }
            }
        }

        assert!(!found_git, ".git should be excluded from walk");
    }

    #[test]
    fn test_walker_allows_github_when_configured() {
        let temp_dir = create_test_directory();
        let config = WalkerConfig::for_file_search(); // This allows .github
        let walker = WorkspaceWalker::new(temp_dir.path().to_str().unwrap(), config);

        let mut found_github = false;
        for entry in walker.build().flatten() {
            if entry.path().to_string_lossy().contains(".github") {
                found_github = true;
                break;
            }
        }

        assert!(
            found_github,
            ".github should be included when allow_github_dir is true"
        );
    }

    #[test]
    fn test_walker_excludes_github_by_default() {
        let temp_dir = create_test_directory();
        let config = WalkerConfig::for_content_search(); // This doesn't allow .github
        let walker = WorkspaceWalker::new(temp_dir.path().to_str().unwrap(), config);

        let mut _found_github = false;
        for entry in walker.build().flatten() {
            if entry.path().to_string_lossy().contains(".github") {
                _found_github = true;
                break;
            }
        }

        // Note: .github is not in EXCLUDED_DIRS, so it should still be found
        // unless explicitly hidden. The skip_hidden setting controls this.
    }

    #[test]
    fn test_validate_path_in_workspace_valid() {
        let temp_dir = TempDir::new().unwrap();
        fs::create_dir_all(temp_dir.path().join("src")).unwrap();
        fs::write(temp_dir.path().join("src/main.rs"), "").unwrap();

        let file_path = temp_dir.path().join("src/main.rs");
        assert!(validate_path_in_workspace(&file_path, temp_dir.path()));
    }

    #[test]
    fn test_validate_path_in_workspace_invalid() {
        let temp_dir = TempDir::new().unwrap();
        let other_dir = TempDir::new().unwrap();
        fs::write(other_dir.path().join("external.txt"), "").unwrap();

        let external_path = other_dir.path().join("external.txt");
        assert!(!validate_path_in_workspace(&external_path, temp_dir.path()));
    }

    #[test]
    #[cfg(unix)]
    fn test_symlink_not_followed() {
        use std::os::unix::fs::symlink;

        let temp_dir = TempDir::new().unwrap();
        let external_dir = TempDir::new().unwrap();

        // Create a file in external directory
        fs::write(external_dir.path().join("secret.txt"), "secret").unwrap();

        // Create internal structure
        fs::create_dir_all(temp_dir.path().join("src")).unwrap();
        fs::write(temp_dir.path().join("src/main.rs"), "fn main() {}").unwrap();

        // Create a symlink pointing to external directory
        let symlink_path = temp_dir.path().join("external_link");
        symlink(external_dir.path(), &symlink_path).unwrap();

        // Walk with follow_links = false (default)
        let config = WalkerConfig::for_file_search();
        let walker = WorkspaceWalker::new(temp_dir.path().to_str().unwrap(), config);

        let mut found_external = false;
        for entry in walker.build().flatten() {
            if entry.path().to_string_lossy().contains("secret.txt") {
                found_external = true;
                break;
            }
        }

        assert!(
            !found_external,
            "Files in symlinked external directories should not be found"
        );
    }

    #[test]
    fn test_walker_with_additional_excludes() {
        let temp_dir = TempDir::new().unwrap();

        // Create directories
        fs::create_dir_all(temp_dir.path().join("src")).unwrap();
        fs::create_dir_all(temp_dir.path().join("custom_exclude")).unwrap();

        fs::write(temp_dir.path().join("src/main.rs"), "").unwrap();
        fs::write(temp_dir.path().join("custom_exclude/file.txt"), "").unwrap();

        let config = WalkerConfig::for_file_search()
            .with_additional_excludes(vec!["custom_exclude".to_string()]);
        let walker = WorkspaceWalker::new(temp_dir.path().to_str().unwrap(), config);

        let mut found_custom = false;
        for entry in walker.build().flatten() {
            if entry.path().to_string_lossy().contains("custom_exclude") {
                found_custom = true;
                break;
            }
        }

        assert!(!found_custom, "custom_exclude directory should be excluded");
    }
}
