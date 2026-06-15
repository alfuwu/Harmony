import { useEffect, useRef, useState } from "react";
import { useAuthState } from "../../lib/state/Auth";
import { useUserState } from "../../lib/state/Users";
import {
  login,
  registerUser,
  checkUsernameAvailability,
  UsernameAvailability,
  twoFactorLogin,
  twoFactorLoginRecovery,
  sendVerificationEmail,
} from "../../lib/api/AuthApi";
import { api } from "../../lib/api/Http";
import { initializeClient } from "../../lib/client/Init";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { t, tr, useLocale } from "../../lib/i18n/Index";
import { TranslationKeys } from "../../lib/i18n/Schema";

type View = "login" | "register" | "twoFactor" | "emailPending";

export default function LoginScreen() {
  useLocale();

  const { setUser, setToken } = useAuthState();
  const { addUser } = useUserState();

  const [view, setView] = useState<View>("login");
  const [isRegister, setIsRegister] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [twoFactorChallenge, setTwoFactorChallenge] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);

  const [pendingEmail, setPendingEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const [availability, setAvailability] = useState<UsernameAvailability | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0)
      return;
    const id = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  useEffect(() => {
    if (!isRegister)
      return;
    setAvailability(null);
    if (username.length < 2)
      return;
    if (debounceRef.current)
      clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        setAvailability(await checkUsernameAvailability(username));
      } catch {
        setAvailability(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [username, isRegister]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key !== "Enter")
      return;
    if (view === "login")
      isRegister ? handleRegister() : handleLogin();
    if (view === "twoFactor")
      handleTwoFactor();
  }

  async function completeLogin(token: string) {
    setToken(token);
    localStorage.setItem("token", token);
    const me = await api("/users/@me");
    setUser(me);
    addUser(me);
    initializeClient();
  }

  async function handleLogin() {
    setError("");
    setLoading(true);
    try {
      const result = await login(username, password);

      if (result.requiresTwoFactor) {
        setTwoFactorChallenge(result.twoFactorChallenge);
        setTwoFactorCode("");
        setUseRecovery(false);
        setView("twoFactor");
        return;
      }

      await completeLogin(result.token);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    setError("");
    setLoading(true);
    try {
      const result = await registerUser(email, password, username);

      if (result.requiresEmailVerification) {
        setPendingEmail(email);
        setResendCooldown(60);
        setView("emailPending");
        return;
      }

      // generally shouldn't happen
      if (result.token)
        await completeLogin(result.token);
    } catch (e: any) {
      setError(e.message ?? "login.register_failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleTwoFactor() {
    if (!twoFactorCode.trim())
      return;
    setError("");
    setLoading(true);
    try {
      const result = useRecovery
        ? await twoFactorLoginRecovery(twoFactorChallenge, twoFactorCode.trim())
        : await twoFactorLogin(twoFactorChallenge, twoFactorCode.trim());
      await completeLogin(result.token);
    } catch (e: any) {
      setError(e.message ?? "error.invalid_code");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0)
      return;
    try {
      await sendVerificationEmail(pendingEmail);
      setResendCooldown(60);
    } catch (e: any) {
      setError(e.message ?? "error.phone.resend");
    }
  }

  const discPreview = availability && !availability.pomelo
    ? `#${String(availability.discriminator).padStart(4, "0")}`
    : null;

  if (view === "twoFactor") {
    return (
      <div className="login-screen">
        <div className="login-modal">
          <div style={{ textAlign: "center" }}>
            <h2 style={{ margin: "0 0 4px" }}>{t("2fa")}</h2>
            <p style={{ margin: "0 0 20px", color: "var(--text-5)", fontSize: 13 }}>
              {useRecovery
                ? t("login.2fa_recovery_hint")
                : t("login.2fa_auth_hint")}
            </p>
          </div>

          <input
            autoFocus
            placeholder={useRecovery ? "xxxx-xxxx-xxxx" : "000000"}
            value={twoFactorCode}
            onChange={(e) => setTwoFactorCode(e.target.value)}
            onKeyDown={handleKey}
            maxLength={useRecovery ? 14 : 6}
            style={{ textAlign: "center", letterSpacing: useRecovery ? 2 : 6, fontSize: 20 }}
          />

          {error && <div className="error-msg">{t(error as TranslationKeys)}</div>}

          <button
            className="primary-btn"
            onClick={handleTwoFactor}
            disabled={loading || !twoFactorCode.trim()}
          >
            {loading ? t("verifying") : t("verify")}
          </button>

          <button
            className="secondary-btn"
            onClick={() => {
              setUseRecovery((r) => !r);
              setTwoFactorCode("");
              setError("");
            }}
          >
            {useRecovery ? t("2fa.use_auth") : t("2fa.use_recovery")}
          </button>

          <button
            className="secondary-btn"
            onClick={() => {
              setView("login");
              setTwoFactorChallenge("");
              setError("");
            }}
          >
            {t("login.back_arrow")}
          </button>
        </div>
      </div>
    );
  }

  if (view === "emailPending") {
    return (
      <div className="login-screen">
        <div className="login-modal" style={{ textAlign: "center" }}>
          <h2 style={{ margin: "0 0 8px" }}>{t("login.email.check")}</h2>
          <p style={{ color: "var(--text-4)", fontSize: 14, margin: "0 0 16px" }}>
            {tr("login.email.sent", { email: <strong style={{ color: "var(--text-2)" }}>{pendingEmail}</strong> })}
            <br />
            {t("login.email.activate")}
          </p>

          <div
            style={{
              background: "color-mix(in hsl, var(--blue-2), transparent 82%)",
              border: "1px solid color-mix(in hsl, var(--blue-2), transparent 55%)",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              color: "var(--blue-1)",
              marginBottom: 16,
              textAlign: "left",
            }}
          >
            <strong>{t("login.email.didnt_get")}</strong> {t("login.email.spam")}
          </div>

          {error && <div className="error-msg">{t(error as TranslationKeys)}</div>}

          <button
            className="primary-btn"
            onClick={handleResend}
            disabled={resendCooldown > 0}
          >
            {resendCooldown > 0
              ? t("resend_in", { seconds: resendCooldown })
              : t("login.resend_verification")}
          </button>

          <button
            className="secondary-btn"
            onClick={() => {
              setView("login");
              setIsRegister(false);
              setEmail("");
              setPassword("");
              setUsername("");
              setError("");
            }}
          >
            {t("login.back_to_login")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {isTauri() && (
        <>
          <div className="window-buttons login">
            <button onClick={() => invoke("minimize")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                <path fill="currentColor" d="M19 13H5v-2h14z" />
              </svg>
            </button>
            <button onClick={() => invoke("toggle_maximize")}> 
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                <path fill="currentColor" d="M4 4h16v16H4zm2 2v12h12V6z" />
              </svg>
            </button>
            <button className="close-btn" onClick={() => invoke("close")}> 
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                <path fill="currentColor" d="M13.46 12L19 17.54V19h-1.46L12 13.46L6.46 19H5v-1.46L10.54 12L5 6.46V5h1.46L12 10.54L17.54 5H19v1.46z" />
              </svg>
            </button>
          </div>
          <hr />
        </>
      )}
      <div className="login-screen">
        <div className="login-modal">
          <h2>{isRegister ? t("login.register_title") : t("login.title")}</h2>
          {isRegister && (
            <div className="form-group">
              <label>{t("email")}</label>
              <input
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                onKeyDown={handleKey}
              />
            </div>
          )}
          <div className="form-group">
            <label>{isRegister ? t("username") : t("login.username_or_email")}</label>
            <input
              type="text"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
              onKeyDown={handleKey}
            />
            {isRegister && username.length >= 2 && (
              <div style={{ marginTop: 4, fontSize: 12, minHeight: 18 }}>
                {checkingUsername && (
                  <span style={{ color: "var(--text-5)" }}>{t("change_un.checking")}</span>
                )}
                {!checkingUsername && availability?.pomelo && (
                  <span style={{ color: "var(--green-2)" }}>
                    ✓ {tr("change_un.available", { username: <strong>@{username}</strong> })}
                  </span>
                )}
                {!checkingUsername && availability && !availability.pomelo && (
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
                    <span style={{ marginRight: 5 }}>⚠️</span>
                    {tr("change_un.taken", { username: <strong>@{username}</strong>, disc: <strong>@{username}{discPreview}</strong> })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>{t("password")}</label>
            <input
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              onKeyDown={handleKey}
            />
          </div>

          {error && <div className="error-msg">{t(error as TranslationKeys)}</div>}

          <button
            className="primary-btn"
            disabled={loading}
            onClick={() => (isRegister ? handleRegister() : handleLogin())}
          >
            {loading
              ? (isRegister ? t("login.creating_account") : t("login.signing_in"))
              : (isRegister ? t("create") : t("login.title"))}
          </button>
          <button
            className="secondary-btn"
            onClick={() => {
              setIsRegister(!isRegister);
              setAvailability(null);
              setUsername("");
              setError("");
            }}
          >
            {isRegister ? t("login.already_have") : t("login.register_title")}
          </button>
        </div>
      </div>
    </>
  );
}