console.log('[APP] App.tsx module evaluating...');
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo } from 'react';
import {
    NavigationContainer,
    LinkingOptions,
    createNavigationContainerRef,
    getStateFromPath as defaultGetStateFromPath,
} from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import { RootStackParamList } from './src/types/navigation';
import { View, StyleSheet, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { authAPI, pushTokenAPI } from './src/api/api';
import { useAuthStore } from './src/store/authStore';
import { AuthResponse } from './src/types/types';
import {
    clearStoredExpoPushToken,
    getStoredExpoPushToken,
    registerForExpoPushToken,
    storeExpoPushToken,
} from './src/lib/pushNotifications';
import {
    consumePendingNotificationOpen,
    handleNotificationOpen,
} from './src/lib/notificationOpenNavigation';
console.log('[APP] All App.tsx imports resolved');

const navigationRef = createNavigationContainerRef<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
    prefixes: [
        Linking.createURL('/'),
        'hazardhero://',
        'smartsign://',
        'https://app.example.com',
        'http://localhost:8081/',
        'https://localhost:8081/',
    ],
    config: {
        screens: {
            LandingScreen: '',
            Home: {
                path: 'home',
                parse: {
                    code: String,
                },
            },
        },
    },
    getStateFromPath: (path, options) => {
        return defaultGetStateFromPath(path, options);
    },
};

function useQueryParam(name: string) {
    const url = Linking.useURL();

    return useMemo(() => {
        if (!url) return null;
        console.log('[DeepLink] Full URL:', url);
        const { queryParams } = Linking.parse(url);
        console.log('[DeepLink] Parsed queryParams:', queryParams);
        const v = queryParams?.[name];
        const result = typeof v === "string" ? v : (Array.isArray(v) ? v[0] : null);
        console.log(`[DeepLink] ${name} param:`, result);
        return result;
    }, [url, name]);
}

export default function App() {
    console.log('[APP] App() rendering');

    const code = useQueryParam("code");
    const [processedCode, setProcessedCode] = React.useState<string | null>(null);
    const pendingNotificationOpenRef = React.useRef(false);
    const { setUser, isAuthenticated } = useAuthStore();

    const navigateHomeAfterNotificationOpen = React.useCallback(() => {
        const nextState = handleNotificationOpen({
            hasPendingNotificationOpen: pendingNotificationOpenRef.current,
            isNavigationReady: navigationRef.isReady(),
        });

        pendingNotificationOpenRef.current = nextState.hasPendingNotificationOpen;

        if (nextState.shouldNavigateHome) {
            navigationRef.navigate('Home');
        }
    }, []);

    useEffect(() => {
        if (!code || code === processedCode) return;

        console.log("[OAuth] Code received:", code);
        setProcessedCode(code);
        
        authAPI.handleCallback(code)
            .then(async (response: AuthResponse) => {
                console.log("[OAuth] Exchange successful", response.user.email);
                await setUser(response.user, response.accessToken, response.refreshToken);
            })
            .catch((error) => {
                console.error("[OAuth] Exchange failed:", error);
                console.error("[OAuth] Error details:", {
                    message: error?.message,
                    status: error?.response?.status,
                    data: error?.response?.data,
                });
            });
    }, [code, processedCode, setUser]);

    useEffect(() => {
        if (Platform.OS === 'web') {
            return;
        }

        const subscription = Notifications.addNotificationResponseReceivedListener(() => {
            navigateHomeAfterNotificationOpen();
        });

        void Notifications.getLastNotificationResponseAsync().then((response) => {
            if (response) {
                navigateHomeAfterNotificationOpen();
            }
        });

        return () => subscription.remove();
    }, [navigateHomeAfterNotificationOpen]);

    useEffect(() => {
        if (!isAuthenticated || Platform.OS === 'web') {
            return;
        }

        let active = true;

        const syncExpoPushToken = async () => {
            try {
                const freshToken = await registerForExpoPushToken();
                if (!freshToken || !active) {
                    return;
                }

                const storedToken = await getStoredExpoPushToken();
                if (storedToken === freshToken) {
                    return;
                }

                if (storedToken) {
                    try {
                        await pushTokenAPI.unregister(storedToken);
                    } catch (error) {
                        console.error('[Push] Failed to unregister previous Expo push token:', error);
                    }
                }

                await pushTokenAPI.register(freshToken);
                await storeExpoPushToken(freshToken);
            } catch (error) {
                console.error('[Push] Failed to sync Expo push token:', error);
                await clearStoredExpoPushToken();
            }
        };

        void syncExpoPushToken();

        return () => {
            active = false;
        };
    }, [isAuthenticated]);

    return (
        <View style={styles.container}>
            <View style={[styles.appContainer, Platform.OS === 'web' && styles.webAppContainer]}>
                <NavigationContainer
                    linking={linking}
                    onReady={() => {
                        const nextState = consumePendingNotificationOpen({
                            hasPendingNotificationOpen: pendingNotificationOpenRef.current,
                        });

                        pendingNotificationOpenRef.current = nextState.hasPendingNotificationOpen;

                        if (nextState.shouldNavigateHome) {
                            navigationRef.navigate('Home');
                        }
                    }}
                    ref={navigationRef}
                >
                    <RootNavigator />
                </NavigationContainer>
                <StatusBar style="auto" />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    appContainer: {
        flex: 1,
        width: '100%',
        backgroundColor: '#f5f5f7',
    },
    webAppContainer: {
        height: '100%',
    },
});
