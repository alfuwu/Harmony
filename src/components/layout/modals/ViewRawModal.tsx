import { useState } from "react";
import { t, useLocale } from "../../../lib/i18n/Index";
import { TranslationKeys } from "../../../lib/i18n/Schema";

interface Props {
  title?: TranslationKeys;
  data: unknown;
  onClose: () => void;
}

export default function RawViewModal({ title, data, onClose }: Props) {
  useLocale();
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(data, null, 2);

  function copy() {
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div
        className="modal-container"
        onClick={e => e.stopPropagation()}
        style={{
          width: 600,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden"
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-2)" }}>{t(title ?? "json.raw_title")}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={copy}
              style={{
                padding: "4px 12px",
                fontSize: 12,
                background: copied
                  ? "color-mix(in hsl, var(--green-2), transparent 72%)"
                  : "var(--bg-2)",
                color: copied ? "var(--green-1)" : "var(--text-4)",
                border: `1px solid ${copied
                  ? "color-mix(in hsl, var(--green-2), transparent 45%)"
                  : "var(--button-border)"}`,
                borderRadius: 6
              }}
            >
              {copied ? t("copy") : t("json.copy")}
            </button>
            <button
              onClick={onClose}
              style={{
                width: 26, height: 26, padding: 0, borderRadius: 5, border: "none",
                background: "rgba(255,255,255,0.07)", color: "var(--text-4)",
                fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}
            >✕</button>
          </div>
        </div>
        <pre style={{
          flex: 1,
          overflow: "auto",
          margin: 0,
          padding: "14px 16px",
          fontSize: 12,
          fontFamily: "'Fira Code', Consolas, monospace",
          color: "var(--text-3)",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          background: "var(--bg-1)"
        }}>
          {json}
        </pre>
      </div>
    </div>
  );
}