use crate::search::RipgrepSearch;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;
use std::time::Instant;
use streaming_iterator::StreamingIterator;
use tauri::{AppHandle, Manager, State};
use tree_sitter::{Language, Parser, Point, Query, QueryCursor, Tree};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolInfo {
    pub name: String,
    pub kind: String,
    pub file_path: String,
    pub lang_family: String, // Language family: c_family, js_family, python, rust, go, java
    pub start_line: u32,
    pub start_column: u32,
    pub end_line: u32,
    pub end_column: u32,
}

#[derive(Default)]
struct SymbolIndex {
    definitions: HashMap<String, Vec<SymbolInfo>>,
    // Reverse index: file_path -> symbol names (for fast clear_file)
    file_definitions: HashMap<String, HashSet<String>>,
}

pub struct CodeNavigationService {
    parsers: HashMap<String, Parser>,
    languages: HashMap<String, Language>,
    queries: HashMap<String, Query>,
    index: SymbolIndex,
}

impl Default for CodeNavigationService {
    fn default() -> Self {
        let mut service = Self {
            parsers: HashMap::new(),
            languages: HashMap::new(),
            queries: HashMap::new(),
            index: SymbolIndex::default(),
        };
        service.init_languages();
        service
    }
}

impl CodeNavigationService {
    pub fn new() -> Self {
        Self::default()
    }

    fn init_languages(&mut self) {
        self.register_language("python", tree_sitter_python::LANGUAGE.into());
        self.register_language("rust", tree_sitter_rust::LANGUAGE.into());
        self.register_language("go", tree_sitter_go::LANGUAGE.into());
        self.register_language("c", tree_sitter_c::LANGUAGE.into());
        self.register_language("cpp", tree_sitter_cpp::LANGUAGE.into());
        self.register_language("java", tree_sitter_java::LANGUAGE.into());

        // TypeScript and JavaScript (using TSX parser which handles both TS and TSX/JSX syntax)
        self.register_language("typescript", tree_sitter_typescript::LANGUAGE_TSX.into());
        self.register_language("javascript", tree_sitter_typescript::LANGUAGE_TSX.into());
    }

    fn register_language(&mut self, lang_id: &str, language: Language) {
        let mut parser = Parser::new();
        if parser.set_language(&language).is_err() {
            log::error!("Failed to set language for {}", lang_id);
            return;
        }

        // Create definition query for this language
        let query_str = Self::get_definition_query(lang_id);
        if !query_str.is_empty() {
            match Query::new(&language, query_str) {
                Ok(query) => {
                    self.queries.insert(lang_id.to_string(), query);
                }
                Err(e) => {
                    log::error!("Failed to create definition query for {}: {:?}", lang_id, e);
                }
            }
        }

        self.parsers.insert(lang_id.to_string(), parser);
        self.languages.insert(lang_id.to_string(), language);
    }

