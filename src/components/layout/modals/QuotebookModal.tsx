import { useEffect, useState } from "react";
import { useAuthState } from "../../../lib/state/Auth";
import { getQuotebook, removeFromQuotebook } from "../../../lib/api/SocialApi";
import { useMessageState } from "../../../lib/state/Messages";
import { useUserState } from "../../../lib/state/Users";
import { getDisplayName, getAvatar } from "../../../lib/utils/UserUtils";
import { QuotebookEntry } from "../../../lib/utils/Types";
import { t, useLocale } from "../../../lib/i18n/Index";

interface QuotebookModalProps {
  open: boolean;
  onClose: () => void;
}

export default function QuotebookModal({ open, onClose }: QuotebookModalProps) {
  useLocale();
  const { token } = useAuthState();
  const { messages } = useMessageState();
  const { get } = useUserState();
  const [entries, setEntries] = useState<QuotebookEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getQuotebook(0, { headers: { Authorization: `Bearer ${token}` } })
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open]);

  async function handleRemove(entry: QuotebookEntry) {
    try {
      await removeFromQuotebook(entry.id, { headers: { Authorization: `Bearer ${token}` } });
      setEntries(prev => prev.filter(e => e.id !== entry.id));
    } catch (e) {
      console.error(e);
    }
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div
        className="modal-container"
        onClick={e => e.stopPropagation()}
        style={{ width: 520, maxHeight: "70vh", display: "flex", flexDirection: "column" }}
      >
        <h2 style={{ margin: 0 }}>{t("quotebook.title")}</h2>
        <p style={{ color: "var(--text-4)", margin: "4px 0 12px", fontSize: 13 }}>
          {t("quotebook.desc")}
        </p>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          {loading && <div style={{ color: "var(--text-4)", textAlign: "center" }}>{t("loading")}</div>}

          {!loading && entries.length === 0 && (
            <div style={{ color: "var(--text-4)", textAlign: "center", padding: "20px 0" }}>
              {t("quotebook.empty")}
            </div>
          )}

          {entries.map(entry => {
            const msg = messages.find(m => m.id === entry.messageId);
            const author = msg ? get(msg.authorId) : undefined;
            return (
              <div
                key={entry.id}
                style={{
                  background: "var(--bg-1)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  border: "1px solid var(--border)",
                  position: "relative",
                }}
              >
                {author && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <img src={getAvatar(author)} alt="" style={{ width: 20, height: 20, borderRadius: "50%" }} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-2)" }}>
                      {getDisplayName(author)}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-5)" }}>
                      {new Date(entry.savedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
                <div style={{ fontSize: 14, color: "var(--text-3)", whiteSpace: "pre-wrap" }}>
                  {msg?.content ?? <em style={{ color: "var(--text-5)" }}>{t("quotebook.not_loaded")}</em>}
                </div>
                {entry.note && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-4)", fontStyle: "italic" }}>
                    {t("quotebook.note", { note: entry.note })}
                  </div>
                )}
                <button
                  onClick={() => handleRemove(entry)}
                  style={{
                    position: "absolute", top: 8, right: 8,
                    background: "none", border: "none", boxShadow: "none",
                    color: "var(--text-5)", cursor: "pointer", fontSize: 16, padding: 2,
                  }}
                  title={t("quotebook.remove")}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        <div className="modal-buttons" style={{ marginTop: 12 }}>
          <button onClick={onClose}>{t("close")}</button>
        </div>
      </div>
    </div>
  );
}