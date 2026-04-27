import React, { useEffect, useRef, useState, useCallback } from 'react';
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
    Modal,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '@/store/authStore';
import { signAPI, notificationAPI } from '@/api/api';
import { Sign, SignNotification, SignStatus } from '@/types/types';
import { RootStackParamList } from '@/types/navigation';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, layout, shadows } from '@/theme/spacing';

/* ──────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────── */

const POLL_INTERVAL_MS = 30_000; // 30 seconds

/* ──────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────── */

const STATUS_CONFIG: Record<SignStatus, { color: string; label: string; icon: string }> = {
    available: { color: '#34C759', label: 'Available', icon: '🟢' },
    assistance_requested: { color: '#FF3B30', label: 'Assistance Requested', icon: '🔴' },
    assistance_in_progress: { color: '#FF9500', label: 'Assistance In Progress', icon: '🟡' },
    offline: { color: '#8E8E93', label: 'Offline', icon: '⚪' },
    error: { color: '#FF9500', label: 'Error', icon: '🟡' },
    training_ready: { color: '#AF52DE', label: 'Training Ready', icon: '🟣' },
    training_positive: { color: '#007AFF', label: 'Training – Positive', icon: '🔵' },
    training_negative: { color: '#FF6B35', label: 'Training – Negative', icon: '🟠' },
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
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const insets = useSafeAreaInsets();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);

    // Sign state
    const [sign, setSign] = useState<Sign | null>(null);
    const [signLoading, setSignLoading] = useState(true);
    const [signError, setSignError] = useState<string | null>(null);

    // Notifications state
    const [notifications, setNotifications] = useState<SignNotification[]>([]);
    const [notifLoading, setNotifLoading] = useState(true);
    const lastPollTime = useRef<string | null>(null);

    /* ── Data fetching ── */

    const refreshSign = useCallback(async () => {
        try {
            const signs = await signAPI.getSigns();
            if (signs.length > 0) {
                const raw = signs[0];
                setSign({
                    ...raw,
                    lastUpdated: raw.last_updated || raw.lastUpdated,
                });
            }
        } catch (err) {
            console.error('[HomeScreen] Failed to refresh sign:', err);
        }
    }, []);

    const fetchNotifications = useCallback(async (isPolling = false) => {
        try {
            if (isPolling && lastPollTime.current) {
                // Only fetch notifications created after the last poll
                const newNotifs = await notificationAPI.getNotifications({ after: lastPollTime.current });
                if (newNotifs.length > 0) {
                    setNotifications((prev) => {
                        const existingIds = new Set(prev.map((n) => n.id));
                        const unique = newNotifs.filter((n) => !existingIds.has(n.id));
                        return unique.length > 0 ? [...unique, ...prev] : prev;
                    });
                    lastPollTime.current = new Date().toISOString();

                    // New notifications likely mean a sign status changed — re-fetch
                    await refreshSign();
                }
            } else {
                // Full fetch
                const allNotifs = await notificationAPI.getNotifications();
                setNotifications(allNotifs);
                lastPollTime.current = new Date().toISOString();
            }
        } catch (err) {
            console.error('[HomeScreen] Failed to fetch notifications:', err);
        } finally {
            if (!isPolling) setNotifLoading(false);
        }
    }, [refreshSign]);

    const fetchData = useCallback(async () => {
        setSignLoading(true);
        setSignError(null);
        try {
            const signs = await signAPI.getSigns();
            if (signs.length > 0) {
                const raw = signs[0];
                setSign({
                    ...raw,
                    lastUpdated: raw.last_updated || raw.lastUpdated,
                });
            } else {
                setSignError('No signs found.');
            }
        } catch (err) {
            console.error('[HomeScreen] Failed to fetch data:', err);
            setSignError('Failed to load sign data.');
        } finally {
            setSignLoading(false);
        }

        await fetchNotifications();
    }, [fetchNotifications]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    }, [fetchData]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Polling cycle for notifications
    useEffect(() => {
        const interval = setInterval(() => {
            fetchNotifications(true);
        }, POLL_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [fetchNotifications]);

    /* ── Actions ── */

    const handleAcknowledge = useCallback(async (notifId: string) => {
        // Optimistic update
        setNotifications((prev) =>
            prev.map((n) => (n.id === notifId ? { ...n, read: true } : n)),
        );
        try {
            await notificationAPI.markAsRead(notifId);
        } catch {
            // Revert on failure
            setNotifications((prev) =>
                prev.map((n) => (n.id === notifId ? { ...n, read: false } : n)),
            );
        }
    }, []);

    const handleAcknowledgeAll = useCallback(async () => {
        const unread = notifications.filter((n) => !n.read).map((n) => n.id);
        // Optimistic update
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        try {
            await notificationAPI.markAllAsRead();
        } catch {
            setNotifications((prev) =>
                prev.map((n) => (unread.includes(n.id) ? { ...n, read: false } : n)),
            );
        }
    }, [notifications]);

    const [signActionLoading, setSignActionLoading] = useState(false);

    const handleAcknowledgeSign = useCallback(async () => {
        if (!sign) return;
        setSignActionLoading(true);
        try {
            const updated = await signAPI.acknowledgeSign(sign.id);
            setSign({
                ...updated,
                lastUpdated: updated.last_updated || updated.lastUpdated,
            });
        } catch (err) {
            console.error('[HomeScreen] Failed to acknowledge sign:', err);
        } finally {
            setSignActionLoading(false);
        }
    }, [sign]);

    const handleResolveSign = useCallback(async () => {
        if (!sign) return;
        setSignActionLoading(true);
        try {
            const updated = await signAPI.resolveSign(sign.id);
            setSign({
                ...updated,
                lastUpdated: updated.last_updated || updated.lastUpdated,
            });
        } catch (err) {
            console.error('[HomeScreen] Failed to resolve sign:', err);
        } finally {
            setSignActionLoading(false);
        }
    }, [sign]);

    /* ── Derived ── */

    const statusConfig = sign ? STATUS_CONFIG[sign.status] : null;
    const unacknowledgedCount = notifications.filter((n) => !n.read).length;

    const userInitial = user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?';

    const handleDeleteAccount = useCallback(() => {
        Alert.alert(
            'Delete Account',
            'Are you sure you want to permanently delete your account? This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // await apiClient.delete('/auth/account');
                            await logout();
                        } catch (err) {
                            console.error('[HomeScreen] Delete account error:', err);
                        }
                    },
                },
            ],
        );
    }, [logout]);

    return (
        <View style={s.root}>
            {/* ── Header ── */}
            <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
                <View style={s.headerInner}>
                    <Text style={[typography.h4, { color: colors.textPrimary }]}>
                        {user ? `Hi, ${user.name?.split(' ')[0] || user.email}` : 'Dashboard'}
                    </Text>
                    <Pressable
                        onPress={() => setMenuVisible(true)}
                        style={({ pressed }) => [s.avatar, pressed && { opacity: 0.7 }]}
                        accessibilityRole="button"
                        accessibilityLabel="Open menu"
                    >
                        <Text style={s.avatarText}>{userInitial}</Text>
                    </Pressable>
                </View>
            </View>

            {/* ── Menu Modal ── */}
            <Modal
                visible={menuVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setMenuVisible(false)}
            >
                <Pressable style={s.menuOverlay} onPress={() => setMenuVisible(false)}>
                    <View style={[s.menuSheet, { paddingTop: insets.top + spacing.sm }]}>
                        <Pressable onPress={() => {}} style={{ width: '100%' }}>
                            {/* User info */}
                            <View style={s.menuUserRow}>
                                <View style={s.avatarLarge}>
                                    <Text style={s.avatarLargeText}>{userInitial}</Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: spacing.md }}>
                                    <Text style={[typography.h4, { color: colors.textPrimary }]} numberOfLines={1}>
                                        {user?.name || 'User'}
                                    </Text>
                                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]} numberOfLines={1}>
                                        {user?.email}
                                    </Text>
                                </View>
                            </View>

                            <View style={s.menuDivider} />

                            {/* Menu items */}
                            {Platform.OS !== 'web' && (
                                <MenuItem
                                    icon="➕"
                                    label="Add Sign"
                                    onPress={() => { setMenuVisible(false); navigation.navigate('SetupGuide'); }}
                                />
                            )}
                            <MenuItem
                                icon="🏢"
                                label="Organizations"
                                onPress={() => { setMenuVisible(false); navigation.navigate('Organizations'); }}
                            />
                            <MenuItem
                                icon="💬"
                                label="Send Feedback"
                                onPress={() => { setMenuVisible(false); navigation.navigate('Feedback'); }}
                            />

                            <View style={s.menuDivider} />

                            <MenuItem
                                icon="🚪"
                                label={isLoggingOut ? 'Logging out…' : 'Log Out'}
                                onPress={async () => {
                                    setMenuVisible(false);
                                    setIsLoggingOut(true);
                                    try { await logout(); } catch {} finally { setIsLoggingOut(false); }
                                }}
                            />
                            <MenuItem
                                icon="🗑️"
                                label="Delete Account"
                                destructive
                                onPress={() => { setMenuVisible(false); handleDeleteAccount(); }}
                            />

                            <View style={{ height: spacing.lg }} />

                            <Pressable
                                onPress={() => setMenuVisible(false)}
                                style={({ pressed }) => [s.menuCloseBtn, pressed && { opacity: 0.7 }]}
                            >
                                <Text style={[typography.button, { color: colors.textSecondary }]}>Close</Text>
                            </Pressable>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>

            <ScrollView
                style={s.scrollView}
                contentContainerStyle={s.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
                <View style={s.content}>
                    {/* ── Sign Status Card ── */}
                    <View style={s.card}>
                        {signLoading ? (
                            <View style={s.emptyState}>
                                <ActivityIndicator size="large" color={colors.primary} />
                                <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>
                                    Loading sign data…
                                </Text>
                            </View>
                        ) : signError || !sign || !statusConfig ? (
                            <View style={s.emptyState}>
                                <View style={s.infoIcon}>
                                    <Text style={s.infoIconText}>i</Text>
                                </View>
                                <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
                                    No signs linked to your account yet.
                                </Text>
                                <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' }]}>
                                    {Platform.OS === 'web'
                                        ? 'Open the mobile app to connect a new sign.'
                                        : 'Connect your SmartSign to get started.'}
                                </Text>
                                {Platform.OS !== 'web' && (
                                    <Pressable
                                        onPress={() => navigation.navigate('SetupGuide')}
                                        style={({ pressed }) => [s.guideBtn, pressed && { opacity: 0.8 }]}
                                        accessibilityRole="button"
                                        accessibilityLabel="Show setup guide"
                                    >
                                        <Text style={[typography.button, { color: colors.ctaPrimaryText }]}>Show me how</Text>
                                    </Pressable>
                                )}
                            </View>
                        ) : (
                            <Pressable
                                onPress={() => navigation.navigate('SignDetail', { sign })}
                                style={({ pressed }) => [pressed && { opacity: 0.85 }]}
                                accessibilityRole="button"
                                accessibilityLabel={`View details for ${sign.name}`}
                            >
                                <View style={{ marginBottom: spacing.md }}>
                                    <Text style={[typography.h3, { color: colors.textPrimary }]}>{sign.name}</Text>
                                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                                        {sign.location}
                                    </Text>
                                    <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2 }]}>
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
                                </View>

                                {/* ── Sign action buttons ── */}
                                {sign.status === 'assistance_requested' && (
                                    <Pressable
                                        onPress={(e) => { e.stopPropagation(); handleAcknowledgeSign(); }}
                                        disabled={signActionLoading}
                                        style={({ pressed }) => [
                                            s.signActionBtn,
                                            { backgroundColor: '#FF9500' },
                                            signActionLoading && { opacity: 0.5 },
                                            pressed && { opacity: 0.8 },
                                        ]}
                                        accessibilityRole="button"
                                        accessibilityLabel="Acknowledge assistance request"
                                    >
                                        {signActionLoading ? (
                                            <ActivityIndicator size="small" color={colors.white} />
                                        ) : (
                                            <Text style={[typography.button, { color: colors.white }]}>
                                                🙋  Acknowledge Request
                                            </Text>
                                        )}
                                    </Pressable>
                                )}
                                {sign.status === 'assistance_in_progress' && (
                                    <Pressable
                                        onPress={(e) => { e.stopPropagation(); handleResolveSign(); }}
                                        disabled={signActionLoading}
                                        style={({ pressed }) => [
                                            s.signActionBtn,
                                            { backgroundColor: '#34C759' },
                                            signActionLoading && { opacity: 0.5 },
                                            pressed && { opacity: 0.8 },
                                        ]}
                                        accessibilityRole="button"
                                        accessibilityLabel="Mark assistance as resolved"
                                    >
                                        {signActionLoading ? (
                                            <ActivityIndicator size="small" color={colors.white} />
                                        ) : (
                                            <Text style={[typography.button, { color: colors.white }]}>
                                                ✅  Mark Resolved
                                            </Text>
                                        )}
                                    </Pressable>
                                )}
                            </Pressable>
                        )}
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
                                    <Text style={[typography.bodySmall, { color: colors.primary, fontWeight: '700' }]}>
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

