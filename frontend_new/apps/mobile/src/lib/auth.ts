/**
 * Shared auth building blocks from deploy-box-react-native.
 *
 * IMPORTANT: We override the default createTokenStorage() because it uses
 * `await import("expo-secure-store")` (dynamic import) on every call.
 * Dynamic imports trigger Metro's async bundle fetching, which fails through
 * dev tunnels with LoadBundleFromServerRequestError.
 *
 * This version uses a static import instead.
 */

import { Platform } from "react-native";
import { TokenStorage } from "deploy-box-react-native/src/auth/tokenStorage";

console.log('[AUTH] lib/auth.ts evaluating — creating tokenStorage with STATIC imports');

const TOKEN_KEYS = {
    access: "auth_access_token",
    refresh: "auth_refresh_token",
} as const;

function createStaticTokenStorage(): TokenStorage {
    if (Platform.OS === "web") {
        console.log('[AUTH] Using web (localStorage) token storage');
        return {
            async getAccessToken() { return localStorage.getItem(TOKEN_KEYS.access); },
            async getRefreshToken() { return localStorage.getItem(TOKEN_KEYS.refresh); },
            async setAccessToken(token) { localStorage.setItem(TOKEN_KEYS.access, token); },
            async setRefreshToken(token) { localStorage.setItem(TOKEN_KEYS.refresh, token); },
            async clear() {
                localStorage.removeItem(TOKEN_KEYS.access);
                localStorage.removeItem(TOKEN_KEYS.refresh);
            },
        };
    }

    // Native — use STATIC import to avoid async bundle fetching
    console.log('[AUTH] Using native (expo-secure-store) token storage with STATIC import');
    const SecureStore = require("expo-secure-store");
    console.log('[AUTH] expo-secure-store loaded:', !!SecureStore);
    return {
        async getAccessToken() {
            console.log('[AUTH] tokenStorage.getAccessToken()');
            const val = await SecureStore.getItemAsync(TOKEN_KEYS.access);
            console.log('[AUTH] getAccessToken result:', val ? `${val.substring(0, 10)}...` : null);
            return val;
        },
        async getRefreshToken() {
            console.log('[AUTH] tokenStorage.getRefreshToken()');
            const val = await SecureStore.getItemAsync(TOKEN_KEYS.refresh);
            console.log('[AUTH] getRefreshToken result:', val ? `${val.substring(0, 10)}...` : null);
            return val;
        },
        async setAccessToken(token) {
            console.log('[AUTH] tokenStorage.setAccessToken()');
            await SecureStore.setItemAsync(TOKEN_KEYS.access, token);
        },
        async setRefreshToken(token) {
            console.log('[AUTH] tokenStorage.setRefreshToken()');
            await SecureStore.setItemAsync(TOKEN_KEYS.refresh, token);
        },
        async clear() {
            console.log('[AUTH] tokenStorage.clear()');
            await SecureStore.deleteItemAsync(TOKEN_KEYS.access);
            await SecureStore.deleteItemAsync(TOKEN_KEYS.refresh);
        },
    };
}

export const tokenStorage = createStaticTokenStorage();
console.log('[AUTH] tokenStorage created successfully');
