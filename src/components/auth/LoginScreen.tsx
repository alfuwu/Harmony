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
} from "../../lib/api/authApi";
import { api } from "../../lib/api/http";
import { useServerState } from "../../lib/state/Servers";
import { useChannelState } from "../../lib/state/Channels";
import { initializeClient } from "../../lib/client/init";
import { useMessageState } from "../../lib/state/Messages";

type View = "login" | "register" | "twoFactor" | "emailPending";

export default function LoginScreen() {
  const authState = useAuthState();
  const { setUser, setToken, setUserSettings } = authState;
  const serverState = useServerState();
  const channelState = useChannelState();
  const messageState = useMessageState();
  const userState = useUserState();
  const { addUser } = userState;

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
    const me = await api("/users/@me", { headers: { Authorization: `Bearer ${token}` } });
    setUser(me);
    addUser(me);
    initializeClient({ authState, serverState, channelState, messageState, userState, setUserSettings });
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
    } catch (e: any) {
      setError(e.message || "Login failed");
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
      setError(e.message || "Registration failed");
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
      setError(e.message || "Invalid code");
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
      setError(e.message || "Failed to resend");
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
            <h2 style={{ margin: "0 0 4px" }}>Two-Factor Authentication</h2>
            <p style={{ margin: "0 0 20px", color: "var(--text-5)", fontSize: 13 }}>
              {useRecovery
                ? "Enter one of your recovery codes."
                : "Enter the 6-digit code from your authenticator app."}
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

          {error && <div className="error-msg">{error}</div>}

          <button
            className="primary-btn"
            onClick={handleTwoFactor}
            disabled={loading || !twoFactorCode.trim()}
          >
            {loading ? "Verifying..." : "Verify"}
          </button>

          <button
            className="secondary-btn"
            onClick={() => {
              setUseRecovery((r) => !r);
              setTwoFactorCode("");
              setError("");
            }}
          >
            {useRecovery ? "Use authenticator code instead" : "Use a recovery code instead"}
          </button>

          <button
            className="secondary-btn"
            onClick={() => {
              setView("login");
              setTwoFactorChallenge("");
              setError("");
            }}
          >
            ← Back to login
          </button>
        </div>
      </div>
    );
  }

  if (view === "emailPending") {
    return (
      <div className="login-screen">
        <div className="login-modal" style={{ textAlign: "center" }}>
          <h2 style={{ margin: "0 0 8px" }}>Check your email</h2>
          <p style={{ color: "var(--text-4)", fontSize: 14, margin: "0 0 16px" }}>
            We sent a verification link to{" "}
            <strong style={{ color: "var(--text-2)" }}>{pendingEmail}</strong>.
            <br />
            Click the link in that email to activate your account.
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
            <strong>Didn't get it?</strong> Check your spam folder, or click below to resend.
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button
            className="primary-btn"
            onClick={handleResend}
            disabled={resendCooldown > 0}
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend verification email"}
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
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-modal">
        <h2>{isRegister ? "Create an account" : "Login"}</h2>
        {isRegister && (
          <div className="form-group">
            <label>Email</label>
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
          <label>{isRegister ? "Username" : "Username / Email"}</label>
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
                <span style={{ color: "var(--text-5)" }}>Checking availability...</span>
              )}
              {!checkingUsername && availability?.pomelo && (
                <span style={{ color: "var(--green-2)" }}>
                  ✓ <strong>@{username}</strong> is available as a unique handle.
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
                  <strong>@{username}</strong> is already taken.{" "}
                  You'll be registered as{" "}
                  <strong>
                    @{username}{discPreview}
                  </strong>{" "}
                  instead.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            onKeyDown={handleKey}
          />
        </div>

        {error && <div className="error-msg">{error}</div>}

        <button
          className="primary-btn"
          disabled={loading}
          onClick={() => (isRegister ? handleRegister() : handleLogin())}
        >
          {loading ? (isRegister ? "Creating account..." : "Signing in...") : isRegister ? "Register" : "Login"}
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
          {isRegister ? "Already have an account?" : "Create an account"}
        </button>
      </div>
    </div>
  );
}