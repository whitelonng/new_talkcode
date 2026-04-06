pub mod diff;
pub mod repository;
pub mod status;
pub mod types;
pub mod worktree;

use types::{CommitLogEntry, DiffLineType, FileDiff, GitFileStatus, GitStatus, RemoteInfo};
use worktree::{MergeResult, SyncResult, WorktreeChanges, WorktreeInfo, WorktreePoolStatus};

/// Gets the Git status for a repository at the given path
#[tauri::command]
pub async fn git_get_status(repo_path: String) -> Result<GitStatus, String> {
    let repo = repository::discover_repository(&repo_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    status::get_repository_status(&repo)
        .map_err(|e| format!("Failed to get repository status: {}", e))
}

/// Checks if a path is a Git repository
#[tauri::command]
pub async fn git_is_repository(repo_path: String) -> Result<bool, String> {
    Ok(repository::is_git_repository(&repo_path))
}

/// Gets all file statuses as a map
#[tauri::command]
pub async fn git_get_all_file_statuses(
    repo_path: String,
) -> Result<std::collections::HashMap<String, (GitFileStatus, bool)>, String> {
    let repo = repository::discover_repository(&repo_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    status::get_all_file_statuses(&repo)
        .map_err(|e| format!("Failed to get all file statuses: {}", e))
}

/// Gets line-level changes for a file (for editor gutter indicators)
#[tauri::command]
pub async fn git_get_line_changes(
    repo_path: String,
    file_path: String,
) -> Result<Vec<(u32, DiffLineType)>, String> {
    let repo = repository::discover_repository(&repo_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    // Convert absolute path to relative path from repo root
    let repo_root = repository::get_repository_root(&repo)
        .ok_or_else(|| "Failed to get repository root".to_string())?;

    let relative_path = if file_path.starts_with(&repo_root) {
        file_path[repo_root.len()..].trim_start_matches('/')
    } else {
        &file_path
    };

    diff::get_line_changes(&repo, relative_path)
        .map_err(|e| format!("Failed to get line changes: {}", e))
}

/// Gets full diff for all changed files in the repository
#[tauri::command]
pub async fn git_get_all_file_diffs(repo_path: String) -> Result<Vec<FileDiff>, String> {
    let repo = repository::discover_repository(&repo_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    let git_status = status::get_repository_status(&repo)
        .map_err(|e| format!("Failed to get repository status: {}", e))?;

    let mut diffs = Vec::new();

    // Collect all file paths from modified and staged files
    for file in git_status.modified.iter().chain(git_status.staged.iter()) {
        if let Ok(file_diff) = diff::get_file_diff(&repo, &file.path) {
            diffs.push(file_diff);
        }
    }

    Ok(diffs)
}

/// Gets raw diff text for all changed files (for AI commit message generation)
/// Returns text similar to `git diff` output
#[tauri::command]
pub async fn git_get_raw_diff_text(repo_path: String) -> Result<String, String> {
    let repo = repository::discover_repository(&repo_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    diff::get_raw_diff_text(&repo).map_err(|e| format!("Failed to get raw diff text: {}", e))
}

// ============================================================================
// Worktree Commands
// ============================================================================

/// Get the default worktree root directory
#[tauri::command]
pub async fn git_get_default_worktree_root() -> Result<String, String> {
    let root = worktree::get_default_worktree_root();
    Ok(root.to_string_lossy().to_string())
}

/// Acquire a worktree from the pool for a task
/// If force is true, will discard any uncommitted changes in existing worktree
#[tauri::command]
pub async fn git_acquire_worktree(
    project_path: String,
    pool_index: u32,
    task_id: String,
    force: Option<bool>,
    worktree_root: Option<String>,
) -> Result<WorktreeInfo, String> {
    worktree::acquire_worktree(
        &project_path,
        pool_index,
        &task_id,
        force.unwrap_or(false),
        worktree_root.as_deref(),
    )
}

/// Release a worktree back to the pool
#[tauri::command]
pub async fn git_release_worktree(project_path: String, pool_index: u32) -> Result<(), String> {
    worktree::release_worktree(&project_path, pool_index)
}

/// Remove a worktree completely from the pool
#[tauri::command]
pub async fn git_remove_worktree(
    project_path: String,
    pool_index: u32,
    worktree_root: Option<String>,
) -> Result<(), String> {
    worktree::remove_worktree(&project_path, pool_index, worktree_root.as_deref())
}

/// List all worktrees in the pool for a project
#[tauri::command]
pub async fn git_list_worktrees(
    project_path: String,
    worktree_root: Option<String>,
) -> Result<WorktreePoolStatus, String> {
    worktree::list_worktrees(&project_path, worktree_root.as_deref())
}

/// Get changes in a worktree
#[tauri::command]
pub async fn git_get_worktree_changes(worktree_path: String) -> Result<WorktreeChanges, String> {
    worktree::get_worktree_changes(&worktree_path)
}

/// Commit all changes in a worktree
#[tauri::command]
pub async fn git_commit_worktree(worktree_path: String, message: String) -> Result<String, String> {
    worktree::commit_worktree(&worktree_path, &message)
}

/// Merge a worktree's changes back to the main branch
#[tauri::command]
pub async fn git_merge_worktree(
    project_path: String,
    pool_index: u32,
    commit_message: Option<String>,
    worktree_root: Option<String>,
) -> Result<MergeResult, String> {
    worktree::merge_worktree_to_main(
        &project_path,
        pool_index,
        commit_message.as_deref(),
        worktree_root.as_deref(),
    )
}

/// Abort an in-progress merge
#[tauri::command]
pub async fn git_abort_merge(project_path: String) -> Result<(), String> {
    worktree::abort_merge(&project_path)
}

/// Continue a merge after conflicts are resolved
#[tauri::command]
pub async fn git_continue_merge(
    project_path: String,
    message: Option<String>,
) -> Result<MergeResult, String> {
    worktree::continue_merge(&project_path, message.as_deref())
}

/// Clean up all worktrees for a project
#[tauri::command]
pub async fn git_cleanup_worktrees(
    project_path: String,
    worktree_root: Option<String>,
) -> Result<(), String> {
    worktree::cleanup_all_worktrees(&project_path, worktree_root.as_deref())
}

/// Sync a worktree with the latest main branch using rebase
#[tauri::command]
pub async fn git_sync_worktree_from_main(
    project_path: String,
    pool_index: u32,
    worktree_root: Option<String>,
) -> Result<SyncResult, String> {
    worktree::sync_worktree_from_main(&project_path, pool_index, worktree_root.as_deref())
}

/// Abort an in-progress rebase in a worktree
#[tauri::command]
pub async fn git_abort_rebase(worktree_path: String) -> Result<(), String> {
    worktree::abort_rebase(&worktree_path)
}

// ============================================================================
// Git Stage / Commit / Push / Pull Commands
// ============================================================================

/// Stage files in a repository (git add)
#[tauri::command]
pub async fn git_stage_files(repo_path: String, files: Vec<String>) -> Result<String, String> {
    let mut cmd = crate::shell_utils::new_command("git");
    cmd.arg("add").args(&files).current_dir(&repo_path);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute git add: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Unstage files in a repository (git reset HEAD)
#[tauri::command]
pub async fn git_unstage_files(repo_path: String, files: Vec<String>) -> Result<String, String> {
    let mut cmd = crate::shell_utils::new_command("git");
    cmd.arg("reset")
        .arg("HEAD")
        .args(&files)
        .current_dir(&repo_path);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute git reset HEAD: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Commit staged changes with a message (git commit -m)
#[tauri::command]
pub async fn git_commit_staged(repo_path: String, message: String) -> Result<String, String> {
    let output = crate::shell_utils::new_command("git")
        .args(["commit", "-m", &message])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git commit: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Push commits to remote (git push)
#[tauri::command]
pub async fn git_push(repo_path: String) -> Result<String, String> {
    let output = crate::shell_utils::new_command("git")
        .arg("push")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git push: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Pull changes from remote (git pull)
#[tauri::command]
pub async fn git_pull(repo_path: String) -> Result<String, String> {
    let output = crate::shell_utils::new_command("git")
        .arg("pull")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git pull: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

// ============================================================================
// Branch Commands
// ============================================================================

/// List all local and remote branches
#[tauri::command]
pub async fn git_list_branches(repo_path: String) -> Result<Vec<types::BranchInfo>, String> {
    let repo = repository::discover_repository(&repo_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut branches = Vec::new();

    // Get current branch name
    let current_branch = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()));

    // List local branches
    let local_branches = repo
        .branches(Some(git2::BranchType::Local))
        .map_err(|e| format!("Failed to list branches: {}", e))?;

    for branch_result in local_branches {
        let (branch, _) = branch_result
            .map_err(|e| format!("Failed to read branch: {}", e))?;

        let name = branch
            .name()
            .map_err(|e| format!("Failed to get branch name: {}", e))?
            .unwrap_or("unknown")
            .to_string();

        let is_current = current_branch.as_deref() == Some(&name);

        let (upstream, ahead, behind) = match branch.upstream() {
            Ok(upstream_branch) => {
                let upstream_name = upstream_branch.name().ok().flatten().map(|s| s.to_string());

                let local_oid = branch.get().target();
                let upstream_oid = upstream_branch.get().target();

                match (local_oid, upstream_oid) {
                    (Some(l), Some(u)) => {
                        match repo.graph_ahead_behind(l, u) {
                            Ok((a, b)) => (upstream_name, Some(a), Some(b)),
                            Err(_) => (upstream_name, None, None),
                        }
                    }
                    _ => (upstream_name, None, None),
                }
            }
            Err(_) => (None, None, None),
        };

        branches.push(types::BranchInfo {
            name,
            is_current,
            is_head: false,
            upstream,
            ahead,
            behind,
        });
    }

    Ok(branches)
}

/// Checkout an existing branch
#[tauri::command]
pub async fn git_checkout_branch(repo_path: String, branch_name: String) -> Result<String, String> {
    let output = crate::shell_utils::new_command("git")
        .args(["checkout", &branch_name])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git checkout: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        // git checkout outputs to stderr on success
        Ok(if stdout.is_empty() { stderr } else { stdout })
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Create a new branch and optionally switch to it
#[tauri::command]
pub async fn git_create_branch(
    repo_path: String,
    branch_name: String,
    checkout: bool,
) -> Result<String, String> {
    let args = if checkout {
        vec!["checkout", "-b", &branch_name]
    } else {
        vec!["branch", &branch_name]
    };

    let output = crate::shell_utils::new_command("git")
        .args(&args)
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git branch: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Ok(if stdout.is_empty() { stderr } else { stdout })
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Delete a local branch
#[tauri::command]
pub async fn git_delete_branch(
    repo_path: String,
    branch_name: String,
    force: bool,
) -> Result<String, String> {
    let flag = if force { "-D" } else { "-d" };

    let output = crate::shell_utils::new_command("git")
        .args(["branch", flag, &branch_name])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git branch delete: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

// ============================================================================
// Remote Commands
// ============================================================================

/// List all configured remotes
#[tauri::command]
pub async fn git_get_remotes(repo_path: String) -> Result<Vec<RemoteInfo>, String> {
    let repo = repository::discover_repository(&repo_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    let remote_names = repo
        .remotes()
        .map_err(|e| format!("Failed to list remotes: {}", e))?;

    let mut remotes = Vec::new();
    for name in remote_names.iter().flatten() {
        if let Ok(remote) = repo.find_remote(name) {
            remotes.push(RemoteInfo {
                name: name.to_string(),
                fetch_url: remote.url().map(|s| s.to_string()),
                push_url: remote.pushurl().map(|s| s.to_string()),
            });
        }
    }

    Ok(remotes)
}

/// Add a new remote
#[tauri::command]
pub async fn git_add_remote(
    repo_path: String,
    name: String,
    url: String,
) -> Result<String, String> {
    let output = crate::shell_utils::new_command("git")
        .args(["remote", "add", &name, &url])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git remote add: {}", e))?;

    if output.status.success() {
        Ok(format!("Remote '{}' added with URL: {}", name, url))
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Remove a remote
#[tauri::command]
pub async fn git_remove_remote(repo_path: String, name: String) -> Result<String, String> {
    let output = crate::shell_utils::new_command("git")
        .args(["remote", "remove", &name])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git remote remove: {}", e))?;

    if output.status.success() {
        Ok(format!("Remote '{}' removed", name))
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

// ============================================================================
// Commit Log Commands
// ============================================================================

/// Get commit log for the repository
#[tauri::command]
pub async fn git_get_commit_log(
    repo_path: String,
    max_count: Option<u32>,
    branch_name: Option<String>,
) -> Result<Vec<CommitLogEntry>, String> {
    let repo = repository::discover_repository(&repo_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    let max = max_count.unwrap_or(50) as usize;

    let mut revwalk = repo
        .revwalk()
        .map_err(|e| format!("Failed to create revwalk: {}", e))?;

    // Push the starting point
    if let Some(ref branch) = branch_name {
        let reference = repo
            .resolve_reference_from_short_name(branch)
            .map_err(|e| format!("Failed to resolve branch '{}': {}", branch, e))?;
        let oid = reference
            .target()
            .ok_or_else(|| format!("Branch '{}' has no target", branch))?;
        revwalk
            .push(oid)
            .map_err(|e| format!("Failed to push oid: {}", e))?;
    } else {
        revwalk
            .push_head()
            .map_err(|e| format!("Failed to push HEAD: {}", e))?;
    }

    revwalk.set_sorting(git2::Sort::TIME)
        .map_err(|e| format!("Failed to set sorting: {}", e))?;

    let mut entries = Vec::new();
    for oid_result in revwalk {
        if entries.len() >= max {
            break;
        }

        let oid = oid_result.map_err(|e| format!("Failed to get oid: {}", e))?;
        let commit = repo
            .find_commit(oid)
            .map_err(|e| format!("Failed to find commit: {}", e))?;

        let message_full = commit.message().unwrap_or("").to_string();
        let mut lines = message_full.lines();
        let first_line = lines.next().unwrap_or("").to_string();
        let body: String = lines.collect::<Vec<_>>().join("\n").trim().to_string();

        let parents: Vec<String> = commit
            .parent_ids()
            .map(|id| id.to_string()[..7].to_string())
            .collect();

        entries.push(CommitLogEntry {
            hash: oid.to_string(),
            short_hash: oid.to_string()[..7].to_string(),
            message: first_line,
            body: if body.is_empty() { None } else { Some(body) },
            author_name: commit.author().name().unwrap_or("Unknown").to_string(),
            author_email: commit.author().email().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
            parents,
        });
    }

    Ok(entries)
}