    fn get_definition_query(lang_id: &str) -> &'static str {
        match lang_id {
            "python" => {
                r#"
                (function_definition name: (identifier) @function.definition)
                (class_definition name: (identifier) @class.definition)
                "#
            }
            "rust" => {
                r#"
                (function_item name: (identifier) @function.definition)
                (struct_item name: (type_identifier) @struct.definition)
                (enum_item name: (type_identifier) @enum.definition)
                (trait_item name: (type_identifier) @trait.definition)
                (const_item name: (identifier) @const.definition)
                (static_item name: (identifier) @static.definition)
                (type_item name: (type_identifier) @type.definition)
                "#
            }
            "go" => {
                r#"
                (function_declaration name: (identifier) @function.definition)
                (method_declaration name: (field_identifier) @method.definition)
                (type_declaration (type_spec name: (type_identifier) @type.definition))
                "#
            }
            "c" => {
                r#"
                (function_definition declarator: (function_declarator declarator: (identifier) @function.definition))
                (struct_specifier name: (type_identifier) @struct.definition)
                "#
            }
            "cpp" => {
                r#"
                (function_definition declarator: (function_declarator declarator: (identifier) @function.definition))
                (function_definition declarator: (function_declarator declarator: (qualified_identifier name: (identifier) @function.definition)))
                (struct_specifier name: (type_identifier) @struct.definition)
                (class_specifier name: (type_identifier) @class.definition)
                "#
            }
            "java" => {
                r#"
                (method_declaration name: (identifier) @method.definition)
                (class_declaration name: (identifier) @class.definition)
                (interface_declaration name: (identifier) @interface.definition)
                "#
            }
            "typescript" | "javascript" => {
                r#"
                (function_declaration name: (identifier) @function.definition)
                (export_statement (function_declaration name: (identifier) @function.definition))
                (class_declaration name: (type_identifier) @class.definition)
                (export_statement (class_declaration name: (type_identifier) @class.definition))
                (interface_declaration name: (type_identifier) @interface.definition)
                (export_statement (interface_declaration name: (type_identifier) @interface.definition))
                (type_alias_declaration name: (type_identifier) @type.definition)
                (export_statement (type_alias_declaration name: (type_identifier) @type.definition))
                (enum_declaration name: (identifier) @enum.definition)
                (export_statement (enum_declaration name: (identifier) @enum.definition))
                (method_definition name: (property_identifier) @method.definition)
                (program (lexical_declaration (variable_declarator name: (identifier) @const.definition)))
                (program (export_statement (lexical_declaration (variable_declarator name: (identifier) @const.definition))))
                "#
            }
            _ => "",
        }
    }

    fn get_symbol_kind(capture_name: &str) -> String {
        if capture_name.contains("function") {
            "function".to_string()
        } else if capture_name.contains("class") {
            "class".to_string()
        } else if capture_name.contains("struct") {
            "struct".to_string()
        } else if capture_name.contains("enum") {
            "enum".to_string()
        } else if capture_name.contains("trait") {
            "trait".to_string()
        } else if capture_name.contains("interface") {
            "interface".to_string()
        } else if capture_name.contains("method") {
            "method".to_string()
        } else if capture_name.contains("type") {
            "type".to_string()
        } else if capture_name.contains("const") {
            "const".to_string()
        } else if capture_name.contains("static") {
            "static".to_string()
        } else {
            "symbol".to_string()
        }
    }

    /// Get language family for language isolation
    /// C/C++ share references, TypeScript/JavaScript share references
    /// Other languages are isolated
    pub fn get_lang_family(lang_id: &str) -> &'static str {
        match lang_id {
            "c" | "cpp" => "c_family",
            "typescript" | "javascript" => "js_family",
            "python" => "python",
            "rust" => "rust",
            "go" => "go",
            "java" => "java",
            _ => "unknown",
        }
    }

    pub fn index_file(&mut self, file_path: &str, content: &str, lang_id: &str) {
        let start = Instant::now();

        // First clear existing symbols for this file
        self.clear_file(file_path);

        let parser = match self.parsers.get_mut(lang_id) {
            Some(p) => p,
            None => {
                log::debug!("No parser for language: {}", lang_id);
                return;
            }
        };

        let tree = match parser.parse(content, None) {
            Some(t) => t,
            None => {
                log::error!("Failed to parse file: {}", file_path);
                return;
            }
        };

        let source_bytes = content.as_bytes();
        let lang_family = Self::get_lang_family(lang_id).to_string();

        // Collect definitions only (references are searched on-demand via hybrid search)
        let mut definitions: Vec<SymbolInfo> = Vec::new();
        let mut defined_names: HashSet<String> = HashSet::new();

        if let Some(query) = self.queries.get(lang_id) {
            let mut cursor = QueryCursor::new();
            let mut matches = cursor.matches(query, tree.root_node(), source_bytes);

            while let Some(m) = matches.next() {
                for capture in m.captures {
                    let node = capture.node;
                    let name = match node.utf8_text(source_bytes) {
                        Ok(text) => text.to_string(),
                        Err(_) => continue,
                    };

                    let capture_name = query.capture_names()[capture.index as usize];
                    let kind = Self::get_symbol_kind(capture_name);

                    definitions.push(SymbolInfo {
                        name: name.clone(),
                        kind,
                        file_path: file_path.to_string(),
                        lang_family: lang_family.clone(),
                        start_line: node.start_position().row as u32 + 1,
                        start_column: node.start_position().column as u32 + 1,
                        end_line: node.end_position().row as u32 + 1,
                        end_column: node.end_position().column as u32 + 1,
                    });
                    defined_names.insert(name);
                }
            }
        }

        // Add definitions to index and always track file as indexed
        // This ensures files like test files are marked as "indexed" even with 0 definitions
        let def_count = definitions.len();
        self.index
            .file_definitions
            .insert(file_path.to_string(), defined_names);
        for symbol in definitions {
            self.index
                .definitions
                .entry(symbol.name.clone())
                .or_default()
                .push(symbol);
        }

        let duration = start.elapsed();
        log::debug!(
            "Indexed {} ({} definitions) in {:.2}ms",
            file_path,
            def_count,
            duration.as_secs_f64() * 1000.0
        );
    }

    pub fn find_definition(&self, symbol_name: &str, lang_family: &str) -> Vec<SymbolInfo> {
        self.index
            .definitions
            .get(symbol_name)
            .map(|symbols| {
                symbols
                    .iter()
                    .filter(|s| s.lang_family == lang_family)
                    .cloned()
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Hybrid reference search: text search + tree-sitter filtering
    /// This approach finds all text occurrences using ripgrep, then filters
    /// using tree-sitter to exclude non-references (strings, comments, property names, etc.)
    pub fn find_references_hybrid(
        &self,
        symbol_name: &str,
        lang_family: &str,
        root_path: &str,
    ) -> Vec<SymbolInfo> {
        let start = Instant::now();

        // 1. Use ripgrep for global text search with word boundary
        let searcher = RipgrepSearch::new()
            .with_max_results(500)
            .with_max_matches_per_file(100);

        // Use word boundary pattern to avoid partial matches
        let pattern = format!(r"\b{}\b", regex::escape(symbol_name));
        let search_results = match searcher.search_content(&pattern, root_path) {
            Ok(results) => results,
            Err(e) => {
                log::error!("Ripgrep search failed: {}", e);
                return Vec::new();
            }
        };

        log::debug!(
            "Ripgrep found {} files with matches for '{}'",
            search_results.len(),
            symbol_name
        );

        // 2. For each result, validate using tree-sitter
        let mut references: Vec<SymbolInfo> = Vec::new();

        for result in search_results {
            // Get language ID from file extension
            let lang_id = match Self::get_lang_id_from_path(&result.file_path) {
                Some(id) => id,
                None => continue,
            };

            // Check if this file belongs to the requested language family
            if Self::get_lang_family(&lang_id) != lang_family {
                continue;
            }

            // Read file content
            let content = match fs::read_to_string(&result.file_path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            // Get language and create parser
            let language: Language = match lang_id.as_str() {
                "python" => tree_sitter_python::LANGUAGE.into(),
                "rust" => tree_sitter_rust::LANGUAGE.into(),
                "go" => tree_sitter_go::LANGUAGE.into(),
                "c" => tree_sitter_c::LANGUAGE.into(),
                "cpp" => tree_sitter_cpp::LANGUAGE.into(),
                "java" => tree_sitter_java::LANGUAGE.into(),
                "typescript" | "javascript" => tree_sitter_typescript::LANGUAGE_TSX.into(),
                _ => continue,
            };

            let mut parser = Parser::new();
            if parser.set_language(&language).is_err() {
                continue;
            }

            let tree = match parser.parse(&content, None) {
                Some(t) => t,
                None => continue,
            };

            let source_bytes = content.as_bytes();

            // Validate each match
            for m in &result.matches {
                let validated = Self::validate_reference_at_line(
                    &tree,
                    source_bytes,
                    m.line_number,
                    symbol_name,
                    &lang_id,
                    &result.file_path,
                    lang_family,
                );
                references.extend(validated);
            }
        }

        let duration = start.elapsed();
        log::debug!(
            "find_references_hybrid for '{}' found {} references in {:.2}ms",
            symbol_name,
            references.len(),
            duration.as_secs_f64() * 1000.0
        );

        references
    }

    /// Get language ID from file path based on extension
    fn get_lang_id_from_path(file_path: &str) -> Option<String> {
        let ext = file_path.rsplit('.').next()?;
        match ext.to_lowercase().as_str() {
            "py" => Some("python".to_string()),
            "rs" => Some("rust".to_string()),
            "go" => Some("go".to_string()),
            "c" | "h" => Some("c".to_string()),
            "cpp" | "cc" | "cxx" | "hpp" | "hxx" => Some("cpp".to_string()),
            "java" => Some("java".to_string()),
            "ts" | "tsx" => Some("typescript".to_string()),
            "js" | "jsx" | "mjs" | "cjs" => Some("javascript".to_string()),
            _ => None,
        }
    }

    /// Validate references at a specific line number
    fn validate_reference_at_line(
        tree: &Tree,
        source: &[u8],
        line_number: u64,
        symbol_name: &str,
        lang_id: &str,
        file_path: &str,
        lang_family: &str,
    ) -> Vec<SymbolInfo> {
        let mut results = Vec::new();

        // Get line start byte offset
        let line_idx = (line_number - 1) as usize;
        let mut line_start = 0;
        let mut current_line = 0;

        for (i, byte) in source.iter().enumerate() {
            if current_line == line_idx {
                line_start = i;
                break;
            }
            if *byte == b'\n' {
                current_line += 1;
            }
        }

        // Get line content
        let line_end = source[line_start..]
            .iter()
            .position(|&b| b == b'\n')
            .map(|pos| line_start + pos)
            .unwrap_or(source.len());

        let line_content = match std::str::from_utf8(&source[line_start..line_end]) {
            Ok(s) => s,
            Err(_) => return results,
        };

        // Find all occurrences of symbol_name in this line
        for (col, _) in line_content.match_indices(symbol_name) {
            // Check word boundaries
            let before_ok = col == 0
                || !line_content.as_bytes()[col - 1].is_ascii_alphanumeric()
                    && line_content.as_bytes()[col - 1] != b'_';

            let after_idx = col + symbol_name.len();
            let after_ok = after_idx >= line_content.len()
                || !line_content.as_bytes()[after_idx].is_ascii_alphanumeric()
                    && line_content.as_bytes()[after_idx] != b'_';

            if !before_ok || !after_ok {
                continue;
            }

            // Get AST node at this position
            let point = Point::new(line_idx, col);
            let node = tree.root_node().descendant_for_point_range(point, point);

            if let Some(node) = node {
                if Self::is_valid_reference_node(&node, symbol_name, source, lang_id) {
                    results.push(SymbolInfo {
                        name: symbol_name.to_string(),
                        kind: "reference".to_string(),
                        file_path: file_path.to_string(),
                        lang_family: lang_family.to_string(),
                        start_line: line_number as u32,
                        start_column: (col + 1) as u32,
                        end_line: line_number as u32,
                        end_column: (col + 1 + symbol_name.len()) as u32,
                    });
                }
            }
        }

        results
    }

    /// Check if a tree-sitter node represents a valid reference
    /// Filters out strings, comments, property names, object keys, etc.
    fn is_valid_reference_node(
        node: &tree_sitter::Node,
        symbol_name: &str,
        source: &[u8],
        lang_id: &str,
    ) -> bool {
        // 1. Node text must exactly match the symbol name
        let node_text = match node.utf8_text(source) {
            Ok(text) => text,
            Err(_) => return false,
        };
        if node_text != symbol_name {
            return false;
        }

        // 2. Must be an identifier or type_identifier
        let node_kind = node.kind();
        let valid_kinds = match lang_id {
            "typescript" | "javascript" => {
                &["identifier", "type_identifier", "property_identifier"][..]
            }
            "go" => &["identifier", "type_identifier", "field_identifier"][..],
            _ => &["identifier", "type_identifier"][..],
        };
        if !valid_kinds.contains(&node_kind) {
            return false;
        }

        // 3. Exclude if inside string or comment (check ancestors)
        let mut parent = node.parent();
        while let Some(p) = parent {
            let kind = p.kind();
            // String literals
            if kind == "string"
                || kind == "template_string"
                || kind == "string_literal"
                || kind == "string_content"
                || kind == "interpreted_string_literal"
                || kind == "raw_string_literal"
            {
                return false;
            }
            // Comments
            if kind == "comment" || kind == "line_comment" || kind == "block_comment" {
                return false;
            }
            parent = p.parent();
        }

        // 4. Exclude property access property name (obj.prop - exclude prop)
        if let Some(p) = node.parent() {
            let parent_kind = p.kind();

            // TypeScript/JavaScript member_expression
            if parent_kind == "member_expression" {
                if let Some(prop) = p.child_by_field_name("property") {
                    if prop.id() == node.id() {
                        return false;
                    }
                }
            }

            // Python attribute
            if parent_kind == "attribute" && lang_id == "python" {
                if let Some(attr) = p.child_by_field_name("attribute") {
                    if attr.id() == node.id() {
                        return false;
                    }
                }
            }

            // Rust field_expression
            if parent_kind == "field_expression" && lang_id == "rust" {
                if let Some(field) = p.child_by_field_name("field") {
                    if field.id() == node.id() {
                        return false;
                    }
                }
            }

            // Go selector_expression
            if parent_kind == "selector_expression" && lang_id == "go" {
                if let Some(field) = p.child_by_field_name("field") {
                    if field.id() == node.id() {
                        return false;
                    }
                }
            }

            // Java/C++/C field_access
            if parent_kind == "field_access" {
                if let Some(field) = p.child_by_field_name("field") {
                    if field.id() == node.id() {
                        return false;
                    }
                }
            }
        }

        // 5. Exclude object literal keys ({ key: value } - exclude key)
        if let Some(p) = node.parent() {
            let parent_kind = p.kind();

            // TypeScript/JavaScript pair
            if parent_kind == "pair" {
                if let Some(key) = p.child_by_field_name("key") {
                    if key.id() == node.id() {
                        return false;
                    }
                }
            }

            // Shorthand property identifier (e.g., { config } in object literal)
            if parent_kind == "shorthand_property_identifier" {
                return false;
            }

            // Python dict pair
            if parent_kind == "pair" && lang_id == "python" {
                if let Some(key) = p.child_by_field_name("key") {
                    if key.id() == node.id() {
                        return false;
                    }
                }
            }

            // Go keyed_element
            if parent_kind == "keyed_element" && lang_id == "go" {
                // First child is the key
                if let Some(key) = p.child(0) {
                    if key.id() == node.id() {
                        return false;
                    }
                }
            }

            // Rust field_initializer
            if parent_kind == "field_initializer" && lang_id == "rust" {
                if let Some(name) = p.child_by_field_name("name") {
                    if name.id() == node.id() {
                        return false;
                    }
                }
            }
        }

        // 6. Exclude import specifier names (import { name } from ...)
        if let Some(p) = node.parent() {
            if p.kind() == "import_specifier" {
                // For renamed imports: import { original as renamed }
                // We want to exclude 'original' but keep 'renamed'
                if let Some(name) = p.child_by_field_name("name") {
                    if name.id() == node.id() {
                        return false;
                    }
                }
            }
        }

        true
    }

    pub fn clear_file(&mut self, file_path: &str) {
        // Use reverse index for O(file_symbols) instead of O(total_symbols)
        if let Some(def_names) = self.index.file_definitions.remove(file_path) {
            for name in def_names {
                if let Some(symbols) = self.index.definitions.get_mut(&name) {
                    symbols.retain(|s| s.file_path != file_path);
                    if symbols.is_empty() {
                        self.index.definitions.remove(&name);
                    }
                }
            }
        }
    }

    pub fn clear_all(&mut self) {
        self.index.definitions.clear();
        self.index.file_definitions.clear();
    }
}

// Tauri state wrapper using RwLock for better read concurrency
pub struct CodeNavState(pub RwLock<CodeNavigationService>);

// Tauri commands
#[tauri::command]
pub async fn code_nav_index_file(
    state: State<'_, CodeNavState>,
    file_path: String,
    content: String,
    lang_id: String,
) -> Result<(), String> {
    let mut service = state
        .0
        .write()
        .map_err(|e| format!("Failed to acquire write lock: {}", e))?;
    service.index_file(&file_path, &content, &lang_id);
    Ok(())
}

#[tauri::command]
pub async fn code_nav_find_definition(
    state: State<'_, CodeNavState>,
    symbol_name: String,
    lang_family: String,
) -> Result<Vec<SymbolInfo>, String> {
    let service = state
        .0
        .read()
        .map_err(|e| format!("Failed to acquire read lock: {}", e))?;
    Ok(service.find_definition(&symbol_name, &lang_family))
}

#[tauri::command]
pub async fn code_nav_find_references_hybrid(
    state: State<'_, CodeNavState>,
    symbol_name: String,
    lang_family: String,
    root_path: String,
) -> Result<Vec<SymbolInfo>, String> {
    let service = state
        .0
        .read()
        .map_err(|e| format!("Failed to acquire read lock: {}", e))?;
    Ok(service.find_references_hybrid(&symbol_name, &lang_family, &root_path))
}

#[tauri::command]
pub async fn code_nav_clear_file(
    state: State<'_, CodeNavState>,
    file_path: String,
) -> Result<(), String> {
    let mut service = state
        .0
        .write()
        .map_err(|e| format!("Failed to acquire write lock: {}", e))?;
    service.clear_file(&file_path);
    Ok(())
}

#[tauri::command]
pub async fn code_nav_clear_all(state: State<'_, CodeNavState>) -> Result<(), String> {
    let mut service = state
        .0
        .write()
        .map_err(|e| format!("Failed to acquire write lock: {}", e))?;
    service.clear_all();
    Ok(())
}

/// Batch index multiple files in parallel (definitions only)
/// References are searched on-demand via hybrid search
#[tauri::command]
pub async fn code_nav_index_files_batch(
    state: State<'_, CodeNavState>,
    files: Vec<(String, String, String)>, // (file_path, content, lang_id)
) -> Result<(), String> {
    let start = Instant::now();

    // Log files being indexed for debugging
    for (file_path, _, lang_id) in &files {
        log::debug!("Batch indexing file: {} (lang: {})", file_path, lang_id);
    }

    // Parallel extraction of definitions
    let def_results: Vec<(Vec<SymbolInfo>, HashSet<String>, String)> = files
        .par_iter()
        .filter_map(|(file_path, content, lang_id)| {
            let language: Language = match lang_id.as_str() {
                "python" => tree_sitter_python::LANGUAGE.into(),
                "rust" => tree_sitter_rust::LANGUAGE.into(),
                "go" => tree_sitter_go::LANGUAGE.into(),
                "c" => tree_sitter_c::LANGUAGE.into(),
                "cpp" => tree_sitter_cpp::LANGUAGE.into(),
                "java" => tree_sitter_java::LANGUAGE.into(),
                "typescript" | "javascript" => tree_sitter_typescript::LANGUAGE_TSX.into(),
                _ => {
                    log::warn!(
                        "Unsupported language for indexing: {} (file: {})",
                        lang_id,
                        file_path
                    );
                    return None;
                }
            };

            let mut parser = Parser::new();
            if parser.set_language(&language).is_err() {
                log::error!(
                    "Failed to set language for parser: {} (file: {})",
                    lang_id,
                    file_path
                );
                return None;
            }

            let tree = match parser.parse(content, None) {
                Some(t) => t,
                None => {
                    log::error!("Failed to parse file: {}", file_path);
                    return None;
                }
            };
            let source_bytes = content.as_bytes();
            let lang_family = CodeNavigationService::get_lang_family(lang_id).to_string();

            let def_query_str = CodeNavigationService::get_definition_query(lang_id);
            let def_query = match Query::new(&language, def_query_str) {
                Ok(q) => q,
                Err(e) => {
                    log::error!("Failed to create query for {}: {:?}", file_path, e);
                    return None;
                }
            };

            let mut definitions = Vec::new();
            let mut defined_names = HashSet::new();
            {
                let mut cursor = QueryCursor::new();
                let mut matches = cursor.matches(&def_query, tree.root_node(), source_bytes);
                while let Some(m) = matches.next() {
                    for capture in m.captures {
                        let node = capture.node;
                        // Use continue instead of ? to avoid skipping the entire file on one bad capture
                        let name = match node.utf8_text(source_bytes) {
                            Ok(text) => text.to_string(),
                            Err(_) => continue,
                        };
                        let capture_name = def_query.capture_names()[capture.index as usize];
                        let kind = CodeNavigationService::get_symbol_kind(capture_name);

                        definitions.push(SymbolInfo {
                            name: name.clone(),
                            kind,
                            file_path: file_path.clone(),
                            lang_family: lang_family.clone(),
                            start_line: node.start_position().row as u32 + 1,
                            start_column: node.start_position().column as u32 + 1,
                            end_line: node.end_position().row as u32 + 1,
                            end_column: node.end_position().column as u32 + 1,
                        });
                        defined_names.insert(name);
                    }
                }
            }

            log::debug!(
                "File {} parsed with {} definitions",
                file_path,
                definitions.len()
            );
            Some((definitions, defined_names, file_path.clone()))
        })
        .collect();

    // Merge definitions into the index
    let mut service = state
        .0
        .write()
        .map_err(|e| format!("Failed to acquire write lock: {}", e))?;

    let mut total_defs = 0;

    // Clear files and add definitions
    for (definitions, defined_names, file_path) in &def_results {
        service.clear_file(file_path);
        total_defs += definitions.len();

        // Always track successfully parsed files, even if they have no definitions
        // This ensures files like test files are marked as "indexed"
        service
            .index
            .file_definitions
            .insert(file_path.clone(), defined_names.clone());

        for symbol in definitions {
            service
                .index
                .definitions
                .entry(symbol.name.clone())
                .or_default()
                .push(symbol.clone());
        }
    }

    let duration = start.elapsed();
    log::info!(
        "Batch indexed {} files ({} successfully parsed, {} definitions) in {:.2}ms",
        files.len(),
        def_results.len(),
        total_defs,
        duration.as_secs_f64() * 1000.0
    );

    Ok(())
}

// ============================================================================
// Index Persistence
// ============================================================================

/// Current version of the persisted index format
/// Version 2: Removed reference indexing (references are now searched on-demand via hybrid search)
const INDEX_VERSION: u32 = 2;

/// Persisted index data structure (definitions only, references are searched on-demand)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedIndex {
    pub version: u32,
    pub root_path: String,
    pub last_updated: i64,
    pub file_timestamps: HashMap<String, i64>,
    pub definitions: HashMap<String, Vec<SymbolInfo>>,
    pub file_definitions: HashMap<String, HashSet<String>>,
}

/// Metadata about a persisted index (for quick checks without loading full index)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexMetadata {
    pub version: u32,
    pub root_path: String,
    pub last_updated: i64,
    pub file_count: usize,
    pub definition_count: usize,
    // Note: reference_count removed since references are now searched on-demand
    pub file_timestamps: HashMap<String, i64>,
}

/// Generate a hash for the project path to use as filename
fn get_project_hash(root_path: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(root_path.as_bytes());
    let result = hasher.finalize();
    // Use first 16 hex characters
    hex::encode(&result[..8])
}

/// Get the index directory path
fn get_index_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    Ok(app_data_dir.join("code-index"))
}

