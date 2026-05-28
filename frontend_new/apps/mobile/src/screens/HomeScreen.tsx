import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { devicesAPI } from '@/api/api';
import { useAuthStore } from '@/store/authStore';
import { Device, DeviceEvent } from '@/types/device';
import { RootStackParamList } from '@/types/navigation';
import { colors } from '@/theme/colors';
import { layout, shadows, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { getPilotStatus, isDeviceStale } from './pilotStatus';

const POLL_INTERVAL_MS = 30_000;
const HOME_SCREEN_REQUEST_TIMEOUT_MS = 10_000;

function formatRelativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function formatLastSeen(iso: string | null): string {
    if (!iso) {
        return 'Last seen never';
    }

    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return 'Last seen unknown';
    }

    return `Last seen ${date.toLocaleString()} (${formatRelativeTime(iso)})`;
}

function formatEventTitle(event: DeviceEvent): string {
    switch (event.event_type) {
        case 'assistance_requested':
            return 'Assistance requested';
        case 'assistance_acknowledged':
            return 'Request acknowledged';
        case 'assistance_resolved':
            return 'Request resolved';
        case 'pilot_seeded':
            return 'Pilot sign created';
        default:
            return event.event_type.replace(/_/g, ' ');
    }
}

function formatEventBody(event: DeviceEvent): string {
    const payload = event.payload ?? {};
    if (typeof payload.message === 'string') {
        return payload.message;
    }

    const previousStatus = typeof payload.previous_status === 'string' ? payload.previous_status : null;
    const newStatus = typeof payload.new_status === 'string' ? payload.new_status : null;
    const confidence = typeof payload.confidence === 'number'
        ? `Confidence ${Math.round(payload.confidence * 100)}%`
        : null;

    return [previousStatus && newStatus ? `${previousStatus} -> ${newStatus}` : newStatus, confidence]
        .filter(Boolean)
        .join(' • ') || 'Recorded device event for the pilot sign.';
}

