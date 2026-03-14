# YT Audio Converter

## Project

Windows desktop app (10/11) to extract audio from YouTube videos as MP3 320 kbps.
GitHub repo: https://github.com/xenong622-cyber/convertisseur-yt-mp3

## Stack

- **Tauri v2** — desktop framework (Rust backend, web frontend)
- **React 19 + TypeScript** — frontend (single page)
- **Tailwind CSS v4** — styles (via `@tailwindcss/vite`, imported in `src/App.css`)
- **yt-dlp** — Tauri sidecar to download YouTube audio
- **ffmpeg** — audio conversion (called by yt-dlp, bundled as externalBin)

## Architecture

```
src/                        # React frontend
  App.tsx                   # Main UI — Cyberpunk Neon theme, custom titlebar, download queue
  lib/ytdlp.ts              # Core logic: yt-dlp sidecar calls, progress parsing, auto-update
  App.css                   # @import "tailwindcss" + neon/grain/grid CSS effects
src-tauri/                  # Rust backend
  src/lib.rs                # get_ffmpeg_path command + plugin registration (shell, dialog, opener)
  src/main.rs               # Entry point (calls lib::run())
  tauri.conf.json           # App config, sidecars, 700x550 window, decorations: false
  capabilities/default.json # Permissions: shell, dialog, window controls (minimize/maximize/close/drag)
  binaries/                 # yt-dlp and ffmpeg (.exe, gitignored, downloaded via scripts/)
scripts/
  download-binaries.ps1     # Downloads yt-dlp.exe and ffmpeg.exe (PowerShell)
  download-binaries.sh      # Same thing in bash
```

## Commands

```bash
# Install dependencies
npm install

# Download yt-dlp + ffmpeg binaries (required before dev/build)
# PowerShell:
.\scripts\download-binaries.ps1
# Or bash:
bash scripts/download-binaries.sh

# Dev
npm run tauri dev

# Build installer (.exe NSIS)
npm run tauri build
# Output: src-tauri/target/release/bundle/nsis/
```

## Important technical notes

### yt-dlp sidecar
- Binaries in `src-tauri/binaries/` must have the triple suffix: `yt-dlp-x86_64-pc-windows-msvc.exe`, `ffmpeg-x86_64-pc-windows-msvc.exe`
- `capabilities/default.json` must have BOTH `shell:allow-execute` AND `shell:allow-spawn` scoped with `"sidecar": true` — otherwise "Scoped command not found" error
- Event handlers (`command.on("close")`, `command.on("error")`) must be registered BEFORE `command.spawn()` to avoid a race condition
- Auto-update yt-dlp on startup via `updateYtdlp()` in useEffect

### ffmpeg path
- In dev: `{exe_dir}/../../binaries/ffmpeg-x86_64-pc-windows-msvc.exe`
- In prod: `{exe_dir}/ffmpeg.exe`
- Resolved on the Rust side via the `get_ffmpeg_path` command (invoked from the frontend)

### Custom titlebar
- `decorations: false` in `tauri.conf.json` — no native Windows titlebar
- React titlebar with `appWindow.startDragging()` on `onMouseDown`
- **Important**: `stopPropagation()` on the window controls button container, otherwise `startDragging` captures the click before the buttons
- Required permissions: `core:window:allow-minimize`, `core:window:allow-toggle-maximize`, `core:window:allow-close`, `core:window:allow-start-dragging`

### Tailwind v4
- No `tailwind.config.js` — Tailwind v4 uses `@tailwindcss/vite` plugin + `@import "tailwindcss"` in CSS
- Config in `vite.config.ts`: plugins `react()` and `tailwindcss()`

### Rust toolchain
- Must be `stable-x86_64-pc-windows-msvc` (not gnu, otherwise missing dlltool error)

### UI — Cyberpunk Neon theme
- Black background (`bg-gray-950`) with subtle grid and animated grain overlay
- Accents: pink (`pink-500` / `#ec4899`) and cyan (`cyan-500` / `#06b6d4`)
- Custom CSS effects: `.neon-card`, `.neon-btn`, `.neon-progress`, `.neon-icon` (glow box-shadow)
- Pink→cyan gradient on buttons and progress bar
- `font-mono` for URLs, stats, and footer

### Installer size
- NSIS installer: ~45 MB (yt-dlp 18 MB + ffmpeg 95 MB compressed + Tauri shell ~3 MB)
- Deno was removed (saved 121 MB) — yt-dlp works without external JS runtime
- Do not reintroduce deno unless absolutely necessary

### Audio format
- Hardcoded to MP3 320 kbps — best practical quality from YouTube
- YouTube source is already lossy (AAC/Opus ~250 kbps), so FLAC/WAV only inflate file size without quality gain

## Current version: v0.2.0

New: Cyberpunk Neon theme, custom titlebar, auto-update yt-dlp, detailed progress (speed/size/ETA), artist-title naming.
Release: https://github.com/xenong622-cyber/convertisseur-yt-mp3/releases/tag/v0.2.0
