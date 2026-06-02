import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '@/theme/colors';
import { layout, shadows, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { RootStackParamList } from '@/types/navigation';
import { getOperationalStatus, getConnectivityStatus } from './pilotStatus';

function displayValue(value: string | null | undefined): string {
    return value?.trim() || 'Not reported';
}

export default function SignDetailsScreen() {
    const route = useRoute<RouteProp<RootStackParamList, 'SignDetails'>>();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { device } = route.params;
    const status = getOperationalStatus(device);
    const deviceOffline = getConnectivityStatus(device)?.label === 'Offline';

    return (
        <ScrollView contentContainerStyle={styles.content} style={styles.root}>
            <View style={styles.card}>
                <Text style={styles.title}>{device.name || 'Sign'}</Text>

                <View style={styles.detailList}>
                    <DetailRow label="Serial number" value={device.serial_number} />
                    <DetailRow label="Last seen" value={displayValue(device.last_seen_at)} />
                    <DetailRow label="Sign version" value={displayValue(device.firmware_version)} />
                    <DetailRow label="Hardware revision" value={displayValue(device.hardware_revision)} />
                    <DetailRow label="Model code" value={displayValue(device.model_code)} />
                    <DetailRow label="Lifecycle status" value={device.lifecycle_status} />
                    <DetailRow label="Current status" value={status.label} />
                    {deviceOffline ? <DetailRow label="Connectivity" value="Offline" /> : null}
                </View>

                <Pressable
                    accessibilityLabel="Configure Wi-Fi settings for the sign"
                    accessibilityRole="button"
                    onPress={() => navigation.navigate('ProvisionSign')}
                    style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
                >
                    <Text style={styles.primaryActionText}>Configure Wi-Fi</Text>
                </Pressable>
            </View>
        </ScrollView>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: colors.offWhite,
    },
    content: {
        padding: layout.contentPadding,
    },
    card: {
        alignSelf: 'center',
        backgroundColor: colors.card,
        borderRadius: layout.borderRadiusMd,
        maxWidth: 720,
        padding: spacing.xl,
        width: '100%',
        ...shadows.card,
    },
    eyebrow: {
        ...typography.label,
        color: colors.textSecondary,
        textTransform: 'uppercase',
    },
    title: {
        ...typography.h2,
        color: colors.textPrimary,
        marginTop: spacing.xs,
    },
    subtitle: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        marginTop: spacing.sm,
    },
    detailList: {
        borderColor: colors.divider,
        borderTopWidth: StyleSheet.hairlineWidth,
        marginTop: spacing.xl,
    },
    detailRow: {
        borderBottomColor: colors.divider,
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingVertical: spacing.md,
    },
    detailLabel: {
        ...typography.label,
        color: colors.textSecondary,
        textTransform: 'uppercase',
    },
    detailValue: {
        ...typography.body,
        color: colors.textPrimary,
        marginTop: spacing.xs,
    },
    primaryAction: {
        alignItems: 'center',
        backgroundColor: colors.ctaPrimary,
        borderRadius: layout.borderRadiusPill,
        marginTop: spacing.xl,
        paddingHorizontal: spacing.lg,
        paddingVertical: 14,
    },
    primaryActionText: {
        ...typography.button,
        color: colors.ctaPrimaryText,
    },
    pressed: {
        opacity: 0.82,
    },
});
