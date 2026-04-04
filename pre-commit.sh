#!/bin/sh

# Check if there are staged Rust files
rust_files_changed=false
if git diff --cached --name-only | grep -E '\.rs$' > /dev/null; then
  rust_files_changed=true
  echo "Rust files detected, running cargo fmt..."

  # Run cargo fmt on the entire project (safer than targeting specific files)
  cd src-tauri
  cargo fmt
  cargo_exit_code=$?

  if [ $cargo_exit_code -ne 0 ]; then
    echo "Error: cargo fmt failed"
    exit $cargo_exit_code
  fi

  # Run cargo clippy to check for warnings (treat warnings as errors)
  echo "Running cargo clippy to check for warnings..."
  cargo clippy --workspace -- -D warnings
  clippy_exit_code=$?
  cd ..

  if [ $clippy_exit_code -ne 0 ]; then
    echo "Error: cargo clippy found warnings or errors"
    exit $clippy_exit_code
  fi

  # Only stage the Rust files that were changed by cargo fmt
  git add -u src-tauri/
fi

# Get list of currently staged files before running Biome
staged_before=$(git diff --cached --name-only | sort)

# Run Biome check with auto-fix (includes formatting and safe fixes like import sorting)
echo "Running Biome check with auto-fix..."
output=$(npx biome check --write --staged 2>&1)
exit_code=$?

# Get list of staged files after running Biome
staged_after=$(git diff --cached --name-only | sort)

# Only stage files that were previously staged and potentially modified by Biome
if [ -n "$staged_before" ]; then
  # Add only the files that were already staged
  echo "$staged_before" | while read -r file; do
    if [ -f "$file" ]; then
      git add "$file"
    fi
  done
fi

if [ $exit_code -eq 0 ]; then
  # If Rust files were formatted but Biome had no changes, still exit 0
  if [ "$rust_files_changed" = true ]; then
    echo "Rust files formatted successfully."
  fi
  exit 0
fi

case "$output" in
  *"No files were processed"*)
    # If only Rust files were changed and formatted, exit 0
    if [ "$rust_files_changed" = true ]; then
      echo "Rust files formatted successfully."
      exit 0
    fi
    exit 0
    ;;
  *)
    echo "$output"
    exit $exit_code
    ;;
esac
