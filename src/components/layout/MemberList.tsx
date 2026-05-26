import { invoke } from '@tauri-apps/api/core';
import { useUserState } from "../../lib/state/Users";
import { usePopoutState } from "../../lib/state/Popouts";
import { useServerState } from "../../lib/state/Servers";
import { getAvatar, getDisplayName, getRoleColor } from "../../lib/utils/UserUtils";
import UserPopout from "./popouts/UserPopout";

export default function MemberList() {
  const serverState = useServerState();
  const userState = useUserState();
  
  const { open, close } = usePopoutState();

  return (
    <div>
      <div className="window-buttons">
        <button onClick={() => invoke("minimize")}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path fill="currentColor" d="M19 13H5v-2h14z" />
          </svg>
        </button>
        <button onClick={() => invoke("toggle_maximize")}> 
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path fill="currentColor" d="M4 4h16v16H4zm2 2v12h12V6z" />
          </svg>
        </button>
        <button className="close-btn" onClick={() => invoke("close")}> 
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path fill="currentColor" d="M13.46 12L19 17.54V19h-1.46L12 13.46L6.46 19H5v-1.46L10.54 12L5 6.46V5h1.46L12 10.54L17.54 5H19v1.46z" />
          </svg>
        </button>
      </div>
      <hr />
      {userState.members.sort((a, b) => getDisplayName(a.user, a).localeCompare(getDisplayName(b.user, b))).map(m => {
        const name = getDisplayName(m.user, m);
        const avatar = getAvatar(m.user, m);
        const roleColor = getRoleColor(serverState, m.user, m, serverState.currentServer === null);

        return m.serverId === serverState.currentServer?.id && (
          <div
            key={m.user.id}
            className="member int"
            onClick={e => {
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              
              const id = `user-profile-${rect.bottom}-${rect.left}`;
              open({
                id,
                element: (
                  <UserPopout
                    user={m.user}
                    member={m}
                    serverState={serverState}
                    onClose={() => close(id)}
                    position={{
                      top: rect.bottom + window.scrollY,
                      right: rect.left + window.scrollX
                    }}
                  />
                ),
                options: {}
              });
            }}
          >
            <img className="avatar uno int" style={{ pointerEvents: "none" }} src={avatar} alt="avatar" />
            <div
              key={m.user.id}
              className="author uno"
              style={{
                fontFamily: `"${m.nameFont}", "${m.user.nameFont}", Inter, Avenir, Helvetica, Arial, sans-serif`,
                color: roleColor,
                pointerEvents: "none"
              }}
            >
              {name}
            </div>
          </div>
        )
      })}
    </div>
  );
}
