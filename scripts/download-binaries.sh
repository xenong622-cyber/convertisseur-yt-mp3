#!/bin/bash
# Downloads yt-dlp.exe and ffmpeg.exe for the Tauri sidecar build
# Run this script before `npm run tauri build` or `npm run tauri dev`

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$SCRIPT_DIR/../src-tauri/binaries"
TRIPLE="x86_64-pc-windows-msvc"

mkdir -p "$BIN_DIR"

# --- yt-dlp ---
YTDLP_PATH="$BIN_DIR/yt-dlp-$TRIPLE.exe"
if [ -f "$YTDLP_PATH" ]; then
    echo "[OK] yt-dlp already exists"
else
    echo "[DL] Downloading yt-dlp..."
    curl -L -o "$YTDLP_PATH" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
    echo "[OK] yt-dlp downloaded"
fi

# --- ffmpeg ---
FFMPEG_PATH="$BIN_DIR/ffmpeg-$TRIPLE.exe"
if [ -f "$FFMPEG_PATH" ]; then
    echo "[OK] ffmpeg already exists"
else
    echo "[DL] Downloading ffmpeg..."
    FFMPEG_ZIP="$BIN_DIR/ffmpeg.zip"
    curl -L -o "$FFMPEG_ZIP" "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
    echo "[..] Extracting ffmpeg.exe..."
    unzip -j "$FFMPEG_ZIP" "*/bin/ffmpeg.exe" -d "$BIN_DIR"
    mv "$BIN_DIR/ffmpeg.exe" "$FFMPEG_PATH"
    rm "$FFMPEG_ZIP"
    echo "[OK] ffmpeg downloaded and extracted"
fi

echo ""
echo "Binaries ready in $BIN_DIR"
echo "  - yt-dlp-$TRIPLE.exe"
echo "  - ffmpeg-$TRIPLE.exe"
