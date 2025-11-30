import "./App.css";
import { useEffect, useState } from "react";
import { api } from "./lib/api/http";
import LoginScreen from "./components/auth/LoginScreen";
import ChannelList from "./components/layout/ChannelList";
import MemberList from "./components/layout/MemberList";
import ServerList from "./components/layout/ServerList";
import MessageList from "./components/messages/MessageList";
import MessageInput from "./components/messages/MessageInput";
import TitleBar from "./components/layout/TitleBar";
import { AuthProvider, useAuthState } from "./lib/state/Auth"; 
import { UserProvider, useUserState } from "./lib/state/Users";
import { ServerProvider, useServerState } from "./lib/state/Servers";
import { ChannelProvider, useChannelState } from "./lib/state/Channels";
import { MemberProvider, useMemberState } from "./lib/state/Members";
import { MessageProvider } from "./lib/state/Messages";
import { initializeClient } from "./lib/client/init";
import { PopoutProvider } from "./lib/state/Popouts";

function AppInner() {
  const { user, setUser, token, setToken } = useAuthState();
  const [loading, setLoading] = useState(true);
  const serverState = useServerState();
  const channelState = useChannelState();
  const memberState = useMemberState();
  const userState = useUserState();

  useEffect(() => {
    const fetchMe = async () => {
      const cached = localStorage.getItem("token");
      if (!cached) {
        setLoading(false);
        return;
      }
      setToken(cached);
      try {
        const me = await api("/users/@me", { headers: { Authorization: `Bearer ${cached}` } });
        setUser(me);
        userState.addUser(me);
      } catch (e) {
        localStorage.removeItem("token");
        setToken(null);
      }
      setLoading(false);
    };
    fetchMe();
  }, []);

  useEffect(() => {
    if (user && token) {
      initializeClient({
        token,
        addServers: serverState.addServers,
        setCurrentServer: serverState.setCurrentServer,
        addChannels: channelState.addChannels,
        setCurrentChannel: channelState.setCurrentChannel,
        addMembers: memberState.addMembers
      });
    }
  }, [user, token]);

  if (loading)
    return null;
  return (
    <div className="ven-colors relative">

      {user ? (
        <div className="app">
          <ServerList />
          <ChannelList />
          <div className="valign">
            <TitleBar />
            <div className="halign">
              <div className="valign">
                <div className="valign ovy-auto justify-end">
                  <MessageList />
                </div>
                <MessageInput />
              </div>
              <div className="member-list">
                <MemberList />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <LoginScreen />
      )}
    </div>
  );
}


export default function App() {
  return (
    <PopoutProvider>
      <AuthProvider>
        <UserProvider>
          <ServerProvider>
            <ChannelProvider>
              <MemberProvider>
                <MessageProvider>
                  <AppInner />
                </MessageProvider>
              </MemberProvider>
            </ChannelProvider>
          </ServerProvider>
        </UserProvider>
      </AuthProvider>
    </PopoutProvider>
  );
}