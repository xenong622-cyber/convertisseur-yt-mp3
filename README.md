# Convertisseur YT Audio

Application desktop Windows pour extraire l'audio de vidéos YouTube en FLAC, MP3 ou WAV. Interface Cyberpunk Neon avec effets néon roses et cyan.

![Interface](https://img.shields.io/badge/platform-Windows%2010%2F11-blue) ![Version](https://img.shields.io/badge/version-0.2.0-pink) ![License](https://img.shields.io/badge/license-MIT-green)

## Fonctionnalités

- Téléchargement audio depuis YouTube (vidéos, shorts, YouTube Music)
- Formats : FLAC (lossless), MP3 (320 kbps), WAV
- File d'attente multi-liens (coller plusieurs URLs)
- Choix du dossier de sauvegarde
- Métadonnées et miniature intégrées
- Nommage intelligent artiste - titre depuis les métadonnées YouTube
- Progression détaillée : pourcentage, vitesse, taille, ETA
- Auto-update de yt-dlp au lancement
- Interface Cyberpunk Neon avec barre de titre custom
- Détection anti-bot avec retry automatique via cookies navigateur

## Installation (utilisateur)

Télécharge le dernier installeur depuis la page [Releases](../../releases) :

- **`Convertisseur YT MP3_x.x.x_x64-setup.exe`** — Installeur Windows (recommandé)

## Build depuis les sources

### Prérequis

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (toolchain `stable-x86_64-pc-windows-msvc`)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/) (composant "C++ build tools")

### Étapes

```bash
# 1. Cloner le repo
git clone https://github.com/xenong622-cyber/convertisseur-yt-mp3.git
cd convertisseur-yt-mp3

# 2. Installer les dépendances Node
npm install

# 3. Télécharger yt-dlp et ffmpeg (obligatoire avant le build)
# PowerShell :
.\scripts\download-binaries.ps1
# Ou bash (Git Bash / WSL) :
bash scripts/download-binaries.sh

# 4. Lancer en mode dev
npm run tauri dev

# 5. Ou build l'installeur
npm run tauri build
```

L'installeur est généré dans `src-tauri/target/release/bundle/nsis/`.

## Stack technique

- **[Tauri v2](https://tauri.app/)** — Framework desktop léger
- **React + TypeScript** — Frontend
- **Tailwind CSS v4** — Styles
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** — Extraction audio YouTube
- **[ffmpeg](https://ffmpeg.org/)** — Conversion audio

## Licence

MIT
