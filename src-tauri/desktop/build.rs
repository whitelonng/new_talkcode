use std::path::PathBuf;

fn main() {
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let root_dir = manifest_dir
        .parent()
        .expect("desktop crate should be inside src-tauri");
    let config_path = root_dir.join("tauri.conf.json");

    std::env::set_current_dir(root_dir).expect("failed to set current dir to src-tauri");

    println!("cargo:rerun-if-changed={}", config_path.display());
    tauri_build::build()
}
