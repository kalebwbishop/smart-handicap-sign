import react, { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as expoStorage from "expo-secure-store";
import secureLocalStorage from "react-secure-storage";


export default class Storage {

    static async setKey(key: string, token: string) {
        if (Platform.OS === "web") {
            const result = await secureLocalStorage.setItem(key, token)
        } else {
            const result = await expoStorage.setItemAsync(key, token)
        }
    }

    static async removeKey(key: string) {
        if (Platform.OS === "web") {
            secureLocalStorage.removeItem(key)
        } else {
            await expoStorage.deleteItemAsync(key)
        }
    }

static async getKey(key: string) {
        if (Platform.OS === "web") {
            const result = await secureLocalStorage.getItem(key)
            console.log(result)
            return result
        } else {
            const result = await expoStorage.getItemAsync(key)
            console.log(result)
            return result
        }
    }
};