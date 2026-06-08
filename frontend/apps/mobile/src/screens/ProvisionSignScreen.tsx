import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { checkEspStatus, configureWifi, scanNetworks, type EspStatus, type WifiNetwork } from '@/api/espApi';
import { colors } from '@/theme/colors';
import { layout, shadows, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import {
    getProvisioningFormError,
    sortNetworks,
} from './provisioningHelpers';

const PROVISIONING_STEPS = [
    'Join the sign Wi-Fi network named SmartSign-XXXX in your phone settings.',
    'Return here and confirm the sign is reachable at 192.168.4.1.',
    'Choose the facility Wi-Fi, then send the password to the sign.',
];

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message
        ? error.message
        : fallback;
}

function getSignalLabel(network: WifiNetwork): string {
    if (network.rssi >= -55) {
        return 'Strong signal';
    }

    if (network.rssi >= -70) {
        return 'Good signal';
    }

    return 'Weak signal';
}

export default function ProvisionSignScreen() {
    const insets = useSafeAreaInsets();

    const [deviceStatus, setDeviceStatus] = useState<EspStatus | null>(null);
    const [networks, setNetworks] = useState<WifiNetwork[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [scanError, setScanError] = useState<string | null>(null);
    const [submitMessage, setSubmitMessage] = useState<string | null>(null);

    const [ssid, setSsid] = useState('');
    const [password, setPassword] = useState('');

    const refreshProvisioningState = useCallback(async () => {
        setIsRefreshing(true);
        setConnectionError(null);
        setScanError(null);
        setSubmitMessage(null);

        try {
            const nextStatus = await checkEspStatus();
            setDeviceStatus(nextStatus);

            try {
                const visibleNetworks = sortNetworks(await scanNetworks());
                setNetworks(visibleNetworks);
                setSsid((currentValue) => currentValue.trim() || visibleNetworks[0]?.ssid || currentValue);
            } catch (error) {
                setNetworks([]);
                setScanError(getErrorMessage(error, 'The sign is reachable, but Wi-Fi scanning failed.'));
            }
        } catch (error) {
            setDeviceStatus(null);
            setNetworks([]);
            setConnectionError(getErrorMessage(error, 'Could not reach the sign in provisioning mode.'));
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        refreshProvisioningState();
    }, [refreshProvisioningState]);

    const handleSubmit = useCallback(async () => {
        const formError = getProvisioningFormError(ssid);
        if (formError) {
            setSubmitMessage(formError);
            return;
        }

        setIsSubmitting(true);
        setSubmitMessage(null);

        try {
            await configureWifi(ssid.trim(), password);
            setPassword('');
            setSubmitMessage(`Credentials sent. The sign should reboot and try to join ${ssid.trim()}.`);
        } catch (error) {
            setSubmitMessage(getErrorMessage(error, 'The sign rejected the Wi-Fi setup request.'));
        } finally {
            setIsSubmitting(false);
        }
    }, [password, ssid]);

    return (
        <ScrollView
            style={styles.root}
            contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        >
            <View style={styles.heroCard}>
                <Text style={styles.eyebrow}>Test sign setup</Text>
                <Text style={styles.title}>Provision the sign from your phone</Text>
                <Text style={styles.subtitle}>
                    This flow assumes the sign is already in provisioning mode and broadcasting SmartSign-XXXX.
                </Text>

                <View style={styles.steps}>
                    {PROVISIONING_STEPS.map((step, index) => (
                        <View key={step} style={styles.stepRow}>
                            <View style={styles.stepBadge}>
                                <Text style={styles.stepBadgeText}>{index + 1}</Text>
                            </View>
                            <Text style={styles.stepText}>{step}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <View style={styles.card}>
                <View style={styles.sectionHeader}>
                    <View>
                        <Text style={styles.sectionTitle}>Provisioning connection</Text>
                        <Text style={styles.sectionSubtitle}>Reach the sign over 192.168.4.1 before sending credentials.</Text>
                    </View>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Check sign and scan Wi-Fi networks"
                        onPress={refreshProvisioningState}
                        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                    >
                        {isRefreshing ? (
                            <ActivityIndicator color={colors.primary} size="small" />
                        ) : (
                            <Text style={styles.secondaryButtonText}>Check sign</Text>
                        )}
                    </Pressable>
                </View>

                {deviceStatus ? (
                    <View style={styles.statusBanner}>
                        <Text style={styles.statusLabel}>Sign detected</Text>
                        <Text style={styles.statusValue}>{deviceStatus.device_id}</Text>
                        <Text style={styles.statusMeta}>
                            AP status: {deviceStatus.ap_active ? 'Provisioning network active' : 'Reachable but AP not reported active'}
                        </Text>
                    </View>
                ) : null}

                {connectionError ? (
                    <View style={[styles.messageBanner, styles.errorBanner]}>
                        <Text style={styles.errorBannerTitle}>Connect to the SmartSign Wi-Fi first</Text>
                        <Text style={styles.errorBannerText}>{connectionError}</Text>
                    </View>
                ) : null}

                {scanError ? (
                    <View style={[styles.messageBanner, styles.warningBanner]}>
                        <Text style={styles.warningBannerTitle}>Network scan unavailable</Text>
                        <Text style={styles.warningBannerText}>{scanError}</Text>
                    </View>
                ) : null}
            </View>

            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Facility Wi-Fi</Text>
                <Text style={styles.sectionSubtitle}>Pick a scanned network or enter the SSID manually.</Text>

                {networks.length > 0 ? (
                    <View style={styles.networkList}>
                        {networks.map((network) => {
                            const selected = ssid.trim() === network.ssid;

                            return (
                                <Pressable
                                    key={network.ssid}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected }}
                                    onPress={() => setSsid(network.ssid)}
                                    style={({ pressed }) => [
                                        styles.networkOption,
                                        selected && styles.networkOptionSelected,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <View style={styles.networkCopy}>
                                        <Text style={styles.networkName}>{network.ssid}</Text>
                                        <Text style={styles.networkMeta}>
                                            {getSignalLabel(network)} • RSSI {network.rssi}
                                        </Text>
                                    </View>
                                    <Text style={[styles.networkState, selected && styles.networkStateSelected]}>
                                        {selected ? 'Selected' : 'Use'}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>
                            No networks were returned yet. You can still enter the Wi-Fi name manually.
                        </Text>
                    </View>
                )}

                <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Wi-Fi network name</Text>
                    <TextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        onChangeText={setSsid}
                        placeholder="OfficeWiFi"
                        placeholderTextColor={colors.textMuted}
                        style={styles.input}
                        value={ssid}
                    />
                </View>

                <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Wi-Fi password</Text>
                    <TextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        onChangeText={setPassword}
                        placeholder="Leave blank for open networks"
                        placeholderTextColor={colors.textMuted}
                        secureTextEntry
                        style={styles.input}
                        value={password}
                    />
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Send configuration</Text>
                <Text style={styles.sectionSubtitle}>For the pilot, the sign only needs Wi-Fi details to leave provisioning mode.</Text>

                {submitMessage ? (
                    <View style={[
                        styles.messageBanner,
                        submitMessage.startsWith('Credentials sent') ? styles.successBanner : styles.errorBanner,
                    ]}>
                        <Text
                            style={submitMessage.startsWith('Credentials sent')
                                ? styles.successBannerText
                                : styles.errorBannerText}
                        >
                            {submitMessage}
                        </Text>
                    </View>
                ) : null}

                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Send Wi-Fi credentials to the sign"
                    disabled={isSubmitting || isRefreshing}
                    onPress={handleSubmit}
                    style={({ pressed }) => [
                        styles.primaryButton,
                        (isSubmitting || isRefreshing) && styles.primaryButtonDisabled,
                        pressed && styles.pressed,
                    ]}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color={colors.ctaPrimaryText} />
                    ) : (
                        <Text style={styles.primaryButtonText}>Send Wi-Fi credentials</Text>
                    )}
                </Pressable>

                <Text style={styles.footnote}>
                    After a successful send, the sign should reboot, leave provisioning mode, and try the selected network.
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: colors.offWhite,
    },
    content: {
        paddingHorizontal: layout.contentPadding,
        paddingBottom: spacing.xxxl,
        gap: spacing.md,
    },
    heroCard: {
        backgroundColor: colors.white,
        borderRadius: layout.borderRadiusLg,
        padding: spacing.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.divider,
        ...shadows.card,
    },
    eyebrow: {
        ...typography.label,
        color: colors.primary,
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
    },
    title: {
        ...typography.h2,
        color: colors.textPrimary,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        marginTop: spacing.sm,
    },
    steps: {
        marginTop: spacing.lg,
        gap: spacing.md,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
    },
    stepBadge: {
        width: 28,
        height: 28,
        borderRadius: layout.borderRadiusCircle,
        backgroundColor: `${colors.primary}14`,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    stepBadgeText: {
        ...typography.captionBold,
        color: colors.primary,
    },
    stepText: {
        ...typography.body,
        color: colors.textPrimary,
        flex: 1,
    },
    card: {
        backgroundColor: colors.white,
        borderRadius: layout.borderRadiusLg,
        padding: spacing.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.divider,
        gap: spacing.md,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.md,
    },
    sectionTitle: {
        ...typography.h4,
        color: colors.textPrimary,
    },
    sectionSubtitle: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    secondaryButton: {
        borderRadius: layout.borderRadiusPill,
        borderWidth: 1,
        borderColor: colors.divider,
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
        minWidth: 112,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonText: {
        ...typography.captionBold,
        color: colors.primary,
    },
    statusBanner: {
        borderRadius: layout.borderRadius,
        padding: spacing.md,
        backgroundColor: `${colors.primary}10`,
        gap: spacing.xs,
    },
    statusLabel: {
        ...typography.label,
        color: colors.primary,
        textTransform: 'uppercase',
    },
    statusValue: {
        ...typography.body,
        color: colors.textPrimary,
        fontFamily: 'Montserrat_600SemiBold',
    },
    statusMeta: {
        ...typography.bodySmall,
        color: colors.textSecondary,
    },
    messageBanner: {
        borderRadius: layout.borderRadius,
        padding: spacing.md,
        gap: spacing.xs,
    },
    errorBanner: {
        backgroundColor: '#fff2f1',
    },
    errorBannerTitle: {
        ...typography.captionBold,
        color: colors.negative,
    },
    errorBannerText: {
        ...typography.bodySmall,
        color: colors.negative,
    },
    warningBanner: {
        backgroundColor: '#fff8ed',
    },
    warningBannerTitle: {
        ...typography.captionBold,
        color: colors.warning,
    },
    warningBannerText: {
        ...typography.bodySmall,
        color: '#8a4b00',
    },
    successBanner: {
        backgroundColor: '#ecf8f0',
    },
    successBannerText: {
        ...typography.bodySmall,
        color: '#157347',
    },
    networkList: {
        gap: spacing.sm,
    },
    networkOption: {
        borderRadius: layout.borderRadius,
        borderWidth: 1,
        borderColor: colors.divider,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.md,
    },
    networkOptionSelected: {
        borderColor: colors.primary,
        backgroundColor: `${colors.primary}08`,
    },
    networkCopy: {
        flex: 1,
        gap: spacing.xs,
    },
    networkName: {
        ...typography.body,
        color: colors.textPrimary,
    },
    networkMeta: {
        ...typography.bodySmall,
        color: colors.textSecondary,
    },
    networkState: {
        ...typography.captionBold,
        color: colors.textSecondary,
    },
    networkStateSelected: {
        color: colors.primary,
    },
    emptyState: {
        borderRadius: layout.borderRadius,
        backgroundColor: colors.sectionAlt,
        padding: spacing.md,
    },
    emptyStateText: {
        ...typography.bodySmall,
        color: colors.textSecondary,
    },
    fieldGroup: {
        gap: spacing.sm,
    },
    fieldLabel: {
        ...typography.captionBold,
        color: colors.textPrimary,
    },
    input: {
        borderRadius: layout.borderRadius,
        borderWidth: 1,
        borderColor: colors.divider,
        paddingHorizontal: spacing.md,
        paddingVertical: 14,
        ...typography.body,
        color: colors.textPrimary,
        backgroundColor: colors.white,
    },
    primaryButton: {
        marginTop: spacing.sm,
        borderRadius: layout.borderRadiusPill,
        backgroundColor: colors.ctaPrimary,
        paddingVertical: 16,
        alignItems: 'center',
    },
    primaryButtonDisabled: {
        opacity: 0.6,
    },
    primaryButtonText: {
        ...typography.button,
        color: colors.ctaPrimaryText,
    },
    footnote: {
        ...typography.small,
        color: colors.textMuted,
    },
    pressed: {
        opacity: 0.86,
    },
});