/// Get the index file path for a project
fn get_index_path(app_handle: &AppHandle, root_path: &str) -> Result<PathBuf, String> {
    let index_dir = get_index_dir(app_handle)?;
    let hash = get_project_hash(root_path);
    Ok(index_dir.join(format!("{}.json", hash)))
}

/// Save the current index to disk
#[tauri::command]
pub async fn code_nav_save_index(
    app_handle: AppHandle,
    state: State<'_, CodeNavState>,
    root_path: String,
    file_timestamps: HashMap<String, i64>,
) -> Result<(), String> {
    let start = Instant::now();

    let service = state
        .0
        .read()
        .map_err(|e| format!("Failed to acquire read lock: {}", e))?;

    let persisted = PersistedIndex {
        version: INDEX_VERSION,
        root_path: root_path.clone(),
        last_updated: chrono::Utc::now().timestamp(),
        file_timestamps,
        definitions: service.index.definitions.clone(),
        file_definitions: service.index.file_definitions.clone(),
    };

    // Release the lock before doing I/O
    drop(service);

    // Ensure index directory exists
    let index_dir = get_index_dir(&app_handle)?;
    fs::create_dir_all(&index_dir)
        .map_err(|e| format!("Failed to create index directory: {}", e))?;

    // Serialize and write to file
    let index_path = get_index_path(&app_handle, &root_path)?;
    let json = serde_json::to_string(&persisted)
        .map_err(|e| format!("Failed to serialize index: {}", e))?;
    fs::write(&index_path, json).map_err(|e| format!("Failed to write index file: {}", e))?;

    let duration = start.elapsed();
    log::info!(
        "Saved index for {} ({} definitions) in {:.2}ms",
        root_path,
        persisted
            .definitions
            .values()
            .map(|v| v.len())
            .sum::<usize>(),
        duration.as_secs_f64() * 1000.0
    );

    Ok(())
}

