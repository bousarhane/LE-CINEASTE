mod db;
mod export;
mod models;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            db::init(app.handle()).map_err(std::io::Error::other)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::list_projects,
            db::load_project,
            db::save_project_snapshot,
            db::delete_project,
            export::export_text_file,
            export::export_binary_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Scene Writer");
}
