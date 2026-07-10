import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Modal,
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Feather from '@expo/vector-icons/Feather';

import { RootStackParamList } from '@/types/navigation';
import { colors } from '@/theme/colors';
import { layout, shadows, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { getConnectivityStatus, getOperationalStatus } from './pilotStatus';

type WifiStep = 'idle' | 'not_on_network' | 'scan' | 'password' | 'connecting' | 'success' | 'error';

enum WifiAuthMode {
    WIFI_AUTH_OPEN = 0,
    WIFI_AUTH_WEP,
    WIFI_AUTH_WPA_PSK,
    WIFI_AUTH_WPA2_PSK,
    WIFI_AUTH_WPA_WPA2_PSK,
    WIFI_AUTH_ENTERPRISE,
    WIFI_AUTH_WPA3_PSK,
    WIFI_AUTH_WPA2_WPA3_PSK,
    WIFI_AUTH_WAPI_PSK,
    WIFI_AUTH_OWE,
    WIFI_AUTH_WPA3_ENT_192,
    WIFI_AUTH_MAX,
}

type WifiNetwork = {
    ssid: string;
    authmode: WifiAuthMode;
    rssi: number;
    secured: boolean;
    strength: 1 | 2 | 3 | 4;
};

function displayValue(value: string | null |undefined): string {
    return value?.trim() || 'Not reported';
}

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
        return 'Never';
    }

    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return 'Unknown';
    }

    return formatRelativeTime(iso);
}

function batteryTextColor(battery: number): string {
    if (battery >= 60) return '#34C759';
    if (battery >= 30) return '#FF9500';
    return '#FF3B30';
}

