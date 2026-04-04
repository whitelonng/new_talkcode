use serde::{Deserialize, Serialize};

/// Represents the status of a file in Git
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GitFileStatus {
    /// File is unmodified
    Unmodified,
    /// File is modified in working directory
    Modified,
    /// File is newly added to index
    Added,
    /// File is deleted in working directory
    Deleted,
    /// File is renamed
    Renamed,
    /// File is untracked
    Untracked,
    /// File has merge conflicts
    Conflicted,
}

/// Represents a file with its Git status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStatus {
    /// Relative path from repository root
    pub path: String,
    /// Git status of the file
    pub status: GitFileStatus,
    /// Whether the file is staged
    pub staged: bool,
}

/// Represents information about a Git branch
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchInfo {
    /// Branch name
    pub name: String,
    /// Whether this is the current branch
    pub is_current: bool,
    /// Whether the branch is HEAD (detached HEAD state)
    pub is_head: bool,
    /// Upstream branch name if any
    pub upstream: Option<String>,
    /// Number of commits ahead of upstream
    pub ahead: Option<usize>,
    /// Number of commits behind upstream
    pub behind: Option<usize>,
}

/// Represents the overall Git repository status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    /// Current branch information
    pub branch: Option<BranchInfo>,
    /// List of modified files (unstaged)
    pub modified: Vec<FileStatus>,
    /// List of staged files
    pub staged: Vec<FileStatus>,
    /// List of untracked files
    pub untracked: Vec<String>,
    /// List of conflicted files
    pub conflicted: Vec<String>,
    /// Total count of uncommitted changes
    pub changes_count: usize,
}

/// Represents a line change in a diff
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DiffLineType {
    /// Line was added
    Addition,
    /// Line was deleted
    Deletion,
    /// Line was modified (context)
    Context,
}

/// Represents a single line in a diff
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    /// Type of change
    pub line_type: DiffLineType,
    /// Line number in old file (None if added)
    pub old_line_number: Option<u32>,
    /// Line number in new file (None if deleted)
    pub new_line_number: Option<u32>,
    /// Content of the line
    pub content: String,
}

/// Represents a hunk in a diff
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunk {
    /// Old file starting line number
    pub old_start: u32,
    /// Old file line count
    pub old_lines: u32,
    /// New file starting line number
    pub new_start: u32,
    /// New file line count
    pub new_lines: u32,
    /// Header text
    pub header: String,
    /// Lines in this hunk
    pub lines: Vec<DiffLine>,
}

/// Represents a file diff
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    /// File path
    pub path: String,
    /// Old file path (if renamed)
    pub old_path: Option<String>,
    /// Status of the file
    pub status: GitFileStatus,
    /// Hunks in the diff
    pub hunks: Vec<DiffHunk>,
    /// Number of lines added
    pub additions: usize,
    /// Number of lines deleted
    pub deletions: usize,
}

