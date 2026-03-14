import { Command } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";

export type AudioFormat = "flac" | "mp3" | "wav";

export type DownloadStatus =
  | { type: "idle" }
  | { type: "fetching_info" }
  | { type: "downloading"; percent: number; speed: string; eta: string; fileSize: string }
  | { type: "converting" }
  | { type: "done"; filePath: string; title: string }
  | { type: "error"; message: string };

function convertToMB(value: string): string {
  const match = value.match(/([\d.]+)\s*(\S+)/);
  if (!match) return value;
  const num = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.includes("gib")) return `${(num * 1.074).toFixed(2)} GB`;
  if (unit.includes("mib")) return `${(num * 1.049).toFixed(1)} MB`;
  if (unit.includes("kib")) return `${(num / 976.6).toFixed(2)} MB`;
  if (unit.includes("gb")) return `${num.toFixed(2)} GB`;
  if (unit.includes("mb")) return `${num.toFixed(1)} MB`;
  if (unit.includes("kb")) return `${(num / 1000).toFixed(2)} MB`;
  return value;
}

function convertSpeed(value: string): string {
  const match = value.match(/([\d.]+)\s*(\S+)/);
  if (!match) return value;
  const num = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.includes("gib/s")) return `${(num * 1074).toFixed(0)} Mo/s`;
  if (unit.includes("mib/s")) return `${(num * 1.049).toFixed(1)} Mo/s`;
  if (unit.includes("kib/s")) return `${(num / 976.6).toFixed(2)} Mo/s`;
  if (unit.includes("gb/s")) return `${(num * 1000).toFixed(0)} Mo/s`;
  if (unit.includes("mb/s")) return `${num.toFixed(1)} Mo/s`;
  if (unit.includes("kb/s")) return `${(num / 1000).toFixed(2)} Mo/s`;
  return value;
}