/// Load a persisted index from disk
#[tauri::command]
pub async fn code_nav_load_index(
    app_handle: AppHandle,
    state: State<'_, CodeNavState>,
    root_path: String,
) -> Result<bool, String> {
    let start = Instant::now();

    let index_path = get_index_path(&app_handle, &root_path)?;

    if !index_path.exists() {
        log::info!("No persisted index found for {}", root_path);
        return Ok(false);
    }

    // Read and deserialize
    let json =
        fs::read_to_string(&index_path).map_err(|e| format!("Failed to read index file: {}", e))?;
    let persisted: PersistedIndex =
        serde_json::from_str(&json).map_err(|e| format!("Failed to deserialize index: {}", e))?;

    // Check version compatibility
    if persisted.version != INDEX_VERSION {
        log::warn!(
            "Index version mismatch: expected {}, got {}. Rebuilding index.",
            INDEX_VERSION,
            persisted.version
        );
        // Delete outdated index file
        let _ = fs::remove_file(&index_path);
        return Ok(false);
    }

    // Verify root path matches
    if persisted.root_path != root_path {
        log::warn!("Index root path mismatch. Rebuilding index.");
        return Ok(false);
    }

    // Load into service
    let mut service = state
        .0
        .write()
        .map_err(|e| format!("Failed to acquire write lock: {}", e))?;

    service.clear_all();
    service.index.definitions = persisted.definitions;
    service.index.file_definitions = persisted.file_definitions;

    let duration = start.elapsed();
    log::info!(
        "Loaded index for {} ({} definitions) in {:.2}ms",
        root_path,
        service
            .index
            .definitions
            .values()
            .map(|v| v.len())
            .sum::<usize>(),
        duration.as_secs_f64() * 1000.0
    );

    Ok(true)
}

/// Get metadata about a persisted index without loading it
#[tauri::command]
pub async fn code_nav_get_index_metadata(
    app_handle: AppHandle,
    root_path: String,
) -> Result<Option<IndexMetadata>, String> {
    let index_path = get_index_path(&app_handle, &root_path)?;

    if !index_path.exists() {
        return Ok(None);
    }

    // Read and deserialize
    let json =
        fs::read_to_string(&index_path).map_err(|e| format!("Failed to read index file: {}", e))?;
    let persisted: PersistedIndex =
        serde_json::from_str(&json).map_err(|e| format!("Failed to deserialize index: {}", e))?;

    // Check version compatibility
    if persisted.version != INDEX_VERSION {
        return Ok(None);
    }

    Ok(Some(IndexMetadata {
        version: persisted.version,
        root_path: persisted.root_path,
        last_updated: persisted.last_updated,
        file_count: persisted.file_definitions.len(),
        definition_count: persisted.definitions.values().map(|v| v.len()).sum(),
        file_timestamps: persisted.file_timestamps,
    }))
}

/// Delete a persisted index
#[tauri::command]
pub async fn code_nav_delete_index(app_handle: AppHandle, root_path: String) -> Result<(), String> {
    let index_path = get_index_path(&app_handle, &root_path)?;

    if index_path.exists() {
        fs::remove_file(&index_path).map_err(|e| format!("Failed to delete index file: {}", e))?;
        log::info!("Deleted index for {}", root_path);
    }

    Ok(())
}

/// Get list of indexed files from the current in-memory index
#[tauri::command]
pub async fn code_nav_get_indexed_files(
    state: State<'_, CodeNavState>,
) -> Result<Vec<String>, String> {
    let service = state
        .0
        .read()
        .map_err(|e| format!("Failed to acquire read lock: {}", e))?;

    Ok(service.index.file_definitions.keys().cloned().collect())
}

// ============================================================================
// Code Summarization for Message Compaction
// ============================================================================

/// Result of code summarization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeSummary {
    pub success: bool,
    pub summary: String,
    pub original_lines: usize,
    pub lang_id: String,
}

/// Summarize code content using tree-sitter to extract only signatures and key definitions.
/// This is used for message compaction to reduce token usage while preserving semantic information.
///
/// The summary includes:
/// - Function/method signatures with their doc comments
/// - Class/struct/interface/enum definitions (fields only, not method bodies)
/// - Type aliases
/// - Top-level constants
#[tauri::command]
pub async fn summarize_code_content(
    content: String,
    lang_id: String,
    file_path: String,
) -> Result<CodeSummary, String> {
    let original_lines = content.lines().count();

    // Get language, return unsupported error if language is not recognized
    let language: Language = match lang_id.as_str() {
        "python" => tree_sitter_python::LANGUAGE.into(),
        "rust" => tree_sitter_rust::LANGUAGE.into(),
        "go" => tree_sitter_go::LANGUAGE.into(),
        "c" => tree_sitter_c::LANGUAGE.into(),
        "cpp" => tree_sitter_cpp::LANGUAGE.into(),
        "java" => tree_sitter_java::LANGUAGE.into(),
        "typescript" | "javascript" | "tsx" | "jsx" => tree_sitter_typescript::LANGUAGE_TSX.into(),
        _ => {
            return Ok(CodeSummary {
                success: false,
                summary: content, // Return original for unsupported languages
                original_lines,
                lang_id,
            });
        }
    };

    let mut parser = Parser::new();
    if parser.set_language(&language).is_err() {
        return Err(format!("Failed to set language for {}", lang_id));
    }

    let tree = match parser.parse(&content, None) {
        Some(t) => t,
        None => return Err(format!("Failed to parse file: {}", file_path)),
    };

    let source_bytes = content.as_bytes();

    // Get the summarization query for this language
    let query_str = get_summarization_query(&lang_id);
    if query_str.is_empty() {
        return Ok(CodeSummary {
            success: false,
            summary: content,
            original_lines,
            lang_id,
        });
    }

    let query = match Query::new(&language, query_str) {
        Ok(q) => q,
        Err(e) => return Err(format!("Failed to create summarization query: {:?}", e)),
    };

    // Collect all captured ranges with their types
    let mut captures: Vec<CapturedSymbol> = Vec::new();
    let mut cursor = QueryCursor::new();
    let mut matches = cursor.matches(&query, tree.root_node(), source_bytes);

    while let Some(m) = matches.next() {
        for capture in m.captures {
            let node = capture.node;
            let capture_name = query.capture_names()[capture.index as usize];

            // Get the full node text (for definitions, this includes the whole signature)
            let text = match node.utf8_text(source_bytes) {
                Ok(t) => t.to_string(),
                Err(_) => continue,
            };

            captures.push(CapturedSymbol {
                kind: capture_name.to_string(),
                text,
                start_line: node.start_position().row,
                start_byte: node.start_byte(),
            });
        }
    }

    // Sort by start position
    captures.sort_by_key(|c| c.start_byte);

    // Build summary from captures
    let summary = build_summary(&content, &captures, &lang_id, original_lines);

    Ok(CodeSummary {
        success: true,
        summary,
        original_lines,
        lang_id,
    })
}

