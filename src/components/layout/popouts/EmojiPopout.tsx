import { useLayoutEffect, useRef, useState } from "react";
import { renderEmoji } from "../../../lib/utils/MarkdownRenderer";
import { UserSettings } from "../../../lib/utils/UserSettings";
import { t, tr } from "../../../lib/i18n/Index";

function isFlag(native: string): boolean {
  const pts = [...(native ?? "")].map(c => c.codePointAt(0) ?? 0);
  return pts.length === 2 && pts.every(p => p >= 0x1f1e6 && p <= 0x1f1ff);
}

function normalizeEmojiId(id: string, native?: string): string {
  let n = (id ?? "").replace(/-/g, "_");
  if (native && isFlag(native) && !n.startsWith("flag_") && !n.startsWith("regional_"))
    n = `flag_${n}`;
  return n;
}

interface EmojiPopoutProps {
  emoji: string;
  emojiName: string;
  userSettings: UserSettings | null;
  position: { top: number; left?: number; right?: number; };
}

export default function EmojiPopout({ emoji, emojiName, userSettings, position }: EmojiPopoutProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [copied, setCopied] = useState(false);

  const displayName = normalizeEmojiId(emojiName, emoji);

  useLayoutEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    }
  }, []);

  const clampedLeft = position.left != null
    ? Math.max(8, Math.min(position.left, window.innerWidth - size.width - 8))
    : undefined;
  const clampedRight = position.right != null
    ? Math.max(8, Math.min(position.right, window.innerWidth + size.width - 8))
    : undefined;
  const clampedTop = Math.max(8, Math.min(position.top, window.innerHeight - size.height - 8));

  function copyShortcode() {
    navigator.clipboard.writeText(`:${displayName}:`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      ref={ref}
      className="uno"
      style={{
        position: "fixed",
        top: clampedTop,
        left: clampedLeft !== undefined ? clampedLeft : (clampedRight ?? 0) - size.width,
        zIndex: 1000,
        background: "var(--bg-2)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        boxShadow: "0 8px 28px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)",
        width: "230px",
        overflow: "hidden",
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 14px 10px",
        borderBottom: "1px solid var(--border)",
        background: "color-mix(in hsl, var(--bg-3), transparent 20%)",
      }}>
        <div style={{
          width: "52px",
          height: "52px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-1)",
          borderRadius: "10px",
          border: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          {renderEmoji(userSettings, emoji, "emoji-big")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>
          <span style={{
            fontWeight: 700,
            color: "var(--text-2)",
            fontSize: "14px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            :{displayName}:
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{
              fontSize: "10px",
              fontWeight: 600,
              color: "var(--text-5)",
              background: "color-mix(in hsl, var(--bg-4), transparent 30%)",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              padding: "1px 5px",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}>
              {t("emoji.standard")}
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{
          fontSize: "10px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-5)",
          marginBottom: "5px",
        }}>
          {t("emoji.shortcode")}
        </div>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "var(--bg-1)",
          borderRadius: "7px",
          padding: "6px 10px",
          border: "1px solid var(--border)",
        }}>
          <code style={{
            flex: 1,
            fontSize: "13px",
            color: "var(--accent-1)",
            fontFamily: "monospace",
            background: "none",
            padding: 0,
            border: "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            :{displayName}:
          </code>
          <button
            title={copied ? t("emoji.copied_title") : t("emoji.copy_shortcode")}
            onClick={copyShortcode}
            style={{
              background: copied
                ? "color-mix(in hsl, var(--green-2), transparent 72%)"
                : "color-mix(in hsl, var(--bg-3), transparent 20%)",
              border: `1px solid ${copied
                ? "color-mix(in hsl, var(--green-2), transparent 45%)"
                : "var(--button-border)"}`,
              boxShadow: "none",
              color: copied ? "var(--green-1)" : "var(--text-4)",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: "5px",
              flexShrink: 0,
              transition: "background 150ms, border-color 150ms, color 150ms",
              whiteSpace: "nowrap",
            }}
          >
            {copied ? t("copied") : t("copy")}
          </button>
        </div>

        <div style={{
          marginTop: "8px",
          fontSize: "11px",
          color: "var(--text-5)",
          lineHeight: 1.4,
        }}>
          {tr("emoji.find_hint", { hint: <code
            style={{
              fontSize: "11px",
              background: "var(--bg-1)",
              border: "1px solid var(--border)",
              borderRadius: "3px",
              padding: "0 3px",
              color: "var(--text-4)",
            }}
          >
            :{displayName.slice(0, 3)}
          </code> })}
        </div>
      </div>
    </div>
  );
}
