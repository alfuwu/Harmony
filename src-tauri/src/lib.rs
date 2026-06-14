use tauri::Result;

// https://tauri.app/develop/calling-rust/
#[tauri::command]
fn minimize(window: tauri::Window<tauri::Cef>) -> Result<()> {
    window.minimize()
}

#[tauri::command]
fn toggle_maximize(window: tauri::Window<tauri::Cef>) -> Result<()> {
    if window.is_maximized()? {
        window.unmaximize()
    } else {
        window.maximize()
    }
}

#[tauri::command]
fn close(window: tauri::Window<tauri::Cef>) -> Result<()> {
    window.close()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::<tauri::Cef>::default()
        .setup(|_app| {
            #[cfg(target_os = "macos")] {
                setup_macos_defaults();
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![minimize, toggle_maximize, close])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(target_os = "macos")]
fn setup_macos_defaults() {
    use objc2_foundation::{NSString, NSUserDefaults};

    unsafe {
        let defaults = NSUserDefaults::standardUserDefaults();
        
        // Enable continuous spell checking for webviews - multiple keys to try
        let spellcheck_keys = [
            "WebContinuousSpellCheckingEnabled",
            "NSSpellCheckerAutomaticallyIdentifiesLanguages", 
            "CheckSpellingWhileTyping",
            "WebSmartInsertDeleteEnabled"
        ];
        
        for key_str in spellcheck_keys.iter() {
            let key = NSString::from_str(key_str);
            defaults.setBool_forKey(true, &key);
        }
        
        // Force synchronization of defaults
        defaults.synchronize();
    }
}