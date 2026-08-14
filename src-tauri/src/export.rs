use std::fs;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

fn safe_name(value: &str) -> String {
    let cleaned: String = value.chars()
        .map(|c| if matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') { '_' } else { c })
        .collect();
    let trimmed = cleaned.trim().trim_matches('.');
    if trimmed.is_empty() { "screenplay".to_string() } else { trimmed.to_string() }
}

fn choose_save_path(app: &AppHandle, filename: &str, extension: &str, label: &str) -> Result<Option<std::path::PathBuf>, String> {
    let suggested = format!("{}.{}", safe_name(filename), extension);
    let selected = app
        .dialog()
        .file()
        .set_title("حفظ الملف")
        .set_file_name(&suggested)
        .add_filter(label, &[extension])
        .blocking_save_file();

    match selected {
        Some(path) => path.into_path().map(Some).map_err(|e| e.to_string()),
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn export_text_file(
    app: AppHandle,
    filename: String,
    content: String,
    extension: String,
) -> Result<String, String> {
    let (ext, label) = match extension.to_lowercase().as_str() {
        "fountain" => ("fountain", "Fountain"),
        "json" => ("json", "JSON"),
        "txt" => ("txt", "Text"),
        _ => return Err("صيغة تصدير غير مدعومة.".into()),
    };

    let Some(path) = choose_save_path(&app, &filename, ext, label)? else {
        return Ok(String::new());
    };
    fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn export_binary_file(
    app: AppHandle,
    filename: String,
    bytes: Vec<u8>,
    extension: String,
) -> Result<String, String> {
    let (ext, label) = match extension.to_lowercase().as_str() {
        "docx" => ("docx", "Word document"),
        _ => return Err("صيغة ملف ثنائي غير مدعومة.".into()),
    };

    let Some(path) = choose_save_path(&app, &filename, ext, label)? else {
        return Ok(String::new());
    };
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}
