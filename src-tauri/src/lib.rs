#[tauri::command]
fn get_ffmpeg_path() -> Result<String, String> {
    let exe_dir = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or("Cannot get exe directory")?
        .to_path_buf();

    // Prod: Tauri NSIS installs sidecar with triple suffix next to the exe
    let prod_triple = exe_dir.join("ffmpeg-x86_64-pc-windows-msvc.exe");
    if prod_triple.exists() {
        return Ok(prod_triple.to_string_lossy().to_string());
    }

    // Prod fallback: plain name
    let prod = exe_dir.join("ffmpeg.exe");
    if prod.exists() {
        return Ok(prod.to_string_lossy().to_string());
    }

    // Dev: binary is in src-tauri/binaries/
    let dev = exe_dir.join("..\\..\\binaries\\ffmpeg-x86_64-pc-windows-msvc.exe");
    if dev.exists() {
        let canonical = std::fs::canonicalize(&dev).map_err(|e| e.to_string())?;
        let path_str = canonical.to_string_lossy().to_string();
        let path_str = path_str.strip_prefix("\\\\?\\").unwrap_or(&path_str).to_string();
        return Ok(path_str);
    }

    Err("ffmpeg.exe introuvable".to_string())
}

#[tauri::command]
fn find_js_runtime() -> Option<String> {
    // Check common Node.js install locations on Windows
    let candidates = vec![
        "C:\\Program Files\\nodejs\\node.exe".to_string(),
        "C:\\Program Files (x86)\\nodejs\\node.exe".to_string(),
    ];

    // Also check user-specific paths
    if let Ok(appdata) = std::env::var("APPDATA") {
        let nvm_path = std::path::Path::new(&appdata).join("nvm");
        if nvm_path.exists() {
            if let Ok(entries) = std::fs::read_dir(&nvm_path) {
                for entry in entries.flatten() {
                    let node = entry.path().join("node.exe");
                    if node.exists() {
                        let path_str = node.to_string_lossy().to_string();
                        return Some(format!("node:{}", path_str));
                    }
                }
            }
        }
    }

    for path in &candidates {
        if std::path::Path::new(path).exists() {
            return Some(format!("node:{}", path));
        }
    }

    // Check if deno is available
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        let deno_path = std::path::Path::new(&userprofile).join(".deno\\bin\\deno.exe");
        if deno_path.exists() {
            return Some(format!("deno:{}", deno_path.to_string_lossy()));
        }
    }

    // Try PATH as last resort (works in dev, may not work in installed GUI app)
    if let Ok(output) = std::process::Command::new("where").arg("node.exe").output() {
        if output.status.success() {
            if let Ok(stdout) = String::from_utf8(output.stdout) {
                if let Some(first_line) = stdout.lines().next() {
                    let path = first_line.trim();
                    if !path.is_empty() {
                        return Some(format!("node:{}", path));
                    }
                }
            }
        }
    }

    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![get_ffmpeg_path, find_js_runtime])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
