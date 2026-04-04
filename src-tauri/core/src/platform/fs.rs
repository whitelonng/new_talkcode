//! Filesystem Platform Abstraction
//!
//! Provides safe filesystem operations with workspace validation.
//! Wraps existing file system utilities from the codebase.

use crate::platform::types::*;
use std::path::{Path, PathBuf};

/// Filesystem operations provider
#[derive(Clone)]
pub struct FileSystemPlatform;

impl FileSystemPlatform {
    pub fn new() -> Self {
        Self
    }

    /// Validate that a path is within the workspace root
    fn validate_path(&self, path: &Path, ctx: &PlatformContext) -> Result<PathBuf, String> {
        let canonical_path = path
            .canonicalize()
            .map_err(|e| format!("Invalid path: {}", e))?;

        let canonical_root = ctx
            .workspace_root
            .canonicalize()
            .map_err(|e| format!("Invalid workspace root: {}", e))?;

        if !canonical_path.starts_with(&canonical_root) {
            return Err(format!(
                "Path '{}' is outside workspace root '{}'",
                canonical_path.display(),
                canonical_root.display()
            ));
        }

        Ok(canonical_path)
    }

    /// Validate that a path for writing is within the workspace root
    /// For write operations, the file may not exist yet, so we validate the parent directory
    fn validate_write_path(&self, path: &Path, ctx: &PlatformContext) -> Result<PathBuf, String> {
        // Get absolute path (without requiring file to exist)
        let absolute_path = if path.is_absolute() {
            path.to_path_buf()
        } else {
            ctx.workspace_root.join(path)
        };

        // Get canonical workspace root
        let canonical_root = ctx
            .workspace_root
            .canonicalize()
            .map_err(|e| format!("Invalid workspace root: {}", e))?;

        // For new files, validate that the parent directory is within workspace
        let parent = absolute_path
            .parent()
            .ok_or_else(|| "Invalid path: no parent directory".to_string())?;

        // Create parent if it doesn't exist for validation purposes
        if !parent.exists() {
            // Parent doesn't exist yet, check if it would be within workspace
            let parent_absolute = if parent.is_absolute() {
                parent.to_path_buf()
            } else {
                ctx.workspace_root.join(parent)
            };

            if !parent_absolute.starts_with(&canonical_root) {
                return Err(format!(
                    "Path '{}' is outside workspace root '{}'",
                    absolute_path.display(),
                    canonical_root.display()
                ));
            }
        } else {
            let canonical_parent = parent
                .canonicalize()
                .map_err(|e| format!("Invalid parent directory: {}", e))?;

            if !canonical_parent.starts_with(&canonical_root) {
                return Err(format!(
                    "Path '{}' is outside workspace root '{}'",
                    absolute_path.display(),
                    canonical_root.display()
                ));
            }
        }

        Ok(absolute_path)
    }

    /// Read file contents
    pub async fn read_file(&self, path: &str, ctx: &PlatformContext) -> PlatformResult<String> {
        let path = Path::new(path);

        match self.validate_path(path, ctx) {
            Ok(validated_path) => {
                // Check file size
                match tokio::fs::metadata(&validated_path).await {
                    Ok(metadata) => {
                        if metadata.len() > ctx.max_file_size as u64 {
                            return PlatformResult::error(format!(
                                "File too large: {} bytes (max: {})",
                                metadata.len(),
                                ctx.max_file_size
                            ));
                        }

                        match tokio::fs::read_to_string(&validated_path).await {
                            Ok(content) => PlatformResult::success(content),
                            Err(e) => PlatformResult::error(format!("Failed to read file: {}", e)),
                        }
                    }
                    Err(e) => PlatformResult::error(format!("Failed to get file metadata: {}", e)),
                }
            }
            Err(e) => PlatformResult::error(e),
        }
    }

    /// Write file contents
    pub async fn write_file(
        &self,
        path: &str,
        content: &str,
        ctx: &PlatformContext,
    ) -> PlatformResult<()> {
        let path = Path::new(path);

        match self.validate_write_path(path, ctx) {
            Ok(validated_path) => {
                // Ensure parent directory exists
                if let Some(parent) = validated_path.parent() {
                    if let Err(e) = tokio::fs::create_dir_all(parent).await {
                        return PlatformResult::error(format!("Failed to create directory: {}", e));
                    }
                }

                match tokio::fs::write(&validated_path, content).await {
                    Ok(_) => PlatformResult::success(()),
                    Err(e) => PlatformResult::error(format!("Failed to write file: {}", e)),
                }
            }
            Err(e) => PlatformResult::error(e),
        }
    }

    /// Check if file exists
    pub async fn file_exists(&self, path: &str, ctx: &PlatformContext) -> PlatformResult<bool> {
        let path = Path::new(path);

        match self.validate_path(path, ctx) {
            Ok(validated_path) => match tokio::fs::try_exists(&validated_path).await {
                Ok(exists) => PlatformResult::success(exists),
                Err(e) => PlatformResult::error(format!("Failed to check file: {}", e)),
            },
            Err(_) => PlatformResult::success(false), // Path outside workspace = doesn't exist for our purposes
        }
    }

