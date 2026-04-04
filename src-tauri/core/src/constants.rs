// Shared constants for file operations

/// Default maximum depth for directory traversal
pub const DEFAULT_MAX_DEPTH: usize = 20;

/// Directories to exclude from file operations
pub const EXCLUDED_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "target",
    "target-dev", // Tauri development build directory
    "build",
    "dist",
    ".next",
    ".cache",
    "coverage",
    ".nyc_output",
    "logs",
    "tmp",
    "temp",
    ".DS_Store",
    ".idea",
    "__pycache__",
    ".pytest_cache",
    ".svn",
    ".hg",
    "vendor",
    "deps",
    "_build",
    ".elixir_ls",
    ".sass-cache",
    ".parcel-cache",
    "out",
    "public",
    ".nuxt",
    ".output",
    ".netlify",
    "bower_components",
];

/// Common code file extensions
pub const CODE_EXTENSIONS: &[&str] = &[
    // Programming languages
    "rs",
    "js",
    "jsx",
    "ts",
    "tsx",
    "py",
    "java",
    "c",
    "cpp",
    "cc",
    "cxx",
    "h",
    "hpp",
    "cs",
    "php",
    "rb",
    "go",
    "swift",
    "kt",
    "scala",
    "clj",
    // Web technologies
    "html",
    "htm",
    "css",
    "scss",
    "sass",
    "less",
    "vue",
    "svelte",
    // Configuration and data formats
    "json",
    "xml",
    "yaml",
    "yml",
    "toml",
    "ini",
    "cfg",
    "conf",
    // Documentation
    "md",
    "mdx",
    "txt",
    "rst",
    "tex",
    "org",
    "log",
    // Scripts
    "sh",
    "bash",
    "zsh",
    "fish",
    "ps1",
    "bat",
    "cmd",
    // Data and API
    "sql",
    "graphql",
    "gql",
    "proto",
    "thrift",
    // Other languages
    "r",
    "m",
    "mm",
    "pl",
    "pm",
    "lua",
    "vim",
    "el",
    "dart",
    "elm",
    "haskell",
    "hs",
    "ml",
    "fs",
    "fsx",
    "fsi",
    "coffee",
    "litcoffee",
    "haml",
    "pug",
    "jade",
    "slim",
    "styl",
    "stylus",
    "postcss",
    "pcss",
    "lock",
];

/// Common code file names (without extensions)
pub const CODE_FILENAMES: &[&str] = &[
    "dockerfile",
    "makefile",
    "rakefile",
    "gemfile",
    "podfile",
    "vagrantfile",
    "procfile",
    "cakefile",
    "gruntfile",
    "gulpfile",
    ".env",
    ".env.local",
    ".env.example",
    ".env.development",
    ".env.production",
    ".env.test",
    ".gitignore",
    ".gitattributes",
    ".editorconfig",
    ".eslintrc",
    ".prettierrc",
    ".babelrc",
    ".npmrc",
    ".yarnrc",
];

/// Binary file extensions to exclude
pub const BINARY_EXTENSIONS: &[&str] = &[
    // Executables and libraries
    "exe", "dll", "so", "dylib", "a", "lib", "o", "obj", // Rust build artifacts
    "rlib", "rmeta", "d", "pdb", // Documents
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", // Archives
    "zip", "tar", "gz", "bz2", "7z", "rar", // Images
    "jpg", "jpeg", "png", "gif", "bmp", "ico", "svg", // Media
    "mp3", "mp4", "avi", "mkv", "mov", "wmv", "flv", // Fonts
    "ttf", "otf", "woff", "woff2", "eot", // Java
    "jar", "war", "ear", "class", // Python
    "pyc", "pyo", // Databases
    "db", "sqlite", "sqlite3",
];

/// Check if a directory should be excluded
pub fn should_exclude_dir(dir_name: &str) -> bool {
    EXCLUDED_DIRS.contains(&dir_name)
}

/// Check if a file extension indicates a code file
pub fn is_code_extension(extension: &str) -> bool {
    CODE_EXTENSIONS.contains(&extension)
}

/// Check if a filename (without extension) is a code file
pub fn is_code_filename(filename: &str) -> bool {
    let lower = filename.to_lowercase();
    CODE_FILENAMES.contains(&lower.as_str())
}

