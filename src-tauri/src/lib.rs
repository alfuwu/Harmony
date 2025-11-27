use tauri::Result;

// https://tauri.app/develop/calling-rust/
#[tauri::command]
fn minimize(window: tauri::Window) -> Result<()> {
    window.minimize()
}

#[tauri::command]
fn toggle_maximize(window: tauri::Window) -> Result<()> {
    if window.is_maximized()? {
        window.unmaximize()
    } else {
        window.maximize()
    }
}

#[tauri::command]
fn close(window: tauri::Window) -> Result<()> {
    window.close()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![minimize, toggle_maximize, close])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
