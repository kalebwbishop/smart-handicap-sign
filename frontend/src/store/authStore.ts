import { create } from 'zustand';
import { User } from '../types/types';
import Storage from '../utils/storage';
import { authAPI } from '../api/api';

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    setUser: (user: User | null, token: string | null) => Promise<void>;
    logout: () => Promise<string | undefined>;
    loadStoredAuth: () => Promise<void>;
}

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,

    setUser: async (user, token) => {
        try {
            if (user && token) {
                await Storage.setKey(TOKEN_KEY, token);
                await Storage.setKey(USER_KEY, JSON.stringify(user));
                set({ user, token, isAuthenticated: true, isLoading: false });
            } else {
                await Storage.removeKey(TOKEN_KEY);
                await Storage.removeKey(USER_KEY);
                set({ user: null, token: null, isAuthenticated: false, isLoading: false });
            }
        } catch (error) {
            console.error('Error saving auth state:', error);
            set({ isLoading: false });
        }
    },

    logout: async () => {
        let logoutUrl: string | undefined;
        try {
            // Call logout API BEFORE clearing the token so the
            // Authorization header is still attached to the request
            const response = await authAPI.initiateLogout();
            logoutUrl = response.logoutUrl;
        } catch (error) {
            console.error('Error calling logout API:', error);
        } finally {
            // Always clear local auth state, even if the API call fails
            await Storage.removeKey(TOKEN_KEY);
            await Storage.removeKey(USER_KEY);
            set({ user: null, token: null, isAuthenticated: false });
        }
        return logoutUrl;
    },

    loadStoredAuth: async () => {
        try {
            const token = await Storage.getKey(TOKEN_KEY);
            const userJson = await Storage.getKey(USER_KEY);

            if (token && typeof token === 'string' && userJson) {
                const user = JSON.parse(userJson as string);
                set({ user, token, isAuthenticated: true, isLoading: false });
            } else {
                set({ isLoading: false });
            }
        } catch (error) {
            console.error('Error loading stored auth:', error);
            set({ isLoading: false });
        }
    },
}));
