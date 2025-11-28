import { createSignal, Show } from "solid-js";
import { authState } from "../../lib/state/auth";
import { userState } from "../../lib/state/users";
import { login, registerUser } from "../../lib/api/authApi";
import { api } from "../../lib/api/http";

export default function LoginScreen() {
  const [isRegister, setIsRegister] = createSignal(false);
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [username, setUsername] = createSignal("");
  const [error, setError] = createSignal("");

  async function handleLogin() {
    setError("");
    try {
      const result = await login(email(), password());

      authState.setToken(result.token);
      localStorage.setItem("token", result.token);

      const me = await api("/users/@me", {
        headers: { Authorization: `Bearer ${result.token}` }
      });

      authState.setUser(me);
      userState.setUsers([...userState.users(), me]);

    } catch (e: any) {
      setError(e.message || "Login failed");
    }
  }

  async function handleRegister() {
    setError("");
    try {
      const result = await registerUser(email(), password(), username());

      // Immediately login after registration
      authState.setToken(result.token);
      localStorage.setItem("token", result.token);

      const me = await api("/users/@me");
      authState.setUser(me);
      userState.setUsers([...userState.users(), me]);

    } catch (e: any) {
      setError(e.message || "Registration failed");
    }
  }

  return (
    <div class="login-screen">
      <div class="login-card">
        <h2>{isRegister() ? "Create an account" : "Login"}</h2>

        <div class="form-group">
          <label>Username/Email</label>
          <input
            type="email"
            value={email()}
            onInput={(e) => setEmail(e.currentTarget.value)}
          />
        </div>

        <Show when={isRegister()}>
          <div class="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
            />
          </div>
        </Show>

        <div class="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
        </div>

        <Show when={error()}>
          <div class="error-msg">{error()}</div>
        </Show>

        <button class="primary-btn" onClick={() => (isRegister() ? handleRegister() : handleLogin())}>
          {isRegister() ? "Register" : "Login"}
        </button>

        <button class="secondary-btn" onClick={() => setIsRegister(!isRegister())}>
          {isRegister() ? "Already have an account?" : "Create an account"}
        </button>
      </div>
    </div>
  );
}
