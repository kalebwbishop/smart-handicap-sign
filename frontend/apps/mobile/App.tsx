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
import { SettingsProvider, useSettings } from './src/context/SettingsContext';
import { RootStackParamList } from './src/types/navigation';
import { ActivityIndicator, View, StyleSheet, Platform, Pressable, Text, AppState, AppStateStatus } from 'react-native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { authAPI, notificationAPI, pushTokenAPI } from './src/api/api';
import { useAuthStore } from './src/store/authStore';
import { AuthResponse, SignNotification } from './src/types/types';
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
import { buildForegroundNotification } from './src/lib/foregroundNotification';
import { getLatestUnseenUnreadNotification } from './src/lib/foregroundNotificationFeed';
import { colors } from './src/theme/colors';
import { spacing, layout, shadows } from './src/theme/spacing';
import { typography } from './src/theme/typography';
console.log('[APP] All App.tsx imports resolved');

const navigationRef = createNavigationContainerRef<RootStackParamList>();
const FOREGROUND_NOTIFICATION_DISMISS_MS = 6000;
const FOREGROUND_NOTIFICATION_SYNC_INTERVAL_MS = 15000;

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

function AppContent() {
    console.log('[APP] App() rendering');

    const code = useQueryParam("code");
    const [processedCode, setProcessedCode] = React.useState<string | null>(null);
    const [foregroundNotification, setForegroundNotification] = React.useState<SignNotification | null>(null);
    const pendingNotificationOpenRef = React.useRef(false);
    const dismissForegroundNotificationTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const appStateRef = React.useRef<AppStateStatus>(AppState.currentState);
    const knownNotificationIdsRef = React.useRef<Set<string>>(new Set());
    const hasHydratedNotificationsRef = React.useRef(false);
    const isSyncingForegroundNotificationsRef = React.useRef(false);
    const { setUser, isAuthenticated, ensureFreshSession } = useAuthStore();
    const { isSettingsLoaded } = useSettings();

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

    const dismissForegroundNotification = React.useCallback(() => {
        if (dismissForegroundNotificationTimeoutRef.current) {
            clearTimeout(dismissForegroundNotificationTimeoutRef.current);
            dismissForegroundNotificationTimeoutRef.current = null;
        }

        setForegroundNotification(null);
    }, []);

    const openForegroundNotification = React.useCallback(async () => {
        if (!foregroundNotification) {
            return;
        }

        const fallbackNotification = foregroundNotification;
        dismissForegroundNotification();

        if (!navigationRef.isReady()) {
            navigateHomeAfterNotificationOpen();
            return;
        }

        try {
            const notification = fallbackNotification.read
                ? fallbackNotification
                : await notificationAPI.markAsRead(fallbackNotification.id);
            navigationRef.navigate('NotificationDetail', { notification });
        } catch (error) {
            console.error('[Push] Failed to open foreground notification:', error);
            navigationRef.navigate('NotificationDetail', { notification: fallbackNotification });
        }
    }, [dismissForegroundNotification, foregroundNotification, navigateHomeAfterNotificationOpen]);

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

        const responseSubscription = Notifications.addNotificationResponseReceivedListener(() => {
            navigateHomeAfterNotificationOpen();
        });
        const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
            setForegroundNotification(buildForegroundNotification(notification));
        });

        void Notifications.getLastNotificationResponseAsync().then((response) => {
            if (response) {
                navigateHomeAfterNotificationOpen();
            }
        });

        return () => {
            responseSubscription.remove();
            receivedSubscription.remove();
        };
    }, [navigateHomeAfterNotificationOpen]);

    useEffect(() => {
        if (!foregroundNotification) {
            if (dismissForegroundNotificationTimeoutRef.current) {
                clearTimeout(dismissForegroundNotificationTimeoutRef.current);
                dismissForegroundNotificationTimeoutRef.current = null;
            }
            return;
        }

        dismissForegroundNotificationTimeoutRef.current = setTimeout(() => {
            setForegroundNotification(null);
            dismissForegroundNotificationTimeoutRef.current = null;
        }, FOREGROUND_NOTIFICATION_DISMISS_MS);

        return () => {
            if (dismissForegroundNotificationTimeoutRef.current) {
                clearTimeout(dismissForegroundNotificationTimeoutRef.current);
                dismissForegroundNotificationTimeoutRef.current = null;
            }
        };
    }, [foregroundNotification]);

    useEffect(() => {
        if (!isAuthenticated || Platform.OS === 'web') {
            knownNotificationIdsRef.current = new Set();
            hasHydratedNotificationsRef.current = false;
            return;
        }

        let active = true;

        const syncForegroundNotifications = async () => {
            if (!active || isSyncingForegroundNotificationsRef.current || appStateRef.current !== 'active') {
                return;
            }

            isSyncingForegroundNotificationsRef.current = true;

            try {
                await ensureFreshSession();
                const latestNotifications = await notificationAPI.getNotifications();
                if (!active) {
                    return;
                }

                const nextNotification = getLatestUnseenUnreadNotification(
                    latestNotifications,
                    knownNotificationIdsRef.current,
                    hasHydratedNotificationsRef.current,
                );

                knownNotificationIdsRef.current = new Set(
                    latestNotifications.map((notification) => notification.id),
                );
                hasHydratedNotificationsRef.current = true;

                if (nextNotification) {
                    setForegroundNotification(nextNotification);
                }
            } catch (error) {
                console.error('[Push] Failed to sync foreground notifications:', error);
            } finally {
                isSyncingForegroundNotificationsRef.current = false;
            }
        };

        void syncForegroundNotifications();

        const interval = setInterval(() => {
            void syncForegroundNotifications();
        }, FOREGROUND_NOTIFICATION_SYNC_INTERVAL_MS);

        const subscription = AppState.addEventListener('change', (nextAppState) => {
            appStateRef.current = nextAppState;

            if (nextAppState === 'active') {
                void syncForegroundNotifications();
            }
        });

        return () => {
            active = false;
            clearInterval(interval);
            subscription.remove();
            isSyncingForegroundNotificationsRef.current = false;
        };
    }, [ensureFreshSession, isAuthenticated]);

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

    if (!isSettingsLoaded) {
        return (
            <View style={styles.container}>
                <View style={[styles.appContainer, Platform.OS === 'web' && styles.webAppContainer]}>
                    <View style={styles.settingsLoadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.settingsLoadingText}>Loading settings…</Text>
                    </View>
                </View>
            </View>
        );
    }

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
                {foregroundNotification ? (
                    <View pointerEvents="box-none" style={styles.foregroundNotificationContainer}>
                        <Pressable
                            accessibilityLabel={`Open notification: ${foregroundNotification.title}`}
                            accessibilityRole="button"
                            onPress={() => {
                                void openForegroundNotification();
                            }}
                            style={({ pressed }) => [
                                styles.foregroundNotificationCard,
                                pressed && styles.foregroundNotificationCardPressed,
                            ]}
                        >
                            <Text style={styles.foregroundNotificationEyebrow}>New notification</Text>
                            <Text numberOfLines={1} style={styles.foregroundNotificationTitle}>
                                {foregroundNotification.title}
                            </Text>
                            <Text numberOfLines={2} style={styles.foregroundNotificationBody}>
                                {foregroundNotification.body}
                            </Text>
                        </Pressable>
                    </View>
                ) : null}
                <StatusBar style="auto" />
            </View>
        </View>
    );
}

export default function App() {
    return (
        <SettingsProvider>
            <AppContent />
        </SettingsProvider>
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
    settingsLoadingContainer: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
    },
    settingsLoadingText: {
        ...typography.body,
        color: colors.textSecondary,
        marginTop: spacing.md,
    },
    foregroundNotificationContainer: {
        left: layout.contentPadding,
        position: 'absolute',
        right: layout.contentPadding,
        top: Platform.select({ ios: 56, android: 24, default: 24 }),
    },
    foregroundNotificationCard: {
        backgroundColor: colors.white,
        borderColor: colors.divider,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        ...shadows.elevated,
    },
    foregroundNotificationCardPressed: {
        opacity: 0.92,
    },
    foregroundNotificationEyebrow: {
        ...typography.caption,
        color: colors.ctaPrimary,
        marginBottom: spacing.xs,
    },
    foregroundNotificationTitle: {
        ...typography.body,
        color: colors.textPrimary,
        fontFamily: 'Montserrat_600SemiBold',
        marginBottom: spacing.xs,
    },
    foregroundNotificationBody: {
        ...typography.bodySmall,
        color: colors.textSecondary,
    },
});
