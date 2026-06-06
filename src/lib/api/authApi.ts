import { api } from "./http";

export async function login(username: string, password: string) {
  return api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

export async function registerUser(email: string, password: string, username: string) {
  return api("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, username })
  });
}

export interface UsernameAvailability {
  pomelo: boolean;
  discriminator: number;
}

export async function checkUsernameAvailability(username: string): Promise<UsernameAvailability> {
  return api(`/auth/username?u=${encodeURIComponent(username)}`);
}

// 2fa
export async function twoFactorBeginSetup(options: RequestInit = {}): Promise<{ secret: string; qrUri: string }> {
  return api("/2fa/setup", { ...options, method: "GET" });
}

export async function twoFactorConfirmSetup(
  code: string,
  options: RequestInit = {}
): Promise<{ recoveryCodes: string[] }> {
  return api("/2fa/setup/confirm", {
    ...options,
    method: "POST",
    body: JSON.stringify({ code })
  });
}

export async function twoFactorDisable(code: string, options: RequestInit = {}): Promise<void> {
  return api("/2fa/disable", {
    ...options,
    method: "POST",
    body: JSON.stringify({ code })
  });
}

export async function twoFactorLogin(challenge: string, code: string): Promise<{ token: string }> {
  return api("/2fa/login", {
    method: "POST",
    body: JSON.stringify({ challenge, code })
  });
}

export async function twoFactorLoginRecovery(
  challenge: string,
  recoveryCode: string
): Promise<{ token: string }> {
  return api("/2fa/login/recovery", {
    method: "POST",
    body: JSON.stringify({ challenge, recoveryCode })
  });
}

// email verification
export async function sendVerificationEmail(
  email?: string | null,
  options: RequestInit = {}
): Promise<void> {
  return api("/verification/email/send", {
    ...options,
    method: "POST",
    body: JSON.stringify(email ? { email } : {})
  });
}

// phone verification
export async function sendPhoneVerification(
  phoneNumber: string,
  options: RequestInit = {}
): Promise<void> {
  return api("/verification/phone/send", {
    ...options,
    method: "POST",
    body: JSON.stringify({ phoneNumber })
  });
}

export async function verifyPhone(
  phoneNumber: string,
  code: string,
  options: RequestInit = {}
): Promise<void> {
  return api("/verification/phone/verify", {
    ...options,
    method: "POST",
    body: JSON.stringify({ phoneNumber, code })
  });
}

export async function getVerificationStatus(options: RequestInit = {}): Promise<{ emailVerified: boolean; phoneVerified: boolean; twoFactorEnabled: boolean }> {
  return api("/verification/status", { ...options, method: "GET" });
}