/// Represents information about a commit
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct CommitInfo {
    /// Commit hash
    pub hash: String,
    /// Short commit hash
    pub short_hash: String,
    /// Commit message
    pub message: String,
    /// Author name
    pub author_name: String,
    /// Author email
    pub author_email: String,
    /// Timestamp in seconds since epoch
    pub timestamp: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_git_file_status_serialization() {
        // Test that GitFileStatus serializes correctly with camelCase
        let status = GitFileStatus::Modified;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"modified\"");

        let status = GitFileStatus::Untracked;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"untracked\"");

        let status = GitFileStatus::Added;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"added\"");
    }

    #[test]
    fn test_git_file_status_deserialization() {
        // Test that GitFileStatus deserializes correctly from camelCase
        let status: GitFileStatus = serde_json::from_str("\"modified\"").unwrap();
        assert!(matches!(status, GitFileStatus::Modified));

        let status: GitFileStatus = serde_json::from_str("\"deleted\"").unwrap();
        assert!(matches!(status, GitFileStatus::Deleted));

        let status: GitFileStatus = serde_json::from_str("\"conflicted\"").unwrap();
        assert!(matches!(status, GitFileStatus::Conflicted));
    }

    #[test]
    fn test_diff_line_type_variants() {
        // Test DiffLineType serialization
        let addition = DiffLineType::Addition;
        let json = serde_json::to_string(&addition).unwrap();
        assert_eq!(json, "\"addition\"");

        let deletion = DiffLineType::Deletion;
        let json = serde_json::to_string(&deletion).unwrap();
        assert_eq!(json, "\"deletion\"");

        let context = DiffLineType::Context;
        let json = serde_json::to_string(&context).unwrap();
        assert_eq!(json, "\"context\"");
    }

    #[test]
    fn test_file_status_struct() {
        let file_status = FileStatus {
            path: "src/main.rs".to_string(),
            status: GitFileStatus::Modified,
            staged: true,
        };

        let json = serde_json::to_string(&file_status).unwrap();
        assert!(json.contains("\"path\":\"src/main.rs\""));
        assert!(json.contains("\"status\":\"modified\""));
        assert!(json.contains("\"staged\":true"));

        // Test deserialization
        let parsed: FileStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.path, "src/main.rs");
        assert!(matches!(parsed.status, GitFileStatus::Modified));
        assert!(parsed.staged);
    }

    #[test]
    fn test_branch_info_struct() {
        let branch = BranchInfo {
            name: "main".to_string(),
            is_current: true,
            is_head: false,
            upstream: Some("origin/main".to_string()),
            ahead: Some(2),
            behind: Some(0),
        };

        let json = serde_json::to_string(&branch).unwrap();
        assert!(json.contains("\"name\":\"main\""));
        assert!(json.contains("\"isCurrent\":true"));
        assert!(json.contains("\"upstream\":\"origin/main\""));
        assert!(json.contains("\"ahead\":2"));
        assert!(json.contains("\"behind\":0"));
    }

    #[test]
    fn test_git_status_struct() {
        let status = GitStatus {
            branch: Some(BranchInfo {
                name: "feature".to_string(),
                is_current: true,
                is_head: false,
                upstream: None,
                ahead: None,
                behind: None,
            }),
            modified: vec![FileStatus {
                path: "file.rs".to_string(),
                status: GitFileStatus::Modified,
                staged: false,
            }],
            staged: vec![],
            untracked: vec!["new_file.txt".to_string()],
            conflicted: vec![],
            changes_count: 2,
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"changesCount\":2"));
        assert!(json.contains("\"modified\""));
        assert!(json.contains("\"untracked\""));
    }

    #[test]
    fn test_diff_line_struct() {
        let line = DiffLine {
            line_type: DiffLineType::Addition,
            old_line_number: None,
            new_line_number: Some(42),
            content: "+ new line content".to_string(),
        };

        let json = serde_json::to_string(&line).unwrap();
        assert!(json.contains("\"lineType\":\"addition\""));
        assert!(json.contains("\"oldLineNumber\":null"));
        assert!(json.contains("\"newLineNumber\":42"));
        assert!(json.contains("\"content\":\"+"));
    }

    #[test]
    fn test_diff_hunk_struct() {
        let hunk = DiffHunk {
            old_start: 10,
            old_lines: 5,
            new_start: 10,
            new_lines: 7,
            header: "@@ -10,5 +10,7 @@".to_string(),
            lines: vec![
                DiffLine {
                    line_type: DiffLineType::Context,
                    old_line_number: Some(10),
                    new_line_number: Some(10),
                    content: " context line".to_string(),
                },
                DiffLine {
                    line_type: DiffLineType::Addition,
                    old_line_number: None,
                    new_line_number: Some(11),
                    content: "+ added line".to_string(),
                },
            ],
        };

        let json = serde_json::to_string(&hunk).unwrap();
        assert!(json.contains("\"oldStart\":10"));
        assert!(json.contains("\"newLines\":7"));
        assert!(json.contains("\"lines\":["));
    }

    #[test]
    fn test_file_diff_struct() {
        let diff = FileDiff {
            path: "src/lib.rs".to_string(),
            old_path: None,
            status: GitFileStatus::Modified,
            hunks: vec![],
            additions: 10,
            deletions: 5,
        };

        let json = serde_json::to_string(&diff).unwrap();
        assert!(json.contains("\"path\":\"src/lib.rs\""));
        assert!(json.contains("\"oldPath\":null"));
        assert!(json.contains("\"additions\":10"));
        assert!(json.contains("\"deletions\":5"));
    }

    #[test]
    fn test_file_diff_renamed() {
        let diff = FileDiff {
            path: "src/new_name.rs".to_string(),
            old_path: Some("src/old_name.rs".to_string()),
            status: GitFileStatus::Renamed,
            hunks: vec![],
            additions: 0,
            deletions: 0,
        };

        let json = serde_json::to_string(&diff).unwrap();
        assert!(json.contains("\"oldPath\":\"src/old_name.rs\""));
        assert!(json.contains("\"status\":\"renamed\""));
    }

    #[test]
    fn test_commit_info_struct() {
        let commit = CommitInfo {
            hash: "abc123def456".to_string(),
            short_hash: "abc123d".to_string(),
            message: "Initial commit".to_string(),
            author_name: "Test User".to_string(),
            author_email: "test@example.com".to_string(),
            timestamp: 1700000000,
        };

        let json = serde_json::to_string(&commit).unwrap();
        assert!(json.contains("\"hash\":\"abc123def456\""));
        assert!(json.contains("\"shortHash\":\"abc123d\""));
        assert!(json.contains("\"authorName\":\"Test User\""));
        assert!(json.contains("\"authorEmail\":\"test@example.com\""));
        assert!(json.contains("\"timestamp\":1700000000"));
    }
}
