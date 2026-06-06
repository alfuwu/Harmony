import { useState } from "react";
import { useAuthState } from "../../../lib/state/Auth";
import { setNickname, deleteNickname } from "../../../lib/api/socialApi";
import { User } from "../../../lib/utils/types";
import { getDisplayName } from "../../../lib/utils/UserUtils";

interface NicknameModalProps {
  open: boolean;
  target: User;
  currentNickname?: string | null;
  onClose: () => void;
  onSaved: (nickname: string | null) => void;
}

export default function NicknameModal({ open, target, currentNickname, onClose, onSaved }: NicknameModalProps) {
  const { token } = useAuthState();
  const [value, setValue] = useState(currentNickname ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setLoading(true); setError("");
    try {
      if (value.trim()) {
        await setNickname(target.id, value.trim(), { headers: { Authorization: `Bearer ${token}` } });
        onSaved(value.trim());
      } else {
        await deleteNickname(target.id, { headers: { Authorization: `Bearer ${token}` } });
        onSaved(null);
      }
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Failed to save nickname");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: 0 }}>Set Nickname</h2>
        <p style={{ color: "var(--text-4)", margin: 0, fontSize: 13 }}>
          This nickname is only visible to you. It overrides how
          <strong> {getDisplayName(target)}</strong>'s name appears.
        </p>
        <div className="form-group">
          <label>Nickname (leave blank to remove)</label>
          <input
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={getDisplayName(target)}
            maxLength={32}
            autoFocus
            onKeyDown={e => e.key === "Enter" && handleSave()}
          />
        </div>
        {error && <div className="error-msg">{error}</div>}
        <div className="modal-buttons">
          <button onClick={onClose}>Cancel</button>
          <button className="create-btn" onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}