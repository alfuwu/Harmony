import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { decode } from "blurhash"; // npm install blurhash
import { hostUrl } from "../../App";
import TextDocument from "../svgs/other/TextDocument";
import { Attachment } from "../../lib/utils/Types";
import { t } from "../../lib/i18n/Index";

type AttachmentKind = "image" | "video" | "audio" | "text" | "other";

const TEXT_CONTENT_TYPES = new Set([
  "application/json", "application/xml", "application/javascript",
  "text/plaintext", "text/plain",
]);
const MAX_TEXT_PREVIEW = 4096;

function getAttachmentKind(contentType: string): AttachmentKind {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";
  if (contentType.startsWith("text/") || TEXT_CONTENT_TYPES.has(contentType)) return "text";
  return "other";
}

function getExt(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx + 1).toLowerCase();
}

function BlurhashPlaceholder({ hash, width, height }: { hash: string; width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = 32;
    const h = Math.max(1, Math.round((height / width) * w));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    try {
      const pixels = decode(hash, w, h);
      const imageData = ctx.createImageData(w, h);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);
    } catch (e) {
      console.error("Failed to decode blurhash", e);
    }
  }, [hash, width, height]);
  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", filter: "blur(12px)", transform: "scale(1.05)" }}
    />
  );
}

function PlayIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 13 / 11)} viewBox="0 0 11 13" fill="currentColor">
      <polygon points="1,0 11,6.5 1,13" />
    </svg>
  );
}

function PauseIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 13 / 11)} viewBox="0 0 11 13" fill="currentColor">
      <rect x="0" y="0" width="3.5" height="13" rx="1.2" />
      <rect x="7.5" y="0" width="3.5" height="13" rx="1.2" />
    </svg>
  );
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
    </svg>
  );
}

function DownloadIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
    </svg>
  );
}

const WAVEFORM_H = 64;
const BAR_GAP = 1.5;
const MIN_BAR_W = 1;

function WaveformBars({
  hash, progress = 0, onSeek,
}: {
  hash: string;
  progress?: number;
  onSeek?: (ratio: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(160);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el)
      return;
    if (el.offsetWidth > 0) setContainerWidth(el.offsetWidth);
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0)
        setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rawValues = useMemo(() => {
    if (!hash)
      return [];
    try {
      const bin = atob(hash);
      return Array.from(bin, c => c.charCodeAt(0) / 255);
    } catch {
      return [];
    }
  }, [hash]);

  const displayValues = useMemo(() => {
    if (rawValues.length === 0)
      return [];
    const maxBars = Math.max(1, Math.floor((containerWidth + BAR_GAP) / (MIN_BAR_W + BAR_GAP)));
    if (maxBars >= rawValues.length)
      return rawValues;
    const chunkSize = rawValues.length / maxBars;
    return Array.from({ length: maxBars }, (_, i) => {
      const start = Math.floor(i * chunkSize);
      const end = Math.ceil(Math.min(rawValues.length, (i + 1) * chunkSize));
      const chunk = rawValues.slice(start, end);
      return chunk.length > 0 ? Math.max(...chunk) : 0;
    });
  }, [rawValues, containerWidth]);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!onSeek)
      return;
    const rect = e.currentTarget.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
  }

  if (rawValues.length === 0) {
    return (
      <div
        ref={containerRef}
        style={{
          flex: 1, height: 4, background: "var(--bg-1)", borderRadius: 2,
          alignSelf: "center", cursor: onSeek ? "pointer" : "default",
          overflow: "hidden"
        }}
        onClick={handleClick}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseMove={e => { console.log(pressed); if (pressed) handleClick(e)}}
        draggable={false}
      >
        <div draggable={false} style={{
          width: `${progress * 100}%`, height: "100%",
          background: "var(--accent-1)", borderRadius: 2,
          transition: "width 0.1s linear"
        }} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        alignItems: "center",
        gap: BAR_GAP,
        height: WAVEFORM_H,
        cursor: onSeek ? "pointer" : "default",
        flex: 1
      }}
      onClick={handleClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseMove={e => { if (pressed) handleClick(e) }}
      draggable={false}
    >
      {displayValues.map((v, i) => {
        const played = (i / displayValues.length) <= progress;
        return (
          <div key={i} draggable={false} style={{
            flex: 1,
            height: Math.max(3, Math.round(v * WAVEFORM_H)),
            background: played ? "var(--accent-1)" : "var(--text-5)",
            borderRadius: 2
          }} />
        );
      })}
    </div>
  );
}

const SPEEDS = [1, 1.5, 2] as const;
type Speed = typeof SPEEDS[number];

