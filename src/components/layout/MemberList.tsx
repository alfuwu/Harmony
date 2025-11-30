import { useMemberState } from "../../lib/state/Members";
import { usePopoutState } from "../../lib/state/Popouts";
import { useServerState } from "../../lib/state/Servers";
import { getAvatar, getDisplayName, getNameFont, getRoleColor } from "../../lib/utils/UserUtils";
import UserPopout from "./popouts/UserPopout";

export default function MemberList() {
  const serverState = useServerState();
  const memberState = useMemberState();
  
  const { open, close } = usePopoutState();

  return (
    <div>
      {memberState.members.map(m => {
        const name = getDisplayName(m.user, m);
        const avatar = getAvatar(m.user, m);
        const roleColor = getRoleColor(serverState, m.user, m, serverState.currentServer === null);
        const font = getNameFont(m.user, m);

        return m.serverId === serverState.currentServer?.id && (
          <div
            key={m.user.id}
            className="member int"
            onClick={e => {
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              open({
                id: "user-profile",
                element: (
                  <UserPopout
                    user={m.user}
                    member={m}
                    serverState={serverState}
                    onClose={() => close("user-profile")}
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
                fontFamily: font,
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