#[derive(Debug)]
struct CapturedSymbol {
    kind: String,
    text: String,
    start_line: usize,
    start_byte: usize,
}

/// Get tree-sitter query for extracting code signatures and definitions
fn get_summarization_query(lang_id: &str) -> &'static str {
    match lang_id {
        "typescript" | "javascript" | "tsx" | "jsx" => {
            r#"
            ; Function declarations (capture full signature)
            (function_declaration) @function

            ; Arrow functions with const (top-level only)
            (program (lexical_declaration
              (variable_declarator
                name: (identifier)
                value: (arrow_function)))) @arrow_function

            ; Exported arrow functions
            (program (export_statement
              (lexical_declaration
                (variable_declarator
                  name: (identifier)
                  value: (arrow_function))))) @arrow_function

            ; Class declarations
            (class_declaration) @class

            ; Interface declarations
            (interface_declaration) @interface

            ; Type alias declarations
            (type_alias_declaration) @type_alias

            ; Enum declarations
            (enum_declaration) @enum

            ; Top-level const declarations (non-function)
            (program (lexical_declaration) @const_decl)

            ; Exported const declarations
            (program (export_statement (lexical_declaration)) @const_decl)
            "#
        }
        "python" => {
            r#"
            ; Function definitions
            (function_definition) @function

            ; Class definitions
            (class_definition) @class

            ; Top-level assignments (constants)
            (module (expression_statement (assignment))) @assignment
            "#
        }
        "rust" => {
            r#"
            ; Function definitions
            (function_item) @function

            ; Struct definitions
            (struct_item) @struct

            ; Enum definitions
            (enum_item) @enum

            ; Trait definitions
            (trait_item) @trait

            ; Impl blocks
            (impl_item) @impl

            ; Type aliases
            (type_item) @type_alias

            ; Const items
            (const_item) @const

            ; Static items
            (static_item) @static
            "#
        }
        "go" => {
            r#"
            ; Function declarations
            (function_declaration) @function

            ; Method declarations
            (method_declaration) @method

            ; Type declarations
            (type_declaration) @type_decl

            ; Const declarations
            (const_declaration) @const

            ; Var declarations
            (var_declaration) @var
            "#
        }
        "java" => {
            r#"
            ; Class declarations
            (class_declaration) @class

            ; Interface declarations
            (interface_declaration) @interface

            ; Enum declarations
            (enum_declaration) @enum

            ; Method declarations (within class body)
            (method_declaration) @method

            ; Field declarations
            (field_declaration) @field
            "#
        }
        "c" | "cpp" => {
            r#"
            ; Function definitions
            (function_definition) @function

            ; Struct specifiers
            (struct_specifier) @struct

            ; Class specifiers (C++)
            (class_specifier) @class

            ; Enum specifiers
            (enum_specifier) @enum

            ; Type definitions
            (type_definition) @typedef
            "#
        }
        _ => "",
    }
}

/// Build a human-readable summary from captured symbols
fn build_summary(
    content: &str,
    captures: &[CapturedSymbol],
    lang_id: &str,
    original_lines: usize,
) -> String {
    let mut result = format!(
        "[COMPRESSED: Original {} lines → Summarized using tree-sitter]\n\n",
        original_lines
    );

    let lines: Vec<&str> = content.lines().collect();

    for capture in captures {
        // Get the captured text
        let text = &capture.text;

        // For function/method bodies, we want to show only the signature
        let summarized = match capture.kind.as_str() {
            "function" | "method" | "arrow_function" => extract_function_signature(text, lang_id),
            "class" => extract_class_summary(text, lang_id),
            "impl" => extract_impl_summary(text),
            "interface" | "type_alias" | "enum" | "struct" | "trait" | "type_decl" => {
                // For types, keep as-is (they're usually not too long)
                // But limit to reasonable size
                limit_text(text, 30)
            }
            "const" | "static" | "const_decl" | "var" | "field" | "assignment" | "typedef" => {
                // For constants, keep the first line
                text.lines().next().unwrap_or(text).to_string()
            }
            _ => text.clone(),
        };

        // Add doc comment if available (look at lines before start_line)
        let doc_comment = extract_doc_comment(&lines, capture.start_line, lang_id);
        if !doc_comment.is_empty() {
            result.push_str(&doc_comment);
            result.push('\n');
        }

        result.push_str(&summarized);
        result.push_str("\n\n");
    }

    result.trim_end().to_string()
}

/// Extract function signature without body
fn extract_function_signature(text: &str, lang_id: &str) -> String {
    match lang_id {
        "typescript" | "javascript" | "tsx" | "jsx" => {
            // Find the opening brace and truncate
            if let Some(pos) = text.find('{') {
                let sig = text[..pos].trim();
                format!("{} {{ ... }}", sig)
            } else if let Some(pos) = text.find("=>") {
                // Arrow function
                let sig = text[..pos + 2].trim();
                format!("{} {{ ... }}", sig)
            } else {
                text.lines().next().unwrap_or(text).to_string()
            }
        }
        "python" => {
            // Find the colon and truncate
            if let Some(pos) = text.find(':') {
                let sig = text[..pos + 1].trim();
                format!("{}\n    ...", sig)
            } else {
                text.lines().next().unwrap_or(text).to_string()
            }
        }
        "rust" => {
            // Find the opening brace and truncate
            if let Some(pos) = text.find('{') {
                let sig = text[..pos].trim();
                format!("{} {{ ... }}", sig)
            } else {
                text.lines().next().unwrap_or(text).to_string()
            }
        }
        "go" => {
            // Find the opening brace
            if let Some(pos) = text.find('{') {
                let sig = text[..pos].trim();
                format!("{} {{ ... }}", sig)
            } else {
                text.lines().next().unwrap_or(text).to_string()
            }
        }
        "java" | "c" | "cpp" => {
            // Find the opening brace
            if let Some(pos) = text.find('{') {
                let sig = text[..pos].trim();
                format!("{} {{ ... }}", sig)
            } else {
                text.lines().next().unwrap_or(text).to_string()
            }
        }
        _ => text.lines().next().unwrap_or(text).to_string(),
    }
}

/// Extract class summary - signature + field names + method signatures
fn extract_class_summary(text: &str, lang_id: &str) -> String {
    let lines: Vec<&str> = text.lines().collect();
    if lines.is_empty() {
        return text.to_string();
    }

    let mut result = Vec::new();

    match lang_id {
        "typescript" | "javascript" | "tsx" | "jsx" => {
            result.push(lines[0].to_string());

            // Detect the indentation level of class members (first non-empty line after class declaration)
            let member_indent = lines
                .iter()
                .skip(1)
                .find(|l| {
                    !l.trim().is_empty()
                        && !l.trim().starts_with("//")
                        && !l.trim().starts_with("*")
                })
                .map(|l| l.len() - l.trim_start().len())
                .unwrap_or(2);

            for line in lines.iter().skip(1) {
                let trimmed = line.trim();
                let current_indent = line.len() - line.trim_start().len();

                // Only consider lines at the class member indentation level
                if current_indent != member_indent || trimmed.is_empty() {
                    continue;
                }

                // Check if it's a class member (field, method, constructor, decorator)
                let is_member = trimmed.starts_with("private ")
                    || trimmed.starts_with("public ")
                    || trimmed.starts_with("protected ")
                    || trimmed.starts_with("readonly ")
                    || trimmed.starts_with("static ")
                    || trimmed.starts_with("constructor")
                    || trimmed.starts_with("async ")
                    || trimmed.starts_with("@") // decorators
                    || trimmed.starts_with("get ")
                    || trimmed.starts_with("set ")
                    // Method without access modifier (must have parentheses and be followed by { or :)
                    || (trimmed.contains('(')
                        && (trimmed.contains(") {") || trimmed.contains("): ")));

                if is_member {
                    if let Some(brace_pos) = line.find('{') {
                        result.push(format!("{}{{ ... }}", &line[..brace_pos]));
                    } else {
                        result.push(line.to_string());
                    }
                }
            }
            result.push("}".to_string());
        }
        "python" => {
            // Class definition line
            result.push(lines[0].to_string());

            for line in lines.iter().skip(1) {
                let trimmed = line.trim();
                // Include def lines (methods)
                if trimmed.starts_with("def ") || trimmed.starts_with("async def ") {
                    if let Some(colon_pos) = line.find(':') {
                        result.push(format!("{}:\n        ...", &line[..colon_pos]));
                    } else {
                        result.push(line.to_string());
                    }
                } else if trimmed.starts_with("self.") && trimmed.contains('=') {
                    // Field assignment in __init__
                    result.push(format!("    {}", trimmed));
                }
            }
        }
        "java" => {
            result.push(lines[0].to_string());

            for line in lines.iter().skip(1) {
                let trimmed = line.trim();
                // Include field and method declarations
                if trimmed.starts_with("private ")
                    || trimmed.starts_with("public ")
                    || trimmed.starts_with("protected ")
                    || trimmed.starts_with("static ")
                    || trimmed.starts_with("final ")
                {
                    if let Some(brace_pos) = line.find('{') {
                        result.push(format!("{}{{ ... }}", &line[..brace_pos]));
                    } else {
                        result.push(line.to_string());
                    }
                }
            }
            result.push("}".to_string());
        }
        _ => {
            // Default: just show first few lines
            return limit_text(text, 20);
        }
    }

    result.join("\n")
}

