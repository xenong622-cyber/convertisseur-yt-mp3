# Convertisseur YT Audio

## Projet

Application desktop Windows (10/11) pour extraire l'audio de vidéos YouTube en FLAC, MP3 ou WAV.
Repo GitHub : https://github.com/xenong622-cyber/convertisseur-yt-mp3

## Stack

- **Tauri v2** — framework desktop (backend Rust, frontend web)
- **React 19 + TypeScript** — frontend (single page)
- **Tailwind CSS v4** — styles (via `@tailwindcss/vite`, import dans `src/App.css`)
- **yt-dlp** — sidecar Tauri pour télécharger l'audio YouTube
- **ffmpeg** — conversion audio (appelé par yt-dlp, embarqué comme externalBin)

## Architecture

```
src/                        # Frontend React
  App.tsx                   # UI principale — thème Cyberpunk Neon, custom titlebar, file d'attente
  lib/ytdlp.ts              # Logique coeur : appel sidecar yt-dlp, parsing progression, auto-update
  App.css                   # @import "tailwindcss" + effets neon/grain/grid CSS
src-tauri/                  # Backend Rust
  src/lib.rs                # Commande get_ffmpeg_path + enregistrement plugins (shell, dialog, opener)
  src/main.rs               # Point d'entrée (appelle lib::run())
  tauri.conf.json           # Config app, sidecars, fenêtre 700x550, decorations: false
  capabilities/default.json # Permissions : shell, dialog, window controls (minimize/maximize/close/drag)
  binaries/                 # yt-dlp, ffmpeg et deno (.exe, gitignored, téléchargés via scripts/)
scripts/
  download-binaries.ps1     # Télécharge yt-dlp.exe et ffmpeg.exe (PowerShell)
  download-binaries.sh      # Même chose en bash
```

## Commandes

```bash
# Installer les dépendances
npm install

# Télécharger les binaires yt-dlp + ffmpeg (obligatoire avant dev/build)
# PowerShell :
.\scripts\download-binaries.ps1
# Ou bash :
bash scripts/download-binaries.sh

# Dev
npm run tauri dev

# Build installeur (.exe NSIS)
npm run tauri build
# Output : src-tauri/target/release/bundle/nsis/
```

## Points techniques importants

### Sidecar yt-dlp
- Les binaires dans `src-tauri/binaries/` doivent avoir le suffixe triple : `yt-dlp-x86_64-pc-windows-msvc.exe`, `ffmpeg-x86_64-pc-windows-msvc.exe`
- `capabilities/default.json` doit avoir BOTH `shell:allow-execute` ET `shell:allow-spawn` scopés avec `"sidecar": true` — sinon erreur "Scoped command not found"
- Les event handlers (`command.on("close")`, `command.on("error")`) doivent être enregistrés AVANT `command.spawn()` pour éviter une race condition
- Auto-update yt-dlp au lancement via `updateYtdlp()` dans useEffect

### ffmpeg path
- En dev : `{exe_dir}/../../binaries/ffmpeg-x86_64-pc-windows-msvc.exe`
- En prod : `{exe_dir}/ffmpeg.exe`
- Résolu côté Rust via la commande `get_ffmpeg_path` (invoquée depuis le frontend)

### Custom titlebar
- `decorations: false` dans `tauri.conf.json` — pas de barre de titre Windows native
- Titlebar React avec `appWindow.startDragging()` sur `onMouseDown`
- **Important** : `stopPropagation()` sur le conteneur des boutons window controls, sinon `startDragging` capture le clic avant les boutons
- Permissions requises : `core:window:allow-minimize`, `core:window:allow-toggle-maximize`, `core:window:allow-close`, `core:window:allow-start-dragging`

### Tailwind v4
- Pas de `tailwind.config.js` — Tailwind v4 utilise `@tailwindcss/vite` plugin + `@import "tailwindcss"` dans CSS
- Config dans `vite.config.ts` : plugins `react()` et `tailwindcss()`

### Rust toolchain
- Doit être `stable-x86_64-pc-windows-msvc` (pas gnu, sinon erreur dlltool manquant)

### UI — Thème Cyberpunk Neon
- Fond noir (`bg-gray-950`) avec grille subtile et overlay grain animé
- Accents : rose (`pink-500` / `#ec4899`) et cyan (`cyan-500` / `#06b6d4`)
- Effets CSS custom : `.neon-card`, `.neon-btn`, `.neon-progress`, `.neon-icon` (glow box-shadow)
- Dégradé rose→cyan sur boutons et barre de progression
- `font-mono` pour URLs, stats, et footer

## Version actuelle : v0.2.0

Nouveautés : thème Cyberpunk Neon, custom titlebar, auto-update yt-dlp, progression détaillée (vitesse/taille/ETA), nommage artiste-titre.
