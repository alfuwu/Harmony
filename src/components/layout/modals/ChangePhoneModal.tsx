import { useState } from "react";
import { sendPhoneVerification, verifyPhone } from "../../../lib/api/authApi";

type Step = "enter" | "verify";

interface Props {
  open: boolean;
  currentPhone?: string | null;
  token: string;
  onClose: () => void;
  onSaved: (newPhone: string) => void;
}

export default function ChangePhoneModal({ open, currentPhone, token, onClose, onSaved }: Props) {
  const opts = { headers: { Authorization: `Bearer ${token}` } };

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
        setError("Enter a phone number first.");
        return;
    }
    setLoading(true);
    setError("");
    try {
      await sendPhoneVerification(trimmed, opts);
      setStep("verify");
      startCooldown(60);
    } catch (e: any) {
      setError(e.message ?? "Failed to send code");
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
      await sendPhoneVerification(phone.trim(), opts);
      startCooldown(60);
    } catch (e: any) {
      setError(e.message ?? "Failed to resend");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6) {
        setError("Enter the 6-digit code.");
        return;
    }
    setLoading(true);
    setError("");
    try {
      await verifyPhone(phone.trim(), trimmedCode, opts);
      onSaved(phone.trim());
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Invalid code");
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
      {error}
    </div>
  ) : null;

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ width: 400 }}>

        {step === "enter" && (
          <>
            <h2 style={{ margin: 0 }}>{currentPhone ? "Change Phone Number" : "Add Phone Number"}</h2>
            <p style={{ margin: 0, color: "var(--text-5)", fontSize: 13 }}>
              Enter your number in E.164 format, e.g. <code>+12125551234</code>.
              A 6-digit verification code will be sent via SMS.
            </p>

            <div className="form-group">
              <label>Phone number</label>
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
              <button onClick={onClose}>Cancel</button>
              <button
                className="create-btn"
                onClick={handleSendCode}
                disabled={loading || !phone.trim()}
              >
                {loading ? "Sending..." : "Send Code"}
              </button>
            </div>
          </>
        )}

        {step === "verify" && (
          <>
            <h2 style={{ margin: 0 }}>Enter Verification Code</h2>
            <p style={{ margin: 0, color: "var(--text-5)", fontSize: 13 }}>
              We sent a 6-digit code to <strong style={{ color: "var(--text-3)" }}>{phone}</strong>.
              It expires in 10 minutes.
            </p>

            <div className="form-group">
              <label>Verification code</label>
              <input
                autoFocus
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={handleKeyEnter}
                maxLength={6}
                style={{ letterSpacing: 6, textAlign: "center", fontSize: 22 }}
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
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setStep("enter"); setCode(""); setError(""); }}>Back</button>
                <button
                  className="create-btn"
                  onClick={handleVerify}
                  disabled={loading || code.length !== 6}
                  style={{ opacity: code.length === 6 ? 1 : 0.5 }}
                >
                  {loading ? "Verifying..." : "Verify"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}