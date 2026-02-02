use std::fs;
use std::path::PathBuf;

/// Check if a file starts with Strata's YAML frontmatter (---\nstatuses:\n)
fn is_strata_file(path: &std::path::Path) -> bool {
    if let Ok(content) = fs::read_to_string(path) {
        content.starts_with("---\n") || content.starts_with("---\r\n")
    } else {
        false
    }
}

#[tauri::command]
fn list_workspace_files(workspace: String) -> Result<Vec<String>, String> {
    let path = PathBuf::from(&workspace);
    let mut files = Vec::new();
    for entry in fs::read_dir(&path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.ends_with(".md") && !name.starts_with('.') && is_strata_file(&entry.path()) {
            files.push(name);
        }
    }
    files.sort();
    Ok(files)
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    fs::remove_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn is_git_repo(workspace: String) -> bool {
    PathBuf::from(&workspace).join(".git").exists()
}

/// Walk up from the current working directory to find the nearest `.git` folder.
/// Returns the git repo root path, or empty string if none found.
#[tauri::command]
fn find_git_root() -> String {
    if let Ok(cwd) = std::env::current_dir() {
        let mut dir = cwd.as_path();
        loop {
            if dir.join(".git").exists() {
                return dir.to_string_lossy().to_string();
            }
            match dir.parent() {
                Some(parent) => dir = parent,
                None => break,
            }
        }
    }
    String::new()
}

/// Create a directory if it doesn't already exist.
#[tauri::command]
fn ensure_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_workspace_files,
            read_file,
            write_file,
            delete_file,
            rename_file,
            is_git_repo,
            find_git_root,
            ensure_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
