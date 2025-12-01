import { useState } from "react";
import { useAuthState } from "../../lib/state/Auth";
import { useUserState } from "../../lib/state/Users";
import { login, registerUser } from "../../lib/api/authApi";
import { api } from "../../lib/api/http";
import { useServerState } from "../../lib/state/Servers";
import { useChannelState } from "../../lib/state/Channels";
import { useMemberState } from "../../lib/state/Members";
import { initializeClient } from "../../lib/client/init";
import { useMessageState } from "../../lib/state/Messages";

export default function LoginScreen() {
  const { setUser, setToken, setUserSettings } = useAuthState();
  const { addUser } = useUserState();
  const serverState = useServerState();
  const channelState = useChannelState();
  const memberState = useMemberState();
  const { addMessages } = useMessageState();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

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
      initializeClient({
        token: result.token,
        addServers: serverState.addServers,
        setCurrentServer: serverState.setCurrentServer,
        addChannels: channelState.addChannels,
        setCurrentChannel: channelState.setCurrentChannel,
        addMembers: memberState.addMembers,
        addMessages,
        setUserSettings
      });
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
      initializeClient({
        token: result.token,
        addServers: serverState.addServers,
        setCurrentServer: serverState.setCurrentServer,
        addChannels: channelState.addChannels,
        setCurrentChannel: channelState.setCurrentChannel,
        addMembers: memberState.addMembers,
        addMessages,
        setUserSettings
      });
    } catch (e: any) {
      setError(e.message || "Registration failed");
    }
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
              onChange={e => setEmail(e.currentTarget.value)}
              onKeyDown={attemptLogin}
            />
          </div>
        )}
        <div className="form-group">
          <label>{isRegister ? "Username" : "Username/Email"}</label>
          <input
            type="text"
            autoComplete="off"
            value={username}
            onChange={e => setUsername(e.currentTarget.value)}
            onKeyDown={attemptLogin}
          />
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
        {error && (
          <div className="error-msg">{error}</div>
        )}
        <button className="primary-btn" onClick={() => (isRegister ? handleRegister() : handleLogin())}>
          {isRegister ? "Register" : "Login"}
        </button>
        <button className="secondary-btn" onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? "Already have an account?" : "Create an account"}
        </button>
      </div>
    </div>
  );
}
