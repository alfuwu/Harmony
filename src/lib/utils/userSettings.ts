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

export enum EmojiStyle {
    Twemoji,
    System
}

export enum Language {
  // Germanic Languages
  AmericanEnglish = 0,
  BritishEnglish = 1,
  German = 2,
  Dutch = 3,
  Swedish = 4,
  Norwegian = 5,
  Danish = 6,

  // Romance Languages
  Spanish = 7,
  French = 8,
  Italian = 9,
  Portuguese = 10,
  Romanian = 11,
  Latin = 12,

  // Slavic & Eastern European Languages
  Russian = 13,
  Polish = 14,
  Latvian = 15,
  Ukrainian = 16,
  Czech = 17,
  Hungarian = 18,
  Greek = 19,
  Turkish = 20,

  // Asian Languages
  Chinese = 21,
  Japanese = 22,
  Korean = 23,
  Vietnamese = 24,
  Thai = 25,
  Hindi = 26,
  Bengali = 27,
  Indonesian = 28,
  Malay = 29,
  Tagalog = 30,

  // Middle Eastern & African Languages
  Arabic = 31,
  Persian = 32,
  Hebrew = 33,
  Swahili = 34,
  Afrikaans = 35,
  
  // Hyleusian Languages
  Miulyn = 36,
  Angelic = 37,
  Jeienese = 38,
  Joculenese = 39,
  VorKhan = 40,
  Wia = 41,
  
  // Silly
  PirateSpeak = 42,
  LeetSpeak = 43,
  PigLatin = 44,
  Klingon = 45,
  Elvish = 46,
  Lolcat = 47,
  Shakespearean = 48,
  YodaSpeak = 49,
  Esperanto = 50,
  UwU = 51
}

// settings
export interface UserSettings {
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
    showLineNumbers: boolean;
    emojiStyle: EmojiStyle;

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
    autoInsertSpaceAfterAutocomplete: boolean;

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
    showReadReceipts: boolean;

    // language
    language: Language;

    // dev options
    developerMode: boolean;
}