use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use walkdir::WalkDir;

const MAX_LIBRARY_FILES: usize = 20_000;
const MAX_MARKDOWN_SIZE: u64 = 2 * 1024 * 1024;
const MAX_RAVI_SIZE: u64 = 64 * 1024 * 1024;
const MAX_RECENT_FILES: usize = 20;
const MAX_HISTORY_DOCUMENTS: usize = 50;
const MAX_DOCUMENT_VERSIONS: usize = 30;

#[derive(Default)]
struct AccessState {
    allowed_roots: HashSet<String>,
    allowed_documents: HashSet<String>,
    renderer_ready: bool,
    pending_document: Option<PathBuf>,
}

#[derive(Default)]
struct AppState {
    access: Mutex<AccessState>,
}

#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecentFile {
    path: String,
    name: String,
    document_type: String,
    opened_at: String,
}

#[derive(Clone, Default, Deserialize, Serialize)]
struct LibraryStateFile {
    folders: Vec<String>,
    recents: Vec<RecentFile>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LibraryFolder {
    root_name: String,
    root_path: String,
}

#[derive(Serialize)]
struct LibrarySnapshot {
    folders: Vec<LibraryFolder>,
    recents: Vec<RecentFile>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LibraryFile {
    id: String,
    name: String,
    path: String,
    native_path: String,
    size: u64,
    last_modified: u128,
    document_type: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LibraryScan {
    root_name: String,
    root_path: String,
    files: Vec<LibraryFile>,
    truncated: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenedDocument {
    name: String,
    path: String,
    document_type: String,
    content: String,
    annotations: Vec<Value>,
    assets: Vec<Value>,
    revision: u64,
    versions: Vec<Value>,
    open_in_reading_mode: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DocumentPayload {
    content: String,
    #[allow(dead_code)]
    annotations: Vec<Value>,
    #[allow(dead_code)]
    assets: Vec<Value>,
    revision: u64,
    versions: Vec<Value>,
    raavi: Value,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveResult {
    saved: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ravi_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    markdown_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    document_type: Option<String>,
}

impl SaveResult {
    fn canceled() -> Self {
        Self {
            saved: false,
            file_path: None,
            ravi_path: None,
            markdown_path: None,
            document_type: None,
        }
    }
}

#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct HistoryEntry {
    path: String,
    revision: u64,
    versions: Vec<Value>,
    updated_at: String,
}

#[derive(Default, Deserialize, Serialize)]
struct HistoryStateFile {
    documents: HashMap<String, HistoryEntry>,
}

fn app_data_file(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join(name))
}

fn read_json<T: serde::de::DeserializeOwned + Default>(path: &Path) -> T {
    fs::read_to_string(path)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let text = serde_json::to_string_pretty(value).map_err(|error| error.to_string())?;
    fs::write(path, text).map_err(|error| error.to_string())
}

fn library_state(app: &AppHandle) -> Result<LibraryStateFile, String> {
    Ok(read_json(&app_data_file(app, "library-state.json")?))
}

fn save_library_state(app: &AppHandle, value: &LibraryStateFile) -> Result<(), String> {
    write_json(&app_data_file(app, "library-state.json")?, value)
}

fn path_text(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn absolute_path(path: &Path) -> Result<PathBuf, String> {
    if path.is_absolute() {
        Ok(path.to_path_buf())
    } else {
        std::env::current_dir()
            .map(|directory| directory.join(path))
            .map_err(|error| error.to_string())
    }
}

fn path_key(path: &Path) -> Result<String, String> {
    let normalized = match path.canonicalize() {
        Ok(value) => value,
        Err(_) => absolute_path(path)?,
    };
    Ok(path_text(&normalized).to_lowercase())
}

fn path_file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_owned()
}

fn root_name(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| path.to_str().unwrap_or("Library"))
        .to_owned()
}

fn now_iso() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_owned())
}

fn modified_millis(value: SystemTime) -> u128 {
    value
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

fn is_markdown(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_lowercase())
            .as_deref(),
        Some("md" | "markdown")
    )
}

