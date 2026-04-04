use crate::constants::{is_code_extension, is_code_filename};
use crate::walker::{WalkerConfig, WorkspaceWalker};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::ffi::OsStr;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSearchResult {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub score: f64,
}

pub struct HighPerformanceFileSearch {
    max_results: usize,
}

impl Default for HighPerformanceFileSearch {
    fn default() -> Self {
        Self { max_results: 200 }
    }
}

impl HighPerformanceFileSearch {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_max_results(mut self, max_results: usize) -> Self {
        self.max_results = max_results;
        self
    }

    /// High-performance file search with fuzzy matching and scoring
    pub fn search_files(
        &self,
        root_path: &str,
        query: &str,
    ) -> Result<Vec<FileSearchResult>, String> {
        if query.trim().is_empty() {
            return Ok(vec![]);
        }

        let keywords = Self::parse_query(query);
        if keywords.is_empty() {
            return Ok(vec![]);
        }

        // Use sequential file collection with unified walker for simplicity and correctness
        let config = WalkerConfig::for_file_search();
        let walker = WorkspaceWalker::new(root_path, config).build();
        let mut results = Vec::new();

        for entry in walker.flatten() {
            // Skip root directory
            if entry.depth() == 0 {
                continue;
            }

            let path = entry.path();

            // Filter files only (not directories for now, but we can include them if needed)
            if !path.is_file() {
                continue;
            }

            // Check if it's a code file
            if !self.is_code_file(path) {
                continue;
            }

            if let Ok(relative_path) = path.strip_prefix(root_path) {
                let relative_path_str = relative_path.to_string_lossy();
                // Normalize path separators to forward slashes for cross-platform search
                let normalized_path = relative_path_str.replace('\\', "/");

                if let Some(search_result) = self.match_path(&normalized_path, path, &keywords) {
                    results.push(search_result);
                    if results.len() >= self.max_results {
                        break;
                    }
                }
            }
        }

        let mut final_results = results;

        // Sort by score (descending) and then by name length (ascending)
        final_results.par_sort_unstable_by(|a, b| {
            let score_cmp = b
                .score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal);
            if score_cmp != std::cmp::Ordering::Equal {
                score_cmp
            } else {
                a.name.len().cmp(&b.name.len())
            }
        });

