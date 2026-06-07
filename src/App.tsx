import "./App.css";
import 'katex/dist/katex.min.css';
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
import { initializeClient, syncSignalRRefs } from "./lib/client/init";
import { PopoutProvider } from "./lib/state/Popouts";
import { getAvatar } from "./lib/utils/UserUtils";
import UserSettingsModal from "./components/layout/modals/UserSettingsModal";
import TypingIndicator from "./components/messages/TypingIndicator";
import { Theme, UserSettings } from "./lib/utils/userSettings";

const IS_DEVELOPMENT = window.location.hostname === "localhost";
export const hostUrl = "http://localhost:5000";
export const rootRef = createRef<HTMLDivElement>();

window.addEventListener("keydown", function (e) {
  // disable CTRL + F
  if (e.keyCode === 114 || (e.ctrlKey && e.keyCode === 70))
    e.preventDefault();
});

function applySettings(settings: UserSettings | null) {
  const body = document.body;
  if (!settings)
    return;
 
  body.style.setProperty("--settings-text-scale", String(settings.textSize ?? 1));
  body.style.setProperty("--settings-saturation", String(settings.saturation ?? 1));
 
  body.classList.toggle("reduce-motion", !!settings.reduceMotion);
  body.classList.toggle("high-contrast", !!settings.highContrastMode);
  body.classList.toggle("dyslexia-font", !!settings.dyslexiaFont);
  body.classList.toggle("always-underline-links", !!settings.alwaysUnderlineLinks);
  body.classList.toggle("hide-reactions", !(settings.showReactions ?? true));
  body.classList.toggle("hide-reaction-count",!(settings.showReactionCount ?? true));
  body.classList.toggle("no-mention-highlight", !(settings.highlightMentions ?? true));
 
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isLight =
    settings.theme === Theme.Light ||
    (settings.theme === Theme.System && !systemDark);
  body.classList.toggle("theme-light", isLight);
 
  const shapeNames = ["circle", "rounded", "square"];
  body.setAttribute("data-avatar-shape", shapeNames[settings.avatarDisplayType ?? 0] ?? "circle");
  body.setAttribute("data-server-icon-shape", shapeNames[settings.serverIconDisplayType ?? 1] ?? "rounded");
 
  const spoilerNames = ["showspoilersalways", "showspoilersonclick", "showspoilersonhover", "showspoilersmoderated"];
  spoilerNames.forEach(c => body.classList.remove(c));
  body.classList.add(spoilerNames[settings.showSpoilers ?? 1] ?? "showspoilersonclick");
}


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
  const [quotebookOpen, setQuotebookOpen] = useState(false);
  const [showDms, setShowDms] = useState(false);

  syncSignalRRefs(messageState, channelState, serverState, userState);

  useEffect(() => {
    applySettings(userSettings);
  }, [userSettings]);
 
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applySettings(userSettings);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [userSettings]);
 
  useEffect(() => {
    document.documentElement.style.fontSize =
      `${(userSettings?.textSize ?? 1) * 16}px`;
  }, [userSettings?.textSize]);

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
      window.userSettings = userSettings;
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
 
  const inDmView = showDms && !serverState.currentServer;
 
  function handleDmClick() {
    setShowDms(true);
    serverState.setCurrentServer(null);
    channelState.setCurrentChannel(null);
  }
  
  return (
    <div className="ven-colors relative" ref={rootRef}>
      <UserSettingsModal open={modalOpen} onClose={() => setModalOpen(false)} />

      {user ? (
        <div className="app">    
          <div className="valign-ungreedy">
            <div className="halign">
              <ServerList onDmClick={handleDmClick} showDms={showDms} />
              {inDmView ? null : <ChannelList />}
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
            <div className="halign">
              <div className="valign">
                <TitleBar />
                <div className="valign ovy-auto justify-end">
                  <MessageList />
                </div>
                <TypingIndicator
                  channelId={channelState.currentChannel?.id}
                  currentUserId={user.id}
                />
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