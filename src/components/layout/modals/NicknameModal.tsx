import { useState } from "react";
import { useAuthState } from "../../../lib/state/Auth";
import { setNickname, deleteNickname } from "../../../lib/api/SocialApi";
import { User } from "../../../lib/utils/Types";
import { getDisplayName } from "../../../lib/utils/UserUtils";
import { t, useLocale } from "../../../lib/i18n/Index";
import { TranslationKeys } from "../../../lib/i18n/Schema";

interface NicknameModalProps {
  open: boolean;
  target: User;
  currentNickname?: string | null;
  onClose: () => void;
  onSaved: (nickname: string | null) => void;
}

export default function NicknameModal({ open, target, currentNickname, onClose, onSaved }: NicknameModalProps) {
  useLocale();
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
      setError(e.message ?? "nickname.failed");
    } finally {
      setLoading(false);
    }
  }

  if (!open)
    return null;

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: 0 }}>{t("nickname.title")}</h2>
        <p style={{ color: "var(--text-4)", margin: 0, fontSize: 13 }}>
          {t("nickname.desc")}
        </p>
        <div className="form-group">
          <label>{t("nickname.placeholder")}</label>
          <input
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={getDisplayName(target)}
            maxLength={32}
            autoFocus
            onKeyDown={e => e.key === "Enter" && handleSave()}
          />
        </div>
        {error && <div className="error-msg">{t(error as TranslationKeys)}</div>}
        <div className="modal-buttons">
          <button onClick={onClose}>{t("cancel")}</button>
          <button className="create-btn" onClick={handleSave} disabled={loading}>
            {loading ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}