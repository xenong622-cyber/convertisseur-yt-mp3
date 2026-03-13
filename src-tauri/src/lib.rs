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
fn get_deno_path() -> Result<String, String> {
    let exe_dir = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or("Cannot get exe directory")?
        .to_path_buf();

    // Prod: bundled deno next to the exe
    let prod_triple = exe_dir.join("deno-x86_64-pc-windows-msvc.exe");
    if prod_triple.exists() {
        return Ok(prod_triple.to_string_lossy().to_string());
    }

    let prod = exe_dir.join("deno.exe");
    if prod.exists() {
        return Ok(prod.to_string_lossy().to_string());
    }

    // Dev: binary is in src-tauri/binaries/
    let dev = exe_dir.join("..\\..\\binaries\\deno-x86_64-pc-windows-msvc.exe");
    if dev.exists() {
        let canonical = std::fs::canonicalize(&dev).map_err(|e| e.to_string())?;
        let path_str = canonical.to_string_lossy().to_string();
        let path_str = path_str.strip_prefix("\\\\?\\").unwrap_or(&path_str).to_string();
        return Ok(path_str);
    }

    Err("deno.exe introuvable".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![get_ffmpeg_path, get_deno_path])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