fn is_raavi(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case("ravi"))
}

fn safe_file_name(value: &str, fallback: &str, extension: &str) -> String {
    let cleaned: String = value
        .chars()
        .map(|character| {
            if matches!(
                character,
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
            ) || character.is_control()
            {
                '-'
            } else {
                character
            }
        })
        .collect::<String>()
        .trim()
        .to_owned();
    let base = if cleaned.is_empty() {
        fallback
    } else {
        &cleaned
    };
    if base.to_lowercase().ends_with(extension) {
        base.to_owned()
    } else {
        format!("{base}{extension}")
    }
}

fn ensure_extension(path: PathBuf, extensions: &[&str], fallback: &str) -> PathBuf {
    let current = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    if extensions
        .iter()
        .any(|extension| current.eq_ignore_ascii_case(extension))
    {
        path
    } else {
        PathBuf::from(format!("{}{fallback}", path_text(&path)))
    }
}

fn remember_folder(app: &AppHandle, root: &Path) -> Result<(), String> {
    let root_text = path_text(root);
    let key = path_key(root)?;
    let mut state = library_state(app)?;
    state.folders.retain(|item| {
        path_key(Path::new(item))
            .map(|item_key| item_key != key)
            .unwrap_or(true)
    });
    state.folders.insert(0, root_text);
    state.folders.truncate(30);
    save_library_state(app, &state)
}

fn record_recent(app: &AppHandle, path: &Path, document_type: &str) -> Result<(), String> {
    let resolved = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let key = path_key(&resolved)?;
    let mut state = library_state(app)?;
    state.recents.retain(|item| {
        path_key(Path::new(&item.path))
            .map(|item_key| item_key != key)
            .unwrap_or(true)
    });
    state.recents.insert(
        0,
        RecentFile {
            path: path_text(&resolved),
            name: path_file_name(&resolved),
            document_type: document_type.to_owned(),
            opened_at: now_iso(),
        },
    );
    state.recents.truncate(MAX_RECENT_FILES);
    save_library_state(app, &state)
}

fn history_for(app: &AppHandle, path: &Path) -> Result<(u64, Vec<Value>), String> {
    let state: HistoryStateFile = read_json(&app_data_file(app, "document-history.json")?);
    Ok(state
        .documents
        .get(&path_key(path)?)
        .map(|entry| (entry.revision.max(1), entry.versions.clone()))
        .unwrap_or_else(|| (1, Vec::new())))
}

fn save_history(
    app: &AppHandle,
    path: &Path,
    revision: u64,
    mut versions: Vec<Value>,
) -> Result<(), String> {
    if versions.len() > MAX_DOCUMENT_VERSIONS {
        versions.drain(..versions.len() - MAX_DOCUMENT_VERSIONS);
    }
    let state_path = app_data_file(app, "document-history.json")?;
    let mut state: HistoryStateFile = read_json(&state_path);
    state.documents.insert(
        path_key(path)?,
        HistoryEntry {
            path: path_text(path),
            revision: revision.max(1),
            versions,
            updated_at: now_iso(),
        },
    );
    if state.documents.len() > MAX_HISTORY_DOCUMENTS {
        let mut keys: Vec<_> = state.documents.keys().cloned().collect();
        keys.sort_by(|first, second| {
            state.documents[second]
                .updated_at
                .cmp(&state.documents[first].updated_at)
        });
        let keep: HashSet<_> = keys.into_iter().take(MAX_HISTORY_DOCUMENTS).collect();
        state.documents.retain(|key, _| keep.contains(key));
    }
    write_json(&state_path, &state)
}

