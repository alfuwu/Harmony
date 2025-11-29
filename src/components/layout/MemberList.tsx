import { useMemberState } from "../../lib/state/Members";

export default function MemberList() {
  const { members } = useMemberState();
  return (
    <div>
      {members.map(m => (
        <div
          key={m.user.id}
          className="member-list"
          style={{ padding: 8, cursor: 'pointer' }}
          onClick={() => null}
        >
          {m.nickname || m.user.displayName || m.user.username}
        </div>
      ))}
    </div>
  );
}
