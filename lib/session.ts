"use client";

export const USER_ID_STORAGE_KEY = "unitpay.userId";
export const USER_TOKEN_STORAGE_KEY = "unitpay.userToken";
export const USER_TOKEN_EXP_STORAGE_KEY = "unitpay.userTokenExp";
export const ENCRYPTION_KEY_STORAGE_KEY = "unitpay.encryptionKey";
export const WALLET_BACKUP_COMPLETE_STORAGE_KEY = "unitpay.walletBackupComplete";

export function hasStoredUserSession(): boolean {
  return Boolean(window.localStorage.getItem(USER_ID_STORAGE_KEY));
}

export function getStoredUserId(): string | null {
  return window.localStorage.getItem(USER_ID_STORAGE_KEY);
}

export function getStoredUserToken(): string | null {
  return window.localStorage.getItem(USER_TOKEN_STORAGE_KEY);
}

export function isWalletBackupComplete(): boolean {
  return window.localStorage.getItem(WALLET_BACKUP_COMPLETE_STORAGE_KEY) === "true";
}

export function markWalletBackupComplete(): void {
  window.localStorage.setItem(WALLET_BACKUP_COMPLETE_STORAGE_KEY, "true");
}

export function clearWalletSession(): void {
  window.localStorage.removeItem(USER_ID_STORAGE_KEY);
  window.localStorage.removeItem(USER_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_TOKEN_EXP_STORAGE_KEY);
  window.localStorage.removeItem(ENCRYPTION_KEY_STORAGE_KEY);
  window.localStorage.removeItem(WALLET_BACKUP_COMPLETE_STORAGE_KEY);
}