function MenuItem({ icon, label, onPress, destructive }: { icon: string; label: string; onPress: () => void; destructive?: boolean }) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [s.menuItem, pressed && { backgroundColor: colors.offWhite }]}
            accessibilityRole="button"
        >
            <Text style={{ fontSize: 18, marginRight: spacing.md }}>{icon}</Text>
            <Text style={[typography.body, { color: destructive ? colors.negative : colors.textPrimary }]}>
                {label}
            </Text>
        </Pressable>
    );
}

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
    return (
        <View style={s.detailRow}>
            <Text style={[typography.bodySmall, { color: colors.textMuted }]}>{label}</Text>
            <Text style={[typography.body, { color: valueColor || colors.textPrimary, fontWeight: '700' }]}>
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
    return (
        <View style={[s.notifRow, notification.read && s.notifRowAcked]}>
            <Text style={{ fontSize: 22, marginRight: spacing.md }}>🔔</Text>
            <View style={s.notifBody}>
                <View style={s.notifTitleRow}>
                    <Text
                        style={[
                            typography.body,
                            { fontWeight: '700', color: colors.textPrimary, flex: 1 },
                            notification.read && { color: colors.textMuted },
                        ]}
                        numberOfLines={1}
                    >
                        {notification.title}
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textMuted, marginLeft: spacing.sm }]}>
                        {timeAgo(notification.created_at)}
                    </Text>
                </View>
                <Text
                    style={[
                        typography.bodySmall,
                        { color: colors.textSecondary, marginTop: 2 },
                        notification.read && { color: colors.textMuted },
                    ]}
                    numberOfLines={2}
                >
                    {notification.body}
                </Text>
                {!notification.read && (
                    <Pressable
                        onPress={() => onAcknowledge(notification.id)}
                        style={({ pressed }) => [s.ackBtn, pressed && { opacity: 0.7 }]}
                        accessibilityRole="button"
                        accessibilityLabel={`Acknowledge: ${notification.title}`}
                    >
                        <Text style={[typography.bodySmall, { color: colors.primary, fontWeight: '700' }]}>
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
        backgroundColor: colors.offWhite,
    },

    /* Header – light surface with subtle bottom border */
    header: {
        backgroundColor: colors.white,
        paddingBottom: spacing.sm,
        paddingHorizontal: layout.contentPadding,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.divider,
    },
    headerInner: {
        maxWidth: layout.maxWidth,
        width: '100%',
        alignSelf: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.ctaPrimary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: colors.white,
        fontSize: 16,
        fontWeight: '700',
    },

    /* Menu modal */
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'flex-start',
    },
    menuSheet: {
        backgroundColor: colors.white,
        paddingHorizontal: layout.contentPadding,
        paddingBottom: spacing.xl,
        borderBottomLeftRadius: layout.borderRadiusXl,
        borderBottomRightRadius: layout.borderRadiusXl,
        ...shadows.elevated,
    },
    menuUserRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.lg,
    },
    avatarLarge: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.ctaPrimary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarLargeText: {
        color: colors.white,
        fontSize: 22,
        fontWeight: '700',
    },
    menuDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.divider,
        marginVertical: spacing.xs,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: spacing.sm,
        borderRadius: layout.borderRadiusSm,
    },
    menuCloseBtn: {
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: layout.borderRadiusPill,
        backgroundColor: colors.offWhite,
    },

    /* Setup guide CTA */
    guideBtn: {
        marginTop: spacing.lg,
        paddingVertical: 12,
        paddingHorizontal: spacing.xl,
        borderRadius: layout.borderRadiusPill,
        backgroundColor: colors.ctaPrimary,
        alignSelf: 'center',
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

    /* Card – white surface, subtle shadow, rounded 16px */
    card: {
        backgroundColor: colors.card,
        borderRadius: layout.borderRadiusMd,
        padding: spacing.xl,
        ...Platform.select({
            web: { boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
            default: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
                elevation: 3,
            },
        }),
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },

    /* Status banner – tinted background, rounded */
    statusBanner: {
        borderRadius: layout.borderRadius,
        padding: spacing.xl,
        alignItems: 'center',
    },
    statusIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    statusDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
    },

    /* Details grid */
    detailsGrid: {
        gap: spacing.md,
    },

    /* Sign action buttons – capsule shape */
    signActionBtn: {
        marginTop: spacing.md,
        paddingVertical: 14,
        borderRadius: layout.borderRadiusPill,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
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
        backgroundColor: '#FF3B30',
        borderRadius: layout.borderRadiusCircle,
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
        borderRadius: layout.borderRadius,
        backgroundColor: colors.offWhite,
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
    },
    notifRowAcked: {
        borderLeftColor: colors.divider,
        opacity: 0.6,
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
        borderRadius: layout.borderRadiusPill,
        backgroundColor: 'rgba(0,113,227,0.10)',
    },

    /* Empty */
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    infoIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,113,227,0.10)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoIconText: {
        fontSize: 18,
        fontWeight: '700' as const,
        fontStyle: 'italic' as const,
        color: colors.primary,
    },
});
