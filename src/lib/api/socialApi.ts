import { QuotebookEntry } from "../utils/types";
import { api } from "./http";

export async function getUserNote(subjectId: number, options: RequestInit = {}): Promise<{ content: string; authorId: number; subjectId: number } | null> {
  try {
    return await api(`/users/${subjectId}/note`, { ...options, method: "GET" });
  } catch {
    return null;
  }
}

export async function setUserNote(subjectId: number, content: string, options: RequestInit = {}): Promise<void> {
  await api(`/users/${subjectId}/note`, {
    ...options,
    method: "PUT",
    body: JSON.stringify({ content })
  });
}

export async function deleteUserNote(subjectId: number, options: RequestInit = {}): Promise<void> {
  await api(`/users/${subjectId}/note`, { ...options, method: "DELETE" });
}

export interface Nickname {
  assignerId: number;
  subjectId: number;
  nickname: string;
  setAt: string;
}

export async function getAllNicknames(options: RequestInit = {}): Promise<Nickname[]> {
  return api(`/users/@me/nicknames`, { ...options, method: "GET" });
}

export async function setNickname(subjectId: number, nickname: string, options: RequestInit = {}): Promise<void> {
  await api(`/users/${subjectId}/nickname`, {
    ...options,
    method: "PUT",
    body: JSON.stringify({ subjectId, nickname })
  });
}

export async function deleteNickname(subjectId: number, options: RequestInit = {}): Promise<void> {
  await api(`/users/${subjectId}/nickname`, { ...options, method: "DELETE" });
}

export const BadgeType = {
  EarlyAdopter: 0,
  ActiveContributor: 1,
  BugReporter: 2,
  Staff: 3,
  Verified: 4,
  Supporter: 5,
} as const;

export const BadgeLabels: Record<number, string> = {
  0: "Early Adopter",
  1: "Active Contributor",
  2: "Bug Reporter",
  3: "Staff",
  4: "Verified",
  5: "Supporter",
};

export const BadgeIcons: Record<number, string> = {
  0: "⭐",
  1: "🔥",
  2: "🐛",
  3: "🛡️",
  4: "✅",
  5: "💎",
};

export interface Badge {
  userId: number;
  type: number;
  isVisible: boolean;
  displayOrder: number;
  earnedAt: string;
}

export async function getUserBadges(userId: number, options: RequestInit = {}): Promise<Badge[]> {
  return api(`/users/${userId}/badges`, { ...options, method: "GET" });
}

export async function updateBadgeVisibility(type: number, isVisible: boolean, displayOrder?: number, options: RequestInit = {}): Promise<void> {
  await api(`/users/@me/badges`, {
    ...options,
    method: "PATCH",
    body: JSON.stringify({ type, isVisible, displayOrder })
  });
}

export async function getQuotebook(page: number = 0, options: RequestInit = {}): Promise<QuotebookEntry[]> {
  return api(`/users/@me/quotebook?page=${page}&pageSize=50`, { ...options, method: "GET" });
}

export async function addToQuotebook(messageId: number, channelId: number, note?: string, options: RequestInit = {}): Promise<QuotebookEntry> {
  return api(`/users/@me/quotebook`, {
    ...options,
    method: "POST",
    body: JSON.stringify({ messageId, channelId, note })
  });
}

export async function removeFromQuotebook(entryId: number, options: RequestInit = {}): Promise<void> {
  await api(`/users/@me/quotebook/${entryId}`, { ...options, method: "DELETE" });
}

export async function sendFriendRequest(targetId: number, options: RequestInit = {}): Promise<void> {
  await api(`/users/add-friend`, {
    ...options,
    method: "POST",
    body: JSON.stringify(targetId)
  });
}

export async function acceptFriendRequest(sourceId: number, options: RequestInit = {}): Promise<void> {
  await api(`/users/accept-friend`, {
    ...options,
    method: "POST",
    body: JSON.stringify(sourceId)
  });
}

export async function getRelationships(options: RequestInit = {}) {
  return api(`/users/friends`, { ...options, method: "GET" });
}
