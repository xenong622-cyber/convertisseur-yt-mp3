# YT Audio Converter

Windows desktop app to extract audio from YouTube videos as MP3 (320 kbps). Cyberpunk Neon UI with pink and cyan neon effects.

![Interface](https://img.shields.io/badge/platform-Windows%2010%2F11-blue) ![Version](https://img.shields.io/badge/version-0.2.0-pink) ![License](https://img.shields.io/badge/license-MIT-green)

## Features

- Audio download from YouTube (videos, shorts, YouTube Music)
- MP3 320 kbps — best practical quality from YouTube's lossy source
- Multi-link queue (paste multiple URLs at once)
- Custom output folder selection
- Embedded metadata and thumbnails
- Smart naming: artist - title from YouTube metadata
- Detailed progress: percentage, speed, file size, ETA
- Auto-update yt-dlp on startup
- Cyberpunk Neon interface with custom titlebar
- Anti-bot detection with automatic retry via browser cookies

## Installation (user)

Download the latest installer from the [Releases](../../releases) page:

- **`Convertisseur YT MP3_x.x.x_x64-setup.exe`** — Windows installer (recommended)

## Build from source

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (toolchain `stable-x86_64-pc-windows-msvc`)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/) ("C++ build tools" component)

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/xenong622-cyber/convertisseur-yt-mp3.git
cd convertisseur-yt-mp3

# 2. Install Node dependencies
npm install

# 3. Download yt-dlp and ffmpeg (required before build)
# PowerShell:
.\scripts\download-binaries.ps1
# Or bash (Git Bash / WSL):
bash scripts/download-binaries.sh

# 4. Run in dev mode
npm run tauri dev

# 5. Or build the installer
npm run tauri build
```

The installer is generated in `src-tauri/target/release/bundle/nsis/`.

## Tech stack

- **[Tauri v2](https://tauri.app/)** — Lightweight desktop framework
- **React + TypeScript** — Frontend
- **Tailwind CSS v4** — Styles
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** — YouTube audio extraction
- **[ffmpeg](https://ffmpeg.org/)** — Audio conversion

## License

MIT