export default function HomeScreen() {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { user, logout, ensureFreshSession } = useAuthStore();

    const [menuVisible, setMenuVisible] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [device, setDevice] = useState<Device | null>(null);
    const [deviceLoading, setDeviceLoading] = useState(true);
    const [deviceError, setDeviceError] = useState<string | null>(null);
    const [deviceActionLoading, setDeviceActionLoading] = useState(false);

    const [events, setEvents] = useState<DeviceEvent[]>([]);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [eventsError, setEventsError] = useState<string | null>(null);
    const fetchInFlightRef = useRef(false);
    const hasLoadedOnceRef = useRef(false);

    const userName = user?.name?.split(' ')[0] || user?.email || 'Operator';
    const userInitial = userName.charAt(0).toUpperCase();

    const fetchData = useCallback(async () => {
        if (fetchInFlightRef.current) {
            return;
        }

        fetchInFlightRef.current = true;
        if (!hasLoadedOnceRef.current) {
            setDeviceLoading(true);
            setEventsLoading(true);
        }

        try {
            await ensureFreshSession();
            const devices = await devicesAPI.list(undefined, { timeout: HOME_SCREEN_REQUEST_TIMEOUT_MS });
            if (devices.length === 0) {
                setDevice(null);
                setEvents([]);
                setDeviceError('No pilot sign is linked to this account yet.');
                setEventsError(null);
                return;
            }

            const pilotDevice = devices[0];
            setDevice(pilotDevice);
            setDeviceError(null);

            try {
                const deviceEvents = await devicesAPI.getEvents(
                    pilotDevice.serial_number,
                    { timeout: HOME_SCREEN_REQUEST_TIMEOUT_MS },
                );
                setEvents(deviceEvents);
                setEventsError(null);
            } catch (error) {
                console.error('[HomeScreen] Failed to load pilot sign events:', error);
                setEvents([]);
                setEventsError('Recent request history is temporarily unavailable.');
            }
        } catch (error) {
            console.error('[HomeScreen] Failed to load pilot sign or events:', error);
            setDeviceError('Unable to load the pilot sign right now.');
            setEvents([]);
            setEventsError(null);
        } finally {
            setDeviceLoading(false);
            setEventsLoading(false);
            fetchInFlightRef.current = false;
            hasLoadedOnceRef.current = true;
        }
    }, [ensureFreshSession]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const interval = setInterval(() => {
            fetchData();
        }, POLL_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [fetchData]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    }, [fetchData]);

    const handleAcknowledgeRequest = useCallback(async () => {
        if (!device) return;

        setDeviceActionLoading(true);
        try {
            await ensureFreshSession();
            const updated = await devicesAPI.acknowledge(device.serial_number);
            setDevice(updated);
            const deviceEvents = await devicesAPI.getEvents(device.serial_number, { timeout: HOME_SCREEN_REQUEST_TIMEOUT_MS });
            setEvents(deviceEvents);
            setEventsError(null);
        } catch (error) {
            console.error('[HomeScreen] Failed to acknowledge request:', error);
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
            const deviceEvents = await devicesAPI.getEvents(device.serial_number, { timeout: HOME_SCREEN_REQUEST_TIMEOUT_MS });
            setEvents(deviceEvents);
            setEventsError(null);
        } catch (error) {
            console.error('[HomeScreen] Failed to resolve request:', error);
        } finally {
            setDeviceActionLoading(false);
        }
    }, [device, ensureFreshSession]);

    const handleLogout = useCallback(async () => {
        setMenuVisible(false);
        setIsLoggingOut(true);
        try {
            await logout();
        } finally {
            setIsLoggingOut(false);
        }
    }, [logout]);

    const handleOpenProvisioning = useCallback(() => {
        setMenuVisible(false);
        navigation.navigate('ProvisionSign');
    }, [navigation]);

    const status = useMemo(() => (device ? getPilotStatus(device) : null), [device]);
    const effectiveOperationalStatus = useMemo(() => {
        if (!device || isDeviceStale(device)) {
            return 'offline';
        }

        return device.operational_status;
    }, [device]);
    const recentRequestCount = events.filter((event) => event.event_type === 'assistance_requested').length;

    return (
        <View style={styles.root}>
            <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
                <View style={styles.headerInner}>
                    <View style={styles.headerCopy}>
                        <Text style={styles.headerEyebrow}>Pilot operator view</Text>
                        <Text style={styles.headerTitle}>Hi, {userName}</Text>
                        <Text style={styles.headerSubtitle}>Monitor one sign and handle requests quickly.</Text>
                    </View>
                    <Pressable
                        accessibilityLabel="Open account menu"
                        accessibilityRole="button"
                        onPress={() => setMenuVisible(true)}
                        style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
                    >
                        <Text style={styles.avatarText}>{userInitial}</Text>
                    </Pressable>
                </View>
            </View>

            <Modal
                animationType="fade"
                onRequestClose={() => setMenuVisible(false)}
                transparent
                visible={menuVisible}
            >
                <Pressable onPress={() => setMenuVisible(false)} style={styles.menuOverlay}>
                    <View style={[styles.menuSheet, { paddingTop: insets.top + spacing.sm }]}>
                        <Pressable onPress={() => undefined} style={styles.menuContent}>
                            <View style={styles.menuUserRow}>
                                <View style={styles.menuAvatar}>
                                    <Text style={styles.menuAvatarText}>{userInitial}</Text>
                                </View>
                                <View style={styles.menuUserCopy}>
                                    <Text numberOfLines={1} style={styles.menuUserName}>
                                        {user?.name || 'Pilot operator'}
                                    </Text>
                                    <Text numberOfLines={1} style={styles.menuUserEmail}>
                                        {user?.email}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.menuDivider} />

                            <Pressable
                                accessibilityRole="button"
                                onPress={handleOpenProvisioning}
                                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                            >
                                <Text style={styles.menuItemIcon}>⚙️</Text>
                                <Text style={styles.menuItemText}>Configure test sign</Text>
                            </Pressable>

                            <Pressable
                                accessibilityRole="button"
                                onPress={handleLogout}
                                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                            >
                                <Text style={styles.menuItemIcon}>↗</Text>
                                <Text style={styles.menuItemText}>
                                    {isLoggingOut ? 'Logging out…' : 'Log out'}
                                </Text>
                            </Pressable>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
                style={styles.scrollView}
            >
                <View style={styles.content}>
                    <View style={styles.card}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionEyebrow}>Pilot sign</Text>
                            {status ? (
                                <View style={[styles.statusPill, { backgroundColor: status.tone }]}>
                                    <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                                    <Text style={[styles.statusPillText, { color: status.color }]}>{status.label}</Text>
                                </View>
                            ) : null}
                        </View>

                        {deviceLoading ? (
                            <View style={styles.emptyState}>
                                <ActivityIndicator color={colors.primary} size="large" />
                                <Text style={styles.emptyTitle}>Loading pilot sign…</Text>
                            </View>
                        ) : deviceError || !device ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyIcon}>⚠️</Text>
                                <Text style={styles.emptyTitle}>Pilot sign unavailable</Text>
                                <Text style={styles.emptyBody}>{deviceError || 'No pilot sign found.'}</Text>
                            </View>
                        ) : (
                            <>
                                <Text style={styles.signName}>{device.name || 'Pilot sign'}</Text>
                                <Text style={styles.signMeta}>Serial {device.serial_number}</Text>
                                <Text style={styles.signMeta}>{formatLastSeen(device.last_seen_at)}</Text>

                                <View style={[styles.statusBanner, { backgroundColor: status?.tone ?? colors.offWhite }]}>
                                    <Text style={[styles.statusBannerText, { color: status?.color ?? colors.textPrimary }]}>
                                        {status?.label ?? 'Status unavailable'}
                                    </Text>
                                </View>

                                {effectiveOperationalStatus === 'assistance_requested' ? (
                                    <Pressable
                                        accessibilityLabel="Acknowledge assistance request"
                                        accessibilityRole="button"
                                        disabled={deviceActionLoading}
                                        onPress={handleAcknowledgeRequest}
                                        style={({ pressed }) => [
                                            styles.primaryAction,
                                            deviceActionLoading && styles.disabledAction,
                                            pressed && styles.pressed,
                                        ]}
                                    >
                                        {deviceActionLoading ? (
                                            <ActivityIndicator color={colors.white} size="small" />
                                        ) : (
                                            <Text style={styles.primaryActionText}>Acknowledge request</Text>
                                        )}
                                    </Pressable>
                                ) : null}

                                {effectiveOperationalStatus === 'assistance_in_progress' ? (
                                    <Pressable
                                        accessibilityLabel="Resolve assistance request"
                                        accessibilityRole="button"
                                        disabled={deviceActionLoading}
                                        onPress={handleResolveRequest}
                                        style={({ pressed }) => [
                                            styles.successAction,
                                            deviceActionLoading && styles.disabledAction,
                                            pressed && styles.pressed,
                                        ]}
                                    >
                                        {deviceActionLoading ? (
                                            <ActivityIndicator color={colors.white} size="small" />
                                        ) : (
                                            <Text style={styles.primaryActionText}>Mark resolved</Text>
                                        )}
                                    </Pressable>
                                ) : null}
                            </>
                        )}
                    </View>

                    <View style={styles.card}>
                        <View style={styles.sectionHeader}>
                            <View>
                                <Text style={styles.sectionEyebrow}>Request visibility</Text>
                                <Text style={styles.sectionTitle}>Recent request history</Text>
                            </View>
                            {recentRequestCount > 0 ? (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{recentRequestCount}</Text>
                                </View>
                            ) : null}
                        </View>

                        {eventsLoading ? (
                            <View style={styles.emptyState}>
                                <ActivityIndicator color={colors.primary} size="small" />
                                <Text style={styles.emptyTitle}>Loading recent requests…</Text>
                            </View>
                        ) : eventsError ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyIcon}>⚠️</Text>
                                <Text style={styles.emptyTitle}>History unavailable</Text>
                                <Text style={styles.emptyBody}>{eventsError}</Text>
                            </View>
                        ) : events.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyIcon}>🔔</Text>
                                <Text style={styles.emptyTitle}>No requests yet</Text>
                                <Text style={styles.emptyBody}>
                                    New assistance requests will appear here as soon as the pilot sign reports them.
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.notificationList}>
                                {events.map((event) => (
                                    <NotificationRow
                                        key={event.id}
                                        event={event}
                                        onPress={() => navigation.navigate('NotificationDetail', { event })}
                                    />
                                ))}
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