fn scan_folder(root: &Path) -> Result<LibraryScan, String> {
    let resolved = root.canonicalize().map_err(|error| error.to_string())?;
    if !resolved.is_dir() {
        return Err("Selected path is not a folder.".to_owned());
    }
    let mut files = Vec::new();
    for entry in WalkDir::new(&resolved)
        .follow_links(false)
        .into_iter()
        .flatten()
    {
        if files.len() >= MAX_LIBRARY_FILES {
            break;
        }
        if !entry.file_type().is_file() || (!is_markdown(entry.path()) && !is_raavi(entry.path())) {
            continue;
        }
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let relative = entry
            .path()
            .strip_prefix(&resolved)
            .unwrap_or(entry.path())
            .to_string_lossy()
            .replace('\\', "/");
        let last_modified = metadata.modified().map(modified_millis).unwrap_or_default();
        let document_type = if is_raavi(entry.path()) {
            "ravi"
        } else {
            "markdown"
        };
        files.push(LibraryFile {
            id: format!("{relative}:{last_modified}:{}", metadata.len()),
            name: path_file_name(entry.path()),
            path: relative,
            native_path: path_text(entry.path()),
            size: metadata.len(),
            last_modified,
            document_type: document_type.to_owned(),
        });
    }
    files.sort_by(|first, second| first.path.to_lowercase().cmp(&second.path.to_lowercase()));
    let truncated = files.len() >= MAX_LIBRARY_FILES;
    Ok(LibraryScan {
        root_name: root_name(&resolved),
        root_path: path_text(&resolved),
        files,
        truncated,
    })
}

fn value_array(value: Option<&Value>) -> Vec<Value> {
    value.and_then(Value::as_array).cloned().unwrap_or_default()
}

fn read_document(
    app: &AppHandle,
    access: &Mutex<AccessState>,
    path: &Path,
    remember: bool,
    reading_mode: bool,
) -> Result<OpenedDocument, String> {
    let resolved = path.canonicalize().map_err(|error| error.to_string())?;
    let metadata = fs::metadata(&resolved).map_err(|error| error.to_string())?;
    if !metadata.is_file() {
        return Err("Selected path is not a file.".to_owned());
    }

    let mut document = if is_markdown(&resolved) {
        if metadata.len() > MAX_MARKDOWN_SIZE {
            return Err("Markdown file is too large.".to_owned());
        }
        let (revision, versions) = history_for(app, &resolved)?;
        OpenedDocument {
            name: path_file_name(&resolved),
            path: path_text(&resolved),
            document_type: "markdown".to_owned(),
            content: fs::read_to_string(&resolved).map_err(|error| error.to_string())?,
            annotations: Vec::new(),
            assets: Vec::new(),
            revision,
            versions,
            open_in_reading_mode: reading_mode,
        }
    } else if is_raavi(&resolved) && metadata.len() <= MAX_RAVI_SIZE {
        let text = fs::read_to_string(&resolved).map_err(|error| error.to_string())?;
        let value: Value = serde_json::from_str(&text).map_err(|error| error.to_string())?;
        if value.get("format").and_then(Value::as_str) != Some("ravi")
            || value.get("version").and_then(Value::as_u64) != Some(1)
        {
            return Err("Raavi document is invalid or unsupported.".to_owned());
        }
        let source = value
            .get("document")
            .and_then(Value::as_object)
            .ok_or_else(|| "Raavi document is invalid or unsupported.".to_owned())?;
        let content = source
            .get("markdown")
            .and_then(Value::as_str)
            .ok_or_else(|| "Raavi document is invalid or unsupported.".to_owned())?;
        OpenedDocument {
            name: source
                .get("name")
                .and_then(Value::as_str)
                .filter(|name| !name.trim().is_empty())
                .map(str::to_owned)
                .unwrap_or_else(|| {
                    format!(
                        "{}.md",
                        resolved
                            .file_stem()
                            .and_then(|v| v.to_str())
                            .unwrap_or("document")
                    )
                }),
            path: path_text(&resolved),
            document_type: "ravi".to_owned(),
            content: content.to_owned(),
            annotations: value_array(value.get("annotations")),
            assets: value_array(value.get("assets")),
            revision: source
                .get("revision")
                .and_then(Value::as_u64)
                .unwrap_or(1)
                .max(1),
            versions: value_array(value.get("versions")),
            open_in_reading_mode: reading_mode,
        }
    } else {
        return Err("Raavi document is too large or unsupported.".to_owned());
    };

    if document.versions.len() > MAX_DOCUMENT_VERSIONS {
        document
            .versions
            .drain(..document.versions.len() - MAX_DOCUMENT_VERSIONS);
    }
    access
        .lock()
        .map_err(|_| "Desktop access state is unavailable.".to_owned())?
        .allowed_documents
        .insert(path_key(&resolved)?);
    if remember {
        record_recent(app, &resolved, &document.document_type)?;
    }
    Ok(document)
}

