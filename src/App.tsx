import "./App.css";
import 'katex/dist/katex.min.css';
import { createRef, useEffect, useRef, useState } from "react";
import { api } from "./lib/api/Http";
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
import { initializeClient, syncSignalRRefs } from "./lib/client/Init";
import { PopoutProvider } from "./lib/state/Popouts";
import { getAvatar } from "./lib/utils/UserUtils";
import UserSettingsModal from "./components/layout/modals/UserSettingsModal";
import TypingIndicator from "./components/messages/TypingIndicator";
import { Theme, UserSettings } from "./lib/utils/UserSettings";
import PendingRepliesBar from "./components/messages/PendingRepliesBar";
import DmList from "./components/layout/DmList";
import { t, useLocale, i18n } from "./lib/i18n/Index";
import { localeFromLanguage } from "./lib/i18n/LocaleMap";
import { OnlineStatus } from "./lib/utils/Types";
import { connection } from "./lib/api/SignalrClient";

const IDLE_MS = 5 * 60 * 1000;
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
  useLocale();
  const authState = useAuthState();
  const { user, setUser, token, setToken, userSettings, setUserSettings } = authState;
  const [loading, setLoading] = useState(true);
  const serverState = useServerState();
  const channelState = useChannelState();
  const messageState = useMessageState();
  const userState = useUserState();
  //const { open, close } = usePopoutState();

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIdleRef = useRef(false);
  const [modalOpen, setModalOpen] = useState(false);
  //const [serverModalOpen, setServerModalOpen] = useState(false);
  //const [quotebookOpen, setQuotebookOpen] = useState(false);
  const [showDms, setShowDms] = useState(false);

  syncSignalRRefs(messageState, channelState, serverState, userState);

  const userStateRef = useRef(userState);
  useEffect(() => {
    userStateRef.current = userState;
  });

  useEffect(() => {
    applySettings(userSettings);
  }, [userSettings]);

  useEffect(() => {
    i18n.loadLocale(localeFromLanguage(userSettings?.language));
  }, [userSettings?.language]);
 
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
    if (!user || !token)
      return;

    function goIdle() {
      if (isIdleRef.current)
        return;
      const live = userStateRef.current.get(user!.id);
      if (live?.onlineStatus !== OnlineStatus.Online)
        return;

      isIdleRef.current = true;
      connection?.invoke("SetStatus", OnlineStatus.Idle).catch(e => console.log(e));
      if (live)
        userStateRef.current.addUser({ ...live, onlineStatus: OnlineStatus.Idle });
    }

    function onActivity() {
      if (idleTimerRef.current)
        clearTimeout(idleTimerRef.current);

      if (isIdleRef.current) {
        isIdleRef.current = false;
        connection?.invoke("SetStatus", OnlineStatus.Online).catch(() => {});
        const live = userStateRef.current.get(user!.id);
        if (live)
          userStateRef.current.addUser({ ...live, onlineStatus: OnlineStatus.Online });
      }

      idleTimerRef.current = setTimeout(goIdle, IDLE_MS);
    }

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    onActivity();

    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity));
      if (idleTimerRef.current)
        clearTimeout(idleTimerRef.current);
    };
  }, [user?.id, user?.status, token]);

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
      const w = window as any;
      w.servers = serverState.servers;
      w.channels = channelState.channels;
      w.members = userState.members;
      w.messages = messageState.messages;
      w.users = userState.users;
      w.userSettings = userSettings;
      w.i18n = i18n;
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
              {inDmView ? <DmList /> : <ChannelList />}
            </div>
            <div className="user-panel">
              <img
                className="avatar uno int"
                src={avatar}
                alt={t("alt.avatar")}
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
                <PendingRepliesBar />
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