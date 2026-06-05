import { useEffect, useRef, useState } from "react";
import { useAuthState } from "../../lib/state/Auth";
import { useUserState } from "../../lib/state/Users";
import { login, registerUser, checkUsernameAvailability, UsernameAvailability } from "../../lib/api/authApi";
import { api } from "../../lib/api/http";
import { useServerState } from "../../lib/state/Servers";
import { useChannelState } from "../../lib/state/Channels";
import { initializeClient } from "../../lib/client/init";
import { useMessageState } from "../../lib/state/Messages";

export default function LoginScreen() {
  const authState = useAuthState();
  const { setUser, setToken, setUserSettings } = authState;
  const serverState = useServerState();
  const channelState = useChannelState();
  const messageState = useMessageState();
  const userState = useUserState();
  const { addUser } = userState;

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  const [availability, setAvailability] = useState<UsernameAvailability | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isRegister) return;

    setAvailability(null);
    if (username.length < 2) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const result = await checkUsernameAvailability(username);
        setAvailability(result);
      } catch {
        setAvailability(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [username, isRegister]);

  function attemptLogin(e: React.KeyboardEvent) {
    if (e.key === "Enter")
      isRegister ? handleRegister() : handleLogin();
  }

  async function handleLogin() {
    setError("");
    try {
      const result = await login(username, password);
      setToken(result.token);
      localStorage.setItem("token", result.token);

      const me = await api("/users/@me", { headers: { Authorization: `Bearer ${result.token}` } });
      setUser(me);
      addUser(me);
      initializeClient({ authState, serverState, channelState, messageState, userState, setUserSettings });
    } catch (e: any) {
      setError(e.message || "Login failed");
    }
  }

  async function handleRegister() {
    setError("");
    try {
      const result = await registerUser(email, password, username);
      setToken(result.token);
      localStorage.setItem("token", result.token);

      const me = await api("/users/@me", { headers: { Authorization: `Bearer ${result.token}` } });
      setUser(me);
      addUser(me);
      initializeClient({ authState, serverState, channelState, messageState, userState, setUserSettings });
    } catch (e: any) {
      setError(e.message || "Registration failed");
    }
  }

  const discPreview = availability && !availability.pomelo
    ? `#${String(availability.discriminator).padStart(4, "0")}`
    : null;

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
              onChange={e => setEmail(e.currentTarget.value)}
              onKeyDown={attemptLogin}
            />
          </div>
        )}
        <div className="form-group">
          <label>{isRegister ? "Username" : "Username / Email"}</label>
          <input
            type="text"
            autoComplete="off"
            value={username}
            onChange={e => setUsername(e.currentTarget.value)}
            onKeyDown={attemptLogin}
          />
          {isRegister && username.length >= 2 && (
            <div style={{ marginTop: 4, fontSize: 12, minHeight: 18 }}>
              {checkingUsername && (
                <span style={{ color: "var(--text-5)" }}>Checking availability…</span>
              )}
              {!checkingUsername && availability?.pomelo && (
                <span style={{ color: "var(--green-2)" }}>
                  ✓ <strong>@{username}</strong> is available as a unique handle.
                </span>
              )}
              {!checkingUsername && availability && !availability.pomelo && (
                <div style={{
                  background: "color-mix(in hsl, var(--yellow-2), transparent 82%)",
                  border: "1px solid color-mix(in hsl, var(--yellow-2), transparent 50%)",
                  borderRadius: 6,
                  padding: "6px 10px",
                  color: "var(--yellow-1)",
                  lineHeight: 1.5,
                }}>
                  <span style={{ marginRight: 5 }}>⚠️</span>
                  <strong>@{username}</strong> is already taken as a unique handle.
                  {" "}You'll be registered as{" "}
                  <strong>@{username}{discPreview}</strong> instead.
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
            onChange={e => setPassword(e.currentTarget.value)}
            onKeyDown={attemptLogin}
          />
        </div>
        
        {error && <div className="error-msg">{error}</div>}

        <button className="primary-btn" onClick={() => (isRegister ? handleRegister() : handleLogin())}>
          {isRegister ? "Register" : "Login"}
        </button>
        <button className="secondary-btn" onClick={() => { setIsRegister(!isRegister); setAvailability(null); setUsername(""); }}>
          {isRegister ? "Already have an account?" : "Create an account"}
        </button>
      </div>
    </div>
  );
}