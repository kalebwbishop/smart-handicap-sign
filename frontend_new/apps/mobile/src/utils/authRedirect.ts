import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

const NATIVE_AUTH_SCHEME = 'hazardhero';

export function getAuthRedirectUri(): string {
    if (Platform.OS === 'web') {
        return `${window.location.origin}/auth`;
    }

    // Prefer the app scheme on native so the browser hands control back to the
    // app after the backend callback. Expo Go will fall back to its runtime URL.
    return Linking.createURL('callback', { scheme: NATIVE_AUTH_SCHEME });
}
