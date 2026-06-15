import { UserSettings } from "../../../../lib/utils/UserSettings";
import { SettingToggle, SettingSlider } from "./SettingPrimitives";

interface Props {
  settings: UserSettings;
  onChange: (patch: Partial<UserSettings>) => void;
}

export default function NotificationsTab({ settings, onChange }: Props) {
  const muted = settings.muteAllNotifications;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {muted && (
        <div
          style={{
            marginBottom: 20,
            padding: "10px 14px",
            background: "color-mix(in hsl, var(--yellow-1), transparent 80%)",
            border: "1px solid color-mix(in hsl, var(--yellow-1), transparent 55%)",
            borderRadius: 10,
            fontSize: 13,
            color: "var(--text-3)",
            lineHeight: 1.5
          }}
        >
          All notifications are muted. Toggle off <strong>Mute All</strong> below to receive alerts again.
        </div>
      )}

      <SectionLabel>Global</SectionLabel>

      <SettingToggle
        label="Mute All Notifications"
        description="Silences every notification sound and popup from this app."
        value={settings.muteAllNotifications}
        onChange={v => onChange({ muteAllNotifications: v })}
      />

      <Divider />
      <SectionLabel>Delivery</SectionLabel>

      <SettingToggle
        label="Desktop Notifications"
        description="Show system popups when the app is backgrounded or minimized."
        value={settings.enableDesktopNotifications}
        disabled={muted}
        onChange={v => onChange({ enableDesktopNotifications: v })}
      />
      <SettingToggle
        label="Notification Sounds"
        value={settings.enableSoundNotifications}
        disabled={muted}
        onChange={v => onChange({ enableSoundNotifications: v })}
      />
      <SettingSlider
        label="Notification Volume"
        value={settings.notificationVolume}
        min={0}
        max={100}
        disabled={muted || !settings.enableSoundNotifications}
        onChange={v => onChange({ notificationVolume: v })}
        format={v => `${v}%`}
      />
      <SettingToggle
        label="Only Notify When Unfocused"
        description="Suppress notifications while the app window is in front."
        value={settings.notifyWhenUnfocused}
        disabled={muted}
        onChange={v => onChange({ notifyWhenUnfocused: v })}
      />
      <SettingToggle
        label="Show Message Preview"
        description="Display message content in desktop notification banners."
        value={settings.showNotificationPreview}
        disabled={muted || !settings.enableDesktopNotifications}
        onChange={v => onChange({ showNotificationPreview: v })}
      />

      <Divider />
      <SectionLabel>Activity</SectionLabel>

      <SettingToggle
        label="Mentions"
        description="Notify when you are @mentioned in a server or DM."
        value={settings.notifyOnMention}
        disabled={muted}
        onChange={v => onChange({ notifyOnMention: v })}
      />
      <SettingToggle
        label="Direct Messages"
        description="Notify when receiving a DM from any user."
        value={settings.notifyOnDirectMessage}
        disabled={muted}
        onChange={v => onChange({ notifyOnDirectMessage: v })}
      />
      <SettingToggle
        label="Friend Requests"
        description="Notify when someone sends you a friend request."
        value={settings.notifyOnFriendRequest}
        disabled={muted}
        onChange={v => onChange({ notifyOnFriendRequest: v })}
      />
      <SettingToggle
        label="Replies"
        description="Notify when someone replies directly to your message."
        value={settings.notifyOnReply}
        disabled={muted}
        onChange={v => onChange({ notifyOnReply: v })}
      />
      <SettingToggle
        label="Reactions"
        description="Notify when someone reacts to your message."
        value={settings.notifyOnReaction}
        disabled={muted}
        onChange={v => onChange({ notifyOnReaction: v })}
      />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--text-5)",
        marginBottom: 8,
        marginTop: 4
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--border)", margin: "16px 0 12px" }} />;
}
