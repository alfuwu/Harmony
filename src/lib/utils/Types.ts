import { FriendRequestContext, UserContext } from "./UserSettings";

/// messages
export interface Attachment {
  fileName: string;
  localUrl?: string | null;
  progress?: number;
  contentType: string;
  size: number;
  placeholderHash?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface Message {
  id: bigint;
  channelId: bigint;
  authorId: bigint;
  mentionsEveryone?: boolean | null;
  mentions?: bigint[] | null;
  mentionRoles?: bigint[] | null;
  reactions?: Reaction[] | null;
  content: string;
  previousContent?: string[] | null;
  references?: bigint[] | null;
  attachments?: Attachment[] | null;
  timestamp: string;
  editedTimestamp?: string | null;
  isPinned: boolean;
  sending?: boolean;
  nonce?: bigint;
}

/// users
export interface User {
  id: bigint;
  email?: string | null;
  emailVerified?: boolean | null;
  phoneNumber?: string | null;
  phoneNumberVerified?: boolean | null;
  displayName?: string | null;
  username: string;
  discriminator?: number | null; // 0 = Pomelo; 1-9999 = Discriminator
  passwordHash: string;
  status?: string | null;
  showStatusWhileOffline?: boolean;
  onlineStatus?: OnlineStatus;
  bio?: string | null;
  pronouns?: string | null;
  avatar?: string | null;
  banner?: string | null;
  bannerColor: number;
  nameFont?: string | null;
  joinedAt: string;
  lastSeen: string;
  flags: bigint;
  nick?: string;
  dmColor?: number | null;
  dmColors?: number[] | null;
  dmNameDisplayType?: RoleDisplayType | null;
  timeZone?: string | null;
  title?: string | null;
  titleIsSystem?: boolean | null;
  titleGrantedAt?: string | null;
  totalXp?: number | null;
  level?: number | null;