/// Extract impl block summary for Rust
fn extract_impl_summary(text: &str) -> String {
    let lines: Vec<&str> = text.lines().collect();
    if lines.is_empty() {
        return text.to_string();
    }

    let mut result = Vec::new();
    result.push(lines[0].to_string()); // impl line

    for line in lines.iter().skip(1) {
        let trimmed = line.trim();
        // Include fn signatures
        if trimmed.starts_with("pub fn ")
            || trimmed.starts_with("fn ")
            || trimmed.starts_with("pub async fn ")
            || trimmed.starts_with("async fn ")
        {
            if let Some(brace_pos) = line.find('{') {
                result.push(format!("{}{{ ... }}", &line[..brace_pos]));
            } else {
                result.push(line.to_string());
            }
        }
    }
    result.push("}".to_string());

    result.join("\n")
}

/// Extract doc comments before a definition
fn extract_doc_comment(lines: &[&str], start_line: usize, lang_id: &str) -> String {
    if start_line == 0 {
        return String::new();
    }

    let mut doc_lines = Vec::new();
    let mut line_idx = start_line - 1;

    // Look backwards for doc comments
    loop {
        let line = lines.get(line_idx).unwrap_or(&"").trim();

        let is_doc_comment = match lang_id {
            "typescript" | "javascript" | "tsx" | "jsx" | "java" | "c" | "cpp" => {
                line.starts_with("/**")
                    || line.starts_with("*")
                    || line.starts_with("//")
                    || line.ends_with("*/")
            }
            "python" => {
                line.starts_with("\"\"\"") || line.starts_with("'''") || line.starts_with("#")
            }
            "rust" => line.starts_with("///") || line.starts_with("//!"),
            "go" => line.starts_with("//"),
            _ => false,
        };

        if is_doc_comment {
            doc_lines.push(line.to_string());
            if line.starts_with("/**") || line.starts_with("\"\"\"") || line.starts_with("'''") {
                break; // Start of block comment
            }
        } else if line.is_empty() {
            // Allow one empty line
            if !doc_lines.is_empty() {
                break;
            }
        } else {
            break;
        }

        if line_idx == 0 {
            break;
        }
        line_idx -= 1;
    }

    doc_lines.reverse();
    doc_lines.join("\n")
}

