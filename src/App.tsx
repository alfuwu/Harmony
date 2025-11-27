import "./App.css";
import { createResource, Show } from "solid-js";
import { authState } from "./lib/state/auth";
import { api } from "./lib/api/http";
import Sidebar from "./components/layout/Sidebar";
import LoginScreen from "./components/auth/LoginScreen";
import ChannelList from "./components/layout/ChannelList";
import MessageList from "./components/messages/MessageList";
import MessageInput from "./components/messages/MessageInput";
import TitleBar from "./components/layout/TitleBar";
import MemberList from "./components/layout/MemberList";

async function fetchMe() {
  const cached = localStorage.getItem("token");
  if (!cached)
    return null;

  // store token before fetching so HTTP requests include it
  authState.setToken(cached);

  try {
    const me = await api("/users/@me", { headers: { Authorization: `Bearer ${cached}` } });
    authState.setUser(me);
    return me;
  } catch {
    localStorage.removeItem("token");
    authState.setToken(null);
    return null;
  }
}

export default function App() {
  const [me] = createResource(fetchMe);

  return (
    <div class="ven-colors">
      <Show when={me() || authState.user()} fallback={<LoginScreen />}>
        <div class="app">
          <Sidebar />
          <div style="width: 240px; border-right: 1px solid #ccc;">
            <ChannelList />
          </div>
          <div class="valign">
            <TitleBar />
            <div class="halign">
              <div class="valign">
                <div style="flex: 1; overflow-y: auto;">
                  <MessageList />
                </div>
                <MessageInput />
              </div>
              <div style="width: 180px; border-left: 1px solid #ccc;">
                <MemberList />
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