        final_results.truncate(self.max_results);
        Ok(final_results)
    }

    /// Parse search query into keywords, splitting on spaces and non-alphanumeric chars
    fn parse_query(query: &str) -> Vec<String> {
        query
            .to_lowercase()
            .split_whitespace()
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .collect()
    }

    /// Check if a file is a code file based on extension or filename
    fn is_code_file(&self, path: &Path) -> bool {
        // First, check the complete filename (handles files like .env, .env.local, .gitignore)
        if let Some(filename) = path.file_name().and_then(OsStr::to_str) {
            if is_code_filename(filename) {
                return true;
            }
        }

        // Then check extension for regular files with extensions
        if let Some(ext) = path.extension().and_then(OsStr::to_str) {
            return is_code_extension(ext);
        }

        false
    }

    /// Advanced path matching with scoring
    fn match_path(
        &self,
        relative_path: &str,
        full_path: &Path,
        keywords: &[String],
    ) -> Option<FileSearchResult> {
        let path_lower = relative_path.to_lowercase();
        let filename = full_path
            .file_name()
            .and_then(OsStr::to_str)
            .unwrap_or("")
            .to_string();
        let filename_lower = filename.to_lowercase();

        // Check if all keywords match against the relative path
        if !keywords
            .iter()
            .all(|keyword| self.keyword_matches(&path_lower, keyword))
        {
            return None;
        }

        // Calculate match score
        let score = self.calculate_match_score(&path_lower, &filename_lower, keywords);

        Some(FileSearchResult {
            name: filename,
            path: full_path.to_string_lossy().to_string(),
            is_directory: false,
            score,
        })
    }

    /// Check if a keyword matches using multiple strategies
    fn keyword_matches(&self, text: &str, keyword: &str) -> bool {
        // Direct substring match
        if text.contains(keyword) {
            return true;
        }

        // For keywords starting with dot (hidden files, extensions),
        // only use exact substring match, no fuzzy matching
        if keyword.starts_with('.') {
            return false;
        }

        // Fuzzy match: check if keyword characters appear in order
        self.fuzzy_match(text, keyword)
    }

    /// Fuzzy matching: check if all characters of keyword appear in order in text
    fn fuzzy_match(&self, text: &str, keyword: &str) -> bool {
        let text_chars: Vec<char> = text.chars().collect();
        let keyword_chars: Vec<char> = keyword.chars().collect();

        if keyword_chars.is_empty() {
            return true;
        }

        let mut keyword_idx = 0;

        for &c in &text_chars {
            if keyword_idx < keyword_chars.len() && c == keyword_chars[keyword_idx] {
                keyword_idx += 1;
            }
        }

        keyword_idx == keyword_chars.len()
    }

    /// Calculate match score for ranking results
    fn calculate_match_score(
        &self,
        path_lower: &str,
        filename_lower: &str,
        keywords: &[String],
    ) -> f64 {
        if keywords.is_empty() {
            return 0.0;
        }

        let mut score = 0.0;

        // Base score for matching all keywords
        score += 100.0;

        // Path matches vs Filename matches
        let combined_query = keywords.join("");
        let combined_query_with_sep = keywords.join("/");

        // HIGHEST PRIORITY: Exact filename match
        if filename_lower == combined_query {
            score += 2000.0;
        }

        // HIGH PRIORITY: Filename starts with query
        if filename_lower.starts_with(&combined_query) {
            score += 1000.0;
        }

        // HIGH PRIORITY: Filename contains query
        if filename_lower.contains(&combined_query) {
            score += 500.0;
        }

        // Exact path match (relative)
        if path_lower == combined_query || path_lower == combined_query_with_sep {
            score += 800.0;
        }

        // Path contains query as substring
        if path_lower.contains(&combined_query) {
            score += 300.0;
        }

        // Path contains query with slashes
        if path_lower.contains(&combined_query_with_sep) {
            score += 400.0;
        }

        // Bonus for all keywords in order (even with gaps) in filename
        if self.all_keywords_in_order(filename_lower, keywords) {
            score += 200.0;
        }

        // Bonus for all keywords in order in path
        if self.all_keywords_in_order(path_lower, keywords) {
            score += 100.0;
        }

        // Individual keyword bonuses
        for keyword in keywords {
            // Filename word boundary match
            if self.word_boundary_match(filename_lower, keyword) {
                score += 80.0;
            }
            // Filename substring match
            else if filename_lower.contains(keyword) {
                score += 40.0;
            }

            // Path word boundary match
            if self.word_boundary_match(path_lower, keyword) {
                score += 40.0;
            }
        }

        // Penalty for length (shorter names rank higher)
        score -= path_lower.len() as f64 * 0.1;

        // Bonus for common file types
        if filename_lower.ends_with(".ts")
            || filename_lower.ends_with(".js")
            || filename_lower.ends_with(".tsx")
            || filename_lower.ends_with(".jsx")
        {
            score += 10.0;
        }

        score.max(0.0)
    }

    /// Check if all keywords appear in order in the filename
    fn all_keywords_in_order(&self, filename: &str, keywords: &[String]) -> bool {
        let mut last_index = 0;

        for keyword in keywords {
            if let Some(index) = filename[last_index..].find(keyword) {
                last_index += index + keyword.len();
            } else {
                return false;
            }
        }

        true
    }

    /// Check for word boundary matches
    fn word_boundary_match(&self, filename: &str, keyword: &str) -> bool {
        // Simple word boundary check using common separators
        let separators = ['-', '_', '.', ' ', '/'];

        // Check if keyword appears at start of filename
        if filename.starts_with(keyword) {
            return filename.len() == keyword.len()
                || separators
                    .iter()
                    .any(|&sep| filename.chars().nth(keyword.len()) == Some(sep));
        }

        // Check if keyword appears after a separator
        for (i, window) in filename.char_indices() {
            if separators.contains(&window) {
                let remaining = &filename[i + 1..];
                if remaining.starts_with(keyword) {
                    return remaining.len() == keyword.len()
                        || separators
                            .iter()
                            .any(|&sep| remaining.chars().nth(keyword.len()) == Some(sep));
                }
            }
        }

        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_github_directory_allowed() {
        let temp_dir = TempDir::new().unwrap();

        // Create .github directory structure
        fs::create_dir_all(temp_dir.path().join(".github/workflows")).unwrap();

        // Create a .yml file in .github directory
        let yml_content = r#"
name: CI
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
"#;
        let target_path = temp_dir.path().join(".github/workflows/ci.yml");
        fs::write(&target_path, yml_content).unwrap();

        let search = HighPerformanceFileSearch::new();

        // Search for .yml files
        let results = search
            .search_files(temp_dir.path().to_str().unwrap(), "ci.yml")
            .unwrap();

        // Should find the ci.yml file
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "ci.yml");

        // Check that the file is in .github directory (cross-platform)
        let result_path = std::path::Path::new(&results[0].path);
        let is_in_github = result_path.components().any(|c| c.as_os_str() == ".github");
        assert!(is_in_github, "File should be in .github directory");
    }

    #[test]
    fn test_github_workflow_search() {
        let temp_dir = TempDir::new().unwrap();

        // Create .github directory structure
        fs::create_dir_all(temp_dir.path().join(".github/workflows")).unwrap();

        // Create multiple yml files in .github directory
        fs::write(
            temp_dir.path().join(".github/workflows/release.yml"),
            "name: Release",
        )
        .unwrap();

        fs::write(
            temp_dir.path().join(".github/workflows/test.yml"),
            "name: Test",
        )
        .unwrap();

        let search = HighPerformanceFileSearch::new();

        // Search for .yml files
        let results = search
            .search_files(temp_dir.path().to_str().unwrap(), "yml")
            .unwrap();

        // Should find both .yml files
        assert_eq!(results.len(), 2);
        let names: Vec<&str> = results.iter().map(|r| r.name.as_str()).collect();
        assert!(names.contains(&"release.yml"));
        assert!(names.contains(&"test.yml"));
    }

    #[test]
    fn test_path_based_search() {
        let temp_dir = TempDir::new().unwrap();
        let root = temp_dir.path();

        // Create nested directory structure
        fs::create_dir_all(root.join("docs/api")).unwrap();
        fs::create_dir_all(root.join("src/components")).unwrap();

        fs::write(root.join("docs/package.json"), "{}").unwrap();
        fs::write(root.join("package.json"), "{}").unwrap();
        fs::write(root.join("src/components/button.tsx"), "").unwrap();

        let search = HighPerformanceFileSearch::new();

        // 1. Search for "docs/package.json"
        let results = search
            .search_files(root.to_str().unwrap(), "docs/package.json")
            .unwrap();

        assert!(!results.is_empty(), "Should find docs/package.json");
        assert_eq!(results[0].name, "package.json");
        assert!(
            results[0].path.contains("docs/package.json")
                || results[0].path.contains("docs\\package.json"),
            "First result should be docs/package.json"
        );

        // 2. Search for "comp/butt" (partial path)
        let results = search
            .search_files(root.to_str().unwrap(), "comp/butt")
            .unwrap();
        assert!(!results.is_empty(), "Should find src/components/button.tsx");
        assert_eq!(results[0].name, "button.tsx");

        // 3. Search for "package.json" (should find both, but root one might rank higher depending on length penalty)
        let results = search
            .search_files(root.to_str().unwrap(), "package.json")
            .unwrap();
        assert!(results.len() >= 2);
    }

    #[test]
    fn test_dotfile_search_no_fuzzy_match() {
        let temp_dir = TempDir::new().unwrap();
        let root = temp_dir.path();

        // Create files with and without .env in the name
        fs::write(root.join(".env"), "SECRET=value").unwrap();
        fs::write(root.join(".env.local"), "SECRET=local").unwrap();
        fs::create_dir_all(root.join("src/locales")).unwrap();
        fs::write(root.join("src/locales/sv_SE.js"), "export default {}").unwrap();
        fs::write(root.join("src/locales/lv_LV.js"), "export default {}").unwrap();
        fs::write(root.join("src/environment.ts"), "export const env = {}").unwrap();

        let search = HighPerformanceFileSearch::new();

        // Search for ".env" - should only find files with ".env" substring
        let results = search.search_files(root.to_str().unwrap(), ".env").unwrap();

        // Should only find .env and .env.local, NOT sv_SE.js or lv_LV.js
        assert!(
            results.len() == 2,
            "Should find exactly 2 files (.env and .env.local), found {}: {:?}",
            results.len(),
            results.iter().map(|r| &r.name).collect::<Vec<_>>()
        );

        // Verify all results contain ".env" in the filename
        for result in &results {
            assert!(
                result.name.contains(".env"),
                "Result '{}' should contain '.env'",
                result.name
            );
        }

        // Verify sv_SE.js and lv_LV.js are NOT in results
        let result_names: Vec<&str> = results.iter().map(|r| r.name.as_str()).collect();
        assert!(!result_names.contains(&"sv_SE.js"));
        assert!(!result_names.contains(&"lv_LV.js"));
        assert!(!result_names.contains(&"environment.ts"));
    }
}
