import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { decode } from "blurhash";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { ColladaLoader } from "three/addons/loaders/ColladaLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import { VRMLLoader } from "three/addons/loaders/VRMLLoader.js";
import { VOXLoader, VOXLoaderResult, VOXMesh } from "three/addons/loaders/VOXLoader.js";
import { AMFLoader } from "three/addons/loaders/AMFLoader.js";
import { USDZLoader } from "three/addons/loaders/USDZLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { decompress } from "fzstd";
import { hostUrl } from "../../App";
import TextDocument from "../svgs/other/TextDocument";
import { Attachment } from "../../lib/utils/Types";
import { t } from "../../lib/i18n/Index";
import { CloseIcon, FilmIcon } from "../svgs/other/Icons";

type AttachmentKind = "image" | "video" | "audio" | "text" | "model" | "other";
type ModelFormat =
  | "gltf" | "obj" | "stl"
  | "collada" | "vrml" | "fbx" | "ply" | "vox"
  | "amf" | "usdz" | "x3d" | "ifc" | "hyleus"
  | "blend" | "alembic" | "dwg" | "usdc"
  | "unknown";

const TEXT_CONTENT_TYPES = new Set([
  "application/json", "application/xml", "application/javascript",
  "text/plaintext", "text/plain"
]);
const MAX_TEXT_PREVIEW = 4096;

function stripGuidPrefix(fileName: string): string {
  return fileName.replace(
    /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}_/i,
    ""
  );
}

async function downloadFile(url: string, displayName: string) {
  try {
    const res = await fetch(url);
    if (!res.ok)
      throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = displayName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 200);
  } catch {
    window.open(url, "_blank");
  }
}

async function parseHyleusMesh(buffer: ArrayBuffer): Promise<THREE.Group> {
  const raw = new Uint8Array(buffer);

  const header = raw.slice(0, 13);
  if (indexedDB.cmp(header, new Uint8Array([72, 89, 76, 69, 85, 83, 95, 77, 0, 0, 0x69, 0x42, 0])) !== 0)
    throw new Error(`Not a HYLEUS_M file (got header: ${header}, expected header: ${new Uint8Array([72, 89, 76, 69, 85, 83, 95, 77, 0, 0, 0x69, 0x42, 0])})`);

  const buf = decompress(raw.slice(13));
  const dv = new DataView(buf.buffer, buf.byteOffset);
  let off = 0;

  const readU8 = () => buf[off++];
  const readU16 = () => { const v = dv.getUint16(off, true); off += 2; return v; };
  const readU32 = () => { const v = dv.getUint32(off, true); off += 4; return v; };
  const readF32 = () => { const v = dv.getFloat32(off, true); off += 4; return v; };
  const readStr = () => {
    const len = readU32();
    const slice = buf.slice(off, off + len);
    off += len;
    return new TextDecoder().decode(slice);
  };
  const skipVec3 = () => { off += 12; };
  const skipQuat = () => { off += 16; };
  const skipMat4 = () => { off += 64; };

  const modType = readU8();
  const hasIndices = (modType & 0x01) !== 0;
  const hasUVs = (modType & 0x02) !== 0;
  const hasNormals = (modType & 0x04) !== 0;
  const hasTex = (modType & 0x08) !== 0;
  const hasDepthTex = (modType & 0x10) !== 0;
  const hasArmature = (modType & 0x20) !== 0;

  const vertCount = readU32();
  const positions = new Float32Array(vertCount * 3);
  for (let i = 0; i < vertCount; i++) {
    positions[i * 3] = readF32();
    positions[i * 3 + 1] = -readF32();
    positions[i * 3 + 2] = readF32();
  }

  let indices: Uint32Array | null = null;
  if (hasIndices) {
    const n = readU32();
    indices = new Uint32Array(n);
    for (let i = 0; i < n; i++)
      indices[i] = readU32();
  }

  const uvs = new Float32Array(vertCount * 2);
  if (hasUVs) {
    const n = Math.min(readU32(), vertCount);
    for (let i = 0; i < n; i++) {
      uvs[i * 2] = readF32();
      uvs[i * 2 + 1] = readF32();
    }
  }

  const normals = new Float32Array(vertCount * 3);
  if (hasNormals) {
    const n = Math.min(readU32(), vertCount);
    for (let i = 0; i < n; i++) {
      normals[i * 3] = readF32();
      normals[i * 3 + 1] = readF32();
      normals[i * 3 + 2] = readF32();
    }
  }

  let dataTexture: THREE.DataTexture | null = null;
  if (hasTex) {
    const sampleType = readU8(); // 0 = POINT, else LINEAR
    const width = readU32();
    const height = readU32();
    const depth = hasDepthTex ? readU32() : 1;
    const pixelCount = width * height * depth * 4;
    const pixels = new Uint8Array(buf.buffer, buf.byteOffset + off, pixelCount);
    off += pixelCount;
    if (depth === 1) {
      const tex = new THREE.DataTexture(new Uint8Array(pixels), width, height, THREE.RGBAFormat);
      tex.minFilter = tex.magFilter = sampleType === 0 ? THREE.NearestFilter : THREE.LinearFilter;
      tex.needsUpdate = true;
      dataTexture = tex;
    }
  }

  if (hasArmature) {
    const boneCount = readU16();
    for (let b = 0; b < boneCount; b++) {
      readStr();
      readU16();
      skipMat4();
      skipMat4();
    }
    const animCount = readU16();
    for (let a = 0; a < animCount; a++) {
      readStr();
      readU8();
      const kfCount = readU32();
      for (let k = 0; k < kfCount; k++) {
        readF32();
        const tCount = readU16();
        for (let tr = 0; tr < tCount; tr++) {
          readU16();
          skipVec3();
          skipQuat();
          skipVec3();
        }
      }
    }
    for (let v = 0; v < vertCount; v++) {
      const wCount = readU8();
      for (let i = 0; i < wCount; i++) {
        readU32();
        readF32();
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  if (hasNormals)
    geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  if (hasUVs)
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  if (indices)
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
  if (!hasNormals)
    geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    ...(dataTexture ? { map: dataTexture } : { color: 0x8899bb }),
    metalness: 0.15, roughness: 0.6, side: THREE.DoubleSide
  });

  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, mat));
  return group;
}

