import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    Platform,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types/navigation';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, layout } from '@/theme/spacing';
import { Sign, SignStatus } from '@/types/types';
import { signAPI } from '@/api/api';

/* ──────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────── */

const STATUS_CONFIG: Record<SignStatus, { color: string; label: string }> = {
    available: { color: '#16A34A', label: 'Available' },
    assistance_requested: { color: '#DC2626', label: 'Assistance Requested' },
    assistance_in_progress: { color: '#F59E0B', label: 'Assistance In Progress' },
    offline: { color: colors.grayDark, label: 'Offline' },
    error: { color: '#F59E0B', label: 'Error' },
    training_ready: { color: '#8B5CF6', label: 'Training Ready' },
    training_positive: { color: '#2563EB', label: 'Training – Positive' },
    training_negative: { color: '#EA580C', label: 'Training – Negative' },
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

const TRAINING_STATUSES: SignStatus[] = ['training_ready', 'training_positive', 'training_negative'];

function isTrainingStatus(status: SignStatus): boolean {
    return TRAINING_STATUSES.includes(status);
}

/* ──────────────────────────────────────────────
 * Component
 * ────────────────────────────────────────────── */

export default function SignDetailScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'SignDetail'>>();
    const [currentSign, setCurrentSign] = useState<Sign>(route.params.sign);
    const [updating, setUpdating] = useState(false);

    const statusConfig = STATUS_CONFIG[currentSign.status];

    const updateStatus = useCallback(async (newStatus: SignStatus) => {
        setUpdating(true);
        try {
            const updated = await signAPI.updateSignStatus(currentSign.id, newStatus);
            setCurrentSign({
                ...updated,
                lastUpdated: updated.last_updated || updated.lastUpdated,
            });
        } catch (err) {
            console.error('[SignDetail] Failed to update status:', err);
        } finally {
            setUpdating(false);
        }
    }, [currentSign.id]);

    return (
        <View style={s.root}>
            {/* Header */}
            <View style={s.header}>
                <View style={s.headerInner}>
                    <Pressable
                        onPress={() => navigation.goBack()}
                        style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                    >
                        <Text style={[typography.body, { color: colors.white }]}>← Back</Text>
                    </Pressable>
                    <Text style={[typography.h4, { color: colors.heroText }]}>{currentSign.name}</Text>
                    <View style={{ width: 60 }} />
                </View>
            </View>

            <ScrollView style={s.scrollView} contentContainerStyle={s.scrollContent}>
                <View style={s.content}>
                    {/* Sign Status Card */}
                    <View style={s.card}>
                        <View style={s.cardHeader}>
                            <Text style={[typography.h3, { color: colors.textPrimary }]}>Sign Status</Text>
                            <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                                Updated {timeAgo(currentSign.lastUpdated)}
                            </Text>
                        </View>

                        <View style={[s.statusBanner, { backgroundColor: statusConfig.color + '12' }]}>
                            <View style={s.statusIconRow}>
                                <View style={[s.statusDot, { backgroundColor: statusConfig.color }]} />
                                <Text style={[typography.h2, { color: statusConfig.color }]}>
                                    {statusConfig.label}
                                </Text>
                            </View>
                            <Text style={{ fontSize: 56, marginTop: spacing.sm }}>♿</Text>
                        </View>

                        <View style={s.detailsGrid}>
                            <DetailRow label="Sign Name" value={currentSign.name} />
                            <DetailRow label="Location" value={currentSign.location} />
                        </View>
                    </View>

                    {/* Training Mode Card */}
                    <View style={s.card}>
                        <View style={s.cardHeader}>
                            <Text style={[typography.h3, { color: colors.textPrimary }]}>Training Mode</Text>
                            <Text style={{ fontSize: 20 }}>🧠</Text>
                        </View>

                        {!isTrainingStatus(currentSign.status) ? (
                            /* ── Not in training mode ── */
                            <View>
                                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.md }]}>
                                    Enter training mode to collect positive and negative samples for the AI model.
                                </Text>
                                <Pressable
                                    onPress={() => updateStatus('training_ready')}
                                    disabled={updating}
                                    style={({ pressed }) => [
                                        s.trainingBtn,
                                        { backgroundColor: '#8B5CF6' },
                                        updating && { opacity: 0.5 },
                                        pressed && { opacity: 0.8 },
                                    ]}
                                    accessibilityRole="button"
                                    accessibilityLabel="Enter training mode"
                                >
                                    {updating ? (
                                        <ActivityIndicator size="small" color={colors.white} />
                                    ) : (
                                        <Text style={[typography.button, { color: colors.white }]}>
                                            Enter Training Mode
                                        </Text>
                                    )}
                                </Pressable>
                            </View>
                        ) : currentSign.status === 'training_ready' ? (
                            /* ── Training Ready ── */
                            <View>
                                <View style={[s.trainingStatusBadge, { backgroundColor: '#8B5CF6' + '18' }]}>
                                    <View style={[s.statusDot, { backgroundColor: '#8B5CF6' }]} />
                                    <Text style={[typography.body, { color: '#8B5CF6', fontWeight: '700' }]}>
                                        Training Ready
                                    </Text>
                                </View>
                                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center' }]}>
                                    Choose a sample type to begin collecting data, or exit training mode.
                                </Text>
                                <View style={s.trainingActions}>
                                    <Pressable
                                        onPress={() => updateStatus('training_positive')}
                                        disabled={updating}
                                        style={({ pressed }) => [
                                            s.trainingBtn,
                                            { backgroundColor: '#2563EB' },
                                            updating && { opacity: 0.5 },
                                            pressed && { opacity: 0.8 },
                                        ]}
                                        accessibilityRole="button"
                                        accessibilityLabel="Start positive training"
                                    >
                                        {updating ? (
                                            <ActivityIndicator size="small" color={colors.white} />
                                        ) : (
                                            <Text style={[typography.button, { color: colors.white }]}>
                                                ✅  Positive Sample
                                            </Text>
                                        )}
                                    </Pressable>
                                    <Pressable
                                        onPress={() => updateStatus('training_negative')}
                                        disabled={updating}
                                        style={({ pressed }) => [
                                            s.trainingBtn,
                                            { backgroundColor: '#EA580C' },
                                            updating && { opacity: 0.5 },
                                            pressed && { opacity: 0.8 },
                                        ]}
                                        accessibilityRole="button"
                                        accessibilityLabel="Start negative training"
                                    >
                                        {updating ? (
                                            <ActivityIndicator size="small" color={colors.white} />
                                        ) : (
                                            <Text style={[typography.button, { color: colors.white }]}>
                                                ❌  Negative Sample
                                            </Text>
                                        )}
                                    </Pressable>
                                </View>
                                <Pressable
                                    onPress={() => updateStatus('available')}
                                    disabled={updating}
                                    style={({ pressed }) => [
                                        s.exitTrainingBtn,
                                        updating && { opacity: 0.5 },
                                        pressed && { opacity: 0.7 },
                                    ]}
                                    accessibilityRole="button"
                                    accessibilityLabel="Exit training mode"
                                >
                                    <Text style={[typography.bodySmall, { color: '#DC2626', fontWeight: '600' }]}>
                                        Exit Training Mode
                                    </Text>
                                </Pressable>
                            </View>
                        ) : (
                            /* ── Training Positive / Negative (active recording) ── */
                            <View>
                                <View style={[
                                    s.trainingStatusBadge,
                                    { backgroundColor: STATUS_CONFIG[currentSign.status].color + '18' },
                                ]}>
                                    <View style={[s.statusDot, { backgroundColor: STATUS_CONFIG[currentSign.status].color }]} />
                                    <Text style={[typography.body, { color: STATUS_CONFIG[currentSign.status].color, fontWeight: '700' }]}>
                                        {STATUS_CONFIG[currentSign.status].label}
                                    </Text>
                                </View>
                                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center' }]}>
                                    {currentSign.status === 'training_positive'
                                        ? 'Collecting positive samples. Press Stop when done.'
                                        : 'Collecting negative samples. Press Stop when done.'}
                                </Text>
                                <Pressable
                                    onPress={() => updateStatus('training_ready')}
                                    disabled={updating}
                                    style={({ pressed }) => [
                                        s.trainingBtn,
                                        { backgroundColor: '#DC2626' },
                                        updating && { opacity: 0.5 },
                                        pressed && { opacity: 0.8 },
                                    ]}
                                    accessibilityRole="button"
                                    accessibilityLabel="Stop recording and return to training ready"
                                >
                                    {updating ? (
                                        <ActivityIndicator size="small" color={colors.white} />
                                    ) : (
                                        <Text style={[typography.button, { color: colors.white }]}>
                                            ⏹  Stop
                                        </Text>
                                    )}
                                </Pressable>
                            </View>
                        )}
                    </View>

                    {/* Device Setup Card (native only — requires direct ESP32 WiFi connection) */}
                    {Platform.OS !== 'web' && (
                    <View style={s.card}>
                        <View style={s.cardHeader}>
                            <Text style={[typography.h3, { color: colors.textPrimary }]}>Device Setup</Text>
                            <Text style={{ fontSize: 20 }}>📡</Text>
                        </View>
                        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.md }]}>
                            Provision a new SmartSign device or update its WiFi credentials.
                        </Text>
                        <Pressable
                            onPress={() => navigation.navigate('WiFiSetup')}
                            style={({ pressed }) => [
                                s.actionBtn,
                                pressed && { opacity: 0.8 },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="Setup device WiFi"
                        >
                            <Text style={[typography.button, { color: colors.white }]}>Setup Device WiFi</Text>
                        </Pressable>
                    </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

/* ──────────────────────────────────────────────
 * Sub-components
 * ────────────────────────────────────────────── */

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <View style={s.detailRow}>
            <Text style={[typography.bodySmall, { color: colors.textMuted }]}>{label}</Text>
            <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '600' }]}>
                {value}
            </Text>
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
    backBtn: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: layout.borderRadiusSm,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
    },
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
    actionBtn: {
        backgroundColor: colors.accent,
        paddingVertical: 14,
        borderRadius: layout.borderRadiusSm,
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* Training mode */
    trainingBtn: {
        paddingVertical: 14,
        borderRadius: layout.borderRadiusSm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    trainingActions: {
        gap: spacing.sm,
    },
    trainingStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: 20,
        marginBottom: spacing.md,
    },
    exitTrainingBtn: {
        marginTop: spacing.lg,
        alignSelf: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: layout.borderRadiusSm,
        backgroundColor: '#DC262614',
    },
});
