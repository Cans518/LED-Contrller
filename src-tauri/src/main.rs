#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Tauri 应用入口

fn main() {
    led_contrller_lib::run();
}