    /// List directory contents
    pub async fn list_directory(
        &self,
        path: &str,
        ctx: &PlatformContext,
    ) -> PlatformResult<Vec<DirectoryEntry>> {
        let path = Path::new(path);

        match self.validate_path(path, ctx) {
            Ok(validated_path) => match tokio::fs::read_dir(&validated_path).await {
                Ok(mut entries) => {
                    let mut result = Vec::new();

                    while let Ok(Some(entry)) = entries.next_entry().await {
                        let file_type = entry.file_type().await.ok();
                        let name = entry.file_name().to_string_lossy().to_string();
                        let path = entry.path().to_string_lossy().to_string();

                        result.push(DirectoryEntry {
                            path,
                            name,
                            is_directory: file_type.map(|ft| ft.is_dir()).unwrap_or(false),
                            is_file: file_type.map(|ft| ft.is_file()).unwrap_or(false),
                        });
                    }

                    PlatformResult::success(result)
                }
                Err(e) => PlatformResult::error(format!("Failed to read directory: {}", e)),
            },
            Err(e) => PlatformResult::error(e),
        }
    }

    /// Get file information
    pub async fn get_file_info(
        &self,
        path: &str,
        ctx: &PlatformContext,
    ) -> PlatformResult<FileInfo> {
        let path = Path::new(path);

        match self.validate_path(path, ctx) {
            Ok(validated_path) => match tokio::fs::metadata(&validated_path).await {
                Ok(metadata) => {
                    let name = validated_path
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();

                    let modified_at = metadata
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs() as i64);

                    let created_at = metadata
                        .created()
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs() as i64);

                    PlatformResult::success(FileInfo {
                        path: validated_path.to_string_lossy().to_string(),
                        name,
                        size: metadata.len(),
                        is_directory: metadata.is_dir(),
                        is_file: metadata.is_file(),
                        modified_at,
                        created_at,
                    })
                }
                Err(e) => PlatformResult::error(format!("Failed to get file info: {}", e)),
            },
            Err(e) => PlatformResult::error(e),
        }
    }

    /// Delete a file
    pub async fn delete_file(&self, path: &str, ctx: &PlatformContext) -> PlatformResult<()> {
        let path = Path::new(path);

        match self.validate_path(path, ctx) {
            Ok(validated_path) => match tokio::fs::remove_file(&validated_path).await {
                Ok(_) => PlatformResult::success(()),
                Err(e) => PlatformResult::error(format!("Failed to delete file: {}", e)),
            },
            Err(e) => PlatformResult::error(e),
        }
    }

    /// Create a directory
    pub async fn create_directory(&self, path: &str, ctx: &PlatformContext) -> PlatformResult<()> {
        let path = Path::new(path);

        match self.validate_path(path, ctx) {
            Ok(validated_path) => match tokio::fs::create_dir_all(&validated_path).await {
                Ok(_) => PlatformResult::success(()),
                Err(e) => PlatformResult::error(format!("Failed to create directory: {}", e)),
            },
            Err(e) => PlatformResult::error(e),
        }
    }
}

impl Default for FileSystemPlatform {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_read_write_file() {
        let fs = FileSystemPlatform::new();
        let temp_dir = TempDir::new().unwrap();

        let ctx = PlatformContext {
            workspace_root: temp_dir.path().to_path_buf(),
            worktree_path: None,
            max_file_size: 1024 * 1024,
            shell_timeout_secs: 60,
        };

        let test_file = temp_dir.path().join("test.txt");
        let test_path = test_file.to_string_lossy().to_string();

        // Write file
        let write_result = fs.write_file(&test_path, "Hello, World!", &ctx).await;
        assert!(write_result.success);

        // Read file
        let read_result = fs.read_file(&test_path, &ctx).await;
        assert!(read_result.success);
        assert_eq!(read_result.data, Some("Hello, World!".to_string()));
    }

    #[tokio::test]
    async fn test_path_validation_outside_workspace() {
        let fs = FileSystemPlatform::new();
        let workspace_dir = TempDir::new().unwrap();
        let outside_dir = TempDir::new().unwrap();

        let ctx = PlatformContext {
            workspace_root: workspace_dir.path().to_path_buf(),
            worktree_path: None,
            max_file_size: 1024 * 1024,
            shell_timeout_secs: 60,
        };

        // Create a file outside the workspace
        let outside_file = outside_dir.path().join("outside.txt");
        tokio::fs::write(&outside_file, "outside content")
            .await
            .unwrap();

        // Try to read file outside workspace
        let result = fs.read_file(&outside_file.to_string_lossy(), &ctx).await;
        assert!(!result.success);
        assert!(result.error.unwrap().contains("outside workspace"));
    }

    #[tokio::test]
    async fn test_file_exists() {
        let fs = FileSystemPlatform::new();
        let temp_dir = TempDir::new().unwrap();

        let ctx = PlatformContext {
            workspace_root: temp_dir.path().to_path_buf(),
            worktree_path: None,
            max_file_size: 1024 * 1024,
            shell_timeout_secs: 60,
        };

        let test_file = temp_dir.path().join("exists.txt");
        tokio::fs::write(&test_file, "content").await.unwrap();

        let exists_result = fs.file_exists(&test_file.to_string_lossy(), &ctx).await;
        assert!(exists_result.success);
        assert_eq!(exists_result.data, Some(true));

        let not_exists_result = fs
            .file_exists(
                &temp_dir.path().join("nonexistent.txt").to_string_lossy(),
                &ctx,
            )
            .await;
        assert!(not_exists_result.success);
        assert_eq!(not_exists_result.data, Some(false));
    }
}
