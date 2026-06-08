import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const PUSH_TOKEN_STORAGE_KEY = 'hazard-hero.expo-push-token';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

function getExpoProjectId(): string | null {
    const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
    return Constants.easConfig?.projectId ?? extra?.eas?.projectId ?? null;
}

export async function getStoredExpoPushToken(): Promise<string | null> {
    return AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
}

export async function storeExpoPushToken(token: string): Promise<void> {
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
}

export async function clearStoredExpoPushToken(): Promise<void> {
    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
}

export async function registerForExpoPushToken(): Promise<string | null> {
    if (Platform.OS === 'web' || Platform.OS !== 'ios') {
        return null;
    }

    if (!Device.isDevice) {
        console.log('[Push] Skipping Expo push registration on a simulator or non-device environment');
        return null;
    }

    const projectId = getExpoProjectId();
    if (!projectId) {
        throw new Error('Expo EAS project ID is not configured for push notifications');
    }

    const permissions = await Notifications.getPermissionsAsync();
    let finalStatus = permissions.status;
    if (finalStatus !== 'granted') {
        const requestedPermissions = await Notifications.requestPermissionsAsync();
        finalStatus = requestedPermissions.status;
    }

    if (finalStatus !== 'granted') {
        console.log('[Push] Notification permission was not granted');
        return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
}
