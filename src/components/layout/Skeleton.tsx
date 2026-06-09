import React from "react";

(function injectSkeletonStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById("skeleton-styles")) return;
  const el = document.createElement("style");
  el.id = "skeleton-styles";
  el.textContent = `
    .skeleton-bone {
      background: var(--bg-2);
      border-radius: 6px;
      position: relative;
      overflow: hidden;
      flex-shrink: 0;
    }
    .skeleton-bone::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(
        90deg,
        transparent 0%,
        var(--bg-4, color-mix(in hsl, var(--bg-3), white 6%)) 50%,
        transparent 100%
      );
      transform: translateX(-100%);
      animation: skeleton-sweep 1.6s ease-in-out infinite;
    }
    @keyframes skeleton-sweep {
      from { transform: translateX(-100%); }
      to   { transform: translateX( 200%); }
    }
  `;
  document.head.appendChild(el);
})();

// ─── Primitive bone ──────────────────────────────────────────────────────────

interface BoneProps {
  w?: string | number;
  h?: string | number;
  r?: string | number;
  style?: React.CSSProperties;
  className?: string;
}

function Bone({ w = "100%", h = 14, r = 6, style, className = "" }: BoneProps) {
  return (
    <div
      className={`skeleton-bone ${className}`}
      style={{ width: w, height: h, borderRadius: r, ...style }}
    />
  );
}

// ─── Deterministic width tables (avoids Math.random on re-render) ─────────────

const CHANNEL_WIDTHS  = [72, 85, 60, 90, 68, 78, 55, 83, 65, 50];
const MEMBER_WIDTHS   = [75, 60, 88, 65, 80, 52, 70, 85, 58, 72];

// Each entry = content line widths for one skeleton message group
const MESSAGE_LINE_PATTERNS: number[][] = [
  [75],
  [85, 60],
  [50],
  [90, 70, 42],
  [65],
  [80],
  [55, 88],
  [70, 48],
];

// ─── Server ──────────────────────────────────────────────────────────────────

export function SkeletonServer() {
  return (
    <div
      className="server uno"
      style={{ cursor: "default", pointerEvents: "none" }}
    >
      <Bone w={48} h={48} r="33%" />
    </div>
  );
}

export function SkeletonServerList({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonServer key={i} />
      ))}
    </>
  );
}

// ─── Channel ─────────────────────────────────────────────────────────────────

export function SkeletonChannel({ index = 0 }: { index?: number }) {
  const w = CHANNEL_WIDTHS[index % CHANNEL_WIDTHS.length];
  return (
    <div
      className="channel uno"
      style={{ pointerEvents: "none", gap: 8, opacity: 0.75 }}
    >
      <Bone w={15} h={15} r="50%" />
      <Bone w={`${w}%`} h={13} />
    </div>
  );
}

export function SkeletonChannelList() {
  return (
    <>
      {/* Category A */}
      <div style={{ padding: "12px 8px 4px", display: "flex", alignItems: "center", gap: 6 }}>
        <Bone w={8} h={8} r={2} />
        <Bone w={80} h={10} r={4} />
      </div>
      {[0, 1, 2, 3].map(i => (
        <SkeletonChannel key={i} index={i} />
      ))}

      {/* Category B */}
      <div style={{ padding: "12px 8px 4px", display: "flex", alignItems: "center", gap: 6 }}>
        <Bone w={8} h={8} r={2} />
        <Bone w={90} h={10} r={4} />
      </div>
      {[4, 5, 6].map(i => (
        <SkeletonChannel key={i} index={i} />
      ))}
    </>
  );
}

// ─── Member ──────────────────────────────────────────────────────────────────

export function SkeletonMember({ index = 0 }: { index?: number }) {
  const w = MEMBER_WIDTHS[index % MEMBER_WIDTHS.length];
  return (
    <div
      className="member"
      style={{
        display: "flex",
        alignItems: "center",
        padding: "4px 12px",
        gap: 10,
        pointerEvents: "none",
      }}
    >
      <Bone w={32} h={32} r="50%" />
      <Bone w={`${w}%`} h={13} />
    </div>
  );
}

export function SkeletonMemberList({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonMember key={i} index={i} />
      ))}
    </>
  );
}

// ─── Message ─────────────────────────────────────────────────────────────────

export function SkeletonMessage({
  index = 0,
  compact = false,
}: {
  index?: number;
  compact?: boolean;
}) {
  const lines = MESSAGE_LINE_PATTERNS[index % MESSAGE_LINE_PATTERNS.length];

  if (compact) {
    return (
      <div className="message" style={{ pointerEvents: "none" }}>
        <div
          className="content-container"
          style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
        >
          <Bone w={50} h={12} r={4} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            {lines.map((lw, li) => (
              <Bone key={li} w={`${lw}%`} h={13} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="message" style={{ pointerEvents: "none" }}>
      <div className="group-header">
        <Bone w={40} h={40} r="50%" style={{ marginRight: 12 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Bone w={110} h={13} />
            <Bone w={55} h={11} r={4} />
          </div>
          {lines.map((lw, li) => (
            <Bone key={li} w={`${lw}%`} h={13} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkeletonMessages({
  count = 6,
  compact = false,
}: {
  count?: number;
  compact?: boolean;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonMessage key={i} index={i} compact={compact} />
      ))}
    </>
  );
}