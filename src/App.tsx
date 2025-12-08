import "./App.css";
import { createRef, useEffect, useState } from "react";
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
import { MessageProvider, useMessageState } from "./lib/state/Messages";
import { initializeClient } from "./lib/client/init";
import { PopoutProvider, /*usePopoutState*/ } from "./lib/state/Popouts";
import { getAvatar } from "./lib/utils/UserUtils";
//import UserPopout from "./components/layout/popouts/UserPopout";
import UserSettingsModal from "./components/layout/modals/UserSettingsModal";

const IS_DEVELOPMENT = window.location.hostname === "localhost";
export const hostUrl = "https://localhost:7217";
export const rootRef = createRef<HTMLDivElement>();

window.addEventListener("keydown", function (e) {
  // disable CTRL + F
  if (e.keyCode === 114 || (e.ctrlKey && e.keyCode === 70)) {
    e.preventDefault();
  }
});

function AppInner() {
  const authState = useAuthState();
  const { user, setUser, token, setToken, userSettings, setUserSettings } = authState;
  const [loading, setLoading] = useState(true);
  const serverState = useServerState();
  const channelState = useChannelState();
  const messageState = useMessageState();
  const userState = useUserState();
  //const { open, close } = usePopoutState();
  const [modalOpen, setModalOpen] = useState(false);

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

  if (IS_DEVELOPMENT) {
    useEffect(() => {
      // @ts-expect-error
      window.servers = serverState.servers;
      // @ts-expect-error
      window.channels = channelState.channels;
      // @ts-expect-error
      window.members = userState.members;
      // @ts-expect-error
      window.messages = messageState.messages;
      // @ts-expect-error
      window.users = userState.users;
      // @ts-expect-error
      window.settings = userSettings;
    }, [serverState.servers, channelState.channels, userState.members, messageState.messages, userState.users, userSettings]);
  }

  useEffect(() => {
    if (user && token) {
      initializeClient({
        authState,
        serverState,
        channelState,
        messageState,
        userState,
        setUserSettings
      });
    }
  }, [user, token]);

  if (loading)
    return null;
  
  const avatar = getAvatar(user);
  
  return (
    <div className="ven-colors relative" ref={rootRef}>
      <UserSettingsModal className="modal" open={modalOpen} onClose={() => setModalOpen(false)} />

      {user ? (
        <div className="app">    
          <div className="valign-ungreedy">
            <div className="halign">
              <ServerList />
              <ChannelList />
            </div>
            <div className="user-panel">
              <img
                className="avatar uno int"
                src={avatar}
                alt="avatar"
                onClick={_e => {
                  setModalOpen(true);
                  /*const rect = e.currentTarget.getBoundingClientRect();
                  open({
                    id: "user-profile",
                    element: (
                      <UserPopout
                        user={user}
                        member={undefined}
                        serverState={serverState}
                        onClose={() => close("user-profile")}
                        position={{
                          top: rect.bottom + window.scrollY,
                          left: rect.right + window.scrollX
                        }}
                      />
                    ),
                    options: {}
                  });*/
                }}
              />
            </div>
          </div>
          <div className="valign">
            <TitleBar />
            <div className="halign">
              <div className="valign">
                <div className="valign ovy-auto justify-end">
                  <MessageList />
                </div>
                <div className="real-wrap">
                  <div className="msg-wrap">
                    <MessageInput />
                  </div>
                </div>
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
              <MessageProvider>
                <AppInner />
              </MessageProvider>
            </ChannelProvider>
          </ServerProvider>
        </UserProvider>
      </AuthProvider>
    </PopoutProvider>
  );
}