/// Check if a file extension indicates a binary file
pub fn is_binary_extension(extension: &str) -> bool {
    BINARY_EXTENSIONS.contains(&extension)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_should_exclude_dir_common_dirs() {
        assert!(should_exclude_dir("node_modules"));
        assert!(should_exclude_dir(".git"));
        assert!(should_exclude_dir("target"));
        assert!(should_exclude_dir("dist"));
        assert!(should_exclude_dir(".cache"));
        assert!(should_exclude_dir("__pycache__"));
    }

    #[test]
    fn test_should_exclude_dir_false() {
        assert!(!should_exclude_dir("src"));
        assert!(!should_exclude_dir("lib"));
        assert!(!should_exclude_dir("components"));
        assert!(!should_exclude_dir("utils"));
    }

    #[test]
    fn test_is_code_extension_programming_languages() {
        assert!(is_code_extension("rs"));
        assert!(is_code_extension("js"));
        assert!(is_code_extension("ts"));
        assert!(is_code_extension("tsx"));
        assert!(is_code_extension("py"));
        assert!(is_code_extension("java"));
        assert!(is_code_extension("go"));
        assert!(is_code_extension("c"));
        assert!(is_code_extension("cpp"));
    }

    #[test]
    fn test_is_code_extension_web_files() {
        assert!(is_code_extension("html"));
        assert!(is_code_extension("css"));
        assert!(is_code_extension("scss"));
        assert!(is_code_extension("vue"));
        assert!(is_code_extension("svelte"));
    }

    #[test]
    fn test_is_code_extension_config_files() {
        assert!(is_code_extension("json"));
        assert!(is_code_extension("yaml"));
        assert!(is_code_extension("yml"));
        assert!(is_code_extension("toml"));
        assert!(is_code_extension("xml"));
    }

    #[test]
    fn test_is_code_extension_false() {
        assert!(!is_code_extension("exe"));
        assert!(!is_code_extension("dll"));
        assert!(!is_code_extension("png"));
        assert!(!is_code_extension("jpg"));
        assert!(!is_code_extension("unknown_extension"));
    }

    #[test]
    fn test_is_code_filename_case_insensitive() {
        assert!(is_code_filename("Dockerfile"));
        assert!(is_code_filename("DOCKERFILE"));
        assert!(is_code_filename("dockerfile"));
        assert!(is_code_filename("Makefile"));
        assert!(is_code_filename("MAKEFILE"));
        assert!(is_code_filename("makefile"));
    }

    #[test]
    fn test_is_code_filename_common_files() {
        assert!(is_code_filename("Gemfile"));
        assert!(is_code_filename("Podfile"));
        assert!(is_code_filename("Rakefile"));
        assert!(is_code_filename("Vagrantfile"));
        assert!(is_code_filename("Procfile"));
    }

    #[test]
    fn test_is_code_filename_false() {
        assert!(!is_code_filename("README"));
        assert!(!is_code_filename("LICENSE"));
        assert!(!is_code_filename("random_file"));
    }

    #[test]
    fn test_is_binary_extension_executables() {
        assert!(is_binary_extension("exe"));
        assert!(is_binary_extension("dll"));
        assert!(is_binary_extension("so"));
        assert!(is_binary_extension("dylib"));
    }

    #[test]
    fn test_is_binary_extension_documents() {
        assert!(is_binary_extension("pdf"));
        assert!(is_binary_extension("doc"));
        assert!(is_binary_extension("docx"));
        assert!(is_binary_extension("xls"));
        assert!(is_binary_extension("xlsx"));
    }

    #[test]
    fn test_is_binary_extension_archives() {
        assert!(is_binary_extension("zip"));
        assert!(is_binary_extension("tar"));
        assert!(is_binary_extension("gz"));
        assert!(is_binary_extension("rar"));
        assert!(is_binary_extension("7z"));
    }

    #[test]
    fn test_is_binary_extension_media() {
        assert!(is_binary_extension("jpg"));
        assert!(is_binary_extension("jpeg"));
        assert!(is_binary_extension("png"));
        assert!(is_binary_extension("gif"));
        assert!(is_binary_extension("mp3"));
        assert!(is_binary_extension("mp4"));
    }

    #[test]
    fn test_is_binary_extension_rust_artifacts() {
        assert!(is_binary_extension("rlib"));
        assert!(is_binary_extension("rmeta"));
        assert!(is_binary_extension("d"));
        assert!(is_binary_extension("pdb"));
        assert!(is_binary_extension("a"));
        assert!(is_binary_extension("dylib"));
        assert!(is_binary_extension("so"));
    }

    #[test]
    fn test_is_binary_extension_false() {
        assert!(!is_binary_extension("rs"));
        assert!(!is_binary_extension("js"));
        assert!(!is_binary_extension("txt"));
        assert!(!is_binary_extension("md"));
    }

    #[test]
    fn test_excluded_dirs_contains_expected() {
        assert!(EXCLUDED_DIRS.contains(&"node_modules"));
        assert!(EXCLUDED_DIRS.contains(&".git"));
        assert!(EXCLUDED_DIRS.contains(&"target"));
        assert!(EXCLUDED_DIRS.contains(&"target-dev"));
        assert!(EXCLUDED_DIRS.contains(&"__pycache__"));
        assert!(EXCLUDED_DIRS.len() > 20); // Should have many exclusions
    }

    #[test]
    fn test_code_extensions_contains_expected() {
        assert!(CODE_EXTENSIONS.contains(&"rs"));
        assert!(CODE_EXTENSIONS.contains(&"py"));
        assert!(CODE_EXTENSIONS.contains(&"js"));
        assert!(CODE_EXTENSIONS.contains(&"ts"));
        assert!(CODE_EXTENSIONS.len() > 50); // Should have many extensions
    }

    #[test]
    fn test_binary_extensions_contains_expected() {
        assert!(BINARY_EXTENSIONS.contains(&"exe"));
        assert!(BINARY_EXTENSIONS.contains(&"png"));
        assert!(BINARY_EXTENSIONS.contains(&"zip"));
        assert!(BINARY_EXTENSIONS.contains(&"rlib"));
        assert!(BINARY_EXTENSIONS.contains(&"rmeta"));
        assert!(BINARY_EXTENSIONS.contains(&"d"));
        assert!(BINARY_EXTENSIONS.contains(&"pdb"));
        assert!(BINARY_EXTENSIONS.len() > 30); // Should have many extensions
    }
}
