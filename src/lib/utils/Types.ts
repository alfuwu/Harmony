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
  id: number;
  channelId: number;
  authorId: number;
  mentionsEveryone?: boolean | null;
  mentions?: number[] | null;
  mentionRoles?: number[] | null;
  reactions?: Reaction[] | null;
  content: string;
  previousContent?: string[] | null;
  references?: number[] | null;
  attachments?: Attachment[] | null;
  timestamp: string;
  editedTimestamp?: string | null;
  isPinned: boolean;
  sending?: boolean;
  nonce?: number;
}

/// users
export interface User {
  id: number;
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
  flags: number;
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

export enum OnlineStatus {
  Online = 0,
  Idle = 1,
  Focusing = 2,
  DND = 3,
  Offline = 4
}

export interface Member {
  userId: number;
  user?: User;
  serverId: number;
  nickname?: string | null;
  bio?: string | null;
  pronouns?: string | null;
  avatar?: string | null;
  banner?: string | null;
  nameFont?: string | null;
  joinedAt: string;
  roles: number[];
  totalXp?: number | null;
  level?: number | null;
}

export interface QuotebookEntry {
  id: number;
  userId: number;
  messageId: number;
  channelId: number;
  note?: string | null;
  savedAt: string;
}

export interface Review {
  authorId: number;
  subjectId: number;
  content: string;
  createdAt: string;
  editedAt?: string | null;
}

export interface Presence {
  userId: number;
  onlineStatus: OnlineStatus;
  statusText?: string | null;
  showStatusWhileOffline?: boolean;
}

export interface VoiceState {
  userId: number;
  channelId?: number;
  serverId?: number;
  muted?: boolean;
  deafeaned?: boolean;
  selfMuted?: boolean;
  selfDeafeaned?: boolean;
  streaming?: boolean;
  cameraOn?: boolean;
}

/// roles
export interface Role {
  id: number;
  serverId: number;
  name: string;
  description?: string | null;
  icon?: string | null;
  permissions: number;
  position: number;
  displaysSeparately: boolean;
  flags: number;
  color?: number | null;
  colors?: number[] | null;
  displayType: RoleDisplayType;
  visibleTo?: number[] | null;
  categoryId?: number | null;
}

export interface FullRole extends Role {
  linkedRoles?: number[] | null;
  mutuallyExclusiveRoles?: number[] | null;
  prerequisites?: RolePrerequisite[] | null;
  permissionPriority: number;
  grantableRoles?: number[] | null;
  canPing?: number[] | null;
}

export enum RoleDisplayType {
  Normal = 0,
  Gradient = 1,
  Glow = 2,
  GradientGlow = 3
}

export interface RolePrerequisite {
  type: PrequisiteType;
  requiredRoleId?: number;
  minAccountAge?: string;
  minServerDuration?: string;
  minMessageCount?: number;
  autoGrant: boolean;
  autoRevoke: boolean;
}

export enum PrequisiteType {
  RoleHeld = 0,
  AccountAge = 1,
  MembershipDuration = 2,
  MessageCount = 3
}

/// channels
export interface AbstractChannel {
  id: number;
  type: ChannelType;
  lastMessage?: number | null;
  name?: string | null;
  description?: string | null;
  serverId?: number;
  parentId?: number;
  icon?: string | null;
  position?: number;
  slowmode?: number;
  createdAt?: string;
}

export interface Channel extends AbstractChannel {
  serverId: number;
  parentId: number;
  name: string;
  description?: string | null;
  icon?: string | null;
  position: number;
  slowmode: number;
  createdAt: string;
}

export interface DmChannel extends AbstractChannel {
  members: number[];
  isDeleted: boolean;
}

export interface GroupDmChannel extends AbstractChannel {
  ownerId: number;
  name?: string | null;
  description?: string | null;
  icon?: string | null;
  inviteUrls?: string[] | null;
  members: number[];
  createdAt: string;
}

export interface Thread extends Channel {
  ownerId: number;
  members: number[];
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
  id: number;
  ownerId: number;
  name: string;
  description?: string | null;
  icon?: string | null;
  banner?: string | null;
  inviteBanner?: string | null;
  tags?: string[] | null;
  inviteUrls?: string[] | null;
  roles: Role[];
  emojis: Emoji[];
  createdAt: string;
  loaded?: boolean;
}

/// small stuff
export interface Typing {
  channelId: number;
  userId: number;
}

export interface Reaction {
  reactors: number[];
  emoji: Emoji;
}

export interface Emoji {
  id?: number | null;
  animated?: boolean;
  name: string;
}

export interface RelationshipEntry {
  userId: number;
  type: RelationshipType;
  isIncoming?: boolean | null;
}