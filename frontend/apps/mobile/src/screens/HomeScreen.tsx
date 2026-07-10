import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    ActivityIndicator,
    AppState,
    AppStateStatus,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import {
    useFocusEffect,
    useIsFocused,
    useNavigation,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { devicesAPI, notificationAPI } from "@/api/api";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { Device } from "@/types/device";
import { RootStackParamList } from "@/types/navigation";
import { NotificationPreferences, SignNotification } from "@/types/types";
import { colors } from "@/theme/colors";
import { layout, shadows, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import {
    canAcknowledgeRequest as hasAcknowledgeRequest,
    canMarkFalsePositiveRequest as hasFalsePositiveRequest,
    canResolveRequest as hasResolveRequest,
    getLatestAssistanceRequestNotification,
    getOperationalStatus,
    getConnectivityStatus,
} from "./pilotStatus";
import {
    shouldRefreshOnAppActive,
    shouldRefreshOnHomeFocus,
} from "./homeRefresh";
import {
    startAssistanceAlertSound,
    stopAssistanceAlertSound,
} from "@/lib/assistanceAlertSound";
import {
    HomeLiveUpdatesConnection,
    openHomeLiveUpdatesConnection,
    shouldRefreshHomeOnLiveUpdate,
} from "@/lib/homeLiveUpdates";
import Feather from "@expo/vector-icons/Feather";
import BatteryIcon from "@/components/BatteryIcon";

const TAG = "HomeScreen";

const POLL_INTERVAL_MS = 30_000;
const HOME_SCREEN_REQUEST_TIMEOUT_MS = 10_000;
const REFRESH_INDICATOR_TICK_MS = 250;

function formatRelativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function formatLastSeen(iso: string | null): string {
    if (!iso) {
        return "Last seen never";
    }

    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return "Last seen unknown";
    }

    return `${formatRelativeTime(iso)}`;
}

export default function HomeScreen() {
    const isFocused = useIsFocused();
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { token, ensureFreshSession } = useAuthStore();
    const [refreshing, setRefreshing] = useState(false);
    const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
    const [nextRefreshAt, setNextRefreshAt] = useState(
        () => Date.now() + POLL_INTERVAL_MS,
    );
    const [refreshClock, setRefreshClock] = useState(() => Date.now());

    const [device, setDevice] = useState<Device | null>(null);
    const [deviceLoading, setDeviceLoading] = useState(true);
    const [deviceError, setDeviceError] = useState<string | null>(null);
    const [deviceActionLoading, setDeviceActionLoading] = useState(false);
    const [falsePositiveActionLoading, setFalsePositiveActionLoading] =
        useState(false);
    const [notifications, setNotifications] = useState<SignNotification[]>([]);
    const [notificationPreferences, setNotificationPreferences] =
        useState<NotificationPreferences | null>(null);
    const [notificationError, setNotificationError] = useState<string | null>(
        null,
    );
    const [notificationActionLoading, setNotificationActionLoading] =
        useState(false);
    const [activeNotificationId, setActiveNotificationId] = useState<
        string | null
    >(null);
    const [isLiveUpdatesConnected, setIsLiveUpdatesConnected] = useState(false);

    const fetchInFlightRef = useRef(false);
    const hasLoadedOnceRef = useRef(false);
    const hasFocusedHomeRef = useRef(false);
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);
    const liveUpdatesConnectionRef = useRef<HomeLiveUpdatesConnection | null>(
        null,
    );

    const fetchData = useCallback(
        async ({ auto = false }: { auto?: boolean } = {}) => {
            if (fetchInFlightRef.current) {
                return;
            }

            fetchInFlightRef.current = true;
            if (auto) {
                setIsAutoRefreshing(true);
            }
            if (!hasLoadedOnceRef.current) {
                setDeviceLoading(true);
            }

            try {
                await ensureFreshSession();
                const [devices, latestNotifications, preferences] =
                    await Promise.all([
                        devicesAPI.list(undefined, {
                            timeout: HOME_SCREEN_REQUEST_TIMEOUT_MS,
                        }),
                        notificationAPI.getNotifications(undefined, {
                            timeout: HOME_SCREEN_REQUEST_TIMEOUT_MS,
                        }),
                        notificationAPI.getPreferences(),
                    ]);
                if (devices.length === 0) {
                    setDevice(null);
                    setDeviceError(
                        "No pilot sign is linked to this account yet.",
                    );
                } else {
                    const pilotDevice = devices[0];
                    setDevice(pilotDevice);
                    setDeviceError(null);
                }

                setNotifications(latestNotifications);
                setNotificationPreferences(preferences);
                setNotificationError(null);
            } catch (error) {
                console.error(`[${TAG}] Failed to load pilot sign:`, error);
                setDeviceError("Unable to load the pilot sign right now.");
                setNotificationError("Unable to load notifications right now.");
            } finally {
                setDeviceLoading(false);
                fetchInFlightRef.current = false;
                hasLoadedOnceRef.current = true;
                if (auto) {
                    setIsAutoRefreshing(false);
                }
            }
        },
        [ensureFreshSession],
    );

    const resetAutoRefreshTimer = useCallback(() => {
        const now = Date.now();
        setRefreshClock(now);
        setNextRefreshAt(now + POLL_INTERVAL_MS);
    }, []);

    const triggerRefresh = useCallback(
        async ({
            auto = false,
            showSpinner = false,
        }: { auto?: boolean; showSpinner?: boolean } = {}) => {
            resetAutoRefreshTimer();

            if (showSpinner) {
                setRefreshing(true);
            }

            try {
                await fetchData({ auto });
            } finally {
                if (showSpinner) {
                    setRefreshing(false);
                }
            }
        },
        [fetchData, resetAutoRefreshTimer],
    );

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (
            Platform.OS === "web" ||
            !isFocused ||
            !hasLoadedOnceRef.current ||
            !token
        ) {
            liveUpdatesConnectionRef.current?.close();
            liveUpdatesConnectionRef.current = null;
            setIsLiveUpdatesConnected(false);
            return;
        }

        let cancelled = false;

        const connect = async () => {
            try {
                await ensureFreshSession();
                const accessToken = useAuthStore.getState().token;
                if (cancelled || !accessToken) {
                    return;
                }

                liveUpdatesConnectionRef.current?.close();
                liveUpdatesConnectionRef.current =
                    openHomeLiveUpdatesConnection(accessToken, {
                        onOpen: () => {
                            if (cancelled) {
                                return;
                            }

                            setIsLiveUpdatesConnected(true);
                            void triggerRefresh({ auto: true });
                        },
                        onMessage: (update) => {
                            if (
                                cancelled ||
                                !shouldRefreshHomeOnLiveUpdate(update)
                            ) {
                                return;
                            }

                            void triggerRefresh({ auto: true });
                        },
                        onError: (error) => {
                            if (cancelled) {
                                return;
                            }

                            console.warn(
                                `[${TAG}] Live updates stream error:`,
                                error,
                            );
                            setIsLiveUpdatesConnected(false);
                        },
                    });

                if (!liveUpdatesConnectionRef.current) {
                    setIsLiveUpdatesConnected(false);
                }
            } catch (error) {
                if (cancelled) {
                    return;
                }

                console.error(
                    `[${TAG}] Failed to open live updates stream:`,
                    error,
                );
                setIsLiveUpdatesConnected(false);
            }
        };

        void connect();

        return () => {
            cancelled = true;
            liveUpdatesConnectionRef.current?.close();
            liveUpdatesConnectionRef.current = null;
            setIsLiveUpdatesConnected(false);
        };
    }, [ensureFreshSession, isFocused, token, triggerRefresh]);

    useFocusEffect(
        useCallback(() => {
            const shouldRefresh = shouldRefreshOnHomeFocus({
                hasLoadedOnce: hasLoadedOnceRef.current,
                hasFocusedBefore: hasFocusedHomeRef.current,
            });

            hasFocusedHomeRef.current = true;

            if (shouldRefresh) {
                void triggerRefresh({ auto: true });
            }
        }, [triggerRefresh]),
    );

    useEffect(() => {
        if (isLiveUpdatesConnected) {
            return undefined;
        }

        const delay = Math.max(0, nextRefreshAt - Date.now());
        const timeout = setTimeout(() => {
            void triggerRefresh({ auto: true });
        }, delay);

        return () => clearTimeout(timeout);
    }, [isLiveUpdatesConnected, nextRefreshAt, triggerRefresh]);

    useEffect(() => {
        if (isLiveUpdatesConnected) {
            return undefined;
        }

        const interval = setInterval(() => {
            setRefreshClock(Date.now());
        }, REFRESH_INDICATOR_TICK_MS);

        return () => clearInterval(interval);
    }, [isLiveUpdatesConnected]);

    useEffect(() => {
        if (Platform.OS === "web") {
            return;
        }

        const subscription = AppState.addEventListener(
            "change",
            (nextAppState) => {
                const shouldRefresh = shouldRefreshOnAppActive({
                    hasLoadedOnce: hasLoadedOnceRef.current,
                    isScreenFocused: isFocused,
                    previousAppState: appStateRef.current,
                    nextAppState,
                });

                appStateRef.current = nextAppState;

                if (shouldRefresh) {
                    void triggerRefresh({ auto: true });
                }
            },
        );

        return () => subscription.remove();
    }, [isFocused, triggerRefresh]);

    const onRefresh = useCallback(async () => {
        await triggerRefresh({ showSpinner: true });
    }, [triggerRefresh]);

    const handleRefreshIndicatorPress = useCallback(() => {
        if (fetchInFlightRef.current) {
            return;
        }

        void triggerRefresh({ auto: true });
    }, [triggerRefresh]);

    const handleAcknowledgeRequest = useCallback(async () => {
        if (!device) return;

        setDeviceActionLoading(true);
        try {
            await ensureFreshSession();
            const updated = await devicesAPI.acknowledge(device.serial_number);
            setDevice(updated);
        } catch (error) {
            console.error(`[${TAG}] Failed to acknowledge request:`, error);
        } finally {
            setDeviceActionLoading(false);
        }
    }, [device, ensureFreshSession]);

    const handleResolveRequest = useCallback(async () => {
        if (!device) return;

        setDeviceActionLoading(true);
        try {
            await ensureFreshSession();
            const updated = await devicesAPI.resolve(device.serial_number);
            setDevice(updated);
        } catch (error) {
            console.error(`[${TAG}] Failed to resolve request:`, error);
        } finally {
            setDeviceActionLoading(false);
        }
    }, [device, ensureFreshSession]);

    const handleMarkFalsePositiveRequest = useCallback(async () => {
        const latestAssistanceRequestNotification =
            getLatestAssistanceRequestNotification(notifications);
        if (!device || !latestAssistanceRequestNotification?.device_event_id) {
            return;
        }

        setFalsePositiveActionLoading(true);
        try {
            await ensureFreshSession();
            const updated = await devicesAPI.markFalsePositive(
                device.serial_number,
                latestAssistanceRequestNotification.device_event_id,
            );
            setDevice(updated.device);
            setNotifications((currentNotifications) =>
                currentNotifications.map((notification) =>
                    notification.device_event_id === updated.device_event.id
                        ? {
                            ...notification,
                            device_event_correct_response:
                                updated.device_event.correct_response,
                        }
                        : notification,
                ),
            );
        } catch (error) {
            console.error(`[${TAG}] Failed to mark false positive:`, error);
        } finally {
            setFalsePositiveActionLoading(false);
        }
    }, [device, ensureFreshSession, notifications]);

    const handleOpenSignDetails = useCallback(() => {
        if (!device) return;

        navigation.navigate("SignDetails", { device });
    }, [device, navigation]);

    const handleOpenNotification = useCallback(
        async (notification: SignNotification) => {
            setActiveNotificationId(notification.id);
            try {
                await ensureFreshSession();
                const updatedNotification = notification.read
                    ? notification
                    : await notificationAPI.markAsRead(notification.id);

                setNotifications((currentNotifications) =>
                    currentNotifications.map((currentNotification) =>
                        currentNotification.id === updatedNotification.id
                            ? updatedNotification
                            : currentNotification,
                    ),
                );

                navigation.navigate("NotificationDetail", {
                    notification: updatedNotification,
                    device,
                });
            } catch (error) {
                console.error(
                    `[${TAG}] Failed to open notification:`,
                    error,
                );
                navigation.navigate("NotificationDetail", {
                    notification,
                    device,
                });
            } finally {
                setActiveNotificationId(null);
            }
        },
        [device, ensureFreshSession, navigation],
    );

    const handleMarkAllNotificationsRead = useCallback(async () => {
        setNotificationActionLoading(true);
        try {
            await ensureFreshSession();
            await notificationAPI.markAllAsRead();
            setNotifications((currentNotifications) =>
                currentNotifications.map((notification) => ({
                    ...notification,
                    read: true,
                })),
            );
        } catch (error) {
            console.error(
                `[${TAG}] Failed to mark notifications as read:`,
                error,
            );
        } finally {
            setNotificationActionLoading(false);
        }
    }, [ensureFreshSession]);

    const status = useMemo(
        () => (device ? getOperationalStatus(device) : null),
        [device],
    );
    const connectivityStatus = useMemo(
        () => (device ? getConnectivityStatus(device) : null),
        [device],
    );
    const deviceOffline = connectivityStatus?.label.toLowerCase() === "offline";
    const canAcknowledge = useMemo(
        () => (device ? hasAcknowledgeRequest(device) : false),
        [device],
    );
    const canResolve = useMemo(
        () => (device ? hasResolveRequest(device) : false),
        [device],
    );
    const latestAssistanceRequestNotification = useMemo(
        () => getLatestAssistanceRequestNotification(notifications),
        [notifications],
    );
    const canMarkFalsePositive = useMemo(
        () =>
            device
                ? hasFalsePositiveRequest(
                    device,
                    latestAssistanceRequestNotification,
                )
                : false,
        [device, latestAssistanceRequestNotification],
    );
    const millisecondsUntilRefresh = isLiveUpdatesConnected
        ? 0
        : Math.max(0, nextRefreshAt - refreshClock);
    const secondsUntilRefresh = Math.ceil(millisecondsUntilRefresh / 1000);
    const refreshProgress = isLiveUpdatesConnected
        ? 1
        : isAutoRefreshing
            ? 1
            : Math.min(
                1,
                Math.max(0, 1 - millisecondsUntilRefresh / POLL_INTERVAL_MS),
            );
    const refreshIndicatorText = isLiveUpdatesConnected
        ? "Live updates connected"
        : isAutoRefreshing
            ? "Refreshing now…"
            : `Next refresh in ${secondsUntilRefresh}s`;
    const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
    const unreadNotificationCount = useMemo(
        () => notifications.filter((notification) => !notification.read).length,
        [notifications],
    );
    useEffect(() => {
        if (!hasLoadedOnceRef.current) return;
        setUnreadCount(unreadNotificationCount);
    }, [unreadNotificationCount, setUnreadCount]);
    const notificationsEnabled =
        notificationPreferences?.assistance_requests_enabled ?? true;

    useEffect(() => {
        if (canAcknowledge) {
            void startAssistanceAlertSound().catch((error) => {
                console.error(
                    `[${TAG}] Failed to start assistance alert sound:`,
                    error,
                );
            });
            return;
        }

        void stopAssistanceAlertSound().catch((error) => {
            console.error(
                `[${TAG}] Failed to stop assistance alert sound:`,
                error,
            );
        });
    }, [canAcknowledge]);

    useEffect(() => {
        return () => {
            void stopAssistanceAlertSound().catch((error) => {
                console.error(
                    `[${TAG}] Failed to stop assistance alert sound during cleanup:`,
                    error,
                );
            });
        };
    }, []);

    return (
        <View style={styles.root}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary}
                    />
                }
                style={styles.scrollView}
            >
                <View style={styles.content}>
                    <View style={styles.card}>
                        {deviceLoading ? (
                            <View style={styles.emptyState}>
                                <ActivityIndicator
                                    color={colors.primary}
                                    size="large"
                                />
                                <Text style={styles.emptyTitle}>
                                    Loading sign information…
                                </Text>
                            </View>
                        ) : deviceError || !device ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyIcon}>⚠️</Text>
                                <Text style={styles.emptyTitle}>
                                    Sign information unavailable
                                </Text>
                                <Text style={styles.emptyBody}>
                                    {deviceError ||
                                        "No sign information found."}
                                </Text>
                            </View>
                        ) : (
                            <>
                                <Pressable
                                    accessibilityLabel={`Open details for ${device.name || "sign"}`}
                                    accessibilityRole="button"
                                    onPress={handleOpenSignDetails}
                                    style={({ pressed }) => [
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <View style={styles.signHeaderRow}>
                                        {deviceOffline && (
                                            <Text
                                                style={
                                                    styles.offlineWarningIcon
                                                }
                                            >
                                                ⚠️
                                            </Text>
                                        )}
                                        <Text style={styles.signName}>
                                            {device.name || "Sign"}
                                        </Text>
                                    </View>
                                    <Text style={styles.signName}>
                                        {device?.connectivity_status ??
                                            "Unknown"}
                                    </Text>



                                    <View
                                        style={[
                                            styles.statusBanner,
                                            {
                                                backgroundColor:
                                                    status?.tone ??
                                                    colors.offWhite,
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.statusBannerText,
                                                {
                                                    color:
                                                        status?.color ??
                                                        colors.textPrimary,
                                                },
                                            ]}
                                        >
                                            {status?.label ??
                                                "Status unavailable"}
                                        </Text>
                                    </View>
                                    {deviceOffline ? (
                                        <View style={styles.offlineWarningRow}>
                                            <Text
                                                style={
                                                    styles.offlineWarningIcon
                                                }
                                            >
                                                ⚠️
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.offlineWarningText,
                                                    {
                                                        color:
                                                            connectivityStatus?.color ??
                                                            colors.textPrimary,
                                                    },
                                                ]}
                                            >
                                                This sign appears to be offline.
                                                The above status may not be up
                                                to date, and assistance requests
                                                may not be received until
                                                connectivity is restored.
                                            </Text>
                                        </View>
                                    ) : null}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                                        <BatteryIcon batteryPercentage={device.battery_percentage ?? 0} size={24} />
                                        <Text style={styles.signMeta}>
                                            {device.battery_percentage}%
                                        </Text>
                                        <Feather
                                            accessibilityLabel="Wi-Fi connected"
                                            name={
                                                deviceOffline
                                                    ? "wifi-off"
                                                    : "wifi"
                                            }
                                            size={24}
                                            color={
                                                deviceOffline ? "red" : "green"
                                            }
                                        />

                                        <Text style={styles.signMeta}>
                                            {formatLastSeen(device.last_seen_at)}
                                        </Text>
                                    </View>
                                </Pressable>

                                {canAcknowledge ? (
                                    <Pressable
                                        accessibilityLabel="Acknowledge assistance request"
                                        accessibilityRole="button"
                                        disabled={
                                            deviceActionLoading ||
                                            falsePositiveActionLoading
                                        }
                                        onPress={handleAcknowledgeRequest}
                                        style={({ pressed }) => [
                                            styles.primaryAction,
                                            (deviceActionLoading ||
                                                falsePositiveActionLoading) &&
                                            styles.disabledAction,
                                            pressed && styles.pressed,
                                        ]}
                                    >
                                        {deviceActionLoading ? (
                                            <ActivityIndicator
                                                color={colors.white}
                                                size="small"
                                            />
                                        ) : (
                                            <Text
                                                style={styles.primaryActionText}
                                            >
                                                Acknowledge request
                                            </Text>
                                        )}
                                    </Pressable>
                                ) : null}{ }

                                {canMarkFalsePositive ? (
                                    <Pressable
                                        accessibilityLabel="Mark assistance request as false positive"
                                        accessibilityRole="button"
                                        disabled={
                                            falsePositiveActionLoading ||
                                            deviceActionLoading
                                        }
                                        onPress={handleMarkFalsePositiveRequest}
                                        style={({ pressed }) => [
                                            styles.falsePositiveAction,
                                            (falsePositiveActionLoading ||
                                                deviceActionLoading) &&
                                            styles.disabledAction,
                                            pressed && styles.pressed,
                                        ]}
                                    >
                                        {falsePositiveActionLoading ? (
                                            <ActivityIndicator
                                                color={colors.negative}
                                                size="small"
                                            />
                                        ) : (
                                            <Text
                                                style={
                                                    styles.falsePositiveActionText
                                                }
                                            >
                                                False Positive
                                            </Text>
                                        )}
                                    </Pressable>
                                ) : null}

                                {canResolve ? (
                                    <Pressable
                                        accessibilityLabel="Resolve assistance request"
                                        accessibilityRole="button"
                                        disabled={
                                            deviceActionLoading ||
                                            falsePositiveActionLoading
                                        }
                                        onPress={handleResolveRequest}
                                        style={({ pressed }) => [
                                            styles.successAction,
                                            (deviceActionLoading ||
                                                falsePositiveActionLoading) &&
                                            styles.disabledAction,
                                            pressed && styles.pressed,
                                        ]}
                                    >
                                        {deviceActionLoading ? (
                                            <ActivityIndicator
                                                color={colors.white}
                                                size="small"
                                            />
                                        ) : (
                                            <Text
                                                style={styles.primaryActionText}
                                            >
                                                Mark resolved
                                            </Text>
                                        )}
                                    </Pressable>
                                ) : null}
                            </>
                        )}
                    </View>

                    <View style={styles.card}>
                        <View style={styles.sectionHeader}>
                            <View>
                                <Text style={styles.sectionEyebrow}>Inbox</Text>
                                <Text style={styles.sectionTitle}>
                                    Assistance alerts
                                </Text>
                            </View>
                            {unreadNotificationCount > 0 ? (
                                <View style={styles.unreadBadge}>
                                    <Text style={styles.unreadBadgeText}>
                                        {unreadNotificationCount} new
                                    </Text>
                                </View>
                            ) : null}
                        </View>

                        <View style={styles.notificationControls}>
                            {unreadNotificationCount > 0 ? (
                                <Pressable
                                    accessibilityLabel="Mark all notifications as read"
                                    accessibilityRole="button"
                                    disabled={notificationActionLoading}
                                    onPress={handleMarkAllNotificationsRead}
                                    style={({ pressed }) => [
                                        styles.inlineAction,
                                        notificationActionLoading &&
                                        styles.disabledAction,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <Text style={styles.inlineActionText}>
                                        Mark all read
                                    </Text>
                                </Pressable>
                            ) : null}
                        </View>

                        {!notificationsEnabled ? (
                            <View style={styles.noticeCard}>
                                <Text style={styles.noticeTitle}>
                                    Alerts are paused
                                </Text>
                                <Text style={styles.noticeBody}>
                                    New assistance requests will still appear on
                                    the home screen, but the inbox will stop
                                    adding new alerts until you turn
                                    notifications back on.
                                </Text>
                            </View>
                        ) : null}

                        {notificationError ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyIcon}>⚠️</Text>
                                <Text style={styles.emptyTitle}>
                                    Inbox unavailable
                                </Text>
                                <Text style={styles.emptyBody}>
                                    {notificationError}
                                </Text>
                            </View>
                        ) : notifications.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyIcon}>🔔</Text>
                                <Text style={styles.emptyTitle}>
                                    No assistance alerts yet
                                </Text>
                                <Text style={styles.emptyBody}>
                                    When the sign requests help, the alert will
                                    appear here for operators to review.
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.notificationList}>
                                {notifications.map((notification) => {
                                    const isOpeningNotification =
                                        activeNotificationId ===
                                        notification.id;

                                    return (
                                        <Pressable
                                            key={notification.id}
                                            accessibilityLabel={`Open notification: ${notification.title}`}
                                            accessibilityRole="button"
                                            disabled={isOpeningNotification}
                                            onPress={() =>
                                                void handleOpenNotification(
                                                    notification,
                                                )
                                            }
                                            style={({ pressed }) => [
                                                styles.notificationRow,
                                                !notification.read &&
                                                styles.notificationRowUnread,
                                                pressed && styles.pressed,
                                            ]}
                                        >
                                            <View
                                                style={
                                                    styles.notificationRowHeader
                                                }
                                            >
                                                <Text
                                                    style={
                                                        styles.notificationTitle
                                                    }
                                                >
                                                    {notification.title}
                                                </Text>
                                                <Text
                                                    style={
                                                        styles.notificationTimestamp
                                                    }
                                                >
                                                    {formatRelativeTime(
                                                        notification.created_at,
                                                    )}
                                                </Text>
                                            </View>
                                            <Text
                                                style={styles.notificationBody}
                                            >
                                                {notification.body}
                                            </Text>
                                            <View
                                                style={
                                                    styles.notificationFooter
                                                }
                                            >
                                                {!notification.read ? (
                                                    <View
                                                        style={
                                                            styles.notificationStatusPill
                                                        }
                                                    >
                                                        <Text
                                                            style={
                                                                styles.notificationStatusPillText
                                                            }
                                                        >
                                                            Unread
                                                        </Text>
                                                    </View>
                                                ) : (
                                                    <Text
                                                        style={
                                                            styles.notificationReadText
                                                        }
                                                    >
                                                        Read
                                                    </Text>
                                                )}
                                                {isOpeningNotification ? (
                                                    <ActivityIndicator
                                                        color={colors.primary}
                                                        size="small"
                                                    />
                                                ) : null}
                                            </View>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: colors.offWhite,
    },
    header: {
        backgroundColor: colors.white,
        borderBottomColor: colors.divider,
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingBottom: spacing.sm,
        paddingHorizontal: layout.contentPadding,
    },
    headerInner: {
        alignItems: "center",
        alignSelf: "center",
        flexDirection: "row",
        justifyContent: "space-between",
        maxWidth: layout.maxWidth,
        width: "100%",
    },
    headerCopy: {
        flex: 1,
        paddingRight: spacing.md,
    },
    headerEyebrow: {
        ...typography.label,
        color: colors.primary,
        marginBottom: spacing.xs,
        textTransform: "uppercase",
    },
    headerTitle: {
        ...typography.h3,
        color: colors.textPrimary,
    },
    headerSubtitle: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    avatar: {
        alignItems: "center",
        backgroundColor: colors.ctaPrimary,
        borderRadius: 18,
        height: 36,
        justifyContent: "center",
        width: 36,
    },
    avatarText: {
        color: colors.white,
        fontWeight: "700",
    },
    menuOverlay: {
        backgroundColor: "rgba(0,0,0,0.35)",
        flex: 1,
        justifyContent: "flex-start",
    },
    menuSheet: {
        backgroundColor: colors.white,
        borderBottomLeftRadius: layout.borderRadiusXl,
        borderBottomRightRadius: layout.borderRadiusXl,
        paddingBottom: spacing.xl,
        paddingHorizontal: layout.contentPadding,
        ...shadows.elevated,
    },
    menuContent: {
        width: "100%",
    },
    menuUserRow: {
        alignItems: "center",
        flexDirection: "row",
        paddingVertical: spacing.lg,
    },
    menuAvatar: {
        alignItems: "center",
        backgroundColor: colors.ctaPrimary,
        borderRadius: 24,
        height: 48,
        justifyContent: "center",
        width: 48,
    },
    menuAvatarText: {
        color: colors.white,
        fontSize: 20,
        fontWeight: "700",
    },
    menuUserCopy: {
        flex: 1,
        marginLeft: spacing.md,
    },
    menuUserName: {
        ...typography.h4,
        color: colors.textPrimary,
    },
    menuUserEmail: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    menuDivider: {
        backgroundColor: colors.divider,
        height: StyleSheet.hairlineWidth,
        marginBottom: spacing.xs,
    },
    menuItem: {
        alignItems: "center",
        borderRadius: layout.borderRadiusSm,
        flexDirection: "row",
        paddingHorizontal: spacing.sm,
        paddingVertical: 14,
    },
    menuItemPressed: {
        backgroundColor: colors.offWhite,
    },
    menuItemIcon: {
        fontSize: 18,
        marginRight: spacing.md,
    },
    menuItemText: {
        ...typography.body,
        color: colors.textPrimary,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: layout.contentPadding,
        paddingVertical: spacing.xl,
    },
    content: {
        alignSelf: "center",
        gap: spacing.lg,
        maxWidth: 720,
        width: "100%",
    },
    card: {
        backgroundColor: colors.card,
        borderRadius: layout.borderRadiusMd,
        padding: spacing.xl,
        ...shadows.card,
    },
    sectionHeader: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: spacing.lg,
    },
    sectionEyebrow: {
        ...typography.label,
        color: colors.textSecondary,
        textTransform: "uppercase",
    },
    sectionTitle: {
        ...typography.h4,
        color: colors.textPrimary,
        marginTop: spacing.xs,
    },
    unreadBadge: {
        backgroundColor: `${colors.primary}14`,
        borderRadius: layout.borderRadiusPill,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    unreadBadgeText: {
        ...typography.captionBold,
        color: colors.primary,
    },
    refreshIndicator: {
        backgroundColor: colors.offWhite,
        borderRadius: layout.borderRadiusMd,
        marginBottom: spacing.lg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
    refreshIndicatorHeader: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
    },
    refreshIndicatorLabel: {
        ...typography.label,
        color: colors.textSecondary,
        textTransform: "uppercase",
    },
    refreshIndicatorValue: {
        ...typography.captionBold,
        color: colors.primary,
    },
    refreshIndicatorTrack: {
        backgroundColor: colors.divider,
        borderRadius: layout.borderRadiusPill,
        height: 6,
        marginTop: spacing.sm,
        overflow: "hidden",
    },
    refreshIndicatorFill: {
        backgroundColor: colors.primaryLight,
        borderRadius: layout.borderRadiusPill,
        height: "100%",
    },
    signName: {
        ...typography.h2,
        color: colors.textPrimary,
        flex: 1,
    },
    signHeaderRow: {
        alignItems: "center",
        flexDirection: "row",
        gap: spacing.sm,
    },
    wifiIcon: {
        fontSize: 24,
    },
    signMeta: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    extraInfoCard: {
        backgroundColor: colors.offWhite,
        borderRadius: layout.borderRadiusSm,
        marginTop: spacing.md,
        padding: spacing.md,
    },
    extraInfoEyebrow: {
        ...typography.caption,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    extraInfoTitle: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    extraInfoBody: {
        ...typography.body,
        color: colors.textPrimary,
        fontFamily: "Montserrat_600SemiBold",
    },
    statusBanner: {
        borderRadius: layout.borderRadiusMd,
        marginTop: spacing.lg,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
    },
    statusBannerText: {
        ...typography.h3,
        textAlign: "center",
    },
    offlineIndicator: {
        alignSelf: "center",
        backgroundColor: "#86868B12",
        borderRadius: layout.borderRadiusPill,
        marginTop: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    offlineIndicatorText: {
        ...typography.captionBold,
        color: colors.textMuted,
    },
    primaryAction: {
        alignItems: "center",
        backgroundColor: colors.warning,
        borderRadius: layout.borderRadiusPill,
        marginTop: spacing.lg,
        paddingHorizontal: spacing.lg,
        paddingVertical: 14,
    },
    successAction: {
        alignItems: "center",
        backgroundColor: "#34C759",
        borderRadius: layout.borderRadiusPill,
        marginTop: spacing.lg,
        paddingHorizontal: spacing.lg,
        paddingVertical: 14,
    },
    falsePositiveAction: {
        alignItems: "center",
        backgroundColor: "#FFF5F5",
        borderColor: colors.negative,
        borderRadius: layout.borderRadiusPill,
        borderWidth: 1,
        marginTop: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: 14,
    },
    primaryActionText: {
        ...typography.button,
        color: colors.white,
    },
    falsePositiveActionText: {
        ...typography.button,
        color: colors.negative,
    },
    disabledAction: {
        opacity: 0.6,
    },
    emptyState: {
        alignItems: "center",
        paddingVertical: spacing.lg,
    },
    emptyIcon: {
        fontSize: 32,
        marginBottom: spacing.sm,
    },
    emptyTitle: {
        ...typography.h4,
        color: colors.textPrimary,
        marginTop: spacing.sm,
        textAlign: "center",
    },
    emptyBody: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        marginTop: spacing.xs,
        textAlign: "center",
    },
    offlineWarningRow: {
        alignItems: "flex-start",
        flexDirection: "row",
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    offlineWarningIcon: {
        fontSize: 20,
        lineHeight: 24,
    },
    offlineWarningText: {
        ...typography.bodySmall,
        flex: 1,
        lineHeight: 20,
    },
    inlineAction: {
        alignSelf: "flex-start",
        marginTop: spacing.sm,
    },
    notificationControls: {
        alignItems: "center",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    secondaryAction: {
        alignItems: "center",
        alignSelf: "flex-start",
        backgroundColor: colors.offWhite,
        borderRadius: layout.borderRadiusPill,
        paddingHorizontal: spacing.lg,
        paddingVertical: 12,
    },
    secondaryActionText: {
        ...typography.bodySmall,
        color: colors.textPrimary,
        fontWeight: "600",
    },
    noticeCard: {
        backgroundColor: colors.offWhite,
        borderRadius: layout.borderRadiusMd,
        marginBottom: spacing.lg,
        padding: spacing.md,
    },
    noticeTitle: {
        ...typography.body,
        color: colors.textPrimary,
        fontFamily: "Montserrat_600SemiBold",
    },
    noticeBody: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        lineHeight: 20,
        marginTop: spacing.xs,
    },
    notificationList: {
        gap: spacing.md,
    },
    notificationRow: {
        backgroundColor: colors.offWhite,
        borderRadius: layout.borderRadiusMd,
        padding: spacing.md,
    },
    notificationRowUnread: {
        borderColor: `${colors.primary}26`,
        borderWidth: 1,
    },
    notificationRowHeader: {
        alignItems: "flex-start",
        flexDirection: "row",
        justifyContent: "space-between",
    },
    notificationTitle: {
        ...typography.body,
        color: colors.textPrimary,
        flex: 1,
        fontFamily: "Montserrat_600SemiBold",
        paddingRight: spacing.md,
    },
    notificationTimestamp: {
        ...typography.captionBold,
        color: colors.textMuted,
    },
    notificationBody: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        lineHeight: 20,
        marginTop: spacing.sm,
    },
    notificationFooter: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: spacing.md,
    },
    notificationStatusPill: {
        backgroundColor: `${colors.primary}14`,
        borderRadius: layout.borderRadiusPill,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    notificationStatusPillText: {
        ...typography.captionBold,
        color: colors.primary,
    },
    notificationReadText: {
        ...typography.captionBold,
        color: colors.textMuted,
    },
    inlineActionText: {
        ...typography.bodySmall,
        color: colors.primary,
        fontWeight: "600",
    },
    pressed: {
        opacity: 0.82,
    },
});
