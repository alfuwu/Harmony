import { useEffect, useRef, useState } from "react";
import { checkUsernameAvailability, UsernameAvailability } from "../../../lib/api/AuthApi";
import { updateMe } from "../../../lib/api/UserApi";
import { t } from "../../../lib/i18n/Index";
import { TranslationKeys } from "../../../lib/i18n/Schema";

interface Props {
  open: boolean;
  currentUsername: string;
  token: string;
  onClose: () => void;
  onSaved: (newUsername: string, newDiscriminator: number) => void;
}

export default function ChangeUsernameModal({
  open, currentUsername, token, onClose, onSaved,
}: Props) {
  const opts = { headers: { Authorization: `Bearer ${token}` } };

  const [username, setUsername] = useState(currentUsername);
  const [availability, setAvailability] = useState<UsernameAvailability | null>(null);
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open)
        return;
    setUsername(currentUsername);
    setAvailability(null);
    setError("");
  }, [open, currentUsername]);

  useEffect(() => {
    if (!open)
        return;
    setAvailability(null);
    const trimmed = username.trim();
    if (trimmed.length < 2 || trimmed === currentUsername)
        return;
    if (debounceRef.current)
        clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setChecking(true);
      try {
        setAvailability(await checkUsernameAvailability(trimmed));
      } catch {
        setAvailability(null);
      } finally {
        setChecking(false);
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [username, open, currentUsername]);

  if (!open)
    return null;

  const trimmed = username.trim();
  const unchanged = trimmed === currentUsername;
  const canSave = !unchanged && trimmed.length >= 2 && trimmed.length <= 32 && !loading;

  async function handleSave() {
    if (!canSave)
        return;
    setLoading(true);
    setError("");
    try {
      await updateMe({ username: trimmed }, opts);
      const disc = availability && !availability.pomelo ? availability.discriminator : 0;
      onSaved(trimmed, disc);
      onClose();
    } catch (e: any) {
      setError(e.message ?? "error.un_change");
    } finally {
      setLoading(false);
    }
  }

  const discPreview =
    !unchanged && availability && !availability.pomelo
      ? `#${String(availability.discriminator).padStart(4, "0")}`
      : null;

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ width: 400 }}>
        <h2 style={{ margin: 0 }}>{t("change_un.title")}</h2>
        <p style={{ margin: 0, color: "var(--text-5)", fontSize: 13 }}>
          {t("change_un.desc")}
        </p>

        <div className="form-group">
          <label>{t("change_un.new_un")}</label>
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            maxLength={32}
            placeholder={currentUsername}
          />
          <div style={{ fontSize: 12, marginTop: 4, minHeight: 28 }}>
            {unchanged && (
              <span style={{ color: "var(--text-5)" }}>
                {t("change_un.same")}
              </span>
            )}

            {!unchanged && checking && (
              <span style={{ color: "var(--text-5)" }}>
                {t("change_un.checking")}
              </span>
            )}
            {!unchanged && !checking && availability?.pomelo && (
              <span style={{ color: "var(--green-2)" }}>
                ✓ <strong>@{trimmed}</strong> {t("change_un.available.prefix")}
              </span>
            )}
            {!unchanged && !checking && availability && !availability.pomelo && (
              <div
                style={{
                  background: "color-mix(in hsl, var(--yellow-2), transparent 82%)",
                  border: "1px solid color-mix(in hsl, var(--yellow-2), transparent 50%)",
                  borderRadius: 6,
                  padding: "6px 10px",
                  color: "var(--yellow-1)",
                  lineHeight: 1.5,
                }}
              >
                ⚠️ <strong>@{trimmed}</strong> {t("change_un.taken.prefix")}{" "}
                <strong>@{trimmed}{discPreview}</strong> {t("change_un.taken.suffix")}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div
            style={{
              color: "var(--red-2)", fontSize: 13, padding: "8px 12px",
              background: "color-mix(in hsl, var(--red-2), transparent 85%)",
              border: "1px solid color-mix(in hsl, var(--red-2), transparent 60%)",
              borderRadius: 6,
            }}
          >
            {t(error as TranslationKeys)}
          </div>
        )}

        <div className="modal-buttons">
          <button onClick={onClose}>{t("cancel")}</button>
          <button
            className="create-btn"
            onClick={handleSave}
            disabled={!canSave}
            style={{ opacity: canSave ? 1 : 0.5 }}
          >
            {loading ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}