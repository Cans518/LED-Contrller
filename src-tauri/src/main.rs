// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::UdpSocket;
use tauri::command;

const PORT: u16 = 8888;

// 这个函数会被前端 React 调用
#[command]
fn send_udp(ip: String, data: String) -> Result<String, String> {
    // 绑定本地任意端口
    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    let target = format!("{}:{}", ip, PORT);
    
    // 发送数据
    socket.send_to(data.as_bytes(), &target).map_err(|e| e.to_string())?;
    
    Ok("Sent".to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![send_udp])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}