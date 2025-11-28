import "./App.css";
import { createEffect, createResource, Show } from "solid-js";
import { authState } from "./lib/state/auth";
import { api } from "./lib/api/http";
import LoginScreen from "./components/auth/LoginScreen";
import ChannelList from "./components/layout/ChannelList";
import MemberList from "./components/layout/MemberList";
import ServerList from "./components/layout/ServerList";
import MessageList from "./components/messages/MessageList";
import MessageInput from "./components/messages/MessageInput";
import TitleBar from "./components/layout/TitleBar";
import { initializeClient } from "./lib/client/init";
import { userState } from "./lib/state/users";

async function fetchMe() {
  const cached = localStorage.getItem("token");
  if (!cached)
    return null;

  // store token before fetching so HTTP requests include it
  authState.setToken(cached);

  try {
    const me = await api("/users/@me", { headers: { Authorization: `Bearer ${cached}` } });
    authState.setUser(me);
    userState.setUsers([...userState.users(), me]);
    return me;
  } catch {
    localStorage.removeItem("token");
    authState.setToken(null);
    return null;
  }
}

export default function App() {
  const [me] = createResource(fetchMe);

  createEffect(() => {
    if (authState.user())
      initializeClient();
  });

  return (
    <div class="ven-colors">
      <Show when={!me.loading} fallback={null}>
        <Show when={me() || authState.user()} fallback={<LoginScreen />}>
          <div class="app">
            <ServerList />
            <div class="channel-list">
              <ChannelList />
            </div>
            <div class="valign">
              <TitleBar />
              <div class="halign">
                <div class="valign">
                  <div class="valign ovy-auto justify-end">
                    <MessageList />
                  </div>
                  <MessageInput />
                </div>
                <div class="member-list">
                  <MemberList />
                </div>
              </div>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
}