function parseX3DToObject(xmlText: string): THREE.Group {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  if (doc.querySelector("parsererror"))
    throw new Error("X3D parse error: malformed XML");

  const root = new THREE.Group();

  function nums(s: string | null | undefined): number[] {
    return (s ?? "").trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
  }

  function makeX3DMaterial(shapeEl: Element): THREE.MeshStandardMaterial {
    const matEl = shapeEl.querySelector("Appearance > Material");
    if (matEl) {
      const dc = nums(matEl.getAttribute("diffuseColor"));
      if (dc.length >= 3) {
        const shininess = parseFloat(matEl.getAttribute("shininess") ?? "0.2");
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color(dc[0], dc[1], dc[2]),
          metalness: shininess * 0.3,
          roughness: 1 - shininess
        });
      }
    }
    return new THREE.MeshStandardMaterial({ color: 0x8899bb, metalness: 0.15, roughness: 0.6 });
  }

  function indexedFaceSetToGeo(el: Element): THREE.BufferGeometry | null {
    const coordEl = el.querySelector("Coordinate");
    const pts = nums(coordEl?.getAttribute("point"));
    if (!pts.length)
      return null;
    const rawCI = nums(el.getAttribute("coordIndex")?.replace(/-1/g, " -1 ") ?? "");
    const triIdx: number[] = [];
    let face: number[] = [];
    for (const idx of rawCI) {
      if (idx === -1) {
        for (let i = 1; i < face.length - 1; i++)
          triIdx.push(face[0], face[i], face[i + 1]);
        face = [];
      } else {
        face.push(idx);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    geo.setIndex(triIdx);
    geo.computeVertexNormals();
    return geo;
  }

  function indexedTriSetToGeo(el: Element): THREE.BufferGeometry | null {
    const coordEl = el.querySelector("Coordinate");
    const pts  = nums(coordEl?.getAttribute("point"));
    const idxs = nums(el.getAttribute("index"));
    if (!pts.length)
      return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    if (idxs.length)
      geo.setIndex(idxs);
    geo.computeVertexNormals();
    return geo;
  }

  function processNode(xmlEl: Element, parent: THREE.Object3D) {
    for (const child of Array.from(xmlEl.children) as Element[]) {
      const tag = child.tagName.split(":").pop() ?? "";
      if (tag === "Transform" || tag === "Group") {
        const g = new THREE.Group();
        if (tag === "Transform") {
          const t = nums(child.getAttribute("translation"));
          if (t.length >= 3)
            g.position.set(t[0], t[1], t[2]);
          const s = nums(child.getAttribute("scale"));
          if (s.length >= 3)
            g.scale.set(s[0], s[1], s[2]);
          const r = nums(child.getAttribute("rotation"));
          if (r.length >= 4)
            g.rotateOnAxis(new THREE.Vector3(r[0], r[1], r[2]).normalize(), r[3]);
        }
        parent.add(g);
        processNode(child, g);
      } else if (tag === "Shape") {
        const mat = makeX3DMaterial(child);
        const ifs = child.querySelector("IndexedFaceSet");
        const its = child.querySelector("IndexedTriangleSet");
        const geo = ifs ? indexedFaceSetToGeo(ifs)
                  : its ? indexedTriSetToGeo(its)
                  : null;
        if (geo) {
          const mesh = new THREE.Mesh(geo, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          parent.add(mesh);
        }
      } else {
        processNode(child, parent);
      }
    }
  }

  const scene = doc.querySelector("Scene") ?? doc.documentElement;
  processNode(scene, root);
  return root;
}

function getAttachmentKind(contentType: string): AttachmentKind {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";
  if (contentType.startsWith("model/")) return "model";
  if (contentType.startsWith("text/") || TEXT_CONTENT_TYPES.has(contentType)) return "text";
  return "other";
}

function getModelFormat(contentType: string): ModelFormat {
  if (contentType === "model/gltf+json" || contentType === "model/gltf-binary") return "gltf";
  if (contentType === "model/obj") return "obj";
  if (contentType === "model/stl") return "stl";
  if (contentType === "model/vnd.collada+xml") return "collada";
  if (contentType === "model/vrml" || contentType === "model/x-vrml") return "vrml";
  if (contentType === "model/fbx" || contentType === "application/x-fbx") return "fbx";
  if (contentType === "model/ply" || contentType === "application/x-ply") return "ply";
  if (contentType === "model/x3d+xml" || contentType === "model/x3d+vrml") return "x3d";
  if (contentType === "application/x-step" || contentType === "model/ifc") return "ifc";
  if (contentType === "model/vnd.usd" || contentType === "model/x-usdz" || contentType === "model/vnd.usdz+zip") return "usdz";
  if (contentType === "image/vnd.dwg" || contentType === "application/dwg") return "dwg";
  if (contentType === "model/hyleus") return "hyleus";
  return "unknown";
}

function BlurhashPlaceholder({ hash, width, height }: { hash: string; width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas)
      return;
    const w = 32;
    const h = Math.max(1, Math.round((height / width) * w));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx)
      return;
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
    <canvas ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", filter: "blur(12px)", transform: "scale(1.05)" }} />
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

function CubeIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73L11 21.73a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

const WAVEFORM_H = 64;
const BAR_GAP = 1.5;
const MIN_BAR_W = 1;

function WaveformBars({ hash, progress = 0, onSeek }: {
  hash: string; progress?: number; onSeek?: (ratio: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(160);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el)
      return;
    if (el.offsetWidth > 0)
      setContainerWidth(el.offsetWidth);
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
        onMouseMove={e => { if (pressed) handleClick(e)}}
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

function AudioPlayer({ url, displayName, placeholderHash }: {
  url: string; displayName: string; placeholderHash?: string | null;
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
    if (audioRef.current)
      audioRef.current.muted = next;
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
      return "--:--";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  }

  const iconBtn: React.CSSProperties = {
    background: "none", border: "none", boxShadow: "none",
    color: "var(--text-4)", flexShrink: 0,
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
        style={{ display: "none" }} />

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
      <span className="dl-btn" onClick={() => downloadFile(url, displayName)} title={t("attachments.download")} style={iconBtn}>
        <DownloadIcon />
      </span>
    </div>
  );
}

function VideoPlayer({ url, displayName, width, height, placeholderHash }: {
  url: string; displayName: string;
  width?: number | null; height?: number | null; placeholderHash?: string | null;
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
      return "--:--";
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
        style={{ width: "100%", display: "block", position: "relative", cursor: "pointer" }} />

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
          <span
            className="dl-btn" 
            onClick={e => { e.stopPropagation(); downloadFile(url, displayName); }}
            style={{ ...whiteBtnStyle, color: "rgba(255,255,255,0.7)" }}
            title={t("attachments.download")}
          >
            <DownloadIcon />
          </span>
          <button onClick={toggleFullscreen} style={{ ...whiteBtnStyle, color: "rgba(255,255,255,0.7)" }}>
            <FullscreenIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

const VIEWER_W = 400;
const VIEWER_H = 300;

const BROWSER_UNSUPPORTED: Partial<Record<ModelFormat, string>> = {
  blend: "Blender (.blend) files cannot be rendered in the browser.",
  alembic: "Alembic (.abc) files cannot be rendered in the browser.",
  dwg: "AutoCAD DWG (.dwg) files cannot be rendered in the browser.",
  usdc: "USD Crate (.usdc/.usd binary) cannot be rendered in the browser. Convert to USDZ for web viewing."
};

function getExt(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx + 1).toLowerCase();
}

function ModelViewer({ url, fileName, contentType }: {
  url: string; fileName: string; contentType: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [clicked, setClicked] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadProgress, setLoadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const displayName = stripGuidPrefix(fileName);

  useEffect(() => {
    if (!clicked)
      return;
    const mount = mountRef.current;
    if (!mount)
      return;

    let cancelled = false;
    const format = getModelFormat(contentType);

    if (format in BROWSER_UNSUPPORTED) {
      setErrorMsg(BROWSER_UNSUPPORTED[format as keyof typeof BROWSER_UNSUPPORTED]!);
      setLoadState("error");
      return;
    }
    if (format === "unknown") {
      setErrorMsg(`Unsupported format: .${getExt(fileName) || "unknown"}`);
      setLoadState("error");
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111318);
    scene.fog = new THREE.Fog(0x111318, 20, 80);

    const camera = new THREE.PerspectiveCamera(50, VIEWER_W / VIEWER_H, 0.001, 1000);
    camera.position.set(0, 1.5, 4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(VIEWER_W, VIEWER_H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(5, 8, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);
    scene.add(new THREE.DirectionalLight(0xffe8cc, 0.5).position.set(-5, -3, -4) && keyLight);

    const fillLight = new THREE.DirectionalLight(0xffe8cc, 0.5);
    fillLight.position.set(-5, -3, -4);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xaaccff, 0.35);
    rimLight.position.set(0, 4, -8);
    scene.add(rimLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));

    const grid = new THREE.GridHelper(20, 30, 0x2a2d36, 0x1e2028);
    grid.position.y = -1.5;
    scene.add(grid);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.ShadowMaterial({ opacity: 0.25 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.5;
    ground.receiveShadow = true;
    scene.add(ground);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 0.05;
    controls.maxDistance = 200;
    controls.screenSpacePanning = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.PAN
    };

    function fitObject(object: THREE.Object3D) {
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale = 2 / maxDim;
      object.scale.setScalar(scale);
      box.setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      object.position.set(-center.x, -box.min.y, -center.z);
      ground.position.y = -0.001;
      grid.position.y = -0.05;
      const br = box.getSize(new THREE.Vector3()).length() / 2;
      const dist = (br / Math.tan(((camera.fov * Math.PI) / 180) / 2)) * 1.4;
      camera.position.set(dist * 0.6, dist * 0.45, dist * 0.85);
      controls.target.set(0, (box.max.y - box.min.y) * 0.5, 0);
      controls.update();
    }

    function enableShadows(object: THREE.Object3D) {
      object.traverse((node: any) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
    }

    function onProgress(evt: ProgressEvent) {
      if (evt.lengthComputable && evt.total > 0 && !cancelled)
        setLoadProgress(Math.round((evt.loaded / evt.total) * 100));
    }

    function onError(err: unknown) {
      console.error("3D model load error:", err);
      if (!cancelled) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to load 3D model");
        setLoadState("error");
      }
    }

    function onLoad(object: THREE.Object3D) {
      if (cancelled)
        return;
      enableShadows(object);
      fitObject(object);
      scene.add(object);
      setLoadState("ready");
    }

    (async () => {
      try {
        if (format === "gltf") {
          new GLTFLoader().load(url, gltf => onLoad(gltf.scene), onProgress, onError);

        } else if (format === "obj") {
          new OBJLoader().load(url, onLoad, onProgress, onError);

        } else if (format === "stl") {
          new STLLoader().load(url, geo => {
            geo.computeVertexNormals();
            onLoad(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x8899bb, metalness: 0.15, roughness: 0.6, side: THREE.DoubleSide })));
          }, onProgress, onError);

        } else if (format === "collada") {
          new ColladaLoader().load(url, result => result && onLoad(result.scene), onProgress, onError);

        } else if (format === "fbx") {
          new FBXLoader().load(url, onLoad, onProgress, onError);

        } else if (format === "ply") {
          new PLYLoader().load(url, geo => {
            geo.computeVertexNormals();
            const mat = new THREE.MeshStandardMaterial({
              color: 0x8899bb, metalness: 0.15, roughness: 0.6,
              vertexColors: geo.hasAttribute("color"),
              side: THREE.DoubleSide,
            });
            onLoad(new THREE.Mesh(geo, mat));
          }, onProgress, onError);

        } else if (format === "vrml") {
          new VRMLLoader().load(url, onLoad, onProgress, onError);

        } else if (format === "vox") {
          new VOXLoader().load(url, (data: VOXLoaderResult) => {
            const group = new THREE.Group();
            for (const chunk of data.chunks)
              group.add(new VOXMesh(chunk));
            onLoad(group);
          }, onProgress, onError);

        } else if (format === "amf") {
          new AMFLoader().load(url, onLoad, onProgress, onError);

        } else if (format === "usdz") {
          new USDZLoader().load(url, onLoad, onProgress, onError);

        } else if (format === "x3d") {
          try {
            const res = await fetch(url);
            if (!res.ok)
              throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            if (cancelled)
              return;
            onLoad(parseX3DToObject(text));
          } catch (e) { onError(e); }

        } else if (format === "hyleus") {
          const fileLoader = new THREE.FileLoader();
          fileLoader.setResponseType("arraybuffer");
          fileLoader.load(url, async (buf) => {
            if (cancelled)
              return;
            try {
              const obj = await parseHyleusMesh(buf as ArrayBuffer);
              if (!cancelled)
                onLoad(obj);
            } catch (e) {
              if (!cancelled)
                onError(e);
            }
          }, onProgress, onError);

        }
      } catch (e) {
        if (!cancelled)
          onError(e);
      }
    })();

    let rafId: number;
    function animate() {
      rafId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      controls.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement))
        mount.removeChild(renderer.domElement);
    };
  }, [clicked]);

  const ext = getExt(displayName).toUpperCase() || "3D";

  if (!clicked) {
    return (
      <div
        onClick={() => setClicked(true)}
        onDoubleClick={e => e.stopPropagation()}
        style={{
          marginTop: 4, width: VIEWER_W, height: VIEWER_H,
          borderRadius: 10, overflow: "hidden",
          background: "var(--bg-2)", border: "1px solid var(--border)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          cursor: "pointer", gap: 10, userSelect: "none",
          transition: "background 0.15s ease, border-color 0.15s ease",
          position: "relative"
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-3)"; e.currentTarget.style.borderColor = "var(--accent-1)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-2)"; e.currentTarget.style.borderColor = "var(--border)"; }}
      >
        <svg width={VIEWER_W} height={VIEWER_H}
          style={{ position: "absolute", inset: 0, opacity: 0.07, pointerEvents: "none" }}>
          <defs>
            <pattern id="iso" x="0" y="0" width="40" height="23.1" patternUnits="userSpaceOnUse">
              <path d="M20 0 L40 11.55 L20 23.1 L0 11.55 Z" fill="none" stroke="currentColor" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#iso)" />
        </svg>

        <div style={{ position: "relative", color: "var(--text-3)" }}><CubeIcon size={48} /></div>
        <div style={{
          position: "relative", fontSize: 13, fontWeight: 600, color: "var(--text-3)",
          maxWidth: 320, textAlign: "center",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 16px"
        }}>
          {displayName}
        </div>
        <button style={{
          position: "relative", fontSize: 12, fontWeight: 600,
          padding: "6px 16px", borderRadius: 20,
          background: "var(--accent-1)", color: "white",
          border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
        }}>
          Load {ext} model
        </button>
        <div style={{ position: "relative", fontSize: 11, color: "var(--text-5)" }}>
          Not loaded. Click to fetch.
        </div>
      </div>
    );
  }

  return (
    <div
      onContextMenu={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
      style={{
        marginTop: 4, position: "relative",
        width: VIEWER_W, height: VIEWER_H,
        borderRadius: 10, overflow: "hidden", background: "#111318",
        border: "1px solid var(--border)"
      }}
    >
      <div ref={mountRef} style={{ width: VIEWER_W, height: VIEWER_H }} />

      {loadState === "loading" && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "#111318", gap: 12, pointerEvents: "none"
        }}>
          <div className="spinner" />
          <div style={{ fontSize: 12, color: "var(--text-5)" }}>
            {loadProgress > 0 ? `Loading model... ${loadProgress}%` : "Loading model..."}
          </div>
          {loadProgress > 0 && (
            <div style={{ width: 120, height: 3, background: "var(--bg-1)", borderRadius: 2 }}>
              <div style={{
                width: `${loadProgress}%`, height: "100%",
                background: "var(--accent-1)", borderRadius: 2, transition: "width 0.2s ease",
              }} />
            </div>
          )}
        </div>
      )}

      {loadState === "error" && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "#111318", gap: 8,
          color: "var(--red-2)", fontSize: 13, padding: "0 24px", textAlign: "center"
        }}>
          <span style={{ fontSize: 28 }}>⚠️</span>
          {errorMsg}
        </div>
      )}

      {loadState === "ready" && (
        <div style={{
          position: "absolute", bottom: 8, left: 0, right: 0,
          display: "flex", justifyContent: "center", pointerEvents: "none"
        }}>
          <div style={{
            fontSize: 11, padding: "3px 12px",
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
            borderRadius: 20, color: "rgba(255,255,255,0.4)", letterSpacing: "0.02em"
          }}>
            Drag to rotate · Scroll to zoom · Middle or right drag to pan
          </div>
        </div>
      )}

      <span
        className="dl-btn" 
        onClick={() => downloadFile(url, displayName)}
        title={t("attachments.download")}
        style={{
          position: "absolute", top: 8, right: 8,
          width: 28, height: 28, borderRadius: 6,
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
          color: "rgba(255,255,255,0.6)", border: "none",
          transition: "background 0.15s ease"
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.75)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,0,0,0.5)")}
      >
        <DownloadIcon size={14} />
      </span>
    </div>
  );
}

