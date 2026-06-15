import { useTranslations } from "../../../lib/state/Translations";

interface Props {
  messageId: number;
}

export default function TranslationBubble({ messageId }: Props) {
  const entry = useTranslations(s => s.entries[messageId]);
  const dismiss = useTranslations(s => s.dismiss);

  if (!entry)
    return null;

  return (
    <div
      style={{
        marginTop: 4,
        padding: "6px 10px",
        background: "color-mix(in hsl, var(--accent-1), transparent 88%)",
        border: "1px solid color-mix(in hsl, var(--accent-1), transparent 72%)",
        borderRadius: 8,
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        maxWidth: "100%"
      }}
    >
      <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1, opacity: 0.7 }}>🌐</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {entry.status === "loading" && (
          <span style={{ fontSize: 13, color: "var(--text-4)", fontStyle: "italic" }}>
            Translating…
          </span>
        )}
        {entry.status === "error" && (
          <span style={{ fontSize: 13, color: "var(--red-1)" }}>
            [Translation failed]
          </span>
        )}
        {entry.status === "done" && (
          <span style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.45 }}>
            {entry.text}
          </span>
        )}
      </div>
      <button
        onClick={() => dismiss(messageId)}
        title="Show original"
        style={{
          flexShrink: 0,
          fontSize: 11,
          padding: "2px 7px",
          borderRadius: 5,
          border: "1px solid color-mix(in hsl, var(--accent-1), transparent 60%)",
          background: "none",
          color: "var(--accent-1)",
          cursor: "pointer",
          marginTop: 1,
          lineHeight: 1.4
        }}
      >
        Original
      </button>
    </div>
  );
}