fn validate_payload(payload: &DocumentPayload) -> Result<(), String> {
    if payload.revision < 1 {
        Err("Document payload is invalid.".to_owned())
    } else {
        Ok(())
    }
}

fn raavi_payload_is_valid(payload: &DocumentPayload) -> bool {
    payload.raavi.get("format").and_then(Value::as_str) == Some("ravi")
        && payload.raavi.get("version").and_then(Value::as_u64) == Some(1)
}

fn dialog_path(value: tauri_plugin_dialog::FilePath) -> Result<PathBuf, String> {
    value.into_path().map_err(|error| error.to_string())
}

#[tauri::command]
async fn get_library_state(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<LibrarySnapshot, String> {
    let mut value = library_state(&app)?;
    value.folders.truncate(30);
    value.recents.truncate(MAX_RECENT_FILES);
    let folders = value
        .folders
        .iter()
        .map(Path::new)
        .map(|path| LibraryFolder {
            root_name: root_name(path),
            root_path: path_text(path),
        })
        .collect();
    let mut access = state
        .access
        .lock()
        .map_err(|_| "Desktop access state is unavailable.".to_owned())?;
    for folder in &value.folders {
        if let Ok(key) = path_key(Path::new(folder)) {
            access.allowed_roots.insert(key);
        }
    }
    Ok(LibrarySnapshot {
        folders,
        recents: value.recents,
    })
}

#[tauri::command]
async fn choose_markdown_folder(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<LibraryScan>, String> {
    let Some(selected) = app
        .dialog()
        .file()
        .set_title("افزودن پوشه به کتابخانه")
        .blocking_pick_folder()
    else {
        return Ok(None);
    };
    let root = dialog_path(selected)?
        .canonicalize()
        .map_err(|error| error.to_string())?;
    state
        .access
        .lock()
        .map_err(|_| "Desktop access state is unavailable.".to_owned())?
        .allowed_roots
        .insert(path_key(&root)?);
    remember_folder(&app, &root)?;
    scan_folder(&root).map(Some)
}

#[tauri::command]
async fn scan_markdown_folder(
    app: AppHandle,
    state: State<'_, AppState>,
    root_path: String,
) -> Result<LibraryScan, String> {
    let root = PathBuf::from(root_path);
    let key = path_key(&root)?;
    let persisted = library_state(&app)?.folders.iter().any(|folder| {
        path_key(Path::new(folder))
            .map(|folder_key| folder_key == key)
            .unwrap_or(false)
    });
    let allowed = state
        .access
        .lock()
        .map_err(|_| "Desktop access state is unavailable.".to_owned())?
        .allowed_roots
        .contains(&key);
    if !allowed && !persisted {
        return Err("This folder must be selected again.".to_owned());
    }
    state
        .access
        .lock()
        .map_err(|_| "Desktop access state is unavailable.".to_owned())?
        .allowed_roots
        .insert(key);
    scan_folder(&root)
}

#[tauri::command]
async fn read_library_document(
    app: AppHandle,
    state: State<'_, AppState>,
    file_path: String,
) -> Result<OpenedDocument, String> {
    let file = PathBuf::from(file_path)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let roots = library_state(&app)?.folders;
    let inside_root = roots.iter().any(|root| {
        Path::new(root)
            .canonicalize()
            .map(|resolved| file.starts_with(resolved))
            .unwrap_or(false)
    });
    if !inside_root {
        return Err("File access is outside the selected library.".to_owned());
    }
    read_document(&app, &state.access, &file, true, false)
}

#[tauri::command]
async fn choose_document(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<OpenedDocument>, String> {
    let Some(selected) = app
        .dialog()
        .file()
        .set_title("بازکردن سند در راوی")
        .add_filter("سندهای راوی", &["md", "markdown", "ravi"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };
    read_document(&app, &state.access, &dialog_path(selected)?, true, false).map(Some)
}

#[tauri::command]
async fn open_recent_document(
    app: AppHandle,
    state: State<'_, AppState>,
    file_path: String,
) -> Result<OpenedDocument, String> {
    let requested = path_key(Path::new(&file_path))?;
    let recent = library_state(&app)?
        .recents
        .into_iter()
        .find(|item| path_key(Path::new(&item.path)).is_ok_and(|key| key == requested))
        .ok_or_else(|| "Recent file access is not allowed.".to_owned())?;
    read_document(&app, &state.access, Path::new(&recent.path), true, false)
}

#[tauri::command]
async fn save_markdown(
    app: AppHandle,
    state: State<'_, AppState>,
    file_name: String,
    document: DocumentPayload,
) -> Result<SaveResult, String> {
    validate_payload(&document)?;
    let name = safe_file_name(&file_name, "نوشته-راوی.md", ".md");
    let mut dialog = app
        .dialog()
        .file()
        .set_title("ذخیره فایل Markdown")
        .set_file_name(name)
        .add_filter("Markdown", &["md", "markdown"]);
    if let Ok(directory) = app.path().document_dir() {
        dialog = dialog.set_directory(directory);
    }
    let Some(selected) = dialog.blocking_save_file() else {
        return Ok(SaveResult::canceled());
    };
    let file = ensure_extension(dialog_path(selected)?, &["md", "markdown"], ".md");
    fs::write(&file, &document.content).map_err(|error| error.to_string())?;
    save_history(&app, &file, document.revision, document.versions)?;
    state
        .access
        .lock()
        .map_err(|_| "Desktop access state is unavailable.".to_owned())?
        .allowed_documents
        .insert(path_key(&file)?);
    record_recent(&app, &file, "markdown")?;
    Ok(SaveResult {
        saved: true,
        file_path: Some(path_text(&file)),
        ravi_path: None,
        markdown_path: None,
        document_type: Some("markdown".to_owned()),
    })
}

#[tauri::command]
async fn save_raavi(
    app: AppHandle,
    state: State<'_, AppState>,
    file_name: String,
    document: DocumentPayload,
) -> Result<SaveResult, String> {
    validate_payload(&document)?;
    if !raavi_payload_is_valid(&document) {
        return Err("Raavi document payload is invalid.".to_owned());
    }
    let name = safe_file_name(&file_name, "نوشته-راوی.ravi", ".ravi");
    let mut dialog = app
        .dialog()
        .file()
        .set_title("ذخیره فایل راوی")
        .set_file_name(name)
        .add_filter("سند راوی", &["ravi"]);
    if let Ok(directory) = app.path().document_dir() {
        dialog = dialog.set_directory(directory);
    }
    let Some(selected) = dialog.blocking_save_file() else {
        return Ok(SaveResult::canceled());
    };
    let ravi_path = ensure_extension(dialog_path(selected)?, &["ravi"], ".ravi");
    let markdown_path = ravi_path.with_extension("md");
    if markdown_path.exists() {
        let overwrite = app
            .dialog()
            .message(format!(
                "یک فایل Markdown با همین نام وجود دارد. آیا «{}» جایگزین شود؟",
                path_file_name(&markdown_path)
            ))
            .title("جایگزینی فایل Markdown")
            .kind(MessageDialogKind::Warning)
            .buttons(MessageDialogButtons::OkCancelCustom(
                "جایگزین شود".to_owned(),
                "انصراف".to_owned(),
            ))
            .blocking_show();
        if !overwrite {
            return Ok(SaveResult::canceled());
        }
    }
    let ravi_text =
        serde_json::to_string_pretty(&document.raavi).map_err(|error| error.to_string())?;
    fs::write(&ravi_path, ravi_text).map_err(|error| error.to_string())?;
    fs::write(&markdown_path, &document.content).map_err(|error| error.to_string())?;
    state
        .access
        .lock()
        .map_err(|_| "Desktop access state is unavailable.".to_owned())?
        .allowed_documents
        .insert(path_key(&ravi_path)?);
    record_recent(&app, &ravi_path, "ravi")?;
    Ok(SaveResult {
        saved: true,
        file_path: Some(path_text(&ravi_path)),
        ravi_path: Some(path_text(&ravi_path)),
        markdown_path: Some(path_text(&markdown_path)),
        document_type: Some("ravi".to_owned()),
    })
}

#[tauri::command]
async fn save_current_document(
    app: AppHandle,
    state: State<'_, AppState>,
    file_path: String,
    document: DocumentPayload,
) -> Result<SaveResult, String> {
    validate_payload(&document)?;
    let file = PathBuf::from(file_path);
    let key = path_key(&file)?;
    let allowed = state
        .access
        .lock()
        .map_err(|_| "Desktop access state is unavailable.".to_owned())?
        .allowed_documents
        .contains(&key);
    if !allowed {
        return Err("This document must be opened before it can be saved.".to_owned());
    }
    let document_type = if is_raavi(&file) { "ravi" } else { "markdown" };
    if document_type == "ravi" {
        if !raavi_payload_is_valid(&document) {
            return Err("Raavi document payload is invalid.".to_owned());
        }
        let ravi_text =
            serde_json::to_string_pretty(&document.raavi).map_err(|error| error.to_string())?;
        fs::write(&file, ravi_text).map_err(|error| error.to_string())?;
        fs::write(file.with_extension("md"), &document.content)
            .map_err(|error| error.to_string())?;
    } else {
        fs::write(&file, &document.content).map_err(|error| error.to_string())?;
        save_history(&app, &file, document.revision, document.versions)?;
    }
    record_recent(&app, &file, document_type)?;
    Ok(SaveResult {
        saved: true,
        file_path: Some(path_text(&file)),
        ravi_path: None,
        markdown_path: None,
        document_type: Some(document_type.to_owned()),
    })
}

#[tauri::command]
async fn renderer_ready(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let pending = {
        let mut access = state
            .access
            .lock()
            .map_err(|_| "Desktop access state is unavailable.".to_owned())?;
        access.renderer_ready = true;
        access.pending_document.take()
    };
    if let Some(path) = pending {
        let document = read_document(&app, &state.access, &path, true, true)?;
        app.emit("document-open-path", document)
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn document_argument(arguments: &[String], working_directory: Option<&str>) -> Option<PathBuf> {
    arguments.iter().find_map(|argument| {
        let path = PathBuf::from(argument);
        if !is_markdown(&path) && !is_raavi(&path) {
            return None;
        }
        if path.is_absolute() {
            Some(path)
        } else {
            Some(
                working_directory
                    .map(PathBuf::from)
                    .unwrap_or_else(|| std::env::current_dir().unwrap_or_default())
                    .join(path),
            )
        }
    })
}

fn queue_or_open(app: &AppHandle, path: PathBuf) {
    let state = app.state::<AppState>();
    let ready = if let Ok(mut access) = state.access.lock() {
        if access.renderer_ready {
            true
        } else {
            access.pending_document = Some(path.clone());
            false
        }
    } else {
        false
    };
    if ready {
        if let Ok(document) = read_document(app, &state.access, &path, true, true) {
            let _ = app.emit("document-open-path", document);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(
            |app, arguments, working_directory| {
                if let Some(path) = document_argument(&arguments, Some(&working_directory)) {
                    queue_or_open(app, path);
                } else if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            },
        ))
        .setup(|app| {
            let arguments: Vec<String> = std::env::args().skip(1).collect();
            if let Some(path) = document_argument(&arguments, None) {
                queue_or_open(app.handle(), path);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_library_state,
            choose_markdown_folder,
            scan_markdown_folder,
            read_library_document,
            choose_document,
            open_recent_document,
            save_markdown,
            save_raavi,
            save_current_document,
            renderer_ready,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Raavi");
}
