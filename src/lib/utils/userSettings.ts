// enums
export enum Theme {
    Light,
    Dark,
    System
}

export enum AppIcon {
    Default,
    Classic,
    Modern,
    Minimal
}

export enum IconDisplayType {
    Circle,
    Rounded,
    Square
}

export enum UserIconDisplayType {
    Circle,
    Rounded,
    Square,
    UserPreference
}

export enum NameHoverBehavior {
    None,
    ShowHandle
}

export enum NameFontDisplayType {
    Everyone,
    Friends,
    FriendsOfFriends,
    NoOne
}

export enum RoleColor {
    ShowInNames,
    RoleDot,
    ShowAsDotAndInNames,
    DontShow
}

export enum AnimateContext {
    Always,
    WhenFocused,
    OnHover,
    OnClick,
    Never
}

export enum VoiceInputMode {
    VoiceActivity,
    PushToTalk
}

export enum SpoilerContext {
    Always,
    OnClick,
    OnHover,
    OnModeratedServers
}

export enum FriendRequestContext {
    Everyone,
    FriendsOfFriends,
    MutualsAndFriendsOfFriends,
    Mutuals,
    NoOne
}

export enum UserContext {
    Everyone,
    FriendsOfFriends,
    Friends,
    MutualsAndFriendsOfFriends,
    MutualsAndFriends,
    Mutuals,
    NoOne
}

// settings
export interface UserSettings {
    // userId: number;
    // user: null;

    // appearance
    theme: Theme;
    appIcon: AppIcon;
    appIconDisplayType: IconDisplayType;
    serverIconDisplayType: IconDisplayType;
    avatarDisplayType: UserIconDisplayType;
    selfAvatarDisplayType: IconDisplayType;
    nameHoverBehavior: NameHoverBehavior;
    nameFontDisplayType: NameFontDisplayType;
    compactMode: boolean;
    applySaturationToRoleColors: boolean;
    alwaysUnderlineLinks: boolean;
    roleColorSettings: RoleColor;
    alwaysExpandRoles: boolean;
    showRoleIcons: boolean;
    showOwnerCrown: boolean;

    // accessibility
    reduceMotion: boolean;
    highContrastMode: boolean;
    saturation: number;
    textSize: number;
    stickerAnimate: AnimateContext;
    emojiAnimate: AnimateContext;
    gifAnimate: AnimateContext;
    serverAnimate: AnimateContext;
    channelAnimate: AnimateContext;
    avatarAnimate: AnimateContext;
    glowRoleAnimate: AnimateContext;
    dyslexiaFont: boolean;
    tts: boolean;
    ttsSpeed: number;
    showSendMessageButton: boolean;

    // voice & video
    inputVolume: number;
    outputVolume: number;
    voiceInputMode: VoiceInputMode;
    inputSensitivity: number;
    echoCancellation: boolean;
    noiseSuppression: boolean;
    automaticGainControl: boolean;

    // messages
    showMessageTimestamps: boolean;
    showImagesFromLinks: boolean;
    showImagesUploadedToHarmony: boolean;
    showVideosFromLinks: boolean;
    showVideosUploadedToHarmony: boolean;
    hideLinkWhenPreviewing: boolean;
    showWebEmbeds: boolean;
    showReactions: boolean;
    showReactionCount: boolean;
    showUsersWhoReacted: boolean;
    convertEmoticonsToEmoji: boolean;
    showSpoilers: SpoilerContext;
    showSpoilersFromFriends: SpoilerContext;
    showMentionSuggestions: boolean;
    highlightMentions: boolean;
    previewMarkdown: boolean;
    sendMessagesWithCtrlEnter: boolean;

    // privacy & safety
    whoCanSendFriendRequests: FriendRequestContext;
    whoCanSendDms: UserContext;
    whoCanSeeEmail: UserContext;
    whoCanSeePhoneNumber: UserContext;
    whoCanSeeBio: UserContext;
    whoCanSeePronouns: UserContext;
    whoCanSeeAvatar: UserContext;
    whoCanSeeStatus: UserContext;
    whoCanSeePasswordHash: UserContext;

    // dev options
    developerMode: boolean;
}