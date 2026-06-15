import { useState } from "react";

const COLORS = [
  "#5865f2", "#eb459e", "#ed4245", "#fee75c",
  "#57f287", "#1abc9c", "#e67e22", "#9b59b6"
];

interface Props {
  onConfirm: (name: string, color: string) => void;
  onClose: () => void;
}

export default function CreateFolderModal({ onConfirm, onClose }: Props) {
  const [name,  setName]  = useState("");
  const [color, setColor] = useState(COLORS[0]);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed)
      return;
    onConfirm(trimmed, color);
  }

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div
        className="modal-container"
        onClick={e => e.stopPropagation()}
        style={{ width: 360, maxWidth: "calc(100vw - 32px)", padding: "20px 20px 16px" }}
      >
        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>
          New Folder
        </div>

        <label
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-5)",
            display: "block",
            marginBottom: 6
          }}
        >
          Folder Name
        </label>
        <input
          type="text"
          value={name}
          maxLength={32}
          placeholder="My Servers"
          autoFocus
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter")  submit();
            if (e.key === "Escape") onClose();
          }}
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "var(--bg-1)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "9px 12px",
            fontSize: 14,
            color: "var(--text-2)",
            outline: "none",
            marginBottom: 16
          }}
        />

        <label
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-5)",
            display: "block",
            marginBottom: 8
          }}
        >
          Color
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {COLORS.map(c => (
            <div
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: c,
                cursor: "pointer",
                outline: color === c ? `3px solid ${c}` : "none",
                outlineOffset: 2,
                transition: "outline 100ms"
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid var(--button-border)",
              background: "var(--bg-2)",
              color: "var(--text-3)",
              fontSize: 13,
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim()}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: name.trim() ? "var(--accent-1)" : "var(--bg-4)",
              color: name.trim() ? "#fff" : "var(--text-5)",
              fontSize: 13,
              fontWeight: 600,
              cursor: name.trim() ? "pointer" : "default",
              transition: "background 120ms"
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
