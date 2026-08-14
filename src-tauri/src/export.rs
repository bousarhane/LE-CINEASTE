use std::fs;
use tauri::{AppHandle, Manager};

fn safe_name(value: &str) -> String {
    let cleaned: String = value.chars()
        .map(|c| if matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') { '_' } else { c })
        .collect();
    let trimmed = cleaned.trim().trim_matches('.');
    if trimmed.is_empty() { "screenplay".to_string() } else { trimmed.to_string() }
}

fn export_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let base = app.path().document_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|e| e.to_string())?;
    let dir = base.join("Scene Writer");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[tauri::command]
pub fn export_text_file(
    app: AppHandle,
    filename: String,
    content: String,
    extension: String,
) -> Result<String, String> {
    let ext = match extension.to_lowercase().as_str() {
        "fountain" => "fountain",
        "json" => "json",
        "txt" => "txt",
        _ => return Err("صيغة تصدير غير مدعومة.".into()),
    };

    let path = export_dir(&app)?.join(format!("{}.{}", safe_name(&filename), ext));
    fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn export_binary_file(
    app: AppHandle,
    filename: String,
    bytes: Vec<u8>,
    extension: String,
) -> Result<String, String> {
    let ext = match extension.to_lowercase().as_str() {
        "docx" => "docx",
        _ => return Err("صيغة ملف ثنائي غير مدعومة.".into()),
    };

    let path = export_dir(&app)?.join(format!("{}.{}", safe_name(&filename), ext));
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}
