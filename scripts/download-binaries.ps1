#!/usr/bin/env pwsh
# Downloads yt-dlp.exe and ffmpeg.exe for the Tauri sidecar build
# Run this script before `npm run tauri build` or `npm run tauri dev`

$ErrorActionPreference = "Stop"
$binDir = Join-Path $PSScriptRoot ".." "src-tauri" "binaries"
$triple = "x86_64-pc-windows-msvc"

if (-not (Test-Path $binDir)) {
    New-Item -ItemType Directory -Path $binDir -Force | Out-Null
}

# --- yt-dlp ---
$ytdlpPath = Join-Path $binDir "yt-dlp-$triple.exe"
if (Test-Path $ytdlpPath) {
    Write-Host "[OK] yt-dlp already exists" -ForegroundColor Green
} else {
    Write-Host "[DL] Downloading yt-dlp..." -ForegroundColor Cyan
    $ytdlpUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
    Invoke-WebRequest -Uri $ytdlpUrl -OutFile $ytdlpPath -UseBasicParsing
    Write-Host "[OK] yt-dlp downloaded" -ForegroundColor Green
}

# --- ffmpeg ---
$ffmpegPath = Join-Path $binDir "ffmpeg-$triple.exe"
if (Test-Path $ffmpegPath) {
    Write-Host "[OK] ffmpeg already exists" -ForegroundColor Green
} else {
    Write-Host "[DL] Downloading ffmpeg (this may take a minute)..." -ForegroundColor Cyan
    $ffmpegZip = Join-Path $binDir "ffmpeg.zip"
    $ffmpegUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
    Invoke-WebRequest -Uri $ffmpegUrl -OutFile $ffmpegZip -UseBasicParsing

    Write-Host "[..] Extracting ffmpeg.exe..." -ForegroundColor Cyan
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($ffmpegZip)
    $entry = $zip.Entries | Where-Object { $_.FullName -like "*/bin/ffmpeg.exe" } | Select-Object -First 1
    if ($null -eq $entry) {
        $zip.Dispose()
        Remove-Item $ffmpegZip -Force
        throw "ffmpeg.exe not found in zip"
    }
    $stream = $entry.Open()
    $fileStream = [System.IO.File]::Create($ffmpegPath)
    $stream.CopyTo($fileStream)
    $fileStream.Close()
    $stream.Close()
    $zip.Dispose()
    Remove-Item $ffmpegZip -Force
    Write-Host "[OK] ffmpeg downloaded and extracted" -ForegroundColor Green
}

Write-Host ""
Write-Host "Binaries ready in $binDir" -ForegroundColor Green
Write-Host "  - yt-dlp-$triple.exe"
Write-Host "  - ffmpeg-$triple.exe"