function AudioPlayer({ url, fileName, placeholderHash }: {
  url: string;
  fileName: string;
  placeholderHash?: string | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);

  const speed: Speed = SPEEDS[speedIdx];
  const progress = duration > 0 ? currentTime / duration : 0;

  function togglePlay() {
    const a = audioRef.current;
    if (!a)
      return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play().then(() => setPlaying(true)).catch(() => {});
    }
  }

  function cycleSpeed() {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current)
      audioRef.current.playbackRate = SPEEDS[next];
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    if (audioRef.current) audioRef.current.muted = next;
  }

  function seekTo(ratio: number) {
    const a = audioRef.current;
    if (!a || !isFinite(duration) || duration === 0)
      return;
    a.currentTime = ratio * duration;
    setCurrentTime(a.currentTime);
  }

  function fmt(s: number) {
    if (!isFinite(s) || s < 0)
      return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  }

  const iconBtn: React.CSSProperties = {
    background: "none", border: "none", boxShadow: "none",
    color: "var(--text-4)", cursor: "pointer",
    display: "flex", alignItems: "center", flexShrink: 0,
    padding: "3px", borderRadius: 4
  };

  return (
    <div style={{
      marginTop: 4, display: "flex", alignItems: "center", gap: 10,
      padding: "8px 12px 8px 10px",
      background: "var(--bg-2)", border: "1px solid var(--border)",
      borderRadius: 36, width: 320, boxSizing: "border-box"
    }}>
      <audio
        ref={audioRef} src={url} preload="metadata"
        onTimeUpdate={() => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); }}
        onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration); }}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        style={{ display: "none" }}
      />

      <button
        onClick={togglePlay}
        style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "var(--accent-1)", border: "none", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "white",
          padding: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
        }}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <WaveformBars hash={placeholderHash ?? ""} progress={progress} onSeek={seekTo} />
        <div style={{ fontSize: 11, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" as const }}>
          {duration ? fmt(currentTime) : '--'}
          {<span style={{ color: "var(--text-5)", marginLeft: 1 }}>{duration > 0 ? ` / ${fmt(duration)}` : ` / --`}</span>}
        </div>
      </div>

      <button
        onClick={cycleSpeed}
        style={{
          ...iconBtn,
          border: "1px solid var(--border)",
          background: "var(--bg-1)",
          fontSize: 11, fontWeight: 700,
          padding: "2px 6px", lineHeight: "16px",
          color: speed !== 1 ? "var(--accent-1)" : "var(--text-4)"
        }}
      >
        {speed === 1 ? "1×" : `${speed}×`}
      </button>

      <button
        onClick={toggleMute}
        style={{ ...iconBtn, color: muted ? "var(--red-2)" : "var(--text-4)" }}
      >
        <VolumeIcon muted={muted} />
      </button>

      <a href={url} download={fileName} title={t("attachments.download")}
        style={{ ...iconBtn, color: "var(--text-4)" }}>
        <DownloadIcon />
      </a>
    </div>
  );
}