function ImageModal({ src, alt, displayName, onClose }: {
  src: string; alt: string; displayName: string; onClose: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [magnifierOn, setMagnifierOn] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [radius, setRadius] = useState(170);
  const [zoom, setZoom] = useState(2.5);
  const [imgRect, setImgRect] = useState<DOMRect | null>(null);

  const updateRect = () => {
    if (imgRef.current)
      setImgRect(imgRef.current.getBoundingClientRect());
  };

  useEffect(() => {
    updateRect();
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")
        onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!magnifierOn)
        return;
      e.preventDefault();

      const up = e.deltaY < 0;
      if (e.shiftKey)
        setRadius(r => Math.max(40, Math.min(400, r + (up ? 20 : -20))));
      else
        setZoom(z => Math.max(1.2, Math.min(12, z + (up ? 0.25 : -0.25))));
    };
    const el = wrapRef.current;
    el?.addEventListener("wheel", onWheel, { passive: false });
    return () => el?.removeEventListener("wheel", onWheel);
  }, [magnifierOn]);

  function handleMouseMove(e: React.MouseEvent) {
    if (magnifierOn)
      setPos({ x: e.clientX, y: e.clientY });
  }

  const lensImgStyle: React.CSSProperties | null =
    imgRect && magnifierOn
      ? {
          position: "absolute",
          width: imgRect.width * zoom,
          height: imgRect.height * zoom,
          left: -(pos.x - imgRect.left) * zoom + radius,
          top: -(pos.y - imgRect.top) * zoom + radius,
          userSelect: "none",
          pointerEvents: "none",
          draggable: false
        } as any
      : null;

  function updateMagnifier(on: boolean, e: React.MouseEvent) {
    e.stopPropagation();
    setPos({ x: e.clientX, y: e.clientY });
    updateRect();
    setMagnifierOn(on);
  }

  return (
    <div
      ref={wrapRef}
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onDoubleClick={e => e.stopPropagation()}
      onContextMenu={e => e.stopPropagation()}
      onMouseLeave={e => updateMagnifier(false, e)}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.9)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "default"
      }}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onMouseDown={e => updateMagnifier(e.button === 0, e)}
        onMouseUp={e => updateMagnifier(false, e)}
        onClick={e => e.stopPropagation()}
        onLoad={updateRect}
        draggable={false}
        style={{
          maxWidth: "90vw", maxHeight: "90vh",
          objectFit: "contain",
          cursor: magnifierOn ? "none" : "zoom-in",
          userSelect: "none",
          borderRadius: 4,
        }}
      />

      {magnifierOn && lensImgStyle && (
        <div style={{
          position: "fixed",
          left: pos.x - radius,
          top:  pos.y - radius,
          width:  radius * 2,
          height: radius * 2,
          borderRadius: "50%",
          overflow: "hidden",
          border: "2px solid rgba(255,255,255,0.75)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(0,0,0,0.3)",
          pointerEvents: "none"
        }}>
          <img src={src} alt="" style={lensImgStyle} />
        </div>
      )}

      {!magnifierOn && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          fontSize: 12, color: "rgba(255,255,255,0.4)",
          background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
          padding: "5px 14px", borderRadius: 20, pointerEvents: "none",
          letterSpacing: "0.02em"
        }}>
          Click image to magnify · Scroll to zoom · Shift+Scroll to resize lens
        </div>
      )}
      {magnifierOn && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          fontSize: 12, color: "rgba(255,255,255,0.35)",
          background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
          padding: "5px 14px", borderRadius: 20, pointerEvents: "none"
        }}>
          {zoom.toFixed(1)}× zoom · {radius * 2}px lens
        </div>
      )}

      <span
        className="dl-btn"
        onClick={e => { e.stopPropagation(); onClose(); }}
        style={{
          position: "fixed", top: 16, left: 16,
          width: 36, height: 36, borderRadius: "50%",
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "rgba(255,255,255,0.7)"
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.8)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,0,0,0.55)")}
      >
        <CloseIcon />
      </span>

      <span
        className="dl-btn" 
        onClick={e => { e.stopPropagation(); downloadFile(src, displayName); }}
        title={t("attachments.download")}
        style={{
          position: "fixed", top: 16, left: 60,
          height: 36, borderRadius: 18, padding: "0 14px",
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "rgba(255,255,255,0.7)",
          gap: 6, fontSize: 12
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.8)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,0,0,0.55)")}
      >
        <DownloadIcon size={13} />
        {displayName}
      </span>
    </div>
  );
}