export default function SignDetailsScreen() {
    const route = useRoute<RouteProp<RootStackParamList, 'SignDetails'>>();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { device } = route.params;

    const status = getOperationalStatus(device);
    const deviceOffline = getConnectivityStatus(device)?.label === 'Offline';

    const translateY = useRef(new Animated.Value(700)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isDismissing, setIsDismissing] = useState(false);
    const [wifiStep, setWifiStep] = useState<WifiStep>('idle');
    const [scannedWifiNetworks, setScannedWifiNetworks] = useState<WifiNetwork[]>([]);
    const [selectedNetwork, setSelectedNetwork] = useState<WifiNetwork | null>(null);
    const [password, setPassword] = useState('');
    const [provisionedWifiSSID, setProvisionedWifiSSID] = useState<string | null>(null);
    const [maintenanceFlagged, setMaintenanceFlagged] = useState(false);
    const wifiConnected = Boolean(provisionedWifiSSID);

    useEffect(() => {
        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 1,
                duration: 180,
                useNativeDriver: true,
            }),
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 80,
                friction: 12,
            }),
        ]).start();
    }, []);

    useEffect(() => {
        return () => {
            if (connectTimeoutRef.current) {
                clearTimeout(connectTimeoutRef.current);
                connectTimeoutRef.current = null;
            }
        };
    }, []);

    const resetWifiFlow = useCallback(() => {
        setWifiStep('idle');
        setSelectedNetwork(null);
        setPassword('');
    }, []);

    const handleConnect = useCallback(() => {
        if (!selectedNetwork) {
            return;
        }

        const trimmedPassword = password.trim();

        setWifiStep('connecting');

        fetch(`http://192.168.4.1/configure`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ssid: selectedNetwork.ssid,
                password: selectedNetwork.secured ? trimmedPassword : '',
            }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            console.log('WiFi configuration response:', response);
            setWifiStep('success');
            setProvisionedWifiSSID(selectedNetwork.ssid);
            return response.json();
        })
        .catch(error => {
            console.error('Error configuring WiFi:', error);
            setWifiStep('error');
        });

    }, [password, selectedNetwork]);

    const dismiss = useCallback(() => {
        if (isDismissing) return;

        setIsDismissing(true);

        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 700,
                duration: 180,
                useNativeDriver: true,
            }),
        ]).start(() => navigation.goBack());
    }, [backdropOpacity, translateY, navigation, isDismissing]);

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onMoveShouldSetPanResponder: (_, gestureState) =>
                    gestureState.dy > 6 &&
                    Math.abs(gestureState.dy) > Math.abs(gestureState.dx),

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
        [dismiss],
    );

    useEffect(() => {
        if (wifiStep === 'scan') {
            // Make a callout to the WiFi status endpoint to ensure the user is connected to the AP server before proceeding
            fetch('http://192.168.4.1/status')
                .then((response) => response.json())
                .then((data) => {
                    console.log('WiFi status:', data);
                    fetch('http://192.168.4.1/scan')
                        .then((response) => response.json())
                        .then((scanData) => {
                            console.log('WiFi scan results:', scanData);
                            let cleanedScanData = [];

                            // Convert rssi to strength value for each network
                            cleanedScanData = Array.isArray(scanData)
                                ? scanData
                                      .filter((network) => typeof network?.ssid === 'string' && network.ssid.trim().length > 0)
                                      .map((network) => ({
                                          ...network,
                                          strength: Math.min(Math.max((network.rssi + 100) * 2, 0), 100),
                                      }))
                                      .map((network) => ({
                                          ...network,
                                          secured: network.authmode !== WifiAuthMode.WIFI_AUTH_OPEN,
                                      }))
                                : [];

                            setScannedWifiNetworks(cleanedScanData);
                        })
                        .catch((error) => {
                            console.error('Failed to fetch WiFi scan results:', error);
                        });
                })
                .catch((error) => {
                    console.error('Failed to fetch WiFi status:', error);
                    setWifiStep('not_on_network');
                });
        }
        else if (wifiStep === 'not_on_network') {
            // Handle the case when the user is not on the network
        }
    }, [wifiStep]);

    return (
        <Modal
            transparent
            visible
            animationType="slide"
            presentationStyle="overFullScreen"
            statusBarTranslucent
            navigationBarTranslucent
            onRequestClose={dismiss}
        >
            <View style={StyleSheet.absoluteFill}>
                <Animated.View
                    style={[
                        styles.backdrop,
                        {
                            opacity: backdropOpacity,
                        },
                    ]}
                >
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={dismiss}
                    />
                </Animated.View>

                <View style={styles.sheetWrap} pointerEvents="box-none">
                    <Animated.View
                        style={[
                            styles.sheet,
                            {
                                transform: [{ translateY }],
                            },
                        ]}
                    >
                        <View
                            {...panResponder.panHandlers}
                            style={styles.dragArea}
                        >
                            <View style={styles.handle} />
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.content}
                        >
                            <Text style={styles.eyebrow}>
                                {device.model_code || 'Sign'}
                            </Text>

                            <Text style={styles.title}>
                                {device.name || 'Sign'}
                            </Text>

                            <View
                                style={[
                                    styles.statusBadge,
                                    {
                                        borderColor: status.color,
                                        backgroundColor: status.tone,
                                    },
                                ]}
                            >
                                <View
                                    style={[
                                        styles.statusDot,
                                        { backgroundColor: status.color },
                                    ]}
                                />
                                <Text
                                    style={[
                                        styles.statusBadgeText,
                                        { color: status.color },
                                    ]}
                                >
                                    {status.label}
                                </Text>
                            </View>

                            <View style={styles.metricsGrid}>
                                <MetricCard
                                    icon="battery"
                                    label="Battery"
                                    value={`${device.battery_percentage}%`}
                                    valueColor={batteryTextColor(device.battery_percentage)}
                                />
                                <MetricCard
                                    icon="activity"
                                    label="Lifecycle"
                                    value={device.lifecycle_status}
                                    valueColor={colors.textPrimary}
                                />
                                <MetricCard
                                    icon="clock"
                                    label="Last seen"
                                    value={formatLastSeen(device.last_seen_at)}
                                    valueColor={colors.textSecondary}
                                />
                                <MetricCard
                                    icon={deviceOffline ? 'wifi-off' : 'wifi'}
                                    label="Connectivity"
                                    value={device.connectivity_status}
                                    valueColor={deviceOffline ? colors.negative : '#34C759'}
                                />
                            </View>

                            <View style={styles.detailList}>
                                <DetailRow label="Serial number" value={device.serial_number} />
                                <DetailRow label="Last seen" value={displayValue(device.last_seen_at)} />
                                <DetailRow label="Firmware" value={displayValue(device.firmware_version)} />
                                <DetailRow label="Hardware revision" value={displayValue(device.hardware_revision)} />
                                <DetailRow label="Model code" value={displayValue(device.model_code)} />
                                <DetailRow label="Current status" value={status.label} />
                              </View>

                            <Text style={styles.description}>
                                Actions
                            </Text>

                            {wifiStep === 'idle' && (
                                <View style={styles.actionList}>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel="Start Wi-Fi provisioning"
                                        onPress={() => setWifiStep('scan')}
                                        style={({ pressed }) => [
                                            styles.actionCard,
                                            pressed && styles.pressed,
                                        ]}
                                    >
                                        <View style={styles.actionIconWrap}>
                                            <Feather color="#60A5FA" name="wifi" size={16} />
                                        </View>
                                        <View style={styles.actionCopy}>
                                            <Text style={styles.actionTitle}>Provision Wi-Fi</Text>
                                            <Text style={styles.actionSubtitle}>
                                                Connect sign to a wireless network
                                            </Text>
                                        </View>
                                        <Feather color={colors.textMuted} name="chevron-right" size={16} />
                                    </Pressable>
                                </View>
                            )}

                            {wifiStep === 'not_on_network' && (
                                <View style={styles.actionList}>
                                    <Text style={styles.actionSubtitle}>
                                        You are not connected to the network. Please connect to the sign's Wi-Fi network.
                                    </Text>
                                </View>
                            )}

                            {wifiStep === 'scan' && (
                                <View style={styles.stepCard}>
                                    <View style={styles.stepHeader}>
                                        <Pressable
                                            accessibilityRole="button"
                                            accessibilityLabel="Cancel Wi-Fi scan"
                                            onPress={resetWifiFlow}
                                        >
                                            <Feather color={colors.textMuted} name="chevron-left" size={16} />
                                        </Pressable>
                                        <Text style={styles.stepTitle}>Select Network</Text>
                                        <ActivityIndicator color={colors.textMuted} size="small" />
                                    </View>

                                    {scannedWifiNetworks.map((network) => (
                                        <Pressable
                                            key={network.ssid}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Use ${network.ssid}`}
                                            onPress={() => {
                                                setSelectedNetwork(network);
                                                setPassword('');
                                                if (network.secured) {
                                                    setWifiStep('password');
                                                    return;
                                                }

                                                setWifiStep('connecting');
                                                
                                                connectTimeoutRef.current = setTimeout(() => {
                                                    setWifiStep('success');
                                                    setProvisionedWifiSSID(network.ssid);
                                                    connectTimeoutRef.current = null;
                                                }, 2000);
                                            }}
                                            style={({ pressed }) => [
                                                styles.networkRow,
                                                pressed && styles.pressed,
                                            ]}
                                        >
                                            <View style={styles.networkCopy}>
                                                <Feather
                                                    color={network.secured ? colors.textMuted : 'transparent'}
                                                    name="lock"
                                                    size={14}
                                                />
                                                <View>
                                                    <Text style={styles.networkSsid}>{network.ssid}</Text>
                                                    <Text style={styles.networkMeta}>
                                                        {network.secured ? 'WPA2 Secured' : 'Open network'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <WifiBars strength={network.strength} />
                                        </Pressable>
                                    ))}
                                </View>
                            )}

                            {wifiStep === 'password' && selectedNetwork && (
                                <View style={styles.stepCardPadded}>
                                    <View style={styles.passwordHeader}>
                                        <Pressable
                                            accessibilityRole="button"
                                            accessibilityLabel="Back to network list"
                                            onPress={() => setWifiStep('scan')}
                                        >
                                            <Feather color={colors.textMuted} name="chevron-left" size={16} />
                                        </Pressable>
                                        <View style={styles.passwordHeaderCopy}>
                                            <Text style={styles.passwordSsid}>{selectedNetwork.ssid}</Text>
                                            <View style={styles.passwordMetaRow}>
                                                <WifiBars strength={selectedNetwork.strength} />
                                                <Text style={styles.networkMeta}>Secured</Text>
                                            </View>
                                        </View>
                                    </View>

                                    <Text style={styles.passwordLabel}>Network Password</Text>
                                    <TextInput
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        onChangeText={setPassword}
                                        placeholder="Enter password"
                                        placeholderTextColor={colors.textMuted}
                                        secureTextEntry
                                        style={styles.passwordInput}
                                        value={password}
                                    />

                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel="Connect sign to selected network"
                                        disabled={!password.trim()}
                                        onPress={handleConnect}
                                        style={({ pressed }) => [
                                            styles.connectButton,
                                            !password.trim() && styles.connectButtonDisabled,
                                            pressed && styles.pressed,
                                        ]}
                                    >
                                        <Text style={styles.connectButtonText}>Connect Sign</Text>
                                    </Pressable>
                                </View>
                            )}

                            {wifiStep === 'connecting' && (
                                <View style={styles.stateCard}>
                                    <View style={styles.stateIconWrap}>
                                        <ActivityIndicator color="#60A5FA" size="large" />
                                    </View>
                                    <View style={styles.stateCopyWrap}>
                                        <Text style={styles.stateTitle}>Connecting to network...</Text>
                                        <Text style={styles.stateSubtitle}>{selectedNetwork?.ssid || 'Selected network'}</Text>
                                    </View>
                                </View>
                            )}

                            {wifiStep === 'success' && (
                                <View style={styles.successCard}>
                                    <View style={styles.successIconWrap}>
                                        <Feather color="#34C759" name="check-circle" size={30} />
                                    </View>
                                    <View style={styles.stateCopyWrap}>
                                        <Text style={styles.successTitle}>Provisioned Successfully</Text>
                                        <Text style={styles.stateSubtitle}>{selectedNetwork?.ssid || provisionedWifiSSID || ''}</Text>
                                    </View>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel="Finish Wi-Fi setup"
                                        onPress={resetWifiFlow}
                                        style={({ pressed }) => [
                                            styles.doneLink,
                                            pressed && styles.pressed,
                                        ]}
                                    >
                                        <Text style={styles.doneLinkText}>Done</Text>
                                    </Pressable>
                                </View>
                            )}
                        </ScrollView>
                    </Animated.View>
                </View>
            </View>
        </Modal>
    );
}

function DetailRow({
    label,
    value,
    isError = false,
}: {
    label: string;
    value: string;
    isError?: boolean;
}) {
    return (
        <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={[styles.detailValue, isError && styles.detailValueError]}>{value}</Text>
        </View>
    );
}

function MetricCard({
    icon,
    label,
    value,
    valueColor,
}: {
    icon: React.ComponentProps<typeof Feather>['name'];
    label: string;
    value: string;
    valueColor: string;
}) {
    return (
        <View style={styles.metricCard}>
            <View style={styles.metricLabelRow}>
                <Feather color={colors.textMuted} name={icon} size={14} />
                <Text style={styles.metricLabel}>{label}</Text>
            </View>
            <Text style={[styles.metricValue, { color: valueColor }]}>{value}</Text>
        </View>
    );
}

function WifiBars({ strength }: { strength: WifiNetwork['strength'] }) {
    return (
        <View style={styles.wifiBars}>
            {[1, 2, 3, 4].map((bar) => (
                <View
                    key={bar}
                    style={[
                        styles.wifiBar,
                        {
                            height: 4 + bar * 2,
                            opacity: bar <= strength ? 1 : 0.2,
                        },
                    ]}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(5, 10, 20, 0.72)',
    },

    sheetWrap: {
        flex: 1,
        justifyContent: 'flex-end',
    },

    sheet: {
        backgroundColor: colors.card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '88%',
        ...shadows.card,
    },

    dragArea: {
        alignItems: 'center',
        paddingTop: spacing.sm,
        paddingBottom: spacing.md,
    },

    handle: {
        width: 44,
        height: 4,
        borderRadius: 999,
        backgroundColor: colors.divider,
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

    statusBadge: {
        alignItems: 'center',
        alignSelf: 'flex-start',
        borderRadius: layout.borderRadiusPill,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing.xs,
        marginTop: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },

    statusDot: {
        borderRadius: 4,
        height: 8,
        width: 8,
    },

    statusBadgeText: {
        ...typography.label,
        textTransform: 'uppercase',
    },

    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginTop: spacing.lg,
    },

    metricCard: {
        backgroundColor: colors.offWhite,
        borderColor: colors.divider,
        borderRadius: layout.borderRadiusMd,
        borderWidth: StyleSheet.hairlineWidth,
        minWidth: '48%',
        padding: spacing.md,
    },

    metricLabelRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.xs,
        marginBottom: spacing.xs,
    },

    metricLabel: {
        ...typography.caption,
        color: colors.textMuted,
        textTransform: 'uppercase',
    },

    metricValue: {
        ...typography.body,
        fontWeight: '600',
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
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.divider,
        borderRadius: layout.borderRadiusMd,
        overflow: 'hidden',
        marginTop: spacing.lg,
    },

    detailRow: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.divider,
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

    detailValueError: {
        color: colors.negative,
    },

    description: {
        ...typography.label,
        color: colors.textSecondary,
        marginTop: spacing.xl,
        textTransform: 'uppercase',
    },

    actionList: {
        gap: spacing.sm,
    },

    actionCard: {
        alignItems: 'center',
        backgroundColor: colors.offWhite,
        borderColor: colors.divider,
        borderRadius: layout.borderRadiusMd,
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        gap: spacing.md,
        justifyContent: 'space-between',
        padding: spacing.md,
    },

    actionIconWrap: {
        alignItems: 'center',
        backgroundColor: '#3B82F61F',
        borderRadius: layout.borderRadiusSm,
        height: 32,
        justifyContent: 'center',
        width: 32,
    },

    maintenanceIconWrap: {
        backgroundColor: '#F59E0B1F',
    },

    actionCopy: {
        flex: 1,
    },

    actionTitle: {
        ...typography.body,
        color: colors.textPrimary,
        fontWeight: '600',
    },

    actionSubtitle: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        marginTop: 2,
    },

    maintenanceState: {
        ...typography.captionBold,
        color: colors.textMuted,
    },

    maintenanceStateActive: {
        color: '#F59E0B',
    },

    stepCard: {
        backgroundColor: colors.offWhite,
        borderColor: colors.divider,
        borderRadius: layout.borderRadiusMd,
        borderWidth: StyleSheet.hairlineWidth,
        marginTop: spacing.sm,
        overflow: 'hidden',
    },

    stepCardPadded: {
        backgroundColor: colors.offWhite,
        borderColor: colors.divider,
        borderRadius: layout.borderRadiusMd,
        borderWidth: StyleSheet.hairlineWidth,
        marginTop: spacing.sm,
        padding: spacing.md,
    },

    stepHeader: {
        alignItems: 'center',
        borderBottomColor: colors.divider,
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },

    stepTitle: {
        ...typography.body,
        color: colors.textPrimary,
        fontWeight: '600',
    },

    networkRow: {
        alignItems: 'center',
        borderBottomColor: colors.divider,
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },

    networkCopy: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.md,
    },

    networkSsid: {
        ...typography.body,
        color: colors.textPrimary,
    },

    networkMeta: {
        ...typography.bodySmall,
        color: colors.textMuted,
        marginTop: 2,
    },

    wifiBars: {
        alignItems: 'flex-end',
        flexDirection: 'row',
        gap: 2,
    },

    wifiBar: {
        backgroundColor: colors.textMuted,
        borderRadius: 1,
        width: 3,
    },

    passwordHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },

    passwordHeaderCopy: {
        flex: 1,
    },

    passwordSsid: {
        ...typography.body,
        color: colors.textPrimary,
        fontWeight: '600',
    },

    passwordMetaRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: 2,
    },

    passwordLabel: {
        ...typography.bodySmall,
        color: colors.textMuted,
        marginBottom: spacing.xs,
    },

    passwordInput: {
        ...typography.body,
        backgroundColor: '#0D1117',
        borderColor: colors.divider,
        borderRadius: layout.borderRadiusMd,
        borderWidth: 1,
        color: colors.textPrimary,
        marginBottom: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },

    connectButton: {
        alignItems: 'center',
        backgroundColor: '#3B82F6',
        borderRadius: layout.borderRadiusMd,
        paddingVertical: spacing.md,
    },

    connectButtonDisabled: {
        opacity: 0.45,
    },

    connectButtonText: {
        ...typography.button,
        color: colors.white,
    },

    stateCard: {
        alignItems: 'center',
        backgroundColor: colors.offWhite,
        borderColor: colors.divider,
        borderRadius: layout.borderRadiusMd,
        borderWidth: StyleSheet.hairlineWidth,
        gap: spacing.md,
        marginTop: spacing.sm,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.xl,
    },

    stateIconWrap: {
        alignItems: 'center',
        borderColor: '#3B82F666',
        borderRadius: 40,
        borderWidth: 2,
        height: 64,
        justifyContent: 'center',
        width: 64,
    },

    stateCopyWrap: {
        alignItems: 'center',
    },

    stateTitle: {
        ...typography.body,
        color: colors.textPrimary,
        fontWeight: '600',
    },

    stateSubtitle: {
        ...typography.bodySmall,
        color: colors.textMuted,
        marginTop: spacing.xs,
    },

    successCard: {
        alignItems: 'center',
        backgroundColor: '#34C75912',
        borderColor: '#34C75944',
        borderRadius: layout.borderRadiusMd,
        borderWidth: 1,
        gap: spacing.md,
        marginTop: spacing.sm,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.xl,
    },

    successIconWrap: {
        alignItems: 'center',
        backgroundColor: '#34C75922',
        borderRadius: 999,
        height: 64,
        justifyContent: 'center',
        width: 64,
    },

    successTitle: {
        ...typography.body,
        color: '#34C759',
        fontWeight: '600',
    },

    doneLink: {
        paddingVertical: spacing.xs,
    },

    doneLinkText: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        textDecorationLine: 'underline',
    },

    primaryAction: {
        marginTop: spacing.xl,
        alignItems: 'center',
        backgroundColor: colors.ctaPrimary,
        borderRadius: layout.borderRadiusPill,
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