function VideoPlayer({ url, width, height, placeholderHash }: {
  url: string;
  width?: number | null;
  height?: number | null;
  placeholderHash?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showCtrl, setShowCtrl] = useState(true);

  const progress = duration > 0 ? currentTime / duration : 0;
  const ctrlVisible = showCtrl || !playing;

  function scheduleHide() {
    if (hideRef.current)
      clearTimeout(hideRef.current);
    hideRef.current = setTimeout(() => setShowCtrl(false), 1000);
  }

  function handleMouseMove() {
    setShowCtrl(true);
    scheduleHide();
  }

  function togglePlay() {
    const v = videoRef.current;
    console.log(v);
    if (!v)
      return;
    if (playing) {
      v.pause();
      setPlaying(false);
      setShowCtrl(true);
    } else {
      v.play().then(() => {
        setPlaying(true);
        scheduleHide();
      }).catch(() => {});
    }
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    if (videoRef.current)
      videoRef.current.muted = next;
  }

  function seekTo(ratio: number) {
    const v = videoRef.current;
    if (!v || !isFinite(duration) || duration === 0)
      return;
    v.currentTime = Math.max(0, Math.min(1, ratio)) * duration;
    setCurrentTime(v.currentTime);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement)
      document.exitFullscreen();
    else
      wrapRef.current?.requestFullscreen();
  }

  function fmt(s: number) {
    if (!isFinite(s) || s < 0)
      return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  }

  const whiteBtnStyle: React.CSSProperties = {
    background: "none", border: "none", boxShadow: "none",
    color: "rgba(255,255,255,0.85)", cursor: "pointer", padding: "2px",
    display: "flex", alignItems: "center"
  };

  return (
    <div
      ref={wrapRef}
      style={{
        marginTop: 4, position: "relative",
        width: width ? Math.min(400, width) : 400,
        aspectRatio: width && height ? `${width} / ${height}` : "16 / 9",
        maxWidth: 400, borderRadius: 10, overflow: "hidden", background: "#000",
        cursor: ctrlVisible ? "default" : "none"
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (playing)
          scheduleHide();
      }}
    >
      {!loaded && placeholderHash && width && height && (
        <BlurhashPlaceholder hash={placeholderHash} width={width} height={height} />
      )}

      <video
        ref={videoRef} src={url} preload="metadata"
        onLoadedData={() => setLoaded(true)}
        onTimeUpdate={() => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime); }}
        onLoadedMetadata={() => { if (videoRef.current) setDuration(videoRef.current.duration); }}
        onEnded={() => { setPlaying(false); setCurrentTime(0); setShowCtrl(true); }}
        onClick={togglePlay}
        style={{ width: "100%", display: "block", position: "relative", cursor: "pointer" }}
      />

      {!playing && (
        <div
          onClick={togglePlay}
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.38)", cursor: "pointer",
          }}
        >
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "white",
          }}>
            <PlayIcon size={18} />
          </div>
        </div>
      )}

      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "linear-gradient(transparent, rgba(0,0,0,0.72))",
        padding: "28px 10px 8px",
        opacity: ctrlVisible ? 1 : 0,
        transition: "opacity 200ms ease",
        pointerEvents: ctrlVisible ? "auto" : "none"
      }}>
        <div
          style={{
            height: 3, background: "rgba(255,255,255,0.25)", borderRadius: 2,
            marginBottom: 7, cursor: "pointer", position: "relative"
          }}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            seekTo((e.clientX - rect.left) / rect.width);
          }}
        >
          <div style={{
            width: `${progress * 100}%`, height: "100%",
            background: "var(--accent-1)", borderRadius: 2,
            transition: "width 0.1s linear"
          }} />
          <div style={{
            position: "absolute", top: "50%", left: `${progress * 100}%`,
            transform: "translate(-50%, -50%)",
            width: 10, height: 10, borderRadius: "50%",
            background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.5)"
          }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={togglePlay} style={whiteBtnStyle}>
            {playing ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
          </button>
          <button onClick={toggleMute} style={whiteBtnStyle}>
            <VolumeIcon muted={muted} />
          </button>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontVariantNumeric: "tabular-nums" as const }}>
            {fmt(currentTime)} / {fmt(duration)}
          </span>
          <div style={{ flex: 1 }} />
          <a href={url} download onClick={e => e.stopPropagation()}
            style={{ ...whiteBtnStyle, color: "rgba(255,255,255,0.7)" }}>
            <DownloadIcon />
          </a>
          <button onClick={toggleFullscreen} style={{ ...whiteBtnStyle, color: "rgba(255,255,255,0.7)" }}>
            <FullscreenIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function FileIcon({ kind }: { kind: AttachmentKind }) {
  const glyphs: Record<AttachmentKind, string | ReactNode> = {
    image: "🖼️", video: "🎬", audio: "🎵",
    text: <TextDocument />, other: "📎",
  };
  return <span style={{ fontSize: 22, lineHeight: 1 }}>{glyphs[kind]}</span>;
}

export function getAttachmentUrl(fileName: string): string {
  return `${hostUrl}/api/attachments/${encodeURIComponent(fileName)}`;
}

interface AttachmentProps {
  attachment: Attachment;
  sending?: boolean;
}

