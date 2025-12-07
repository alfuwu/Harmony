// @ts-expect-error
import { Theme, AppIcon, IconDisplayType, UserIconDisplayType, NameHoverBehavior, NameFontDisplayType, RoleColor, AnimateContext, VoiceInputMode, SpoilerContext, FriendRequestContext, UserContext, UserSettings } from "../../../lib/utils/userSettings";
import { useAuthState } from "../../../lib/state/Auth";
import { updateMe, updateProfile, updateSettings, changeAvatar, changeBanner, deleteAvatar, deleteBanner, deleteFont, changeFont } from "../../../lib/api/userApi";
import { useEffect, useRef, useState } from "react";
import Search from "../../svgs/settings/Search";
import { getAvatar, getBanner, getDisplayName } from "../../../lib/utils/UserUtils";
import { Server } from "../../../lib/utils/types";
import { useUserState } from "../../../lib/state/Users";
import CroppingModal from "./CroppingModal";
import MessageInput from "../../messages/MessageInput";
import { useMessageState } from "../../../lib/state/Messages";
import { useMemberState } from "../../../lib/state/Members";
import { useServerState } from "../../../lib/state/Servers";

export default function UserSettingsModal({ open, onClose }: any) {
  const { token, user, setUser, userSettings, setUserSettings } = useAuthState();
  const { addUser } = useUserState();
  const { setMessages } = useMessageState();
  const { setMembers } = useMemberState();
  const { setServers } = useServerState();
  const [currentTab, setCurrentTab] = useState("My Account");
  const [emailRevealed, setEmailRevealed] = useState(false);
  const [phoneRevealed, setPhoneRevealed] = useState(false);
  const [isMainProfile, setIsMainProfile] = useState(true);
  
  const [name, setName] = useState(user?.displayName);
  const [pronouns, setPronouns] = useState(user?.pronouns);
  const [bio, setBio] = useState(user?.bio);

  const inputRef = useRef(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [fontFile, setFontFile] = useState<File | string | null>(null);
  const [fAviFile, setFAviFile] = useState<File | null>(null);
  const [fBaniFile, setFBaniFile] = useState<File | null>(null);
  const [croppingSrc, setCroppingSrc] = useState<string | null>(null);
  const [showAviCropper, setShowAviCropper] = useState(false);
  const [showBaniCropper, setShowBaniCropper] = useState(false);

  const initialRef = useRef({
    name: user?.displayName,
    pronouns: user?.pronouns,
    bio: user?.bio,
    nameFont: user?.nameFont,
    settings: userSettings
  });

  // track if anything differs
  const [hasUnsaved, setHasUnsaved] = useState(false);

  // compare helper
  function computeDirty() {
    // currently, the user settings object gets populated AFTER this modal gets added to the app, so..
    //const settingsChanged = JSON.stringify(userSettings) !== JSON.stringify(initialRef.current.settings);
    return name !== initialRef.current.name ||
      pronouns !== initialRef.current.pronouns ||
      bio !== initialRef.current.bio ||
      fAviFile !== null ||
      fBaniFile !== null ||
      fontFile !== null && (typeof fontFile !== "string" || fontFile !== initialRef.current.nameFont);
  }

  // recompute whenever dependent values change
  useEffect(() => {
    setHasUnsaved(computeDirty());
  }, [name, pronouns, bio, fAviFile, fBaniFile, fontFile, userSettings]);

  useEffect(() => {
    if (fontFile && typeof fontFile !== "string") {
      const blobUrl = URL.createObjectURL(fontFile);

      const style = document.createElement("style");
      style.textContent = `@font-face{font-family:"UploadedFont";src:url(${blobUrl});}`;
      document.head.appendChild(style);

      return () => {
        setTimeout(() => {
          document.head.removeChild(style);
          URL.revokeObjectURL(blobUrl);
        }, 50); // do with small timeout to prevent font flashing
      };
    }
  }, [fontFile]);

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
      ...userSettings!,
      [key]: value
    });
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
    const body = { displayName: name, pronouns, bio };
    if (typeof fontFile === "string")
      // @ts-expect-error
      body.nameFont = fontFile;
    return updateProfile(
      body,
      server,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  async function logout() {
    onClose();
    setUser(null);
    // reset cache
    setMessages([]);
    setMembers([]);
    setServers([]);
    localStorage.removeItem("token");
  }

  function getSettingsIconUrl(tab: string) {
    return tab.toLowerCase().replace(/\s/gm, "").replace(/&/gm, "and");
  }

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file)
      return;
    // reset value so that the same file can be picked again
    e.target.value = "";

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setCroppingSrc(reader.result as string);
      setShowAviCropper(true);
    };
    reader.readAsDataURL(file);
  }

  async function handleBannerPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file)
      return;
    e.target.value = "";

    setBannerFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setCroppingSrc(reader.result as string);
      setShowBaniCropper(true);
    };
    reader.readAsDataURL(file);
  }

  async function handleFontPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file)
      return;
    e.target.value = "";

    setFontFile(file);
  }

  async function handleAviCropComplete(croppedBlob: Blob) {
    const croppedFile = new File([croppedBlob], avatarFile?.name || "avatar.png", {
      type: croppedBlob.type,
    });

    setShowAviCropper(false);
    setCroppingSrc(null);
    setAvatarFile(null);
    setFAviFile(croppedFile);
  }

  async function handleBaniCropComplete(croppedBlob: Blob) {
    const croppedFile = new File([croppedBlob], bannerFile?.name || "banner.png", {
      type: croppedBlob.type,
    });

    setShowBaniCropper(false);
    setCroppingSrc(null);
    setBannerFile(null);
    setFBaniFile(croppedFile);
  }

  async function handleRemoveAvatar() {
    try {
      const res = await deleteAvatar({
        headers: { Authorization: `Bearer ${token}` },
      });

      const updated = { ...user!, avatar: res.avatar };
      setUser(updated);
      addUser(updated);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRemoveBanner() {
    try {
      const res = await deleteBanner({
        headers: { Authorization: `Bearer ${token}` },
      });

      const updated = { ...user!, banner: res.banner };
      setUser(updated);
      addUser(updated);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRemoveFont() {
    try {
      const res = await deleteFont({
        headers: { Authorization: `Bearer ${token}` },
      });

      const updated = { ...user!, nameFont: res.nameFont };
      setUser(updated);
      addUser(updated);
    } catch (err) {
      console.error(err);
    }
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

    switch(currentTab) {
      case "My Account":
        return (
          <div className="profile-display">
            <div
              className="banner"
              style={{
                // @ts-expect-error
                "--banner-color": "#" + (user?.bannerColor?.toString(16)?.padStart(6, "0") ?? "000000"),
                "--banner": banner ? `url(${banner})` : undefined
              }}
            />
            <div className="profile-name uno">
              <img
                className="big-avatar uno"
                src={avatar}
                alt="avatar"
              />
              <div>
                <div 
                  style={{
                    fontFamily: `"${user?.nameFont}", Inter, Avenir, Helvetica, Arial, sans-serif`
                  }}
                >
                  {displayName}
                </div>
                <div className="profile-id">ID: {user?.id}</div>
              </div>
              <button onClick={() => setTab("Profiles")}>
                Edit User Profile
              </button>
            </div>
            <div className="profile-details uno">
              <div className="profile-item">
                <div>
                  <div>Display Name</div>
                  <div
                    style={{
                      fontFamily: `"${user?.nameFont}", Inter, Avenir, Helvetica, Arial, sans-serif`
                    }}
                  >
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
            {!isMainProfile && (
              <>
                <div className="uno">Server</div>
                {/* do smthn to make a server dropdown thing */}
                <hr />
              </>
            )}
            <div className="profiles-content halign">
              <div className="profiles-item">
                <div className="uno">Display Name</div>
                <input value={name ?? ""} placeholder={user?.username} onChange={e => setName(e.target.value !== "" ? e.target.value : null)} />
                <hr />
                <div className="uno">Pronouns</div>
                <input value={pronouns ?? ""} placeholder="Add your pronouns" onChange={e => setPronouns(e.target.value !== "" ? e.target.value : null)} />
                <hr />
                <div className="uno">Avatar</div>
                <div className="item-actions">
                  <button onClick={_ => document.getElementById("avatar-picker")?.click()}>
                    {user?.avatar ? "Change Avatar" : "Add Avatar"}
                    <input id="avatar-picker" type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarPick} />
                  </button>
                  <button className="dangerous" onClick={handleRemoveAvatar}>Remove Avatar</button>
                </div>
                <hr />
                <div className="uno">Banner</div>
                <div className="item-actions">
                  <button onClick={_ => document.getElementById("banner-picker")?.click()}>
                    {user?.banner ? "Change Banner" : "Add Banner"}
                    <input id="banner-picker" type="file" accept="image/*" style={{ display: "none" }} onChange={handleBannerPick} />
                  </button>
                  <button className="dangerous" onClick={handleRemoveBanner}>Remove Banner</button>
                  {/* add color picker here to change banner color */}
                </div>
                <hr />
                <div className="uno">Name Font</div>
                <div className="item-actions">
                  <button onClick={_ => document.getElementById("font-picker")?.click()}>
                    {user?.nameFont ? "Change Font" : "Add Font"}
                    <input id="font-picker" type="file" accept=".ttf,.otf,.woff,.woff2,.sfnt" style={{ display: "none" }} onChange={handleFontPick} />
                  </button>
                  <button className="dangerous" onClick={handleRemoveFont}>Remove Font</button>
                </div>
                <hr />
                <div className="uno">About Me</div>
                <div className="about-me">
                  <MessageInput isChannel={false} placeholderText="Write your bio" initialText={bio} setText={setBio} giveNull={true} ref={inputRef} />
                </div>
              </div>
              <div className="preview">
                <div
                  className="banner"
                  style={{
                    // @ts-expect-error
                    "--banner-color": "#" + (user?.bannerColor?.toString(16)?.padStart(6, "0") ?? "000000"),
                    "--banner": fBaniFile ? `url(${URL.createObjectURL(fBaniFile)})` : banner ? `url(${banner})` : ""
                  }}
                />
                  <img
                    className="big-avatar uno"
                    src={fAviFile ? URL.createObjectURL(fAviFile) : avatar}
                    alt="avatar"
                  />
                <div
                  className="profile-name uno"
                  style={{
                    fontFamily: `"UploadedFont", "${user?.nameFont}", Inter, Avenir, Helvetica, Arial, sans-serif`
                  }}
                >
                  <div>{name || user?.username}</div>
                </div>
              </div>
            </div>
          </div>
        );
      case "Privacy & Safety":
        return (
          <div>
            <div className="profiles-item">
              <div className="uno">Display Name</div>
              <input value={name ?? ""} placeholder={user?.username} onChange={e => setName(e.target.value !== "" ? e.target.value : null)} />
              <hr />
            </div>
          </div>
        )
    }
  }

  function handleRevert() {
    setName(initialRef.current.name);
    setPronouns(initialRef.current.pronouns);
    setBio(initialRef.current.bio);
    // @ts-expect-error magic ref thing
    inputRef.current?.setText(initialRef.current.bio);
    setUserSettings(initialRef.current.settings);

    setFAviFile(null);
    setFBaniFile(null);
    setFontFile(null);
    setAvatarFile(null);
    setBannerFile(null);
  }

  async function handleSave() {
    try {
      let u = { ...user! };
      if (currentTab === "My Account") {
        await updateCore();
      } else if (currentTab === "Profiles") {
        await updateVanity();
        u = { ...u, displayName: name, pronouns, bio };
      } else {
        await update();
      }

      try {
        if (fAviFile !== null) {
          const res = await changeAvatar(fAviFile, {
            headers: { Authorization: `Bearer ${token}` },
          });

          u.avatar = res.avatar;
          setFAviFile(null);
        }
        if (fBaniFile !== null) {
          const res = await changeBanner(fBaniFile, {
            headers: { Authorization: `Bearer ${token}` },
          });

          u.banner = res.banner;
          setFBaniFile(null);
        }
        if (fontFile !== null) {
          if (fontFile instanceof File) {
            const res = await changeFont(fontFile, {
              headers: { Authorization: `Bearer ${token}` },
            });

            u.nameFont = res.nameFont;
          } else {
            u.nameFont = fontFile;
          }
          setFontFile(null);
        }
      } catch (err) {
        console.error(err);
      }
      if (u != user) { // send react update stuff
        setUser(u);
        addUser(u);
      }

      // reset initial snapshot to new values
      initialRef.current = {
        name,
        pronouns,
        bio,
        nameFont: u.nameFont,
        settings: userSettings
      };

      // clear unsaved state
      setHasUnsaved(false);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <>
      <div className={"modal-backdrop" + (open ? " open" : "")} onMouseDown={_ => !hasUnsaved && onClose()}>
        <div className="modal-container settings" onMouseDown={e => e.stopPropagation()}>
          <div className="navigation ovy-auto ovx-hidden">
            <div className="input-wrapper">
              <Search className="input-icon" />
              <input placeholder="Search" />
            </div>
            <hr />
            {Object.entries(tabs).map(([section, items]) => (
              <div key={section} className="nav-section">
                <div className="section-header uno ellipsis">{section}</div>
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
                        "--mask-url": `url(./settings/${getSettingsIconUrl(item)}.png)`
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
                  "--mask-url": `url(./settings/logout.png)`
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
                  "--mask-url": `url(./settings/${getSettingsIconUrl(currentTab)}.png)`
                }}
              />
              {currentTab}
            </div>
            {loadCurrentTab()}
            {hasUnsaved && (
              <div className="unsaved-bar">
                <div className="uno">You have unsaved changes</div>
                <div>
                  <button onClick={handleRevert}>Revert</button>
                  <button className="save-btn" onClick={handleSave}>Save</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {showAviCropper && (
        <CroppingModal
          src={croppingSrc!}
          onCancel={() => setShowAviCropper(false)}
          onComplete={handleAviCropComplete}
          headerText="Adjust Your Avatar"
        />
      )}
      {showBaniCropper && (
        <CroppingModal
          src={croppingSrc!}
          onCancel={() => setShowBaniCropper(false)}
          onComplete={handleBaniCropComplete}
          headerText="Adjust Your Banner"
          shape="rect"
          rectAspect={2}
        />
      )}
    </>
  );
}
