import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TextInput,
    Pressable,
    StyleSheet,
    Linking,
    ActivityIndicator,
    Platform,
    RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '@/store/authStore';
import { signAPI, notificationAPI } from '@/api/api';
import { Sign, SignNotification, SignStatus } from '@/types/types';
import { RootStackParamList } from '@/types/navigation';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, layout } from '@/theme/spacing';

/* ──────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────── */

const POLL_INTERVAL_MS = 30_000; // 30 seconds

/* ──────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────── */

const STATUS_CONFIG: Record<SignStatus, { color: string; label: string; icon: string }> = {
    available: { color: '#16A34A', label: 'Available', icon: '🟢' },
    assistance_requested: { color: '#DC2626', label: 'Assistance Requested', icon: '🔴' },
    assistance_in_progress: { color: '#F59E0B', label: 'Assistance In Progress', icon: '🟡' },
    offline: { color: colors.grayDark, label: 'Offline', icon: '⚪' },
    error: { color: '#F59E0B', label: 'Error', icon: '🟡' },
    training_ready: { color: '#8B5CF6', label: 'Training Ready', icon: '🟣' },
    training_positive: { color: '#2563EB', label: 'Training – Positive', icon: '🔵' },
    training_negative: { color: '#EA580C', label: 'Training – Negative', icon: '🟠' },
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
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Sign state
    const [sign, setSign] = useState<Sign | null>(null);
    const [signLoading, setSignLoading] = useState(true);
    const [signError, setSignError] = useState<string | null>(null);

    // Notifications state
    const [notifications, setNotifications] = useState<SignNotification[]>([]);
    const [notifLoading, setNotifLoading] = useState(true);
    const lastPollTime = useRef<string | null>(null);

    // Feedback state
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
    const [feedbackLoading, setFeedbackLoading] = useState(false);

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

    const handleSubmitFeedback = useCallback(async () => {
        if (!feedbackText.trim()) return;
        setFeedbackLoading(true);
        try {
            // await apiClient.post('/feedback', { message: feedbackText });
            console.log('[Feedback]', feedbackText);
            setFeedbackSubmitted(true);
            setFeedbackText('');
        } catch (err) {
            console.error('[HomeScreen] Feedback error:', err);
        } finally {
            setFeedbackLoading(false);
        }
    }, [feedbackText]);

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
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable
                            onPress={() => navigation.navigate('Organizations')}
                            style={({ pressed }) => [s.logoutBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }, pressed && { opacity: 0.7 }]}
                            accessibilityRole="button"
                            accessibilityLabel="Organizations"
                        >
                            <Text style={[typography.bodySmall, { color: colors.white }]}>🏢 Orgs</Text>
                        </Pressable>
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
            </View>

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
                                <Text style={{ fontSize: 32 }}>⚠️</Text>
                                <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>
                                    {signError || 'No sign data available.'}
                                </Text>
                            </View>
                        ) : (
                            <Pressable
                                onPress={() => navigation.navigate('SignDetail', { sign })}
                                style={({ pressed }) => [pressed && { opacity: 0.85 }]}
                                accessibilityRole="button"
                                accessibilityLabel={`View details for ${sign.name}`}
                            >
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
                                </View>

                                <Text style={[typography.bodySmall, { color: colors.accent, textAlign: 'center', marginTop: spacing.md }]}>
                                    Tap for details & device setup →
                                </Text>

                                {/* ── Sign action buttons ── */}
                                {sign.status === 'assistance_requested' && (
                                    <Pressable
                                        onPress={(e) => { e.stopPropagation(); handleAcknowledgeSign(); }}
                                        disabled={signActionLoading}
                                        style={({ pressed }) => [
                                            s.signActionBtn,
                                            { backgroundColor: '#F59E0B' },
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
                                            { backgroundColor: '#16A34A' },
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

                    {/* ── Feedback ── */}
                    <View style={s.card}>
                        <View style={s.cardHeader}>
                            <Text style={[typography.h3, { color: colors.textPrimary }]}>Send Feedback</Text>
                            <Text style={{ fontSize: 20 }}>💬</Text>
                        </View>

                        {feedbackSubmitted ? (
                            <View style={s.feedbackSuccess}>
                                <Text style={{ fontSize: 32 }}>✅</Text>
                                <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '600', marginTop: spacing.sm }]}>
                                    Thanks for your feedback!
                                </Text>
                                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 4, textAlign: 'center' }]}>
                                    Your input helps us improve the Smart Handicap Sign.
                                </Text>
                                <Pressable
                                    onPress={() => setFeedbackSubmitted(false)}
                                    style={({ pressed }) => [s.feedbackNewBtn, pressed && { opacity: 0.7 }]}
                                    accessibilityRole="button"
                                    accessibilityLabel="Send another feedback"
                                >
                                    <Text style={[typography.bodySmall, { color: colors.accent, fontWeight: '600' }]}>
                                        Send Another
                                    </Text>
                                </Pressable>
                            </View>
                        ) : (
                            <View>
                                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                                    Let us know about issues, ideas, or anything else.
                                </Text>
                                <TextInput
                                    style={s.feedbackInput}
                                    value={feedbackText}
                                    onChangeText={setFeedbackText}
                                    placeholder="What's on your mind?"
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                    accessibilityLabel="Feedback message"
                                />
                                <Pressable
                                    onPress={handleSubmitFeedback}
                                    disabled={!feedbackText.trim() || feedbackLoading}
                                    style={({ pressed }) => [
                                        s.feedbackSubmitBtn,
                                        (!feedbackText.trim() || feedbackLoading) && { opacity: 0.5 },
                                        pressed && { opacity: 0.8 },
                                    ]}
                                    accessibilityRole="button"
                                    accessibilityLabel="Submit feedback"
                                >
                                    {feedbackLoading ? (
                                        <ActivityIndicator size="small" color={colors.white} />
                                    ) : (
                                        <Text style={[typography.button, { color: colors.white }]}>Submit Feedback</Text>
                                    )}
                                </Pressable>
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
    return (
        <View style={[s.notifRow, notification.read && s.notifRowAcked]}>
            <Text style={{ fontSize: 22, marginRight: spacing.md }}>🔔</Text>
            <View style={s.notifBody}>
                <View style={s.notifTitleRow}>
                    <Text
                        style={[
                            typography.body,
                            { fontWeight: '600', color: colors.textPrimary, flex: 1 },
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

    /* Sign action buttons */
    signActionBtn: {
        marginTop: spacing.md,
        paddingVertical: 14,
        borderRadius: layout.borderRadiusSm,
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

    /* Feedback */
    feedbackInput: {
        backgroundColor: colors.offWhite,
        borderWidth: 1,
        borderColor: colors.divider,
        borderRadius: layout.borderRadiusSm,
        padding: spacing.md,
        minHeight: 100,
        fontSize: 16,
        color: colors.textPrimary,
        lineHeight: 22,
    },
    feedbackSubmitBtn: {
        marginTop: spacing.md,
        backgroundColor: colors.accent,
        paddingVertical: 14,
        borderRadius: layout.borderRadiusSm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    feedbackSuccess: {
        alignItems: 'center',
        paddingVertical: spacing.lg,
    },
    feedbackNewBtn: {
        marginTop: spacing.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: layout.borderRadiusSm,
        backgroundColor: colors.accent + '14',
    },
});
