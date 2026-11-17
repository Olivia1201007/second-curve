mod model;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(model::ModelState::default())
        .invoke_handler(tauri::generate_handler![
            model::career_model_load,
            model::career_model_save,
            model::career_model_set_enabled,
            model::career_model_clear,
            model::career_model_request,
        ])
        .run(tauri::generate_context!())
        .expect("SECOND CURVE desktop application failed to start");
}
