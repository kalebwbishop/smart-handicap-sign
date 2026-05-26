import { webStorageAdapter } from "../platform/storageAdapter";

const ACCESS_KEY = "auth_access_token";
const REFRESH_KEY = "auth_refresh_token";

export async function getAccessToken(): Promise<string | null> {
  return webStorageAdapter.getItem(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return webStorageAdapter.getItem(REFRESH_KEY);
}

export async function setTokens(accessToken: string, refreshToken?: string | null): Promise<void> {
  await webStorageAdapter.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) {
    await webStorageAdapter.setItem(REFRESH_KEY, refreshToken);
  }
}

export async function clearTokens(): Promise<void> {
  await webStorageAdapter.removeItem(ACCESS_KEY);
  await webStorageAdapter.removeItem(REFRESH_KEY);
}