function NotificationRow({
    event,
    onPress,
}: {
    event: DeviceEvent;
    onPress: () => void;
}) {
    return (
        <Pressable
            accessibilityLabel={`Open request update: ${formatEventTitle(event)}`}
            accessibilityRole="button"
            onPress={onPress}
            style={({ pressed }) => [
                styles.notificationRow,
                pressed && styles.pressed,
            ]}
        >
            <View style={styles.notificationCopy}>
                <View style={styles.notificationHeader}>
                    <Text numberOfLines={1} style={styles.notificationTitle}>
                        {formatEventTitle(event)}
                    </Text>
                    <Text style={styles.notificationTime}>{formatRelativeTime(event.created_at)}</Text>
                </View>
                <Text numberOfLines={2} style={styles.notificationBody}>
                    {formatEventBody(event)}
                </Text>
            </View>
        </Pressable>
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
        alignItems: 'center',
        alignSelf: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        maxWidth: layout.maxWidth,
        width: '100%',
    },
    headerCopy: {
        flex: 1,
        paddingRight: spacing.md,
    },
    headerEyebrow: {
        ...typography.label,
        color: colors.primary,
        marginBottom: spacing.xs,
        textTransform: 'uppercase',
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
        alignItems: 'center',
        backgroundColor: colors.ctaPrimary,
        borderRadius: 18,
        height: 36,
        justifyContent: 'center',
        width: 36,
    },
    avatarText: {
        color: colors.white,
        fontWeight: '700',
    },
    menuOverlay: {
        backgroundColor: 'rgba(0,0,0,0.35)',
        flex: 1,
        justifyContent: 'flex-start',
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
        width: '100%',
    },
    menuUserRow: {
        alignItems: 'center',
        flexDirection: 'row',
        paddingVertical: spacing.lg,
    },
    menuAvatar: {
        alignItems: 'center',
        backgroundColor: colors.ctaPrimary,
        borderRadius: 24,
        height: 48,
        justifyContent: 'center',
        width: 48,
    },
    menuAvatarText: {
        color: colors.white,
        fontSize: 20,
        fontWeight: '700',
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
        alignItems: 'center',
        borderRadius: layout.borderRadiusSm,
        flexDirection: 'row',
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
        alignSelf: 'center',
        gap: spacing.lg,
        maxWidth: 720,
        width: '100%',
    },
    card: {
        backgroundColor: colors.card,
        borderRadius: layout.borderRadiusMd,
        padding: spacing.xl,
        ...shadows.card,
    },
    sectionHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.lg,
    },
    sectionEyebrow: {
        ...typography.label,
        color: colors.textSecondary,
        textTransform: 'uppercase',
    },
    sectionTitle: {
        ...typography.h4,
        color: colors.textPrimary,
        marginTop: spacing.xs,
    },
    signName: {
        ...typography.h2,
        color: colors.textPrimary,
    },
    signMeta: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    statusPill: {
        alignItems: 'center',
        borderRadius: layout.borderRadiusPill,
        flexDirection: 'row',
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: spacing.xs,
    },
    statusPillText: {
        ...typography.bodySmall,
        fontWeight: '600',
    },
    statusDot: {
        borderRadius: 4,
        height: 8,
        marginRight: spacing.xs,
        width: 8,
    },
    statusBanner: {
        borderRadius: layout.borderRadiusMd,
        marginTop: spacing.lg,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
    },
    statusBannerText: {
        ...typography.h3,
        textAlign: 'center',
    },
    primaryAction: {
        alignItems: 'center',
        backgroundColor: colors.warning,
        borderRadius: layout.borderRadiusPill,
        marginTop: spacing.lg,
        paddingHorizontal: spacing.lg,
        paddingVertical: 14,
    },
    successAction: {
        alignItems: 'center',
        backgroundColor: '#34C759',
        borderRadius: layout.borderRadiusPill,
        marginTop: spacing.lg,
        paddingHorizontal: spacing.lg,
        paddingVertical: 14,
    },
    primaryActionText: {
        ...typography.button,
        color: colors.white,
    },
    disabledAction: {
        opacity: 0.6,
    },
    emptyState: {
        alignItems: 'center',
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
        textAlign: 'center',
    },
    emptyBody: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        marginTop: spacing.xs,
        textAlign: 'center',
    },
    badge: {
        alignItems: 'center',
        backgroundColor: colors.primary,
        borderRadius: 999,
        justifyContent: 'center',
        minWidth: 24,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    badgeText: {
        ...typography.bodySmall,
        color: colors.white,
        fontWeight: '700',
    },
    notificationList: {
        gap: spacing.md,
    },
    notificationRow: {
        borderColor: colors.divider,
        borderRadius: layout.borderRadiusMd,
        borderWidth: StyleSheet.hairlineWidth,
        padding: spacing.md,
    },
    notificationRowRead: {
        backgroundColor: colors.offWhite,
    },
    notificationCopy: {
        flex: 1,
    },
    notificationHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    notificationTitle: {
        ...typography.body,
        color: colors.textPrimary,
        flex: 1,
        fontWeight: '700',
        marginRight: spacing.sm,
    },
    notificationTime: {
        ...typography.small,
        color: colors.textMuted,
    },
    notificationBody: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    inlineAction: {
        alignSelf: 'flex-start',
        marginTop: spacing.sm,
    },
    inlineActionText: {
        ...typography.bodySmall,
        color: colors.primary,
        fontWeight: '600',
    },
    pressed: {
        opacity: 0.82,
    },
});