/// Limit text to a certain number of lines
fn limit_text(text: &str, max_lines: usize) -> String {
    let lines: Vec<&str> = text.lines().collect();
    if lines.len() <= max_lines {
        text.to_string()
    } else {
        let mut result: Vec<&str> = lines[..max_lines].to_vec();
        result.push("    // ... (truncated)");
        result.push("}");
        result.join("\n")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_service_has_languages() {
        let service = CodeNavigationService::new();

        // Check that languages are registered
        assert!(service.languages.contains_key("python"));
        assert!(service.languages.contains_key("rust"));
        assert!(service.languages.contains_key("go"));
        assert!(service.languages.contains_key("c"));
        assert!(service.languages.contains_key("cpp"));
        assert!(service.languages.contains_key("java"));
        assert!(service.languages.contains_key("typescript"));
        assert!(service.languages.contains_key("javascript"));
    }

    #[test]
    fn test_new_service_has_parsers() {
        let service = CodeNavigationService::new();

        // Check that parsers are registered
        assert!(service.parsers.contains_key("python"));
        assert!(service.parsers.contains_key("rust"));
        assert!(service.parsers.contains_key("typescript"));
    }

    #[test]
    fn test_new_service_has_queries() {
        let service = CodeNavigationService::new();

        // Check that queries are registered
        assert!(service.queries.contains_key("python"));
        assert!(service.queries.contains_key("rust"));
        assert!(service.queries.contains_key("go"));
    }

    #[test]
    fn test_get_lang_family() {
        assert_eq!(CodeNavigationService::get_lang_family("c"), "c_family");
        assert_eq!(CodeNavigationService::get_lang_family("cpp"), "c_family");
        assert_eq!(
            CodeNavigationService::get_lang_family("typescript"),
            "js_family"
        );
        assert_eq!(
            CodeNavigationService::get_lang_family("javascript"),
            "js_family"
        );
        assert_eq!(CodeNavigationService::get_lang_family("python"), "python");
        assert_eq!(CodeNavigationService::get_lang_family("rust"), "rust");
        assert_eq!(CodeNavigationService::get_lang_family("go"), "go");
        assert_eq!(CodeNavigationService::get_lang_family("java"), "java");
        assert_eq!(CodeNavigationService::get_lang_family("unknown"), "unknown");
    }

    #[test]
    fn test_get_lang_id_from_path() {
        assert_eq!(
            CodeNavigationService::get_lang_id_from_path("test.py"),
            Some("python".to_string())
        );
        assert_eq!(
            CodeNavigationService::get_lang_id_from_path("test.rs"),
            Some("rust".to_string())
        );
        assert_eq!(
            CodeNavigationService::get_lang_id_from_path("test.go"),
            Some("go".to_string())
        );
        assert_eq!(
            CodeNavigationService::get_lang_id_from_path("test.c"),
            Some("c".to_string())
        );
        assert_eq!(
            CodeNavigationService::get_lang_id_from_path("test.h"),
            Some("c".to_string())
        );
        assert_eq!(
            CodeNavigationService::get_lang_id_from_path("test.cpp"),
            Some("cpp".to_string())
        );
        assert_eq!(
            CodeNavigationService::get_lang_id_from_path("test.cc"),
            Some("cpp".to_string())
        );
        assert_eq!(
            CodeNavigationService::get_lang_id_from_path("test.hpp"),
            Some("cpp".to_string())
        );
        assert_eq!(
            CodeNavigationService::get_lang_id_from_path("test.java"),
            Some("java".to_string())
        );
        assert_eq!(
            CodeNavigationService::get_lang_id_from_path("test.ts"),
            Some("typescript".to_string())
        );
        assert_eq!(
            CodeNavigationService::get_lang_id_from_path("test.tsx"),
            Some("typescript".to_string())
        );
        assert_eq!(
            CodeNavigationService::get_lang_id_from_path("test.js"),
            Some("javascript".to_string())
        );
        assert_eq!(
            CodeNavigationService::get_lang_id_from_path("test.jsx"),
            Some("javascript".to_string())
        );
        assert_eq!(
            CodeNavigationService::get_lang_id_from_path("test.mjs"),
            Some("javascript".to_string())
        );
        assert_eq!(
            CodeNavigationService::get_lang_id_from_path("test.txt"),
            None
        );
    }

    #[test]
    fn test_get_symbol_kind() {
        assert_eq!(
            CodeNavigationService::get_symbol_kind("function.definition"),
            "function"
        );
        assert_eq!(
            CodeNavigationService::get_symbol_kind("class.definition"),
            "class"
        );
        assert_eq!(
            CodeNavigationService::get_symbol_kind("struct.definition"),
            "struct"
        );
        assert_eq!(
            CodeNavigationService::get_symbol_kind("enum.definition"),
            "enum"
        );
        assert_eq!(
            CodeNavigationService::get_symbol_kind("trait.definition"),
            "trait"
        );
        assert_eq!(
            CodeNavigationService::get_symbol_kind("interface.definition"),
            "interface"
        );
        assert_eq!(
            CodeNavigationService::get_symbol_kind("method.definition"),
            "method"
        );
        assert_eq!(
            CodeNavigationService::get_symbol_kind("type.definition"),
            "type"
        );
        assert_eq!(
            CodeNavigationService::get_symbol_kind("const.definition"),
            "const"
        );
        assert_eq!(
            CodeNavigationService::get_symbol_kind("static.definition"),
            "static"
        );
        assert_eq!(CodeNavigationService::get_symbol_kind("unknown"), "symbol");
    }

    #[test]
    fn test_index_python_file() {
        let mut service = CodeNavigationService::new();

        let python_code = r#"
def my_function():
    pass

class MyClass:
    def method(self):
        pass
"#;

        service.index_file("test.py", python_code, "python");

        // Check that function definition was indexed
        let func_defs = service.find_definition("my_function", "python");
        assert!(!func_defs.is_empty(), "Should find my_function definition");
        assert_eq!(func_defs[0].name, "my_function");
        assert_eq!(func_defs[0].kind, "function");
        assert_eq!(func_defs[0].lang_family, "python");

        // Check that class definition was indexed
        let class_defs = service.find_definition("MyClass", "python");
        assert!(!class_defs.is_empty(), "Should find MyClass definition");
        assert_eq!(class_defs[0].name, "MyClass");
        assert_eq!(class_defs[0].kind, "class");
    }

    #[test]
    fn test_index_rust_file() {
        let mut service = CodeNavigationService::new();

        let rust_code = r#"
fn my_function() {
    println!("Hello");
}

struct MyStruct {
    field: i32,
}

enum MyEnum {
    Variant1,
    Variant2,
}

trait MyTrait {
    fn method(&self);
}

const MY_CONST: i32 = 42;

type MyType = Vec<i32>;
"#;

        service.index_file("test.rs", rust_code, "rust");

        // Check function
        let func_defs = service.find_definition("my_function", "rust");
        assert!(!func_defs.is_empty(), "Should find my_function");
        assert_eq!(func_defs[0].kind, "function");

        // Check struct
        let struct_defs = service.find_definition("MyStruct", "rust");
        assert!(!struct_defs.is_empty(), "Should find MyStruct");
        assert_eq!(struct_defs[0].kind, "struct");

        // Check enum
        let enum_defs = service.find_definition("MyEnum", "rust");
        assert!(!enum_defs.is_empty(), "Should find MyEnum");
        assert_eq!(enum_defs[0].kind, "enum");

        // Check trait
        let trait_defs = service.find_definition("MyTrait", "rust");
        assert!(!trait_defs.is_empty(), "Should find MyTrait");
        assert_eq!(trait_defs[0].kind, "trait");

        // Check const
        let const_defs = service.find_definition("MY_CONST", "rust");
        assert!(!const_defs.is_empty(), "Should find MY_CONST");
        assert_eq!(const_defs[0].kind, "const");

        // Check type alias
        let type_defs = service.find_definition("MyType", "rust");
        assert!(!type_defs.is_empty(), "Should find MyType");
        assert_eq!(type_defs[0].kind, "type");
    }

    #[test]
    fn test_index_typescript_file() {
        let mut service = CodeNavigationService::new();

        let ts_code = r#"
function myFunction() {
    console.log("Hello");
}

class MyClass {
    method() {}
}

interface MyInterface {
    prop: string;
}

type MyType = {
    field: number;
};

enum MyEnum {
    A,
    B,
}

const MY_CONST = 42;
"#;

        service.index_file("test.ts", ts_code, "typescript");

        // Check function
        let func_defs = service.find_definition("myFunction", "js_family");
        assert!(!func_defs.is_empty(), "Should find myFunction");
        assert_eq!(func_defs[0].kind, "function");

        // Check class
        let class_defs = service.find_definition("MyClass", "js_family");
        assert!(!class_defs.is_empty(), "Should find MyClass");
        assert_eq!(class_defs[0].kind, "class");

        // Check interface
        let interface_defs = service.find_definition("MyInterface", "js_family");
        assert!(!interface_defs.is_empty(), "Should find MyInterface");
        assert_eq!(interface_defs[0].kind, "interface");

        // Check type
        let type_defs = service.find_definition("MyType", "js_family");
        assert!(!type_defs.is_empty(), "Should find MyType");
        assert_eq!(type_defs[0].kind, "type");

        // Check enum
        let enum_defs = service.find_definition("MyEnum", "js_family");
        assert!(!enum_defs.is_empty(), "Should find MyEnum");
        assert_eq!(enum_defs[0].kind, "enum");
    }

    #[test]
    fn test_index_go_file() {
        let mut service = CodeNavigationService::new();

        let go_code = r#"
package main

func myFunction() {
    fmt.Println("Hello")
}

type MyStruct struct {
    Field int
}

func (m *MyStruct) Method() {}
"#;

        service.index_file("test.go", go_code, "go");

        // Check function
        let func_defs = service.find_definition("myFunction", "go");
        assert!(!func_defs.is_empty(), "Should find myFunction");
        assert_eq!(func_defs[0].kind, "function");

        // Check struct type
        let type_defs = service.find_definition("MyStruct", "go");
        assert!(!type_defs.is_empty(), "Should find MyStruct");
        assert_eq!(type_defs[0].kind, "type");

        // Check method
        let method_defs = service.find_definition("Method", "go");
        assert!(!method_defs.is_empty(), "Should find Method");
        assert_eq!(method_defs[0].kind, "method");
    }

    #[test]
    fn test_find_definition_filters_by_lang_family() {
        let mut service = CodeNavigationService::new();

        // Index same symbol name in different languages
        let python_code = "def test_func(): pass";
        let rust_code = "fn test_func() {}";

        service.index_file("test.py", python_code, "python");
        service.index_file("test.rs", rust_code, "rust");

        // Should only find Python definition
        let python_defs = service.find_definition("test_func", "python");
        assert_eq!(python_defs.len(), 1);
        assert_eq!(python_defs[0].file_path, "test.py");

        // Should only find Rust definition
        let rust_defs = service.find_definition("test_func", "rust");
        assert_eq!(rust_defs.len(), 1);
        assert_eq!(rust_defs[0].file_path, "test.rs");

        // Should find nothing for wrong lang family
        let js_defs = service.find_definition("test_func", "js_family");
        assert!(js_defs.is_empty());
    }

    #[test]
    fn test_clear_file() {
        let mut service = CodeNavigationService::new();

        let code = "def my_function(): pass";
        service.index_file("test.py", code, "python");

        // Verify it was indexed
        let defs = service.find_definition("my_function", "python");
        assert!(!defs.is_empty());

        // Clear the file
        service.clear_file("test.py");

        // Verify it's gone
        let defs = service.find_definition("my_function", "python");
        assert!(defs.is_empty());
    }

    #[test]
    fn test_clear_all() {
        let mut service = CodeNavigationService::new();

        service.index_file("test1.py", "def func1(): pass", "python");
        service.index_file("test2.py", "def func2(): pass", "python");

        // Verify both were indexed
        assert!(!service.find_definition("func1", "python").is_empty());
        assert!(!service.find_definition("func2", "python").is_empty());

        // Clear all
        service.clear_all();

        // Verify both are gone
        assert!(service.find_definition("func1", "python").is_empty());
        assert!(service.find_definition("func2", "python").is_empty());
    }

    #[test]
    fn test_reindex_file_updates_symbols() {
        let mut service = CodeNavigationService::new();

        // Index initial version
        service.index_file("test.py", "def old_func(): pass", "python");
        assert!(!service.find_definition("old_func", "python").is_empty());
        assert!(service.find_definition("new_func", "python").is_empty());

        // Reindex with new content
        service.index_file("test.py", "def new_func(): pass", "python");

        // Old symbol should be gone, new should exist
        assert!(service.find_definition("old_func", "python").is_empty());
        assert!(!service.find_definition("new_func", "python").is_empty());
    }

    #[test]
    fn test_symbol_info_line_numbers() {
        let mut service = CodeNavigationService::new();

        let code = r#"
def func_line_2():
    pass

def func_line_5():
    pass
"#;

        service.index_file("test.py", code, "python");

        let defs = service.find_definition("func_line_2", "python");
        assert!(!defs.is_empty());
        assert_eq!(defs[0].start_line, 2);

        let defs = service.find_definition("func_line_5", "python");
        assert!(!defs.is_empty());
        assert_eq!(defs[0].start_line, 5);
    }

    #[test]
    fn test_symbol_info_serialization() {
        let symbol = SymbolInfo {
            name: "test_func".to_string(),
            kind: "function".to_string(),
            file_path: "/path/to/file.py".to_string(),
            lang_family: "python".to_string(),
            start_line: 10,
            start_column: 5,
            end_line: 10,
            end_column: 14,
        };

        let json = serde_json::to_string(&symbol).unwrap();
        assert!(json.contains("\"name\":\"test_func\""));
        assert!(json.contains("\"kind\":\"function\""));
        assert!(json.contains("\"start_line\":10"));

        // Deserialize back
        let parsed: SymbolInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.name, "test_func");
        assert_eq!(parsed.kind, "function");
        assert_eq!(parsed.start_line, 10);
    }

    #[test]
    fn test_index_c_file() {
        let mut service = CodeNavigationService::new();

        let c_code = r#"
void my_function() {
    printf("Hello\n");
}

struct MyStruct {
    int field;
};
"#;

        service.index_file("test.c", c_code, "c");

        // Check function
        let func_defs = service.find_definition("my_function", "c_family");
        assert!(!func_defs.is_empty(), "Should find my_function in C");
        assert_eq!(func_defs[0].kind, "function");

        // Check struct
        let struct_defs = service.find_definition("MyStruct", "c_family");
        assert!(!struct_defs.is_empty(), "Should find MyStruct in C");
        assert_eq!(struct_defs[0].kind, "struct");
    }

    #[test]
    fn test_index_java_file() {
        let mut service = CodeNavigationService::new();

        let java_code = r#"
public class MyClass {
    public void myMethod() {
        System.out.println("Hello");
    }
}

interface MyInterface {
    void method();
}
"#;

        service.index_file("Test.java", java_code, "java");

        // Check class
        let class_defs = service.find_definition("MyClass", "java");
        assert!(!class_defs.is_empty(), "Should find MyClass in Java");
        assert_eq!(class_defs[0].kind, "class");

        // Check method
        let method_defs = service.find_definition("myMethod", "java");
        assert!(!method_defs.is_empty(), "Should find myMethod in Java");
        assert_eq!(method_defs[0].kind, "method");

        // Check interface
        let interface_defs = service.find_definition("MyInterface", "java");
        assert!(
            !interface_defs.is_empty(),
            "Should find MyInterface in Java"
        );
        assert_eq!(interface_defs[0].kind, "interface");
    }

    #[test]
    fn test_file_definitions_reverse_index() {
        let mut service = CodeNavigationService::new();

        service.index_file("test.py", "def func1(): pass\ndef func2(): pass", "python");

        // Check reverse index has the file
        assert!(service.index.file_definitions.contains_key("test.py"));

        // Check it contains both function names
        let names = service.index.file_definitions.get("test.py").unwrap();
        assert!(names.contains("func1"));
        assert!(names.contains("func2"));
    }

    #[test]
    fn test_persisted_index_serialization() {
        let mut definitions = HashMap::new();
        definitions.insert(
            "test_func".to_string(),
            vec![SymbolInfo {
                name: "test_func".to_string(),
                kind: "function".to_string(),
                file_path: "test.py".to_string(),
                lang_family: "python".to_string(),
                start_line: 1,
                start_column: 1,
                end_line: 1,
                end_column: 10,
            }],
        );

        let mut file_definitions = HashMap::new();
        let mut names = HashSet::new();
        names.insert("test_func".to_string());
        file_definitions.insert("test.py".to_string(), names);

        let persisted = PersistedIndex {
            version: INDEX_VERSION,
            root_path: "/project".to_string(),
            last_updated: 1700000000,
            file_timestamps: HashMap::new(),
            definitions,
            file_definitions,
        };

        let json = serde_json::to_string(&persisted).unwrap();
        assert!(json.contains(&format!("\"version\":{}", INDEX_VERSION)));
        assert!(json.contains("\"root_path\":\"/project\""));

        // Deserialize back
        let parsed: PersistedIndex = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.version, INDEX_VERSION);
        assert_eq!(parsed.root_path, "/project");
        assert!(parsed.definitions.contains_key("test_func"));
    }

    #[test]
    fn test_index_metadata_serialization() {
        let metadata = IndexMetadata {
            version: INDEX_VERSION,
            root_path: "/project".to_string(),
            last_updated: 1700000000,
            file_count: 10,
            definition_count: 50,
            file_timestamps: HashMap::new(),
        };

        let json = serde_json::to_string(&metadata).unwrap();
        assert!(json.contains("\"file_count\":10"));
        assert!(json.contains("\"definition_count\":50"));

        let parsed: IndexMetadata = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.file_count, 10);
        assert_eq!(parsed.definition_count, 50);
    }

    #[test]
    fn test_get_project_hash() {
        let hash1 = get_project_hash("/project/a");
        let hash2 = get_project_hash("/project/b");
        let hash3 = get_project_hash("/project/a"); // Same as hash1

        // Different paths should have different hashes
        assert_ne!(hash1, hash2);

        // Same path should have same hash
        assert_eq!(hash1, hash3);

        // Hash should be 16 characters (8 bytes in hex)
        assert_eq!(hash1.len(), 16);
    }

    // ============================================================================
    // Code Summarization Tests
    // ============================================================================

    #[tokio::test]
    async fn test_summarize_typescript_code() {
        let ts_code = r#"
/**
 * A sample service for processing data
 */
export class DataProcessor {
    private data: Map<string, number>;

    constructor() {
        this.data = new Map();
    }

    /**
     * Process incoming data
     * @param input The input to process
     * @returns The processed result
     */
    async process(input: string): Promise<number> {
        // Some long implementation
        const result = input.length * 2;
        for (let i = 0; i < 100; i++) {
            console.log(i);
        }
        return result;
    }

    private helperMethod(): void {
        console.log('helper');
    }
}

interface DataInput {
    id: string;
    value: number;
    timestamp: Date;
}

const MAX_SIZE = 1000;

export function processAll(items: DataInput[]): void {
    items.forEach(item => console.log(item));
}
"#;

        let result = summarize_code_content(
            ts_code.to_string(),
            "typescript".to_string(),
            "test.ts".to_string(),
        )
        .await
        .unwrap();

        assert!(
            result.success,
            "Should successfully summarize TypeScript code"
        );
        assert!(
            result.summary.contains("[COMPRESSED:"),
            "Should have compression marker"
        );
        assert!(
            result.summary.contains("DataProcessor"),
            "Should include class name"
        );
        assert!(
            result.summary.contains("process("),
            "Should include method signature"
        );
        assert!(
            result.summary.contains("DataInput"),
            "Should include interface"
        );
        assert!(result.summary.contains("MAX_SIZE"), "Should include const");
        // Function body should be replaced with { ... }
        assert!(
            result.summary.contains("{ ... }"),
            "Function bodies should be summarized"
        );
    }

    #[tokio::test]
    async fn test_summarize_rust_code() {
        let rust_code = r#"
/// A struct for holding configuration
pub struct Config {
    pub name: String,
    pub value: i32,
}

impl Config {
    /// Create a new config
    pub fn new(name: String, value: i32) -> Self {
        Self { name, value }
    }

    pub fn process(&self) -> String {
        format!("{}: {}", self.name, self.value)
    }
}

/// Process data with the given config
pub fn process_data(config: &Config) -> Result<(), String> {
    // Long implementation
    println!("Processing...");
    Ok(())
}

const MAX_RETRIES: u32 = 3;
"#;

        let result = summarize_code_content(
            rust_code.to_string(),
            "rust".to_string(),
            "test.rs".to_string(),
        )
        .await
        .unwrap();

        assert!(result.success, "Should successfully summarize Rust code");
        assert!(
            result.summary.contains("Config"),
            "Should include struct name"
        );
        assert!(
            result.summary.contains("process_data"),
            "Should include function name"
        );
        assert!(
            result.summary.contains("MAX_RETRIES"),
            "Should include const"
        );
    }

    #[tokio::test]
    async fn test_summarize_python_code() {
        let python_code = r#"
"""A module for data processing."""

class DataProcessor:
    """Processes data efficiently."""

    def __init__(self, config: dict):
        self.config = config
        self.data = []

    def process(self, input_data: list) -> list:
        """Process the input data."""
        result = []
        for item in input_data:
            result.append(item * 2)
        return result

def helper_function(x: int) -> int:
    """A helper function."""
    return x + 1

MAX_SIZE = 1000
"#;

        let result = summarize_code_content(
            python_code.to_string(),
            "python".to_string(),
            "test.py".to_string(),
        )
        .await
        .unwrap();

        assert!(result.success, "Should successfully summarize Python code");
        assert!(
            result.summary.contains("DataProcessor"),
            "Should include class name"
        );
        assert!(
            result.summary.contains("process"),
            "Should include method name"
        );
        assert!(
            result.summary.contains("helper_function"),
            "Should include function name"
        );
    }

    #[tokio::test]
    async fn test_summarize_unsupported_language() {
        let markdown_code = r#"
# Header

Some text content.

- Item 1
- Item 2
"#;

        let result = summarize_code_content(
            markdown_code.to_string(),
            "markdown".to_string(),
            "test.md".to_string(),
        )
        .await
        .unwrap();

        // Should return success=false but not error, keeping original content
        assert!(!result.success, "Should indicate unsupported language");
        assert_eq!(
            result.summary, markdown_code,
            "Should return original content for unsupported language"
        );
    }

    #[tokio::test]
    async fn test_summarize_go_code() {
        let go_code = r#"
package main

// Config holds configuration values
type Config struct {
    Name  string
    Value int
}

// NewConfig creates a new Config
func NewConfig(name string, value int) *Config {
    return &Config{
        Name:  name,
        Value: value,
    }
}

// Process handles the main logic
func (c *Config) Process() error {
    fmt.Println(c.Name)
    return nil
}

const MaxRetries = 3
"#;

        let result =
            summarize_code_content(go_code.to_string(), "go".to_string(), "main.go".to_string())
                .await
                .unwrap();

        assert!(result.success, "Should successfully summarize Go code");
        assert!(
            result.summary.contains("Config"),
            "Should include type name"
        );
        assert!(
            result.summary.contains("NewConfig"),
            "Should include function name"
        );
        assert!(
            result.summary.contains("Process"),
            "Should include method name"
        );
    }
}
