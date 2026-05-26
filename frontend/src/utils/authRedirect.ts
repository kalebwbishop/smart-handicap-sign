import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

export function getAuthRedirectUri(): string {
    if (Platform.OS === 'web') {
        return `${window.location.origin}/auth`;
    }

    // Use the runtime-native deep link so Expo Go/dev clients and standalone builds
    // all return to the app after WorkOS redirects through the backend callback.
    return Linking.createURL('callback');
}
