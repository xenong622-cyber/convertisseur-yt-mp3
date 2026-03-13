import { Command } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";

export type AudioFormat = "flac" | "mp3" | "wav";

export type DownloadStatus =
  | { type: "idle" }
  | { type: "fetching_info" }
  | { type: "downloading"; percent: number; speed: string; eta: string }
  | { type: "converting" }
  | { type: "done"; filePath: string; title: string }
  | { type: "error"; message: string };

export async function downloadAudio(
  url: string,
  outputDir: string,
  format: AudioFormat,
  onStatus: (status: DownloadStatus) => void
): Promise<void> {
  onStatus({ type: "fetching_info" });

  let ffmpegPath: string;
  try {
    ffmpegPath = await invoke<string>("get_ffmpeg_path");
  } catch (e) {
    onStatus({ type: "error", message: `Impossible de trouver ffmpeg: ${e}` });
    return;
  }

  const args = [
    "-x",
    "--audio-format", format,
    "--audio-quality", "0",
    "--embed-thumbnail",
    "--add-metadata",
    "--ffmpeg-location", ffmpegPath,
    "--newline",
    "--no-playlist",
    "--progress",
    "--extractor-args", "youtube:player_client=web_creator,mediaconnect",
    "-o", `${outputDir}/%(title)s.%(ext)s`,
    url,
  ];

  // MP3: force 320kbps CBR for best quality
  if (format === "mp3") {
    args.splice(args.indexOf("--audio-quality"), 2, "--audio-quality", "320K");
  }

  let title = "";
  let lastFilePath = "";
  const stderrLines: string[] = [];

  const command = Command.sidecar("binaries/yt-dlp", args);

  command.stdout.on("data", (line: string) => {
    const titleMatch = line.match(/\[download\]\s+Destination:\s+(.+)/);
    if (titleMatch) {
      lastFilePath = titleMatch[1].trim();
      const parts = lastFilePath.split(/[/\\]/);
      const filename = parts[parts.length - 1];
      title = filename.replace(/\.[^.]+$/, "");
    }

    if (line.includes("[youtube]") || line.includes("[info]")) {
      onStatus({ type: "fetching_info" });
      return;
    }

    const progressMatch = line.match(
      /\[download\]\s+([\d.]+)%\s+of.*?at\s+([\d.]+\s*\S+)\s+ETA\s+(\S+)/
    );
    if (progressMatch) {
      onStatus({
        type: "downloading",
        percent: parseFloat(progressMatch[1]),
        speed: progressMatch[2],
        eta: progressMatch[3],
      });
      return;
    }

    const simpleProgress = line.match(/\[download\]\s+([\d.]+)%/);
    if (simpleProgress) {
      onStatus({
        type: "downloading",
        percent: parseFloat(simpleProgress[1]),
        speed: "",
        eta: "",
      });
      return;
    }

    if (line.includes("has already been downloaded")) {
      const alreadyMatch = line.match(/\[download\]\s+(.+?)\s+has already/);
      if (alreadyMatch) {
        lastFilePath = alreadyMatch[1].trim();
        const parts = lastFilePath.split(/[/\\]/);
        const filename = parts[parts.length - 1];
        title = filename.replace(/\.[^.]+$/, "");
      }
    }

    if (
      line.includes("[ExtractAudio]") ||
      line.includes("[Postprocess") ||
      line.includes("[EmbedThumbnail]") ||
      line.includes("[Metadata]")
    ) {
      onStatus({ type: "converting" });
    }
  });

  command.stderr.on("data", (line: string) => {
    console.warn("[yt-dlp stderr]", line);
    if (line.trim()) {
      stderrLines.push(line.trim());
    }
  });

  const resultPromise = new Promise<void>((resolve, reject) => {
    command.on("close", (data) => {
      if (data.code === 0) {
        const outPath = lastFilePath.replace(/\.[^.]+$/, `.${format}`);
        onStatus({
          type: "done",
          filePath: outPath,
          title: title || "Audio",
        });
        resolve();
      } else {
        const errMsg = stderrLines.length > 0
          ? stderrLines.slice(-3).join("\n")
          : `yt-dlp s'est terminé avec le code ${data.code}`;
        onStatus({ type: "error", message: errMsg });
        reject(new Error(errMsg));
      }
    });

    command.on("error", (error) => {
      const errMsg = `Erreur: ${error}`;
      onStatus({ type: "error", message: errMsg });
      reject(new Error(errMsg));
    });
  });

  try {
    await command.spawn();
  } catch (e) {
    onStatus({
      type: "error",
      message: `Impossible de lancer yt-dlp: ${e}`,
    });
    throw e;
  }

  return resultPromise;
}

export function isValidYoutubeUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^https?:\/\/youtu\.be\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/,
    /^https?:\/\/music\.youtube\.com\/watch\?v=[\w-]+/,
  ];
  return patterns.some((p) => p.test(url.trim()));
}
