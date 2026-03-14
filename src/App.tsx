import { useState, useCallback, useRef, useEffect } from "react";
import { desktopDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { downloadAudio, isValidYoutubeUrl, updateYtdlp, type DownloadStatus, type UpdateStatus } from "./lib/ytdlp";
import "./App.css";

const appWindow = getCurrentWindow();

interface QueueItem {
  id: number;
  url: string;
  status: DownloadStatus;
}

function App() {
  const [urlInput, setUrlInput] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const nextId = useRef(0);
  const outputDirRef = useRef("");

  // Auto-update yt-dlp on startup
  useEffect(() => {
    updateYtdlp(setUpdateStatus).then(() => {
      setTimeout(() => setUpdateStatus(null), 4000);
    });
  }, []);

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
      title: "Choose output folder",
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
            message: "Invalid YouTube URL. Please check your link(s).",
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
        await downloadAudio(item.url, dir, (status) => {
          setQueue((q) =>
            q.map((qi) => (qi.id === item.id ? { ...qi, status } : qi))
          );
        });
      } catch {
        // Error already handled
      }
    }
    setIsProcessing(false);
  }, [urlInput, isProcessing, getOutputDir]);

  const clearCompleted = useCallback(() => {
    setQueue((prev) => prev.filter((item) => item.status.type !== "done" && item.status.type !== "error"));
  }, []);

  const handleUpdate = useCallback(async () => {
    if (isProcessing) return;
    await updateYtdlp(setUpdateStatus);
    setTimeout(() => setUpdateStatus(null), 4000);
  }, [isProcessing]);

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
    : "Desktop";

  return (
    <div className="min-h-screen bg-gray-950 bg-grid bg-grain flex flex-col relative">
      {/* Bottom pink glow */}
      <div className="absolute bottom-0 left-0 right-0 h-[200px] bg-gradient-to-t from-pink-600/5 to-transparent pointer-events-none" />

      {/* Custom title bar */}
      <div
        className="flex items-center justify-between h-9 bg-black/60 border-b border-pink-500/10 select-none shrink-0 relative z-10"
        onMouseDown={() => appWindow.startDragging()}
      >
        <div className="flex items-center gap-2 pl-3">
          <svg className="w-4 h-4 text-pink-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
          </svg>
          <span className="text-xs text-pink-400/60 font-medium tracking-wider uppercase">YT Audio</span>
        </div>
        <div className="flex h-full" onMouseDown={(e) => e.stopPropagation()}>
          <button
            onClick={() => appWindow.minimize()}
            className="h-full px-3 text-gray-600 hover:bg-pink-500/10 hover:text-pink-400 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth={2} d="M5 12h14" />
            </svg>
          </button>
          <button
            onClick={() => appWindow.toggleMaximize()}
            className="h-full px-3 text-gray-600 hover:bg-pink-500/10 hover:text-pink-400 transition-colors cursor-pointer"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="4" y="4" width="16" height="16" rx="1" strokeWidth={2} />
            </svg>
          </button>
          <button
            onClick={() => appWindow.close()}
            className="h-full px-3 text-gray-600 hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl border border-pink-500/30 mb-3 neon-icon">
            <svg className="w-7 h-7 text-pink-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            <span className="text-pink-400">YT</span> Audio Converter
          </h1>
        </div>

        {/* Main card */}
        <div className="bg-black/50 rounded-2xl border border-pink-500/15 p-5 neon-card">
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
            placeholder={"Paste one or more YouTube links...\n(one per line)"}
            disabled={isProcessing}
            rows={2}
            className="w-full px-4 py-3 bg-black/60 border border-cyan-500/15 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500/30 transition-all disabled:opacity-50 text-sm resize-none font-mono"
          />

          {/* Folder picker */}
          <button
            onClick={handlePickFolder}
            disabled={isProcessing}
            className="w-full flex items-center gap-2 px-3 py-2 mt-3 bg-black/60 border border-cyan-500/15 rounded-lg text-xs text-gray-500 hover:text-cyan-400 hover:border-cyan-500/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed truncate"
            title={outputDir || "Desktop (default)"}
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="truncate">{displayDir}</span>
          </button>

          {/* Download button */}
          <button
            onClick={handleAddAndDownload}
            disabled={isProcessing || !urlInput.trim()}
            className="w-full mt-3 py-3 px-6 bg-gradient-to-r from-pink-600 to-cyan-600 hover:from-pink-500 hover:to-cyan-500 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-600 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed neon-btn"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>
                  Downloading...
                  {pendingCount > 0 && ` (${pendingCount} pending)`}
                </span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download as MP3
              </>
            )}
          </button>

          {/* Active download progress */}
          {activeItem && (
            <div className="mt-3">
              <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-500 to-cyan-400 rounded-full transition-all duration-300 ease-out neon-progress"
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
              <div className="flex justify-between mt-1.5 text-xs text-gray-500 font-mono">
                <span>
                  {activeItem.status.type === "fetching_info" && "Fetching info..."}
                  {activeItem.status.type === "downloading" &&
                    `${activeItem.status.percent.toFixed(1)}%${activeItem.status.fileSize ? ` of ${activeItem.status.fileSize}` : ""}`}
                  {activeItem.status.type === "converting" && "Converting to MP3..."}
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
                      ? "bg-cyan-500/5 border border-cyan-500/20"
                      : item.status.type === "error"
                      ? "bg-pink-500/5 border border-pink-500/20"
                      : item.status.type === "idle"
                      ? "bg-black/30 border border-gray-800"
                      : "bg-pink-500/5 border border-pink-500/15"
                  }`}
                >
                  {/* Status icon */}
                  {item.status.type === "done" && (
                    <svg className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {item.status.type === "error" && (
                    <svg className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {item.status.type === "idle" && (
                    <svg className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {(item.status.type === "fetching_info" ||
                    item.status.type === "downloading" ||
                    item.status.type === "converting") && (
                    <svg className="w-3.5 h-3.5 text-pink-400 flex-shrink-0 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {item.status.type === "done" ? (
                      <span className="text-cyan-400 truncate block font-mono">{item.status.title}.mp3</span>
                    ) : item.status.type === "error" ? (
                      <span className="text-pink-400 truncate block">{item.status.message}</span>
                    ) : (
                      <span className="text-gray-500 truncate block font-mono">{item.url}</span>
                    )}
                  </div>
                </div>
              ))}

              {/* Clear completed */}
              {doneCount > 0 && !isProcessing && (
                <button
                  onClick={clearCompleted}
                  className="w-full text-xs text-gray-600 hover:text-pink-400 py-1 transition-colors cursor-pointer"
                >
                  Clear list
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <p className="text-gray-600 text-xs font-mono">
            MP3 320kbps · {displayDir}
          </p>
          <span className="text-gray-800">·</span>
          <button
            onClick={handleUpdate}
            disabled={isProcessing || (updateStatus?.type === "checking") || (updateStatus?.type === "updating")}
            className="text-xs text-pink-500/50 hover:text-pink-400 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            title="Update yt-dlp"
          >
            {updateStatus?.type === "checking" ? "Checking..." :
             updateStatus?.type === "updating" ? "Updating..." :
             updateStatus?.type === "done" ? updateStatus.message :
             updateStatus?.type === "error" ? "Error" :
             "Update yt-dlp"}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

export default App;
