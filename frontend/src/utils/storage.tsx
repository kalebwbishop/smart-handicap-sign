import { Platform } from "react-native";
import * as expoStorage from "expo-secure-store";

// react-secure-storage is web-only and accesses browser globals (e.g.
// navigator.languages) at import time, which crashes the iOS runtime.
// Lazy-load it so the module is only evaluated on web.
function getSecureLocalStorage() {
    return require("react-secure-storage").default;
}

export default class Storage {

    static async setKey(key: string, token: string) {
        if (Platform.OS === "web") {
            getSecureLocalStorage().setItem(key, token);
        } else {
            await expoStorage.setItemAsync(key, token);
        }
    }

    static async removeKey(key: string) {
        if (Platform.OS === "web") {
            getSecureLocalStorage().removeItem(key);
        } else {
            await expoStorage.deleteItemAsync(key);
        }
    }

    static async getKey(key: string) {
        if (Platform.OS === "web") {
            const result = getSecureLocalStorage().getItem(key);
            console.log(result);
            return result;
        } else {
            const result = await expoStorage.getItemAsync(key);
            console.log(result);
            return result;
        }
    }
}