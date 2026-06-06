import { useState, useEffect } from "react";
import {
  twoFactorBeginSetup,
  twoFactorConfirmSetup,
  twoFactorDisable,
} from "../../../lib/api/authApi";

type SetupStep = "loading" | "secret" | "confirm" | "recovery";

interface Props {
  mode: "setup" | "disable";
  open: boolean;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TwoFactorModal({ mode, open, token, onClose, onSuccess }: Props) {
  const opts = { headers: { Authorization: `Bearer ${token}` } };

  const [setupStep, setSetupStep] = useState<SetupStep>("loading");
  const [secret, setSecret] = useState("");
  const [qrUri, setQrUri] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [recoveryAcknowledged, setRecoveryAcknowledged] = useState(false);

  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  useEffect(() => {
    if (!open)
        return;
    setCode("");
    setError("");
    setUseRecovery(false);
    setRecoveryAcknowledged(false);
    setSecretCopied(false);
    if (mode === "setup") {
      setSetupStep("loading");
      twoFactorBeginSetup(opts)
        .then(({ secret: s, qrUri: q }) => {
          setSecret(s);
          setQrUri(q);
          setSetupStep("secret");
        })
        .catch((e) => {
          setError(e.message ?? "Failed to start setup");
          setSetupStep("secret");
        });
    }
  }, [open, mode]);

  if (!open)
    return null;

  async function handleConfirmSetup() {
    if (!code.trim())
        return;
    setLoading(true);
    setError("");
    try {
      const result = await twoFactorConfirmSetup(code.trim(), opts);
      setRecoveryCodes(result.recoveryCodes);
      setSetupStep("recovery");
    } catch (e: any) {
      setError(e.message ?? "Invalid code — check your authenticator app and try again");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    if (!code.trim())
        return;
    setLoading(true);
    setError("");
    try {
      await twoFactorDisable(code.trim(), opts);
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  function copySecret() {
    navigator.clipboard.writeText(secret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      if (mode === "setup" && setupStep === "secret")
        handleConfirmSetup();
      if (mode === "disable")
        handleDisable();
    }
  }

  const base: React.CSSProperties = {
    background: "var(--bg-3)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 28,
    width: 440,
    maxWidth: "90vw",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  };

  if (mode === "disable") {
    return (
      <div className="modal-backdrop open" onClick={onClose}>
        <div style={base} onClick={(e) => e.stopPropagation()}>
          <div>
            <h2 style={{ margin: 0 }}>Disable Two-Factor Authentication</h2>
            <p style={{ margin: "6px 0 0", color: "var(--text-5)", fontSize: 13 }}>
              Enter your current authenticator code or a recovery code to confirm.
            </p>
          </div>

          <div className="form-group">
            <label>{useRecovery ? "Recovery code" : "Authenticator code"}</label>
            <input
              autoFocus
              placeholder={useRecovery ? "xxxx-xxxx-xxxx" : "000000"}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKey}
              maxLength={useRecovery ? 14 : 6}
              style={{ letterSpacing: useRecovery ? 1 : 4, textAlign: "center", fontSize: 18 }}
            />
          </div>

          {error && (
            <div
              style={{
                color: "var(--red-2)",
                fontSize: 13,
                padding: "8px 12px",
                background: "color-mix(in hsl, var(--red-2), transparent 85%)",
                border: "1px solid color-mix(in hsl, var(--red-2), transparent 60%)",
                borderRadius: 6,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button
              onClick={() => { setUseRecovery((r) => !r); setCode(""); setError(""); }}
              style={{ fontSize: 12, color: "var(--text-4)", background: "none", border: "none", boxShadow: "none", cursor: "pointer", padding: "4px 8px" }}
            >
              {useRecovery ? "Use authenticator code" : "Use recovery code instead"}
            </button>
            <button onClick={onClose}>Cancel</button>
            <button
              onClick={handleDisable}
              disabled={loading || !code.trim()}
              style={{ background: "color-mix(in hsl, var(--red-3), transparent 20%)", color: "var(--red-1)", border: "1px solid color-mix(in hsl, var(--red-3), transparent 40%)" }}
            >
              {loading ? "Disabling..." : "Disable 2FA"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "setup" && setupStep === "recovery") {
    return (
      <div className="modal-backdrop open">
        <div style={{ ...base, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
          <div>
            <h2 style={{ margin: 0 }}>Two-Factor Authentication Enabled</h2>
            <p style={{ margin: "6px 0 0", color: "var(--text-5)", fontSize: 13 }}>
              Save these recovery codes somewhere safe. Each code can only be used once to log in
              if you lose access to your authenticator app.{" "}
              <strong style={{ color: "var(--red-2)" }}>They will not be shown again.</strong>
            </p>
          </div>

          <div
            style={{
              background: "var(--bg-1)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "14px 18px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "6px 24px",
            }}
          >
            {recoveryCodes.map((rc, i) => (
              <code key={i} style={{ fontFamily: "monospace", fontSize: 13, color: "var(--text-2)", letterSpacing: 1 }}>
                {rc}
              </code>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              id="2fa-ack"
              checked={recoveryAcknowledged}
              onChange={(e) => setRecoveryAcknowledged(e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
            />
            <label htmlFor="2fa-ack" style={{ fontSize: 13, color: "var(--text-4)", cursor: "pointer" }}>
              I have saved my recovery codes in a safe place.
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={() => {
                const text = recoveryCodes.join("\n");
                navigator.clipboard.writeText(text);
              }}
            >
              Copy All
            </button>
            <button
              onClick={() => {
                onSuccess();
                onClose();
              }}
              disabled={!recoveryAcknowledged}
              style={{
                background: recoveryAcknowledged ? "var(--accent-3)" : undefined,
                color: recoveryAcknowledged ? "var(--text-0)" : undefined,
                opacity: recoveryAcknowledged ? 1 : 0.5,
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "setup" && setupStep === "loading") {
    return (
      <div className="modal-backdrop open" onClick={onClose}>
        <div style={{ ...base, alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
          <p style={{ color: "var(--text-4)" }}>Loading setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div style={{ ...base, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 style={{ margin: 0 }}>Set Up Two-Factor Authentication</h2>
          <p style={{ margin: "6px 0 0", color: "var(--text-5)", fontSize: 13 }}>
            Open your authenticator app (Google Authenticator, Authy, 1Password, etc.) and add
            a new account using the secret key below.
          </p>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-5)", marginBottom: 6 }}>
            Secret Key
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--bg-1)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "10px 14px",
            }}
          >
            <code
              style={{
                flex: 1,
                fontFamily: "monospace",
                fontSize: 15,
                letterSpacing: 2,
                color: "var(--accent-1)",
                wordBreak: "break-all",
              }}
            >
              {secret}
            </code>
            <button
              onClick={copySecret}
              style={{
                flexShrink: 0,
                padding: "4px 12px",
                fontSize: 12,
                background: secretCopied
                  ? "color-mix(in hsl, var(--green-2), transparent 72%)"
                  : "var(--bg-2)",
                color: secretCopied ? "var(--green-1)" : "var(--text-4)",
                border: `1px solid ${secretCopied ? "color-mix(in hsl, var(--green-2), transparent 45%)" : "var(--button-border)"}`,
                borderRadius: 6,
              }}
            >
              {secretCopied ? "✓ Copied" : "Copy"}
            </button>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-5)" }}>
            In your app, choose <em>Enter setup key manually</em> and paste the key above.
            Set the account name to anything (e.g. Harmony) and leave type as Time-based.
          </div>
        </div>

        <div className="form-group">
          <label style={{ fontWeight: 600 }}>Confirm with a code from your app</label>
          <input
            autoFocus
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={handleKey}
            maxLength={6}
            style={{ letterSpacing: 6, textAlign: "center", fontSize: 22 }}
          />
          <div style={{ fontSize: 12, color: "var(--text-5)", marginTop: 3 }}>
            Enter the 6-digit code shown in your authenticator app to verify the setup.
          </div>
        </div>

        {error && (
          <div
            style={{
              color: "var(--red-2)",
              fontSize: 13,
              padding: "8px 12px",
              background: "color-mix(in hsl, var(--red-2), transparent 85%)",
              border: "1px solid color-mix(in hsl, var(--red-2), transparent 60%)",
              borderRadius: 6,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={handleConfirmSetup}
            disabled={loading || code.length !== 6}
            style={{
              background: code.length === 6 ? "var(--accent-3)" : undefined,
              color: code.length === 6 ? "var(--text-0)" : undefined,
              opacity: code.length === 6 ? 1 : 0.5,
            }}
          >
            {loading ? "Verifying..." : "Enable 2FA"}
          </button>
        </div>
      </div>
    </div>
  );
}