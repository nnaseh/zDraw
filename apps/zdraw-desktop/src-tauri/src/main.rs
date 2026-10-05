// zDraw desktop: a window around the built web app. No custom commands/IPC.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running zDraw");
}