  // only populated for the self
  twoFactorEnabled?: boolean | null;
  whoCanSendFriendRequests?: FriendRequestContext | null;
  whoCanSendDms?: UserContext | null;
  whoCanAddToGcs?: UserContext | null;
  whoCanSeeEmail?: UserContext | null;
  whoCanSeePhoneNumber?: UserContext | null;
  whoCanSeeBio?: UserContext | null;
  whoCanSeePronouns?: UserContext | null;
  whoCanSeeAvatar?: UserContext | null;
  whoCanSeeBanner?: UserContext | null;
  whoCanSeeStatus?: UserContext | null;
  whoCanSeePasswordHash?: UserContext | null;
}

export interface LinkedAccount {
  provider: string;
  providerUserId: string;
  providerUsername?: string | null;
  providerDisplayName?: string | null;
  providerAvatarUrl?: string | null;
  isPublic?: boolean | null;
  linkedAt: string;
}

export enum OnlineStatus {
  Online = 0,
  Idle = 1,
  Focusing = 2,
  DND = 3,
  Offline = 4
}

export interface Member {
  userId: bigint;
  serverId: bigint;
  nickname?: string | null;
  bio?: string | null;
  pronouns?: string | null;
  avatar?: string | null;
  banner?: string | null;
  nameFont?: string | null;
  joinedAt: string;
  roles: bigint[];
  totalXp?: number | null;
  level?: number | null;
}

export interface QuotebookEntry {
  id: bigint;
  userId: bigint;
  messageId: bigint;
  channelId: bigint;
  note?: string | null;
  savedAt: string;
}

export interface Review {
  authorId: bigint;
  subjectId: bigint;
  content: string;
  createdAt: string;
  editedAt?: string | null;
}

export interface Presence {
  userId: bigint;
  onlineStatus: OnlineStatus;
  statusText?: string | null;
  showStatusWhileOffline?: boolean;
}

export interface VoiceState {
  userId: bigint;
  channelId?: bigint;
  serverId?: bigint;
  muted?: boolean;
  deafeaned?: boolean;
  selfMuted?: boolean;
  selfDeafeaned?: boolean;
  streaming?: boolean;
  cameraOn?: boolean;
}

/// roles
export interface RoleCategory {
  id: bigint;
  serverId: bigint;
  name: string;
  position: number;
}

export interface Role {
  id: bigint;
  serverId: bigint;
  name: string;
  description?: string | null;
  icon?: string | null;
  permissions: bigint;
  position: number;
  displaysSeparately: boolean;
  flags: bigint;
  color?: number | null;
  colors?: number[] | null;
  displayType: RoleDisplayType;
  visibleTo?: bigint[] | null;
  categoryId?: bigint | null;
}

export interface FullRole extends Role {
  linkedRoles?: bigint[] | null;
  mutuallyExclusiveRoles?: bigint[] | null;
  permissionPriority: bigint;
  grantableRoles?: bigint[] | null;
  canPing?: bigint[] | null;
}

export enum RoleDisplayType {
  Normal = 0,
  Gradient = 1,
  Glow = 2,
  GradientGlow = 3
}

/// channels
export interface AbstractChannel {
  id: bigint;
  type: ChannelType;
  lastMessage?: bigint | null;
  name?: string | null;
  description?: string | null;
  serverId?: bigint;
  parentId?: bigint;
  icon?: string | null;
  position?: number;
  slowmode?: number;
  createdAt?: string;
}

export interface Channel extends AbstractChannel {
  serverId: bigint;
  parentId: bigint;
  name: string;
  description?: string | null;
  icon?: string | null;
  position: number;
  slowmode: number;
  createdAt: string;
}

export interface DmCategory {
  id: bigint;
  userId: bigint;
  name: string;
  color?: string | null;
  position: number;
  channelIds: bigint[];
}

export interface DmChannel extends AbstractChannel {
  dmMembers: bigint[];
  isDeleted: boolean;
}

export interface GroupDmChannel extends AbstractChannel {
  ownerId: bigint;
  name?: string | null;
  description?: string | null;
  icon?: string | null;
  inviteUrls?: string[] | null;
  members: bigint[];
  createdAt: string;
}

export interface Thread extends Channel {
  ownerId: bigint;
  members: bigint[];
  archiveAfter: number;
  archived: boolean;
  private: boolean;
  locked: boolean;
}

export enum ChannelType {
  Category = 0,       // category channel, used for organizing other channels
  Text = 1,           // default text channel
  Voice = 2,          // default voice channel
  Announcement = 3,   // announcement channel
  Rules = 4,          // rules channel
  Thread = 5,         // thread, parented to some other channel
  Forum = 6,          // forum, no normal text stuff but allows creating threads and displays those as posts
  Calendar = 7,       // calendar channel, used for scheduling & showing events
  Document = 8,       // document channel, used for collaborative document editing
  DM = 9,             // direct message channel between two users
  GroupDM = 10,       // group direct message channel
  Canvas = 11,        // canvas channel, used for collaborative drawing
  Lounge = 12,        // lounge channel, used for voice channels with proximity voice chat based off your avatar's position in a 2d space
}

export enum RelationshipType {
  Self = 0,
  Friend = 1,
  Pending = 2,
  Regular = 3,
  Blocked = 4
}

/// server
export interface Server {
  id: bigint;
  ownerId: bigint;
  name: string;
  description?: string | null;
  icon?: string | null;
  banner?: string | null;
  inviteBanner?: string | null;
  tags?: string[] | null;
  inviteUrls?: string[] | null;
  roles: Role[];
  roleCategories: RoleCategory[];
  emojis: Emoji[];
  createdAt: string;
  loaded?: boolean;
}

/// small stuff
export interface Typing {
  channelId: bigint;
  userId: bigint;
}

export interface Reaction {
  reactors: bigint[];
  emoji: Emoji;
}

export interface Emoji {
  id?: bigint | null;
  animated?: boolean;
  name: string;
}

export interface RelationshipEntry {
  userId: bigint;
  type: RelationshipType;
  isIncoming?: boolean | null;
}