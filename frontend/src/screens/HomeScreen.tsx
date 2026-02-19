import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    Pressable,
    StyleSheet,
    Linking,
    ActivityIndicator,
    Platform,
    RefreshControl,
} from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { signAPI, notificationAPI } from '@/api/api';
import { Sign, SignNotification, SignStatus } from '@/types/types';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, layout } from '@/theme/spacing';

/* ──────────────────────────────────────────────
 * Mock data (used until backend endpoints exist)
 * ────────────────────────────────────────────── */

const MOCK_SIGN: Sign = {
    id: '1',
    name: 'Parking Sign A-1',
    location: 'Main Entrance — Lot A, Space 1',
    status: 'available',
    lastUpdated: new Date().toISOString(),
    batteryLevel: 87,
    signalStrength: 92,
};

const MOCK_NOTIFICATIONS: SignNotification[] = [
    {
        id: '1',
        signId: '1',
        type: 'status_change',
        title: 'Space Now Available',
        message: 'Parking space A-1 is now available.',
        timestamp: new Date(Date.now() - 5 * 60_000).toISOString(),
        acknowledged: false,
    },
    {
        id: '2',
        signId: '1',
        type: 'misuse',
        title: 'Potential Misuse Detected',
        message: 'Unauthorized vehicle detected in space A-1 without a valid permit.',
        timestamp: new Date(Date.now() - 25 * 60_000).toISOString(),
        acknowledged: false,
    },
    {
        id: '3',
        signId: '1',
        type: 'maintenance',
        title: 'Battery Low Warning',
        message: 'Sign battery is below 20%. Schedule maintenance soon.',
        timestamp: new Date(Date.now() - 2 * 3_600_000).toISOString(),
        acknowledged: true,
    },
    {
        id: '4',
        signId: '1',
        type: 'status_change',
        title: 'Space Occupied',
        message: 'Parking space A-1 is now occupied.',
        timestamp: new Date(Date.now() - 5 * 3_600_000).toISOString(),
        acknowledged: true,
    },
];

/* ──────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────── */

const STATUS_CONFIG: Record<SignStatus, { color: string; label: string; icon: string }> = {
    available: { color: '#16A34A', label: 'Available', icon: '🟢' },
    occupied: { color: '#DC2626', label: 'Occupied', icon: '🔴' },
    offline: { color: colors.grayDark, label: 'Offline', icon: '⚪' },
    error: { color: '#F59E0B', label: 'Error', icon: '🟡' },
};

const NOTIF_ICONS: Record<string, string> = {
    status_change: '🔄',
    alert: '⚠️',
    maintenance: '🔧',
    misuse: '🚨',
};

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

/* ──────────────────────────────────────────────
 * Component
 * ────────────────────────────────────────────── */

