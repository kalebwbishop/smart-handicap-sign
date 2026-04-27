console.log('[STORE] authStore.ts module evaluating...');
import { create } from 'zustand';
import { Platform, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import axios from 'axios';
import { User } from '../types/types';
import { tokenStorage } from '../lib/auth';
import { authAPI, pushTokenAPI } from '../api/api';
console.log('[STORE] All authStore imports resolved');

interface AuthState {
    user: User | null;
    token: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    sessionExpiredMessage: string | null;
    _pushToken: string | null;
    login: () => Promise<void>;
    handleAuthCode: (code: string) => Promise<void>;
    setUser: (user: User | null, token: string | null, refreshToken?: string | null) => Promise<void>;
    setTokens: (token: string, refreshToken: string) => Promise<void>;
    logout: () => Promise<void>;
    restoreSession: () => Promise<void>;
    handleSessionExpired: () => void;
    setPushToken: (token: string | null) => void;
}

let lastExchangedCode: string | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
    sessionExpiredMessage: null,
    _pushToken: null,

    setPushToken: (pushToken) => set({ _pushToken: pushToken }),

    login: async () => {
        try {
            const redirectUri = Platform.OS === 'web'
                ? `${window.location.origin}/auth`
                : ExpoLinking.createURL('auth');

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
        // Unregister push token before clearing auth state
        const currentPushToken = get()._pushToken;
        if (currentPushToken) {
            try {
                await pushTokenAPI.unregister(currentPushToken);
            } catch (error) {
                console.warn('[Auth] Failed to unregister push token:', error);
            }
        }

        let logoutUrl: string | undefined;
        try {
            const response = await authAPI.initiateLogout();
            logoutUrl = response.logoutUrl;
        } catch (error) {
            console.error('[Auth] Error calling logout API:', error);
        } finally {
            await tokenStorage.clear();
            set({ user: null, token: null, refreshToken: null, isAuthenticated: false, _pushToken: null });
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

    handleSessionExpired: () => {
        tokenStorage.clear();
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
    const API_URL = (process.env.EXPO_PUBLIC_API_URL || '') + '/api/v1';
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
