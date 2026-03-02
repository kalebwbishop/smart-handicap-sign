import { create } from 'zustand';
import { User } from '../types/types';
import Storage from '../utils/storage';

interface AuthState {
    user: User | null;
    token: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    setUser: (user: User | null, token: string | null, refreshToken?: string | null) => Promise<void>;
    setTokens: (token: string, refreshToken: string) => Promise<void>;
    logout: () => Promise<string | undefined>;
    loadStoredAuth: () => Promise<void>;
}

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user_data';

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,

    setUser: async (user, token, refreshToken = null) => {
        try {
            if (user && token) {
                await Storage.setKey(TOKEN_KEY, token);
                await Storage.setKey(USER_KEY, JSON.stringify(user));
                if (refreshToken) {
                    await Storage.setKey(REFRESH_TOKEN_KEY, refreshToken);
                }
                set({ user, token, refreshToken: refreshToken ?? null, isAuthenticated: true, isLoading: false });
            } else {
                await Storage.removeKey(TOKEN_KEY);
                await Storage.removeKey(USER_KEY);
                await Storage.removeKey(REFRESH_TOKEN_KEY);
                set({ user: null, token: null, refreshToken: null, isAuthenticated: false, isLoading: false });
            }
        } catch (error) {
            console.error('Error saving auth state:', error);
            set({ isLoading: false });
        }
    },

    setTokens: async (token, refreshToken) => {
        try {
            await Storage.setKey(TOKEN_KEY, token);
            await Storage.setKey(REFRESH_TOKEN_KEY, refreshToken);
            set({ token, refreshToken });
        } catch (error) {
            console.error('Error saving tokens:', error);
        }
    },

    logout: async () => {
        let logoutUrl: string | undefined;
        try {
            // Call logout API BEFORE clearing the token so the
            // Authorization header is still attached to the request
            // Lazy require to avoid circular dependency
            const { authAPI } = require('../api/api');
            const response = await authAPI.initiateLogout();
            logoutUrl = response.logoutUrl;
        } catch (error) {
            console.error('Error calling logout API:', error);
        } finally {
            // Always clear local auth state, even if the API call fails
            await Storage.removeKey(TOKEN_KEY);
            await Storage.removeKey(USER_KEY);
            await Storage.removeKey(REFRESH_TOKEN_KEY);
            set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
        }
        return logoutUrl;
    },

    loadStoredAuth: async () => {
        try {
            const token = await Storage.getKey(TOKEN_KEY);
            const refreshToken = await Storage.getKey(REFRESH_TOKEN_KEY);
            const userJson = await Storage.getKey(USER_KEY);

            if (token && typeof token === 'string' && userJson) {
                const user = JSON.parse(userJson as string);
                set({
                    user,
                    token,
                    refreshToken: (refreshToken as string) || null,
                    isAuthenticated: true,
                    isLoading: false,
                });
            } else {
                set({ isLoading: false });
            }
        } catch (error) {
            console.error('Error loading stored auth:', error);
            set({ isLoading: false });
        }
    },
}));