async function runYtdlp(
  args: string[],
  onStatus: (status: DownloadStatus) => void,
  format: AudioFormat,
): Promise<{ success: boolean; botDetected: boolean; errorMsg: string }> {
  let title = "";
  let lastFilePath = "";
  const allOutput: string[] = [];
  let botDetected = false;

  const command = Command.sidecar("binaries/yt-dlp", args);

  command.stdout.on("data", (line: string) => {
    allOutput.push(line);

    if (line.includes("ERROR:")) {
      if (line.includes("Sign in") || line.includes("bot")) {
        botDetected = true;
      }
      return;
    }

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
      /\[download\]\s+([\d.]+)%\s+of\s+~?\s*([\d.]+\s*\S+)\s+at\s+([\d.]+\s*\S+)\s+ETA\s+(\S+)/
    );
    if (progressMatch) {
      onStatus({
        type: "downloading",
        percent: parseFloat(progressMatch[1]),
        fileSize: convertToMB(progressMatch[2]),
        speed: convertSpeed(progressMatch[3]),
        eta: progressMatch[4],
      });
      return;
    }

    const progressNoEta = line.match(
      /\[download\]\s+([\d.]+)%\s+of\s+~?\s*([\d.]+\s*\S+)\s+at\s+([\d.]+\s*\S+)/
    );
    if (progressNoEta) {
      onStatus({
        type: "downloading",
        percent: parseFloat(progressNoEta[1]),
        fileSize: convertToMB(progressNoEta[2]),
        speed: convertSpeed(progressNoEta[3]),
        eta: "",
      });
      return;
    }

    const simpleProgress = line.match(/\[download\]\s+([\d.]+)%/);
    if (simpleProgress) {
      onStatus({
        type: "downloading",
        percent: parseFloat(simpleProgress[1]),
        fileSize: "",
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
    allOutput.push(line);
    if (line.includes("Sign in") || line.includes("bot")) {
      botDetected = true;
    }
  });

  return new Promise((resolve) => {
    command.on("close", (data) => {
      if (data.code === 0) {
        const outPath = lastFilePath.replace(/\.[^.]+$/, `.${format}`);
        onStatus({
          type: "done",
          filePath: outPath,
          title: title || "Audio",
        });
        resolve({ success: true, botDetected: false, errorMsg: "" });
      } else {
        const errorLines = allOutput
          .filter(l => l.includes("ERROR:"))
          .map(l => l.trim());
        const lastLines = allOutput.slice(-5).map(l => l.trim()).join("\n");
        resolve({
          success: false,
          botDetected,
          errorMsg: errorLines.length > 0 ? errorLines.join("\n") : lastLines,
        });
      }
    });

    command.on("error", (error) => {
      resolve({ success: false, botDetected: false, errorMsg: `Erreur: ${error}` });
    });

    command.spawn().catch((e) => {
      resolve({ success: false, botDetected: false, errorMsg: `Impossible de lancer yt-dlp: ${e}` });
    });
  });
}

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

  const outputTemplate = `${outputDir}/%(artist&{} - |)s%(track,title)s.%(ext)s`;

  const baseArgs = [
    "-x",
    "--audio-format", format,
    "--audio-quality", "0",
    "--embed-thumbnail",
    "--add-metadata",
    "--ffmpeg-location", ffmpegPath,
    "--newline",
    "--no-playlist",
    "--progress",
    "-o", outputTemplate,
    url,
  ];

  if (format === "mp3") {
    baseArgs.splice(baseArgs.indexOf("--audio-quality"), 2, "--audio-quality", "320K");
  }

  // First attempt: without cookies
  const result = await runYtdlp(baseArgs, onStatus, format);
  if (result.success) return;

  // If YouTube detected a bot, retry with browser cookies
  if (result.botDetected) {
    const browsers = ["chrome", "edge", "brave", "firefox", "opera"];
    for (const browser of browsers) {
      onStatus({ type: "fetching_info" });
      const cookieArgs = [...baseArgs.slice(0, -1), "--cookies-from-browser", browser, url];
      const retryResult = await runYtdlp(cookieArgs, onStatus, format);
      if (retryResult.success) return;
      // If it's not a cookie extraction error, don't try other browsers
      if (!retryResult.errorMsg.includes("could not find") &&
          !retryResult.errorMsg.includes("Could not copy") &&
          !retryResult.errorMsg.includes("Failed to decrypt")) {
        // Different error, stop trying
        if (retryResult.botDetected) continue; // Still bot detected, try next browser
        onStatus({ type: "error", message: retryResult.errorMsg });
        return;
      }
    }

    // All browsers failed
    onStatus({
      type: "error",
      message: "YouTube demande une vérification anti-bot.\n\nSolution : ouvre YouTube dans ton navigateur, connecte-toi à ton compte Google, puis réessaie.",
    });
    return;
  }

  // Non-bot error
  onStatus({ type: "error", message: result.errorMsg });
}

export type UpdateStatus =
  | { type: "checking" }
  | { type: "updating"; message: string }
  | { type: "done"; message: string }
  | { type: "error"; message: string };

export async function updateYtdlp(
  onStatus: (status: UpdateStatus) => void
): Promise<void> {
  onStatus({ type: "checking" });

  const command = Command.sidecar("binaries/yt-dlp", ["-U"]);
  const allOutput: string[] = [];

  command.stdout.on("data", (line: string) => {
    allOutput.push(line);
    if (line.includes("Updating to")) {
      onStatus({ type: "updating", message: line.trim() });
    }
  });

  command.stderr.on("data", (line: string) => {
    allOutput.push(line);
  });

  return new Promise((resolve) => {
    command.on("close", (data) => {
      const output = allOutput.join("\n");
      if (data.code === 0) {
        if (output.includes("is up to date") || output.includes("Up-to-date")) {
          onStatus({ type: "done", message: "yt-dlp est déjà à jour." });
        } else {
          onStatus({ type: "done", message: "yt-dlp mis à jour avec succès !" });
        }
      } else {
        onStatus({ type: "error", message: `Échec de la mise à jour: ${output.slice(-200)}` });
      }
      resolve();
    });

    command.on("error", (error) => {
      onStatus({ type: "error", message: `Erreur: ${error}` });
      resolve();
    });

    command.spawn().catch((e) => {
      onStatus({ type: "error", message: `Impossible de lancer yt-dlp: ${e}` });
      resolve();
    });
  });
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