export default function HomeScreen() {
    const { user, logout } = useAuthStore();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Sign state
    const [sign, setSign] = useState<Sign>(MOCK_SIGN);
    const [signLoading, setSignLoading] = useState(false);

    // Notifications state
    const [notifications, setNotifications] = useState<SignNotification[]>(MOCK_NOTIFICATIONS);

    /* ── Data fetching ── */

    const fetchData = useCallback(async () => {
        try {
            // Uncomment when backend endpoints are ready:
            // const [signData, notifData] = await Promise.all([
            //     signAPI.getMySign(),
            //     notificationAPI.getNotifications(),
            // ]);
            // setSign(signData);
            // setNotifications(notifData);
        } catch (err) {
            console.error('[HomeScreen] Failed to fetch data:', err);
        }
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    }, [fetchData]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    /* ── Actions ── */

    const handleLogout = useCallback(async () => {
        setIsLoggingOut(true);
        try {
            const logoutUrl = await logout();
            if (logoutUrl) await Linking.openURL(logoutUrl);
        } catch (error) {
            console.error('[HomeScreen] Logout error:', error);
        } finally {
            setIsLoggingOut(false);
        }
    }, [logout]);

    const handleAcknowledge = useCallback(async (notifId: string) => {
        // Optimistic update
        setNotifications((prev) =>
            prev.map((n) => (n.id === notifId ? { ...n, acknowledged: true } : n)),
        );
        try {
            // await notificationAPI.acknowledgeNotification(notifId);
        } catch {
            // Revert on failure
            setNotifications((prev) =>
                prev.map((n) => (n.id === notifId ? { ...n, acknowledged: false } : n)),
            );
        }
    }, []);

    const handleAcknowledgeAll = useCallback(async () => {
        const unacked = notifications.filter((n) => !n.acknowledged).map((n) => n.id);
        // Optimistic update
        setNotifications((prev) => prev.map((n) => ({ ...n, acknowledged: true })));
        try {
            // await notificationAPI.acknowledgeAll();
        } catch {
            setNotifications((prev) =>
                prev.map((n) => (unacked.includes(n.id) ? { ...n, acknowledged: false } : n)),
            );
        }
    }, [notifications]);

    /* ── Derived ── */

    const statusConfig = STATUS_CONFIG[sign.status];
    const unacknowledgedCount = notifications.filter((n) => !n.acknowledged).length;

    return (
        <View style={s.root}>
            {/* ── Header ── */}
            <View style={s.header}>
                <View style={s.headerInner}>
                    <View>
                        <Text style={[typography.label, { color: colors.accent }]}>SMART HANDICAP SIGN</Text>
                        <Text style={[typography.h4, { color: colors.heroText, marginTop: 2 }]}>
                            {user ? `Hi, ${user.name?.split(' ')[0] || user.email}` : 'Dashboard'}
                        </Text>
                    </View>
                    <Pressable
                        onPress={handleLogout}
                        disabled={isLoggingOut}
                        style={({ pressed }) => [s.logoutBtn, pressed && { opacity: 0.7 }]}
                        accessibilityRole="button"
                        accessibilityLabel="Log out"
                    >
                        {isLoggingOut ? (
                            <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                            <Text style={[typography.bodySmall, { color: colors.white }]}>Log Out</Text>
                        )}
                    </Pressable>
                </View>
            </View>

            <ScrollView
                style={s.scrollView}
                contentContainerStyle={s.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
                <View style={s.content}>
                    {/* ── Sign Status Card ── */}
                    <View style={s.card}>
                        <View style={s.cardHeader}>
                            <Text style={[typography.h3, { color: colors.textPrimary }]}>Your Sign</Text>
                            <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                                Updated {timeAgo(sign.lastUpdated)}
                            </Text>
                        </View>

                        {/* Big status indicator */}
                        <View style={[s.statusBanner, { backgroundColor: statusConfig.color + '12' }]}>
                            <View style={s.statusIconRow}>
                                <View style={[s.statusDot, { backgroundColor: statusConfig.color }]} />
                                <Text style={[typography.h2, { color: statusConfig.color }]}>
                                    {statusConfig.label}
                                </Text>
                            </View>
                            <Text style={{ fontSize: 56, marginTop: spacing.sm }}>♿</Text>
                        </View>

                        {/* Sign details */}
                        <View style={s.detailsGrid}>
                            <DetailRow label="Sign Name" value={sign.name} />
                            <DetailRow label="Location" value={sign.location} />
                            <DetailRow label="Battery" value={`${sign.batteryLevel}%`}
                                valueColor={sign.batteryLevel < 20 ? '#DC2626' : colors.textPrimary} />
                            <DetailRow label="Signal" value={`${sign.signalStrength}%`}
                                valueColor={sign.signalStrength < 30 ? '#F59E0B' : colors.textPrimary} />
                        </View>
                    </View>

                    {/* ── Notifications ── */}
                    <View style={s.card}>
                        <View style={s.cardHeader}>
                            <View style={s.notifHeaderLeft}>
                                <Text style={[typography.h3, { color: colors.textPrimary }]}>Notifications</Text>
                                {unacknowledgedCount > 0 && (
                                    <View style={s.badge}>
                                        <Text style={[typography.bodySmall, { color: colors.white, fontWeight: '700' }]}>
                                            {unacknowledgedCount}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            {unacknowledgedCount > 0 && (
                                <Pressable
                                    onPress={handleAcknowledgeAll}
                                    style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                                    accessibilityRole="button"
                                    accessibilityLabel="Acknowledge all notifications"
                                >
                                    <Text style={[typography.bodySmall, { color: colors.accent, fontWeight: '600' }]}>
                                        Acknowledge All
                                    </Text>
                                </Pressable>
                            )}
                        </View>

                        {notifications.length === 0 ? (
                            <View style={s.emptyState}>
                                <Text style={{ fontSize: 32 }}>🔔</Text>
                                <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>
                                    No notifications yet
                                </Text>
                            </View>
                        ) : (
                            <View style={s.notifList}>
                                {notifications.map((notif) => (
                                    <NotificationRow
                                        key={notif.id}
                                        notification={notif}
                                        onAcknowledge={handleAcknowledge}
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

/* ──────────────────────────────────────────────
 * Sub-components
 * ────────────────────────────────────────────── */

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
    return (
        <View style={s.detailRow}>
            <Text style={[typography.bodySmall, { color: colors.textMuted }]}>{label}</Text>
            <Text style={[typography.body, { color: valueColor || colors.textPrimary, fontWeight: '600' }]}>
                {value}
            </Text>
        </View>
    );
}

function NotificationRow({
    notification,
    onAcknowledge,
}: {
    notification: SignNotification;
    onAcknowledge: (id: string) => void;
}) {
    const icon = NOTIF_ICONS[notification.type] || '🔔';
    return (
        <View style={[s.notifRow, notification.acknowledged && s.notifRowAcked]}>
            <Text style={{ fontSize: 22, marginRight: spacing.md }}>{icon}</Text>
            <View style={s.notifBody}>
                <View style={s.notifTitleRow}>
                    <Text
                        style={[
                            typography.body,
                            { fontWeight: '600', color: colors.textPrimary, flex: 1 },
                            notification.acknowledged && { color: colors.textMuted },
                        ]}
                        numberOfLines={1}
                    >
                        {notification.title}
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textMuted, marginLeft: spacing.sm }]}>
                        {timeAgo(notification.timestamp)}
                    </Text>
                </View>
                <Text
                    style={[
                        typography.bodySmall,
                        { color: colors.textSecondary, marginTop: 2 },
                        notification.acknowledged && { color: colors.textMuted },
                    ]}
                    numberOfLines={2}
                >
                    {notification.message}
                </Text>
                {!notification.acknowledged && (
                    <Pressable
                        onPress={() => onAcknowledge(notification.id)}
                        style={({ pressed }) => [s.ackBtn, pressed && { opacity: 0.7 }]}
                        accessibilityRole="button"
                        accessibilityLabel={`Acknowledge: ${notification.title}`}
                    >
                        <Text style={[typography.bodySmall, { color: colors.accent, fontWeight: '600' }]}>
                            Acknowledge
                        </Text>
                    </Pressable>
                )}
            </View>
        </View>
    );
}

/* ──────────────────────────────────────────────
 * Styles
 * ────────────────────────────────────────────── */

const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: colors.grayLight,
    },

    /* Header */
    header: {
        backgroundColor: colors.primary,
        paddingTop: Platform.OS === 'web' ? spacing.lg : 56,
        paddingBottom: spacing.lg,
        paddingHorizontal: layout.contentPadding,
    },
    headerInner: {
        maxWidth: layout.maxWidth,
        width: '100%',
        alignSelf: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    logoutBtn: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: layout.borderRadiusSm,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
    },

    /* Scroll */
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingVertical: spacing.xl,
        paddingHorizontal: layout.contentPadding,
    },
    content: {
        maxWidth: 640,
        width: '100%',
        alignSelf: 'center',
        gap: spacing.lg,
    },

    /* Card */
    card: {
        backgroundColor: colors.white,
        borderRadius: layout.borderRadius,
        padding: spacing.xl,
        ...Platform.select({
            web: { boxShadow: `0 1px 8px ${colors.shadow}` },
            default: { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 },
        }),
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },

    /* Status banner */
    statusBanner: {
        borderRadius: layout.borderRadius,
        padding: spacing.xl,
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    statusIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    statusDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
    },

    /* Details grid */
    detailsGrid: {
        gap: spacing.md,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
    },

    /* Notifications */
    notifHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    badge: {
        backgroundColor: '#DC2626',
        borderRadius: 10,
        minWidth: 22,
        height: 22,
        paddingHorizontal: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    notifList: {
        gap: spacing.sm,
    },
    notifRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: spacing.md,
        borderRadius: layout.borderRadiusSm,
        backgroundColor: colors.offWhite,
        borderLeftWidth: 3,
        borderLeftColor: colors.accent,
    },
    notifRowAcked: {
        borderLeftColor: colors.grayMid,
        opacity: 0.7,
    },
    notifBody: {
        flex: 1,
    },
    notifTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ackBtn: {
        marginTop: spacing.sm,
        alignSelf: 'flex-start',
        paddingVertical: 4,
        paddingHorizontal: spacing.sm,
        borderRadius: 4,
        backgroundColor: colors.accent + '14',
    },

    /* Empty */
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
});
