import { useState, useCallback, useRef } from "react";
import { desktopDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { downloadAudio, isValidYoutubeUrl, type DownloadStatus, type AudioFormat } from "./lib/ytdlp";
import "./App.css";

interface QueueItem {
  id: number;
  url: string;
  status: DownloadStatus;
}

const FORMAT_OPTIONS: { value: AudioFormat; label: string; desc: string }[] = [
  { value: "flac", label: "FLAC", desc: "Lossless" },
  { value: "mp3", label: "MP3", desc: "320 kbps" },
  { value: "wav", label: "WAV", desc: "Non compressé" },
];

function App() {
  const [urlInput, setUrlInput] = useState("");
  const [format, setFormat] = useState<AudioFormat>("flac");
  const [outputDir, setOutputDir] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const nextId = useRef(0);
  const outputDirRef = useRef("");

  // Initialize output dir
  const getOutputDir = useCallback(async () => {
    if (outputDirRef.current) return outputDirRef.current;
    const desktop = await desktopDir();
    outputDirRef.current = desktop;
    setOutputDir(desktop);
    return desktop;
  }, []);

  const handlePickFolder = useCallback(async () => {
    const selected = await open({
      directory: true,
      title: "Choisir le dossier de sauvegarde",
      defaultPath: outputDir || undefined,
    });
    if (selected) {
      outputDirRef.current = selected;
      setOutputDir(selected);
    }
  }, [outputDir]);

  const handleAddAndDownload = useCallback(async () => {
    const lines = urlInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const validUrls = lines.filter(isValidYoutubeUrl);

    if (validUrls.length === 0) {
      setQueue((prev) => [
        ...prev,
        {
          id: nextId.current++,
          url: "",
          status: {
            type: "error",
            message: "URL YouTube invalide. Vérifie le(s) lien(s).",
          },
        },
      ]);
      return;
    }

    const dir = await getOutputDir();

    const newItems: QueueItem[] = validUrls.map((url) => ({
      id: nextId.current++,
      url,
      status: { type: "idle" as const },
    }));

    setQueue((prev) => [...prev, ...newItems]);
    setUrlInput("");

    if (isProcessing) return;
    setIsProcessing(true);

    for (const item of newItems) {
      try {
        await downloadAudio(item.url, dir, format, (status) => {
          setQueue((q) =>
            q.map((qi) => (qi.id === item.id ? { ...qi, status } : qi))
          );
        });
      } catch {
        // Error already handled
      }
    }
    setIsProcessing(false);
  }, [urlInput, format, isProcessing, getOutputDir]);

  const clearCompleted = useCallback(() => {
    setQueue((prev) => prev.filter((item) => item.status.type !== "done" && item.status.type !== "error"));
  }, []);

  const activeItem = queue.find(
    (q) =>
      q.status.type === "fetching_info" ||
      q.status.type === "downloading" ||
      q.status.type === "converting"
  );

  const pendingCount = queue.filter((q) => q.status.type === "idle").length;
  const doneCount = queue.filter((q) => q.status.type === "done").length;

  const displayDir = outputDir
    ? outputDir.length > 40
      ? "..." + outputDir.slice(-37)
      : outputDir
    : "Bureau";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-500/10 mb-3">
            <svg className="w-7 h-7 text-red-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Convertisseur YT Audio
          </h1>
        </div>

        {/* Main card */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-5 shadow-2xl">
          {/* URL Input */}
          <textarea
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !isProcessing) {
                e.preventDefault();
                handleAddAndDownload();
              }
            }}
            placeholder={"Colle un ou plusieurs liens YouTube...\n(un par ligne)"}
            disabled={isProcessing}
            rows={2}
            className="w-full px-4 py-3 bg-gray-900/80 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all disabled:opacity-50 text-sm resize-none"
          />

          {/* Format selector + Folder picker */}
          <div className="flex gap-2 mt-3">
            {/* Format buttons */}
            <div className="flex bg-gray-900/80 rounded-lg p-0.5 border border-gray-700/50">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFormat(opt.value)}
                  disabled={isProcessing}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer disabled:cursor-not-allowed ${
                    format === opt.value
                      ? "bg-red-600 text-white shadow-sm"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className="hidden sm:inline text-[10px] opacity-60 ml-1">{opt.desc}</span>
                </button>
              ))}
            </div>

            {/* Folder picker */}
            <button
              onClick={handlePickFolder}
              disabled={isProcessing}
              className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-gray-900/80 border border-gray-700/50 rounded-lg text-xs text-gray-400 hover:text-white hover:border-gray-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed truncate"
              title={outputDir || "Bureau (par défaut)"}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className="truncate">{displayDir}</span>
            </button>
          </div>

          {/* Download button */}
          <button
            onClick={handleAddAndDownload}
            disabled={isProcessing || !urlInput.trim()}
            className="w-full mt-3 py-3 px-6 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>
                  Téléchargement en cours...
                  {pendingCount > 0 && ` (${pendingCount} en attente)`}
                </span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Télécharger en {format.toUpperCase()}
              </>
            )}
          </button>

          {/* Active download progress */}
          {activeItem && (
            <div className="mt-3">
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-300 ease-out"
                  style={{
                    width: `${
                      activeItem.status.type === "downloading"
                        ? activeItem.status.percent
                        : activeItem.status.type === "converting"
                        ? 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-xs text-gray-400">
                <span>
                  {activeItem.status.type === "fetching_info" && "Récupération des infos..."}
                  {activeItem.status.type === "downloading" &&
                    `${activeItem.status.percent.toFixed(1)}%`}
                  {activeItem.status.type === "converting" && `Conversion en ${format.toUpperCase()}...`}
                </span>
                {activeItem.status.type === "downloading" && (
                  <span>
                    {activeItem.status.speed && activeItem.status.speed}
                    {activeItem.status.eta && ` · ETA ${activeItem.status.eta}`}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Queue list */}
          {queue.length > 0 && (
            <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                    item.status.type === "done"
                      ? "bg-green-500/10 border border-green-500/20"
                      : item.status.type === "error"
                      ? "bg-red-500/10 border border-red-500/20"
                      : item.status.type === "idle"
                      ? "bg-gray-900/50 border border-gray-700/30"
                      : "bg-blue-500/10 border border-blue-500/20"
                  }`}
                >
                  {/* Status icon */}
                  {item.status.type === "done" && (
                    <svg className="w-3.5 h-3.5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {item.status.type === "error" && (
                    <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {item.status.type === "idle" && (
                    <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {(item.status.type === "fetching_info" ||
                    item.status.type === "downloading" ||
                    item.status.type === "converting") && (
                    <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {item.status.type === "done" ? (
                      <span className="text-green-400 truncate block">{item.status.title}.{format}</span>
                    ) : item.status.type === "error" ? (
                      <span className="text-red-400 truncate block">{item.status.message}</span>
                    ) : (
                      <span className="text-gray-400 truncate block">{item.url}</span>
                    )}
                  </div>
                </div>
              ))}

              {/* Clear completed */}
              {doneCount > 0 && !isProcessing && (
                <button
                  onClick={clearCompleted}
                  className="w-full text-xs text-gray-500 hover:text-gray-300 py-1 transition-colors cursor-pointer"
                >
                  Effacer la liste
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-4">
          {format.toUpperCase()} · Sauvegardé dans {displayDir}
        </p>
      </div>
    </div>
  );
}

export default App;