function ImageAttachment({ attachment }: { attachment: Attachment }) {
  const [loaded, setLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const url = attachment.localUrl ?? getAttachmentUrl(attachment.fileName);
  const displayName = stripGuidPrefix(attachment.fileName);

  return (
    <>
      <div
        onDoubleClick={e => e.stopPropagation()}
        style={{
          marginTop: 4, position: "relative",
          width:  attachment.width && attachment.height ? Math.min(400, attachment.width) : 400,
          aspectRatio: attachment.width && attachment.height
            ? `${attachment.width} / ${attachment.height}` : undefined,
          maxWidth: 400, borderRadius: 6, overflow: "hidden"
        }}
      >
        {!loaded && attachment.placeholderHash && attachment.width && attachment.height && (
          <BlurhashPlaceholder hash={attachment.placeholderHash} width={attachment.width} height={attachment.height} />
        )}
        <img
          src={url}
          alt={displayName}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onClick={() => setModalOpen(true)}
          style={{
            width: "100%", height: "100%",
            objectFit: "contain", display: "block", position: "relative",
            cursor: "pointer"
          }}
        />
      </div>

      {modalOpen && (
        <ImageModal
          src={url}
          alt={displayName}
          displayName={displayName}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

function FileIcon({ kind }: { kind: AttachmentKind }) {
  const glyphs: Record<AttachmentKind, string | ReactNode> = {
    image: "🖼️",
    video: <FilmIcon size={16} />,
    audio: "🎵",
    text:  <TextDocument />,
    other: "📎",
    model: <span style={{ display: "flex", alignItems: "center", color: "var(--text-3)" }}><CubeIcon size={22} /></span>
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
  const displayName = stripGuidPrefix(attachment.fileName);

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
          <img src={attachment.localUrl} alt={displayName}
            style={{ maxWidth: 400, maxHeight: 300, borderRadius: 6, opacity: 0.5, display: "block" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="spinner" />
          </div>
          {typeof progress === "number" && (
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "rgba(0,0,0,0.3)", borderRadius: "0 0 6px 6px" }}>
              <div style={{
                height: "100%", width: `${Math.min(100, Math.max(0, progress))}%`,
                background: "var(--accent-1)", borderRadius: "0 0 6px 6px", transition: "width 0.2s ease"
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
            {displayName}
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
                background: "var(--accent-1)", borderRadius: 2, transition: "width 0.2s ease"
              }} />
            </div>
          )}
        </div>
        <div className="spinner small" />
      </div>
    );
  }

  if (kind === "image") {
    return <ImageAttachment attachment={attachment} />;
  }

  if (kind === "video") {
    return (
      <VideoPlayer
        url={url}
        displayName={displayName}
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
        displayName={displayName}
        placeholderHash={attachment.placeholderHash}
      />
    );
  }

  if (kind === "model") {
    return (
      <ModelViewer
        url={url}
        fileName={attachment.fileName}
        contentType={attachment.contentType}
      />
    );
  }

  if (kind === "text") {
    return (
      <div className="attachment-text" style={{
        marginTop: 4, maxWidth: 480,
        border: "1px solid var(--border)", borderRadius: 8,
        background: "var(--bg-2)", overflow: "hidden"
      }}>
        <button
          onClick={toggleExpand}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
        >
          <FileIcon kind={kind} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {displayName}
          </span>
          <button
            onClick={e => { e.stopPropagation(); downloadFile(url, displayName); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-4)", fontSize: 12, padding: 0 }}
          >
            {t("attachments.download")}
          </button>
          <span style={{ color: "var(--text-5)", fontSize: 12 }}>{expanded ? "▲" : "▼"}</span>
        </button>
        {expanded && (
          <div style={{
            borderTop: "1px solid var(--border)", padding: 8, maxHeight: 300,
            overflow: "auto", fontFamily: "monospace", fontSize: 12,
            color: "var(--text-3)", whiteSpace: "pre-wrap", wordBreak: "break-word"
          }}>
            {textLoading && t("attachments.loading")}
            {textError   && t("attachments.load_error")}
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
      border: "1px solid var(--border)", maxWidth: 320
    }}>
      <FileIcon kind={kind} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {displayName}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-5)" }}>
          {getExt(displayName).toUpperCase() || t("attachments.file")}
        </div>
      </div>
      <span
        onClick={() => downloadFile(url, displayName)}
        title={t("attachments.download")}
        className="dl-btn"
        style={{
          width: 28, height: 28, borderRadius: 6, color: "var(--text-3)",
          background: "var(--bg-1)"
        }}
      >
        <DownloadIcon />
      </span>
    </div>
  );
}