use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri::menu::{MenuBuilder, MenuItem, SubmenuBuilder};

// ── App state for file watcher ──

struct AppState {
    watcher: Mutex<Option<RecommendedWatcher>>,
    write_guard: Arc<Mutex<HashSet<PathBuf>>>,
}

#[derive(Clone, Serialize)]
struct FsEvent {
    #[serde(rename = "relPath")]
    rel_path: String,
}

// ── Helpers ──

/// Check if a file contains Strata's YAML frontmatter with `doc-type: strata`
fn is_strata_file(path: &std::path::Path) -> bool {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return false,
    };
    if !content.starts_with("---\n") && !content.starts_with("---\r\n") {
        return false;
    }
    let after_first = if content.starts_with("---\r\n") { 5 } else { 4 };
    if let Some(end) = content[after_first..].find("\n---") {
        let frontmatter = &content[after_first..after_first + end];
        frontmatter.lines().any(|line| {
            let trimmed = line.trim();
            trimmed == "doc-type: strata" || trimmed == "doc-type: \"strata\""
        })
    } else {
        false
    }
}

/// Directories to skip during recursive file discovery
fn should_skip_dir(name: &str) -> bool {
    name.starts_with('.') || name == "node_modules" || name == "target" || name == "__pycache__"
}

// ── File commands ──

fn walk_dir(base: &PathBuf, dir: &PathBuf, files: &mut Vec<String>) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if path.is_dir() {
            if !should_skip_dir(&name) {
                walk_dir(base, &path, files)?;
            }
        } else if name.ends_with(".md") && !name.starts_with('.') && is_strata_file(&path) {
            if let Ok(rel) = path.strip_prefix(base) {
                // Normalize to forward slashes for cross-platform consistency
                files.push(rel.to_string_lossy().replace('\\', "/"));
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn list_workspace_files(workspace: String) -> Result<Vec<String>, String> {
    let base = PathBuf::from(&workspace);
    let mut files = Vec::new();
    walk_dir(&base, &base, &mut files)?;
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

// ── File watcher commands ──

#[tauri::command]
fn mark_file_write(path: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.write_guard.lock().map_err(|e| e.to_string())?;
    guard.insert(PathBuf::from(path));
    Ok(())
}

#[tauri::command]
fn start_watching(workspace: String, app_handle: AppHandle, state: tauri::State<'_, AppState>) -> Result<(), String> {
    // Stop any existing watcher first
    {
        let mut w = state.watcher.lock().map_err(|e| e.to_string())?;
        *w = None;
    }

    let watch_path = PathBuf::from(&workspace);
    let handle = app_handle.clone();
    let write_guard = Arc::clone(&app_handle.state::<AppState>().inner().write_guard);
    let watch_dir = watch_path.clone();

    let mut watcher = notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
        let event = match res {
            Ok(e) => e,
            Err(_) => return,
        };

        for path in &event.paths {
            let name = match path.file_name() {
                Some(n) => n.to_string_lossy().to_string(),
                None => continue,
            };

            // Only care about .md files, not hidden
            if !name.ends_with(".md") || name.starts_with('.') {
                continue;
            }

            // Skip files inside hidden or ignored directories
            if let Ok(rel) = path.strip_prefix(&watch_dir) {
                let dominated_by_hidden = rel.components().any(|c| {
                    let s = c.as_os_str().to_string_lossy();
                    should_skip_dir(&s)
                });
                if dominated_by_hidden {
                    continue;
                }
            } else {
                continue; // outside watch dir
            }

            // Check write guard — if we wrote this file, skip the event
            {
                let mut guard = match write_guard.lock() {
                    Ok(g) => g,
                    Err(_) => continue,
                };
                if guard.remove(path) {
                    continue;
                }
            }

            // Compute relative path from workspace root
            let rel_path = match path.strip_prefix(&watch_dir) {
                Ok(r) => r.to_string_lossy().replace('\\', "/"),
                Err(_) => continue,
            };

            let payload = FsEvent { rel_path };

            match event.kind {
                EventKind::Create(_) => {
                    if is_strata_file(path) {
                        let _ = handle.emit("fs:created", &payload);
                    }
                }
                EventKind::Modify(_) => {
                    if is_strata_file(path) {
                        let _ = handle.emit("fs:modified", &payload);
                    }
                }
                EventKind::Remove(_) => {
                    let _ = handle.emit("fs:deleted", &payload);
                }
                _ => {}
            }
        }
    }).map_err(|e| e.to_string())?;

    watcher
        .watch(&watch_path, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    let mut w = state.watcher.lock().map_err(|e| e.to_string())?;
    *w = Some(watcher);

    Ok(())
}

#[tauri::command]
fn stop_watching(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut w = state.watcher.lock().map_err(|e| e.to_string())?;
    *w = None;
    Ok(())
}

// ── Menu builder ──

fn build_menu(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();

    let mut menu_builder = MenuBuilder::new(handle);

    // macOS app menu
    if cfg!(target_os = "macos") {
        let app_menu = SubmenuBuilder::new(handle, "Strata")
            .about(None)
            .separator()
            .hide()
            .hide_others()
            .show_all()
            .separator()
            .quit()
            .build()?;
        menu_builder = menu_builder.item(&app_menu);
    }

    // File menu
    let mut file_builder = SubmenuBuilder::new(handle, "File")
        .item(&MenuItem::with_id(handle, "new-document", "New Document", true, Some("CmdOrCtrl+N"))?);

    file_builder = file_builder
        .separator()
        .item(&MenuItem::with_id(handle, "settings", "Settings...", true, Some("CmdOrCtrl+,"))?);

    if !cfg!(target_os = "macos") {
        file_builder = file_builder.separator().quit();
    }

    let file_menu = file_builder.build()?;

    // Edit menu
    let edit_menu = SubmenuBuilder::new(handle, "Edit")
        .item(&MenuItem::with_id(handle, "undo", "Undo", true, Some("CmdOrCtrl+Z"))?)
        .item(&MenuItem::with_id(handle, "redo", "Redo", true, Some("CmdOrCtrl+Shift+Z"))?)
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    // View menu
    let view_menu = SubmenuBuilder::new(handle, "View")
        .item(&MenuItem::with_id(handle, "view-outline", "Outline Mode", true, Some("CmdOrCtrl+1"))?)
        .item(&MenuItem::with_id(handle, "view-split", "Split Mode", true, Some("CmdOrCtrl+2"))?)
        .item(&MenuItem::with_id(handle, "view-board", "Board Mode", true, Some("CmdOrCtrl+3"))?)
        .separator()
        .item(&MenuItem::with_id(handle, "toggle-sidebar", "Toggle Sidebar", true, Some("CmdOrCtrl+B"))?)
        .separator()
        .item(&MenuItem::with_id(handle, "toggle-tags", "Toggle Tags", true, None::<&str>)?)
        .build()?;

    // Help menu
    let help_menu = SubmenuBuilder::new(handle, "Help")
        .item(&MenuItem::with_id(handle, "shortcuts", "Keyboard Shortcuts", true, Some("CmdOrCtrl+/"))?)
        .build()?;

    let menu = menu_builder
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&help_menu)
        .build()?;

    app.set_menu(menu)?;

    // Forward menu events to the frontend
    app.on_menu_event(move |app_handle, event| {
        let _ = app_handle.emit("menu-action", event.id().0.as_str());
    });

    Ok(())
}

// ── Entry point ──

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            watcher: Mutex::new(None),
            write_guard: Arc::new(Mutex::new(HashSet::new())),
        })
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            build_menu(app)?;

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
            mark_file_write,
            start_watching,
            stop_watching,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
