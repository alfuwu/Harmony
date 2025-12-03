// @ts-expect-error
import { Theme, AppIcon, IconDisplayType, UserIconDisplayType, NameHoverBehavior, NameFontDisplayType, RoleColor, AnimateContext, VoiceInputMode, SpoilerContext, FriendRequestContext, UserContext, UserSettings } from "../../../lib/utils/userSettings";
import { useAuthState } from "../../../lib/state/Auth";
import { updateMe, updateProfile, updateSettings } from "../../../lib/api/userApi";
import { useEffect, useRef, useState } from "react";
import Search from "../../svgs/settings/Search";
import { getAvatar, getBanner, getDisplayName, getNameFont } from "../../../lib/utils/UserUtils";
import { Server } from "../../../lib/utils/types";

export default function UserSettingsModal({ open, onClose }: any) {
  const { token, user, setUser } = useAuthState();
  const { userSettings, setUserSettings } = useAuthState();
  const [currentTab, setCurrentTab] = useState("My Account");
  const [emailRevealed, setEmailRevealed] = useState(false);
  const [phoneRevealed, setPhoneRevealed] = useState(false);
  const [isMainProfile, setIsMainProfile] = useState(true);
  
  const [name, setName] = useState(user?.displayName);

  const initialRef = useRef({
    name: user?.displayName,
    settings: userSettings
  });

  // track if anything differs
  const [hasUnsaved, setHasUnsaved] = useState(false);

  // compare helper
  function computeDirty() {
    const nameChanged = name !== initialRef.current.name;
    /* currently, the user settings object gets populated AFTER this modal gets added to the app, so.. */
    const settingsChanged = JSON.stringify(userSettings) !== JSON.stringify(initialRef.current.settings);
    return nameChanged;
  }

  // recompute whenever dependent values change
  useEffect(() => {
    setHasUnsaved(computeDirty());
  }, [name, userSettings]);

  const tabs = {
    "USER SETTINGS": [
      "My Account",
      "Profiles",
      "Privacy & Safety"
    ],
    "APP SETTINGS": [
      "Appearance",
      "Accessibility",
      "Voice & Video",
      "Chat",
      "Notifications",
      "Language",
      "Advanced"
    ]
  }

  function handleChange(key: string, value: any) {
    setUserSettings({
      ...userSettings,
      [key]: value
    } as UserSettings);
  }

  async function update() {
    return updateSettings(
      userSettings!,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  async function updateCore() {
    return updateMe(
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  async function updateVanity(server: Server | undefined = undefined) {
    return updateProfile(
      { displayName: name! },
      server,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  async function logout() {
    onClose();
    setUser(null);
    localStorage.removeItem("token");
  }

  function getSettingsIconUrl(tab: string) {
    return tab.toLowerCase().replace(/\s/gm, "").replace(/&/gm, "and");
  }

  function setTab(tab: string) {
    if (hasUnsaved)
      return;
    setCurrentTab(tab);
  }

  function loadCurrentTab() {
    const displayName = getDisplayName(user);
    const avatar = getAvatar(user);
    const banner = getBanner(user);
    const font = getNameFont(user);

    switch(currentTab) {
      case "My Account":
        return (
          <div className="profile-display">
            <div
              className="banner"
              style={{
                // @ts-expect-error
                "--banner-color": "#" + (user?.bannerColor?.toString(16)?.padStart(6, "0") ?? "000000"),
                "--banner": banner ? `url('${banner}')` : `url('${avatar}')`
              }}
            />
            <div
              className="profile-name uno"
              style={{
                fontFamily: font
              }}
            >
              <img
                className="big-avatar uno"
                src={avatar}
                alt="avatar"
              />
              <div>
                {displayName}
                <div className="profile-id">ID: {user?.id}</div>
              </div>
              <button onClick={() => setTab("Profiles")}>
                Edit User Profile
              </button>
            </div>
            <div className="profile-details">
              <div className="profile-item">
                <div>
                  <div>Display Name</div>
                  <div>
                    {user?.displayName ? user.displayName : "You haven't added a display name yet."}
                  </div>
                </div>
                <button onClick={() => setTab("Profiles")}>Edit</button>
              </div>
              <div className="profile-item">
                <div>
                  <div>Username</div>
                  <div>@{user?.username}</div>
                </div>
                <button>Edit</button>
              </div>
              <div className="profile-item">
                <div>
                  <div>Email</div>
                  <div>
                    {user?.email ? emailRevealed ? user.email : "*".repeat(user.email.indexOf('@')) + user.email.substring(user.email.indexOf('@')) : "You haven't added an email yet."}
                    <a className="ml" onClick={() => setEmailRevealed(!emailRevealed)}>{emailRevealed ? "Hide" : "Reveal"}</a>
                  </div>
                </div>
                <button>{user?.email ? "Edit" : "Add"}</button>
              </div>
              <div className="profile-item">
                <div>
                  <div>Phone Number</div>
                  <div>
                    {user?.phoneNumber ? phoneRevealed ? user.phoneNumber : "*".repeat(user.phoneNumber.length) : "You haven't added a phone number yet."}
                    {user?.phoneNumber ?
                      <a className="ml" onClick={() => setPhoneRevealed(!phoneRevealed)}>{phoneRevealed ? "Hide" : "Reveal"}</a> :
                      null}
                  </div>
                </div>
                <button>{user?.phoneNumber ? "Edit" : "Add"}</button>
              </div>
            </div>
          </div>
        );
      case "Profiles":
        return (
          <div className="profiles">
            <div className="profile-nav halign">
              <div className={"uno int" + (isMainProfile ? " selected" : "")} onClick={() => setIsMainProfile(true)}>
                Main Profile
              </div>
              <div className={"uno int" + (!isMainProfile ? " selected" : "")} onClick={() => setIsMainProfile(false)}>
                Per-server Profiles
              </div>
            </div>
            <div className="profiles-content halign">
              {isMainProfile ? (
                <div className="profiles-item">
                  <div>Display Name</div>
                  <input value={name ?? ""} placeholder={user?.username} onChange={e => setName(e.target.value !== "" ? e.target.value : null)} />
                </div>
              ) : (
                <div>
                </div>
              )}
              <div className="preview">
                <div
                  className="banner"
                  style={{
                    // @ts-expect-error
                    "--banner-color": "#" + (user?.bannerColor?.toString(16)?.padStart(6, "0") ?? "000000"),
                    "--banner": banner ? `url('${banner}')` : ""
                  }}
                />
                  <img
                    className="big-avatar uno"
                    src={avatar}
                    alt="avatar"
                  />
                <div
                  className="profile-name uno"
                  style={{
                    fontFamily: font
                  }}
                >
                  <div>{name || displayName}</div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  }

  async function handleSave() {
    try {
      if (currentTab === "My Account") {
        await updateCore();
      } else if (currentTab === "Profiles") {
        await updateVanity();
        setUser({ ...user!, displayName: name });
      } else {
        await update();
      }

      // reset initial snapshot to new values
      initialRef.current = {
        name,
        settings: userSettings
      };

      // clear unsaved state
      setHasUnsaved(false);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className={"modal-backdrop" + (open ? " open" : "")} onClick={_ => onClose()}>
      <div className="modal-container settings" onClick={e => e.stopPropagation()}>
        <div className="navigation ovy-auto ovx-hidden">
          <div className="input-wrapper">
            <Search className="input-icon" />
            <input placeholder="Search" />
          </div>
          <hr />
          {Object.entries(tabs).map(([section, items]) => (
            <div key={section} className="nav-section">
              <div className="section-header ellipsis">{section}</div>
              {items.map(item => (
                <div
                  key={item}
                  className={
                    currentTab === item
                      ? "channel uno selected"
                      : "channel uno int"
                  }
                  onClick={() => setTab(item)}
                >
                  <div
                    className="nav-icon"
                    style={{
                      // @ts-expect-error
                      "--mask-url": `url('./settings/${getSettingsIconUrl(item)}.png')`
                    }}
                  />
                  {item}
                </div>
              ))}
              <hr />
            </div>
          ))}
          <div
            key="logout"
            className="channel uno int dangerous"
            onClick={() => logout()}
          >
            <div
              className="nav-icon"
              style={{
                // @ts-expect-error
                "--mask-url": `url('./settings/logout.png')`
              }}
            />
            Logout
          </div>
        </div>
        <div className="settings-content ovy-auto">
          <div className="settings-header ellipsis uno">
            <div
              className="nav-icon settings-header-icon uno"
              style={{
                // @ts-expect-error
                "--mask-url": `url('./settings/${getSettingsIconUrl(currentTab)}.png')`
              }}
            />
            {currentTab}
          </div>
          {loadCurrentTab()}
          {hasUnsaved && (
            <div className="unsaved-bar">
              <div className="unsaved-message">You have unsaved changes</div>
              <button
                className="save-btn"
                onClick={handleSave}
              >
                Save
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
