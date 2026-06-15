import { useState } from "react";
import { sendPhoneVerification, verifyPhone } from "../../../lib/api/AuthApi";
import { t, tr, useLocale } from "../../../lib/i18n/Index";
import type { TranslationKeys } from "../../../lib/i18n/Schema";

type Step = "enter" | "verify";

interface Props {
  open: boolean;
  currentPhone?: string | null;
  onClose: () => void;
  onSaved: (newPhone: string) => void;
}

export default function ChangePhoneModal({ open, currentPhone, onClose, onSaved }: Props) {
  useLocale();

  const [step, setStep] = useState<Step>("enter");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  if (!open)
    return null;

  function startCooldown(seconds = 60) {
    setCooldown(seconds);
    const tick = () => {
      setCooldown((c) => {
        if (c <= 1)
            return 0;
        setTimeout(tick, 1000);
        return c - 1;
      });
    };
    setTimeout(tick, 1000);
  }

  async function handleSendCode() {
    const trimmed = phone.trim();
    if (!trimmed) {
        setError("error.phone.required");
        return;
    }
    setLoading(true);
    setError("");
    try {
      await sendPhoneVerification(trimmed);
      setStep("verify");
      startCooldown(60);
    } catch (e: any) {
      setError(e.message ?? "error.phone.send");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0)
        return;
    setLoading(true);
    setError("");
    try {
      await sendPhoneVerification(phone.trim());
      startCooldown(60);
    } catch (e: any) {
      setError(e.message ?? "error.phone.resend");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6) {
        setError("error.phone.code_length");
        return;
    }
    setLoading(true);
    setError("");
    try {
      await verifyPhone(phone.trim(), trimmedCode);
      onSaved(phone.trim());
      onClose();
    } catch (e: any) {
      setError(e.message ?? "error.invalid_code");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyEnter(e: React.KeyboardEvent) {
    if (e.key !== "Enter")
        return;
    if (step === "enter")
        handleSendCode();
    if (step === "verify")
        handleVerify();
  }

  const errorBanner = error ? (
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
  ) : null;

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ width: 400 }}>

        {step === "enter" && (
          <>
            <h2 style={{ margin: 0 }}>{t(currentPhone ? "change_phone.title" : "add_phone.title")}</h2>
            <p style={{ margin: 0, color: "var(--text-5)", fontSize: 13 }}>
              {tr("change_phone.desc", { number: <code>+12125551234</code> })}
            </p>

            <div className="form-group">
              <label>{t("phone")}</label>
              <input
                autoFocus
                type="tel"
                placeholder="+12125551234"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={handleKeyEnter}
              />
            </div>

            {errorBanner}

            <div className="modal-buttons">
              <button onClick={onClose}>{t("cancel")}</button>
              <button
                className="create-btn"
                onClick={handleSendCode}
                disabled={loading || !phone.trim()}
              >
                {loading ? t("sending") : t("send_code")}
              </button>
            </div>
          </>
        )}

        {step === "verify" && (
          <>
            <h2 style={{ margin: 0 }}>{t("verify_phone.title")}</h2>
            <p style={{ margin: 0, color: "var(--text-5)", fontSize: 13 }}>
              {tr("verify_phone.sent", { number: <strong style={{ color: "var(--text-3)" }}>{phone}</strong>})}
            </p>

            <div className="form-group">
              <label>{t("verify_phone.code")}</label>
              <input
                autoFocus
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={handleKeyEnter}
                maxLength={6}
                style={{ letterSpacing: 6, textIndent: 6, textAlign: "center", fontSize: 22 }}
              />
            </div>

            {errorBanner}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <button
                onClick={handleResend}
                disabled={cooldown > 0 || loading}
                style={{
                  background: "none", border: "none", boxShadow: "none",
                  color: cooldown > 0 ? "var(--text-5)" : "var(--accent-1)",
                  cursor: cooldown > 0 ? "default" : "pointer",
                  fontSize: 13, padding: 0,
                }}
              >
                {cooldown > 0
                  ? t("resend_in", { seconds: cooldown })
                  : t("resend_code")}
              </button>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setStep("enter"); setCode(""); setError(""); }}>{t("back")}</button>
                <button
                  className="create-btn"
                  onClick={handleVerify}
                  disabled={loading || code.length !== 6}
                  style={{ opacity: code.length === 6 ? 1 : 0.5 }}
                >
                  {loading ? t("verifying") : t("verify")}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}