export default function MessageAttachment({ attachment, sending }: AttachmentProps) {
  const kind = getAttachmentKind(attachment.contentType);
  const isPending = sending || !!attachment.localUrl;

  const [expanded, setExpanded] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState(false);

  const url = attachment.localUrl ?? getAttachmentUrl(attachment.fileName);

  async function loadText() {
    if (textContent !== null || textLoading)
      return;
    setTextLoading(true);
    setTextError(false);
    try {
      const res = await fetch(getAttachmentUrl(attachment.fileName));
      if (!res.ok)
        throw new Error(`Request failed: ${res.status}`);
      setTextContent(await res.text());
    } catch (e) {
      console.error("Failed to load text attachment", e);
      setTextError(true);
    } finally {
      setTextLoading(false);
    }
  }

  function toggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next)
      loadText();
  }

  if (isPending) {
    const progress = attachment.progress;

    if (kind === "image" && attachment.localUrl) {
      return (
        <div className="attachment-pending image" style={{ position: "relative", display: "inline-block", marginTop: 4 }}>
          <img src={attachment.localUrl} alt={attachment.fileName}
            style={{ maxWidth: 400, maxHeight: 300, borderRadius: 6, opacity: 0.5, display: "block" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="spinner" />
          </div>
          {typeof progress === "number" && (
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "rgba(0,0,0,0.3)", borderRadius: "0 0 6px 6px" }}>
              <div style={{
                height: "100%", width: `${Math.min(100, Math.max(0, progress))}%`,
                background: "var(--accent-1)", borderRadius: "0 0 6px 6px", transition: "width 0.2s ease",
              }} />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="attachment-pending" style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px", borderRadius: 8,
        background: "var(--bg-2)", border: "1px solid var(--border)",
        marginTop: 4, maxWidth: 320,
      }}>
        <FileIcon kind={kind} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {attachment.fileName}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-5)" }}>
            {typeof progress === "number"
              ? t("attachments.uploading_pct", { pct: Math.round(progress) })
              : t("attachments.uploading")}
          </div>
          {typeof progress === "number" && (
            <div style={{ height: 3, marginTop: 4, background: "var(--bg-1)", borderRadius: 2 }}>
              <div style={{
                height: "100%", width: `${Math.min(100, Math.max(0, progress))}%`,
                background: "var(--accent-1)", borderRadius: 2, transition: "width 0.2s ease",
              }} />
            </div>
          )}
        </div>
        <div className="spinner small" />
      </div>
    );
  }

  if (kind === "image") {
    const [loaded, setLoaded] = useState(false);
    return (
      <div style={{
        marginTop: 4, position: "relative",
        width: attachment.width && attachment.height ? Math.min(400, attachment.width) : 400,
        aspectRatio: attachment.width && attachment.height ? `${attachment.width} / ${attachment.height}` : undefined,
        maxWidth: 400, borderRadius: 6, overflow: "hidden",
      }}>
        {!loaded && attachment.placeholderHash && attachment.width && attachment.height && (
          <BlurhashPlaceholder hash={attachment.placeholderHash} width={attachment.width} height={attachment.height} />
        )}
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={attachment.fileName} loading="lazy"
            onLoad={() => setLoaded(true)}
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", position: "relative" }} />
        </a>
      </div>
    );
  }

  if (kind === "video") {
    return (
      <VideoPlayer
        url={url}
        width={attachment.width}
        height={attachment.height}
        placeholderHash={attachment.placeholderHash}
      />
    );
  }

  if (kind === "audio") {
    return (
      <AudioPlayer
        url={url}
        fileName={attachment.fileName}
        placeholderHash={attachment.placeholderHash}
      />
    );
  }

  if (kind === "text") {
    return (
      <div className="attachment-text" style={{
        marginTop: 4, maxWidth: 480,
        border: "1px solid var(--border)", borderRadius: 8,
        background: "var(--bg-2)", overflow: "hidden",
      }}>
        <button
          onClick={toggleExpand}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
        >
          <FileIcon kind={kind} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {attachment.fileName}
          </span>
          <a href={url} download={attachment.fileName} onClick={e => e.stopPropagation()}
            style={{ color: "var(--text-4)", fontSize: 12 }}>
            {t("attachments.download")}
          </a>
          <span style={{ color: "var(--text-5)", fontSize: 12 }}>{expanded ? "▲" : "▼"}</span>
        </button>
        {expanded && (
          <div style={{
            borderTop: "1px solid var(--border)", padding: 8, maxHeight: 300,
            overflow: "auto", fontFamily: "monospace", fontSize: 12,
            color: "var(--text-3)", whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>
            {textLoading && t("attachments.loading")}
            {textError && t("attachments.load_error")}
            {textContent !== null && (
              textContent.length > MAX_TEXT_PREVIEW ? (
                <>
                  {textContent.slice(0, MAX_TEXT_PREVIEW)}
                  <div style={{ marginTop: 8, color: "var(--text-5)", fontStyle: "italic" }}>
                    {t("attachments.truncated")}
                  </div>
                </>
              ) : textContent
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="attachment-file" style={{
      display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
      borderRadius: 8, marginTop: 4, background: "var(--bg-2)",
      border: "1px solid var(--border)", maxWidth: 320,
    }}>
      <FileIcon kind={kind} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {attachment.fileName}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-5)" }}>
          {getExt(attachment.fileName).toUpperCase() || t("attachments.file")}
        </div>
      </div>
      <a href={url} download={attachment.fileName} title={t("attachments.download")}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, color: "var(--text-3)", background: "var(--bg-1)" }}>
        <DownloadIcon />
      </a>
    </div>
  );
}