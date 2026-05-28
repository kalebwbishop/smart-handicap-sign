console.log('[STORE] authStore.ts module evaluating...');
import { create } from 'zustand';
import { Platform, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import axios from 'axios';
import { User } from '../types/types';
import { tokenStorage } from '../lib/auth';
import { clearStoredExpoPushToken, getStoredExpoPushToken } from '../lib/pushNotifications';
import { authAPI, pushTokenAPI } from '../api/api';
import { resolveApiV1BaseUrl } from '../api/baseUrl';
import { getAuthRedirectUri } from '../utils/authRedirect';
console.log('[STORE] All authStore imports resolved');

interface AuthState {
    user: User | null;
    token: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    sessionExpiredMessage: string | null;
    login: () => Promise<void>;
    handleAuthCode: (code: string) => Promise<void>;
    setUser: (user: User | null, token: string | null, refreshToken?: string | null) => Promise<void>;
    setTokens: (token: string, refreshToken: string) => Promise<void>;
    logout: () => Promise<void>;
    restoreSession: () => Promise<void>;
    ensureFreshSession: () => Promise<void>;
    handleSessionExpired: () => void;
}

let lastExchangedCode: string | null = null;
let refreshInFlight: Promise<void> | null = null;

function getTokenExpiryMs(token: string | null): number | null {
    if (!token) return null;

    try {
        const [, payload] = token.split('.');
        if (!payload) return null;

        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
        const decoded = JSON.parse(globalThis.atob(padded));
        return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null;
    } catch (error) {
        console.warn('[Auth] Failed to decode token expiry:', error);
        return null;
    }
}

function isTokenFresh(token: string | null): boolean {
    const expiryMs = getTokenExpiryMs(token);
    if (!expiryMs) return false;
    return expiryMs - Date.now() > 60_000;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
    sessionExpiredMessage: null,

    login: async () => {
        try {
            const redirectUri = getAuthRedirectUri();

            const response = await authAPI.initiateLogin(redirectUri);

            if (response.authorizationUrl) {
                if (Platform.OS === 'web') {
                    window.location.href = response.authorizationUrl;
                } else {
                    const result = await WebBrowser.openAuthSessionAsync(
                        response.authorizationUrl,
                        redirectUri,
                    );

                    if (result.type === 'success' && result.url) {
                        const parsed = ExpoLinking.parse(result.url);
                        const code = parsed.queryParams?.code as string | undefined;
                        if (code) {
                            await get().handleAuthCode(code);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[Auth] Login error:', error);
        }
    },

    handleAuthCode: async (code: string) => {
        if (code === lastExchangedCode) {
            console.log('[Auth] Skipping duplicate code exchange');
            return;
        }
        lastExchangedCode = code;

        try {
            const authResponse = await authAPI.handleCallback(code);
            await get().setUser(authResponse.user, authResponse.accessToken, authResponse.refreshToken);
        } catch (error) {
            console.error('[Auth] Code exchange failed:', error);
            lastExchangedCode = null;
        }
    },

    setUser: async (user, token, refreshToken = null) => {
        try {
            if (user && token) {
                await tokenStorage.setAccessToken(token);
                if (refreshToken) {
                    await tokenStorage.setRefreshToken(refreshToken);
                }
                set({ user, token, refreshToken: refreshToken ?? null, isAuthenticated: true, isLoading: false });
            } else {
                await tokenStorage.clear();
                await clearStoredExpoPushToken();
                set({ user: null, token: null, refreshToken: null, isAuthenticated: false, isLoading: false });
            }
        } catch (error) {
            console.error('[Auth] Error saving auth state:', error);
            set({ isLoading: false });
        }
    },

    setTokens: async (token, refreshToken) => {
        try {
            await tokenStorage.setAccessToken(token);
            await tokenStorage.setRefreshToken(refreshToken);
            set({ token, refreshToken });
        } catch (error) {
            console.error('[Auth] Error saving tokens:', error);
        }
    },

    logout: async () => {
        let logoutUrl: string | undefined;
        try {
            const response = await authAPI.initiateLogout();
            logoutUrl = response.logoutUrl;

            const storedPushToken = await getStoredExpoPushToken();
            if (storedPushToken) {
                try {
                    await pushTokenAPI.unregister(storedPushToken);
                } catch (error) {
                    console.error('[Auth] Error unregistering Expo push token during logout:', error);
                }
            }
        } catch (error) {
            console.error('[Auth] Error calling logout API:', error);
        } finally {
            await tokenStorage.clear();
            await clearStoredExpoPushToken();
            set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
        }

        if (logoutUrl) {
            if (Platform.OS === 'web') {
                window.location.href = logoutUrl;
            } else {
                await Linking.openURL(logoutUrl);
            }
        }
    },

    restoreSession: async () => {
        try {
            const timeoutMs = 8000;
            console.log('[Auth] restoreSession() called, timeout:', timeoutMs, 'ms');

            const restorePromise = (async () => {
                console.log('[Auth] Step 1: Getting refresh token from storage...');
                const t0 = Date.now();
                const refreshToken = await tokenStorage.getRefreshToken();
                console.log('[Auth] Step 1 done in', Date.now() - t0, 'ms. Has token:', !!refreshToken);

                if (!refreshToken) {
                    console.log('[Auth] No refresh token — setting isLoading=false');
                    set({ isLoading: false });
                    return;
                }

                console.log('[Auth] Step 2: Refreshing token via API...');
                const t1 = Date.now();
                const tokens = await apiClient_refresh(refreshToken as string);
                console.log('[Auth] Step 2 done in', Date.now() - t1, 'ms. Got new tokens:', !!tokens?.accessToken);

                console.log('[Auth] Step 3: Saving new access token...');
                await tokenStorage.setAccessToken(tokens.accessToken);
                if (tokens.refreshToken) {
                    await tokenStorage.setRefreshToken(tokens.refreshToken);
                }
                set({
                    token: tokens.accessToken,
                    refreshToken: tokens.refreshToken ?? refreshToken,
                });
                console.log('[Auth] Step 3 done — tokens saved');

                console.log('[Auth] Step 4: Fetching user profile...');
                const t2 = Date.now();
                const user = await authAPI.getCurrentUser();
                console.log('[Auth] Step 4 done in', Date.now() - t2, 'ms. User:', user?.email || 'none');

                set({ user, isAuthenticated: true, isLoading: false });
                console.log('[Auth] Session restored successfully');
            })();

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Session restore timed out')), timeoutMs)
            );

            await Promise.race([restorePromise, timeoutPromise]);
        } catch (error: any) {
            console.error('[Auth] Session restore FAILED:', error?.message || error);
            console.error('[Auth] Error name:', error?.name);
            console.error('[Auth] Error stack:', error?.stack?.substring(0, 300));
            if (error?.response) {
                console.error('[Auth] HTTP status:', error.response.status);
                console.error('[Auth] HTTP data:', JSON.stringify(error.response.data)?.substring(0, 200));
            }
            await tokenStorage.clear();
            set({ user: null, token: null, refreshToken: null, isAuthenticated: false, isLoading: false });
            console.log('[Auth] Cleared auth state after failure');
        }
    },

    ensureFreshSession: async () => {
        if (refreshInFlight) {
            await refreshInFlight;
            return;
        }

        const currentAccessToken = await tokenStorage.getAccessToken();
        if (isTokenFresh(currentAccessToken)) {
            return;
        }

        refreshInFlight = (async () => {
            const storedRefreshToken = await tokenStorage.getRefreshToken();
            if (!storedRefreshToken) {
                get().handleSessionExpired();
                throw new Error('No refresh token available');
            }

            const tokens = await apiClient_refresh(storedRefreshToken);
            await tokenStorage.setAccessToken(tokens.accessToken);
            if (tokens.refreshToken) {
                await tokenStorage.setRefreshToken(tokens.refreshToken);
            }

            set((state) => ({
                token: tokens.accessToken,
                refreshToken: tokens.refreshToken ?? state.refreshToken ?? storedRefreshToken,
            }));
        })();

        try {
            await refreshInFlight;
        } catch (error) {
            console.error('[Auth] ensureFreshSession failed:', error);
            get().handleSessionExpired();
            throw error;
        } finally {
            refreshInFlight = null;
        }
    },

    handleSessionExpired: () => {
        tokenStorage.clear();
        void clearStoredExpoPushToken();
        set({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
            sessionExpiredMessage: 'Your session has expired. Please log in again.',
        });
    },
}));

/**
 * Direct axios call for token refresh — avoids going through the
 * intercepted apiClient, which would cause infinite loops.
 */
async function apiClient_refresh(refreshToken: string) {
    const API_URL = resolveApiV1BaseUrl();
    console.log('[Auth] apiClient_refresh — calling', `${API_URL}/auth/refresh`);
    try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        console.log('[Auth] apiClient_refresh — success');
        return data as { accessToken: string; refreshToken: string };
    } catch (err: any) {
        console.error('[Auth] apiClient_refresh — FAILED:', err?.message);
        console.error('[Auth] apiClient_refresh — status:', err?.response?.status);
        throw err;
    }
}
