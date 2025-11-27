import { memberState } from "../../lib/state/members";

export default function MemberList() {
  return (
    <div>
      {memberState.members().map(m => (
        <div
          class="member-list"
          style="padding: 8px; cursor: pointer;"
          onClick={() => null}
        >
          {m.nickname ?? m.user.displayName ?? m.user.username}
        </div>
      ))}
    </div>
  );
}
