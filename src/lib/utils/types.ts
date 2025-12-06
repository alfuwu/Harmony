/// messages
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
  timestamp: string;
  editedTimestamp?: string | null;
  isDeleted: boolean;
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
  passwordHash: string;
  status?: string;
  bio?: string | null;
  pronouns?: string | null;
  avatar?: string | null;
  banner?: string | null;
  bannerColor: number;
  nameFont?: string | null;
  joinedAt: string;
  lastSeen: string;
  isDeleted: boolean;
  flags: number;
  dmColor?: number | null;
  dmColors?: number[] | null;
  dmNameDisplayType?: RoleDisplayType | null;
}

export interface Member {
  user: User;
  serverId: number;
  nickname?: string | null;
  bio?: string | null;
  pronouns?: string | null;
  avatar?: string | null;
  banner?: string | null;
  nameFont?: string | null;
  joinedAt: string;
  roles: number[];
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
  flags: number;
  color?: number | null;
  colors?: number[] | null;
  displayType: RoleDisplayType;
  visibleTo?: number[] | null;
}

export interface FullRole extends Role {
  linkedRoles?: number[] | null;
  mutuallyExclusiveRoles?: number[] | null;
  prerequisites?: RolePrerequisite[] | null;
  priority: number;
  grantableRoles?: number[] | null;
  canPing?: number[] | null;
}

export enum RoleDisplayType {
  Normal = 0,
  Gradient = 1,
  Glow = 2,
  GradientGlow = 3
}

export interface RolePrerequisite {}

/// channels
export interface AbstractChannel {
  id: number;
  channelType: ChannelType;
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
  GroupDM = 10        // group direct message channel
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
  name: string;
}

export interface RelationshipEntry {
  userId: number;
  type: RelationshipType;
  isIncoming?: boolean | null;
}