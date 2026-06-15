import { useState } from "react";
import { User } from "../../../lib/utils/Types";
import { useNicknames } from "../../../lib/state/Nicknames";
import { deleteNickname, setNickname } from "../../../lib/api/SocialApi";

interface Props {
  user: User;
  onClose: () => void;
}

const MAX_LEN = 32;

export default function NicknameModal({ user, onClose }: Props) {
  const { get, set } = useNicknames();
  const current = get(user.id) ?? "";

  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed   = value.trim();
  const unchanged = trimmed === current;

  async function save() {
    if (unchanged || saving)
      return;

    setSaving(true);
    setError(null);

    try {
      if (trimmed)
        await setNickname(user.id, trimmed);
      else
        await deleteNickname(user.id);

      set(user.id, trimmed || null);
      onClose();
    } catch {
      setError("Failed to save nickname.");
    } finally {
      setSaving(false);
    }
  }

  const displayName = user.displayName ?? user.username;

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div
        className="modal-container"
        onClick={e => e.stopPropagation()}
        style={{ width: 400, maxWidth: "calc(100vw - 32px)", padding: "20px 20px 16px" }}
      >
        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-1)", marginBottom: 4 }}>
          Set Nickname
        </div>
        <div style={{ fontSize: 13, color: "var(--text-4)", marginBottom: 18 }}>
          Choose a personal nickname for{" "}
          <strong style={{ color: "var(--text-2)" }}>{displayName}</strong>.
          Only you can see it.
        </div>

        <div style={{ marginBottom: 16 }}>
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
            Nickname
          </label>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              value={value}
              maxLength={MAX_LEN}
              placeholder={displayName}
              autoFocus
              onChange={e => { setValue(e.target.value); setError(null); }}
              onKeyDown={e => {
                if (e.key === "Enter")
                  save();
                else if (e.key === "Escape")
                  onClose();
              }}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "var(--bg-1)",
                border: `1px solid ${error ? "var(--red-1)" : "var(--border)"}`,
                borderRadius: 8,
                padding: "9px 46px 9px 12px",
                fontSize: 14,
                color: "var(--text-2)",
                outline: "none"
              }}
            />
            <span
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 11,
                color: value.length >= MAX_LEN ? "var(--red-1)" : "var(--text-5)"
              }}
            >
              {value.length}/{MAX_LEN}
            </span>
          </div>
          {error && (
            <div style={{ fontSize: 12, color: "var(--red-1)", marginTop: 4 }}>{error}</div>
          )}
        </div>

        {current && (
          <div
            onClick={() => setValue("")}
            style={{
              fontSize: 12,
              color: "var(--red-1)",
              cursor: "pointer",
              marginBottom: 16,
              display: "inline-block"
            }}
          >
            Remove nickname
          </div>
        )}

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
            onClick={save}
            disabled={unchanged || saving}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: unchanged || saving ? "var(--bg-4)" : "var(--accent-1)",
              color: unchanged || saving ? "var(--text-5)" : "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: unchanged || saving ? "default" : "pointer",
              transition: "background 120ms"
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
