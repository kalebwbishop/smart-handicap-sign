import React, { useMemo, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types/navigation';
import { colors } from '@/theme/colors';
import { layout, shadows, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { getConnectivityStatus, getOperationalStatus } from './pilotStatus';

function displayValue(value: string | null | undefined): string {
    return value?.trim() || 'Not reported';
}

export default function SignDetailsScreen() {
    const route = useRoute<RouteProp<RootStackParamList, 'SignDetails'>>();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { device } = route.params;
    const status = getOperationalStatus(device);
    const deviceOffline = getConnectivityStatus(device)?.label === 'Offline';
    const translateY = useRef(new Animated.Value(0)).current;
    const [isDismissing, setIsDismissing] = useState(false);

    const dismiss = () => {
        if (isDismissing) {
            return;
        }
        setIsDismissing(true);
        Animated.timing(translateY, {
            toValue: 700,
            duration: 180,
            useNativeDriver: true,
        }).start(() => navigation.goBack());
    };

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onMoveShouldSetPanResponder: (_, gestureState) =>
                    gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
                onPanResponderMove: (_, gestureState) => {
                    if (gestureState.dy > 0) {
                        translateY.setValue(gestureState.dy);
                    }
                },
                onPanResponderRelease: (_, gestureState) => {
                    if (gestureState.dy > 120 || gestureState.vy > 1.2) {
                        dismiss();
                        return;
                    }

                    Animated.spring(translateY, {
                        toValue: 0,
                        useNativeDriver: true,
                    }).start();
                },
            }),
        [dismiss, translateY],
    );

    return (
        <Modal
            animationType="slide"
            presentationStyle="overFullScreen"
            transparent
            visible
            statusBarTranslucent
            navigationBarTranslucent
            onRequestClose={dismiss}
        >
            <Pressable style={styles.backdrop} onPress={dismiss}>
                <View style={styles.sheetWrap} pointerEvents="box-none">
                    <Animated.View
                        {...panResponder.panHandlers}
                        style={[styles.sheet, { transform: [{ translateY }] }]}
                    >
                        <View style={styles.handle} />
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                            <Text style={styles.eyebrow}>{device.model_code || 'Sign'}</Text>
                            <Text style={styles.title}>{device.name || 'Sign'}</Text>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{status.label}</Text>
                            </View>

                            <View style={styles.detailList}>
                                <DetailRow label="Serial number" value={device.serial_number} />
                                <DetailRow label="Last seen" value={displayValue(device.last_seen_at)} />
                                <DetailRow label="Firmware" value={displayValue(device.firmware_version)} />
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
                        </ScrollView>
                    </Animated.View>
                </View>
            </Pressable>
        </Modal>
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
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(5, 10, 20, 0.72)',
        justifyContent: 'flex-end',
    },
    sheetWrap: {
        flex: 1,
        width: '100%',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: colors.card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        width: '100%',
        marginBottom: 0,
        maxHeight: '50%',
        paddingTop: spacing.sm,
        ...shadows.card,
    },
    handle: {
        alignSelf: 'center',
        backgroundColor: colors.divider,
        borderRadius: 999,
        height: 4,
        marginBottom: spacing.md,
        width: 44,
    },
    content: {
        paddingHorizontal: layout.contentPadding,
        paddingBottom: Math.max(spacing.xl, 24),
    },
    eyebrow: {
        ...typography.label,
        color: colors.textSecondary,
        letterSpacing: 2,
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
        marginTop: spacing.xs,
    },
    badge: {
        alignSelf: 'flex-start',
        backgroundColor: '#2B1D0D',
        borderRadius: layout.borderRadiusPill,
        marginTop: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
    },
    badgeText: {
        ...typography.label,
        color: '#F59E0B',
        textTransform: 'uppercase',
    },
    detailList: {
        borderColor: colors.divider,
        borderRadius: layout.borderRadiusMd,
        borderWidth: StyleSheet.hairlineWidth,
        marginTop: spacing.lg,
        overflow: 'hidden',
    },
    detailRow: {
        borderBottomColor: colors.divider,
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: spacing.md,
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
