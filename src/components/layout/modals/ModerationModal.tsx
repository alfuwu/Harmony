import { useState } from "react";
import { t, tr } from "../../../lib/i18n/Index";
import { Member } from "../../../lib/utils/Types";
import { Name } from "../Generic";
import { getUs } from "../../../lib/state/Users";

interface Props {
  target: Member;
  action: "kick" | "ban" | "ip_ban";
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

export default function ModerationModal({ target, action, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setLoading(true);
    setError("");
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Action failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()} style={{ width: 400 }}>
        <h2 style={{ margin: 0 }}>
          {tr(`moderation.${action}.target`, { target: <Name user={getUs().get(target.userId)} member={target} md={{}} /> })}
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-5)", margin: "6px 0 16px" }}>
          {t(`moderation.${action}.desc`)}
        </p>
        <div className="form-group">
          <label>Reason (optional)</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Enter a reason..."
            maxLength={500}
            rows={3}
            style={{
              resize: "vertical", width: "100%", minHeight: 60, boxSizing: "border-box",
              background: "var(--bg-1)", color: "var(--text-3)",
              border: "1px solid var(--button-border)", borderRadius: 6,
              padding: 8, fontFamily: "inherit", fontSize: "1em",
            }}
          />
        </div>
        {error && <div style={{ color: "var(--red-2)", fontSize: 13, marginBottom: 8 }}>{error}</div>}
        <div className="modal-buttons">
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            style={{
              background: "var(--red-3)",
              border: "1px solid color-mix(in hsl, var(--red-3), transparent 30%)",
              color: "#fff",
            }}
          >
            {loading ? t("...") : t(`moderation.${action}`)}
          </button>
        </div>
      </div>
    </div>
  );
}