// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

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
    socket
        .send_to(data.as_bytes(), &target)
        .map_err(|e| e.to_string())?;

    Ok("Sent".to_string())
}

#[command]
fn send_and_receive_udp(ip: String, data: String) -> Result<String, String> {
    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    socket
        .set_read_timeout(Some(std::time::Duration::from_secs(2)))
        .map_err(|e| e.to_string())?;

    let target = format!("{}:{}", ip, PORT);
    socket
        .send_to(data.as_bytes(), &target)
        .map_err(|e| e.to_string())?;

    let mut buf = [0; 4096]; // Buffer for response
    let (amt, _src) = socket.recv_from(&mut buf).map_err(|e| e.to_string())?;

    let response = String::from_utf8_lossy(&buf[..amt]).to_string();
    Ok(response)
}

// Define struct for device response
#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct DeviceResponse {
    ip: String,
    mac: String,
}

#[command]
fn scan_devices() -> Result<Vec<DeviceResponse>, String> {
    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    socket.set_broadcast(true).map_err(|e| e.to_string())?;
    // Set a short read timeout to allow checking for multiple responses repeatedly
    socket
        .set_read_timeout(Some(std::time::Duration::from_millis(100)))
        .map_err(|e| e.to_string())?;

    let target = format!("255.255.255.255:{}", PORT);
    let data = r#"{"cmd":"discover"}"#;

    socket
        .send_to(data.as_bytes(), &target)
        .map_err(|e| e.to_string())?;

    let mut found_devices = Vec::new(); // Use Vec to store full objects, we'll dedupe by IP/MAC if needed or just trust user visual
    let mut seen_ips = std::collections::HashSet::new(); // Helper to avoid duplicates

    let start = std::time::Instant::now();
    let duration = std::time::Duration::from_secs(2); // Scan for 2 seconds

    let mut buf = [0; 4096];

    // Loop until timeout
    while start.elapsed() < duration {
        if let Ok((amt, _src)) = socket.recv_from(&mut buf) {
            let response_str = String::from_utf8_lossy(&buf[..amt]);
            if let Ok(device) = serde_json::from_str::<DeviceResponse>(&response_str) {
                if seen_ips.insert(device.ip.clone()) {
                    found_devices.push(device);
                }
            }
        }
    }

    Ok(found_devices)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            #[cfg(target_os = "android")]
            {
                use tauri::Manager;
                if let Some(window) = _app.get_webview_window("main") {
                    let _ = window.set_fullscreen(true);
                }
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            send_udp,
            send_and_receive_udp,
            scan_devices
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
