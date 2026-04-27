import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    Pressable,
    TextInput,
    FlatList,
    ScrollView,
    ActivityIndicator,
    StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types/navigation';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, layout } from '@/theme/spacing';
import { checkEspStatus, scanNetworks, configureWifi, WifiNetwork } from '@/api/espApi';

const TOTAL_STEPS = 5;

/* ──────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────── */

function signalLabel(rssi: number) {
    if (rssi >= -50) return { icon: '📶', text: 'Excellent' };
    if (rssi >= -60) return { icon: '📶', text: 'Good' };
    if (rssi >= -70) return { icon: '📶', text: 'Fair' };
    return { icon: '📶', text: 'Weak' };
}

function authmodeLabel(mode: number) {
    const map: Record<number, string> = { 0: 'Open', 1: 'WEP', 2: 'WPA', 3: 'WPA2', 4: 'WPA/WPA2' };
    return map[mode] ?? 'Secured';
}

/* ──────────────────────────────────────────────
 * Component
 * ────────────────────────────────────────────── */

export default function SetupGuideScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const insets = useSafeAreaInsets();
    const [current, setCurrent] = useState(0);

    // WiFi states (steps 2-3)
    const [checking, setChecking] = useState(false);
    const [connected, setConnected] = useState(false);
    const [checkError, setCheckError] = useState<string | null>(null);

    const [networks, setNetworks] = useState<WifiNetwork[]>([]);
    const [scanning, setScanning] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);

    const [selectedSsid, setSelectedSsid] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [configuring, setConfiguring] = useState(false);
    const [configError, setConfigError] = useState<string | null>(null);
    const [wifiDone, setWifiDone] = useState(false);

    /* ── Actions ── */

    const handleCheckConnection = useCallback(async () => {
        setChecking(true);
        setCheckError(null);
        try {
            await checkEspStatus();
            setConnected(true);
        } catch (err: any) {
            setCheckError(err.message || 'Could not reach the SmartSign device.');
        } finally {
            setChecking(false);
        }
    }, []);

    const handleScan = useCallback(async () => {
        setScanning(true);
        setScanError(null);
        try {
            const results = await scanNetworks();
            setNetworks(results);
        } catch (err: any) {
            setScanError(err.message || 'Failed to scan networks.');
        } finally {
            setScanning(false);
        }
    }, []);

    const handleConfigure = useCallback(async () => {
        if (!selectedSsid) return;
        setConfiguring(true);
        setConfigError(null);
        try {
            await configureWifi(selectedSsid, password);
            setWifiDone(true);
            setCurrent(4); // jump to final step
        } catch (err: any) {
            if (err.message?.includes('Network request failed') || err.message?.includes('Could not reach')) {
                setWifiDone(true);
                setCurrent(4);
            } else {
                setConfigError(err.message || 'Configuration failed.');
            }
        } finally {
            setConfiguring(false);
        }
    }, [selectedSsid, password]);

    /* ── Navigation helpers ── */

    const canGoNext = () => {
        if (current === 2 && !connected) return false; // must verify connection first
        if (current === 3 && !wifiDone) return false;  // must configure wifi first
        return current < TOTAL_STEPS - 1;
    };

    const goNext = () => {
        if (current === 2 && !connected) return;
        if (current < TOTAL_STEPS - 1) setCurrent((c) => c + 1);
    };

    const goPrev = () => setCurrent((c) => Math.max(0, c - 1));

    /* ── Step renderers ── */

    const renderInfoStep = (icon: string, title: string, body: string) => (
        <View style={s.content}>
            <Text style={s.icon}>{icon}</Text>
            <Text style={s.stepLabel}>Step {current + 1} of {TOTAL_STEPS}</Text>
            <Text style={s.title}>{title}</Text>
            <Text style={s.body}>{body}</Text>
        </View>
    );

    const renderStep = () => {
        switch (current) {
            /* Step 1 – Power on */
            case 0:
                return renderInfoStep(
                    '🔌',
                    'Power on the SmartSign',
                    'Plug in your SmartSign device and wait a few seconds. The LED will blink blue to indicate it\'s in pairing mode.',
                );

            /* Step 2 – Connect to sign WiFi */
            case 1:
                return renderInfoStep(
                    '📶',
                    'Connect to the sign\'s WiFi',
                    'Open your phone\'s WiFi settings and connect to the network named "SmartSign-XXXX". No password is needed.',
                );

            /* Step 3 – Verify connection */
            case 2:
                return (
                    <View style={s.content}>
                        <Text style={s.icon}>{checkError ? '⚠️' : '🔗'}</Text>
                        <Text style={s.stepLabel}>Step 3 of {TOTAL_STEPS}</Text>
                        <Text style={s.title}>Verify Connection</Text>
                        <Text style={s.body}>
                            {connected
                                ? 'Connected to your SmartSign! Tap Next to scan for WiFi networks.'
                                : checkError
                                    ? 'We couldn\'t reach the SmartSign. Try these fixes:'
                                    : 'Tap below to check that your phone can reach the SmartSign device.'}
                        </Text>
                        {checkError && (
                            <View style={s.troubleshootList}>
                                <Text style={s.troubleshootItem}>1. Open WiFi settings and make sure you're connected to "SmartSign-XXXX"</Text>
                                <Text style={s.troubleshootItem}>2. Turn off mobile data - your phone may be routing traffic over cellular instead</Text>
                                <Text style={s.troubleshootItem}>3. Move closer to the sign and try again</Text>
                                <Text style={s.troubleshootItem}>4. Unplug the sign, wait 10 seconds, and plug it back in</Text>
                            </View>
                        )}
                        {!connected && (
                            <Pressable
                                onPress={handleCheckConnection}
                                disabled={checking}
                                style={({ pressed }) => [s.actionBtn, checking && { opacity: 0.6 }, pressed && { opacity: 0.8 }]}
                            >
                                {checking ? (
                                    <ActivityIndicator size="small" color={colors.ctaPrimaryText} />
                                ) : (
                                    <Text style={s.actionBtnText}>{checkError ? 'Try Again' : 'Check Connection'}</Text>
                                )}
                            </Pressable>
                        )}
                        {connected && <Text style={s.successBadge}>✓ Device found</Text>}
                    </View>
                );

            /* Step 4 – Scan & configure WiFi */
            case 3:
                return (
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={s.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        <Text style={s.stepLabel}>Step 4 of {TOTAL_STEPS}</Text>
                        <Text style={[s.title, { textAlign: 'left' }]}>Configure WiFi</Text>
                        <Text style={[s.body, { textAlign: 'left', maxWidth: undefined }]}>
                            Scan for nearby networks, pick one, and enter the password.
                        </Text>

                        <Pressable
                            onPress={handleScan}
                            disabled={scanning}
                            style={({ pressed }) => [s.scanBtn, scanning && { opacity: 0.6 }, pressed && { opacity: 0.8 }]}
                        >
                            {scanning ? (
                                <ActivityIndicator size="small" color={colors.textPrimary} />
                            ) : (
                                <Text style={[typography.button, { color: colors.textPrimary }]}>
                                    {networks.length > 0 ? 'Rescan' : 'Scan Networks'}
                                </Text>
                            )}
                        </Pressable>

                        {scanError && <Text style={s.errorText}>{scanError}</Text>}

                        {networks.length > 0 && (
                            <View style={s.networkList}>
                                {networks.map((net) => {
                                    const sig = signalLabel(net.rssi);
                                    const selected = net.ssid === selectedSsid;
                                    return (
                                        <Pressable
                                            key={net.ssid}
                                            onPress={() => { setSelectedSsid(net.ssid); setPassword(''); setConfigError(null); }}
                                            style={[s.networkRow, selected && s.networkRowSelected]}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '700' }]}>
                                                    {net.ssid}
                                                </Text>
                                                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                                                    {sig.icon} {sig.text} · {authmodeLabel(net.authmode)}
                                                </Text>
                                            </View>
                                            {selected && <Text style={{ fontSize: 18, color: colors.primary }}>✓</Text>}
                                        </Pressable>
                                    );
                                })}
                            </View>
                        )}

                        {selectedSsid && (
                            <View style={s.passwordSection}>
                                <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                                    PASSWORD FOR {selectedSsid}
                                </Text>
                                <TextInput
                                    style={s.input}
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="WiFi password"
                                    placeholderTextColor={colors.textMuted}
                                    secureTextEntry
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                <Pressable
                                    onPress={handleConfigure}
                                    disabled={configuring}
                                    style={({ pressed }) => [s.actionBtn, { alignSelf: 'stretch' }, configuring && { opacity: 0.6 }, pressed && { opacity: 0.8 }]}
                                >
                                    {configuring ? (
                                        <ActivityIndicator size="small" color={colors.ctaPrimaryText} />
                                    ) : (
                                        <Text style={s.actionBtnText}>Save & Connect</Text>
                                    )}
                                </Pressable>
                                {configError && <Text style={s.errorText}>{configError}</Text>}
                            </View>
                        )}
                    </ScrollView>
                );

            /* Step 5 – Done */
            case 4:
                return renderInfoStep(
                    '✅',
                    'You\'re all set!',
                    wifiDone
                        ? `Your SmartSign is rebooting and connecting to ${selectedSsid || 'your network'}. Reconnect your phone to your regular WiFi, then head back to the dashboard and pull down to refresh.`
                        : 'Head back to the dashboard and pull down to refresh. Your sign should appear within a few seconds.',
                );

            default:
                return null;
        }
    };

    /* ── Main render ── */

    const isFirst = current === 0;
    const isLast = current === TOTAL_STEPS - 1;

    return (
        <View style={[s.root, { paddingBottom: insets.bottom + spacing.md }]}>
            {/* Step content */}
            {renderStep()}

            {/* Navigation buttons — hide on step 4 (WiFi configure) since it auto-advances */}
            {current !== 3 && (
                <View style={s.navRow}>
                    {isFirst ? (
                        <Pressable
                            onPress={() => navigation.goBack()}
                            style={({ pressed }) => [s.navBtn, s.navBtnSecondary, pressed && { opacity: 0.7 }]}
                        >
                            <Text style={s.navBtnSecondaryText}>Cancel</Text>
                        </Pressable>
                    ) : (
                        <Pressable
                            onPress={goPrev}
                            style={({ pressed }) => [s.navBtn, s.navBtnSecondary, pressed && { opacity: 0.7 }]}
                        >
                            <Text style={s.navBtnSecondaryText}>Previous</Text>
                        </Pressable>
                    )}

                    {isLast ? (
                        <Pressable
                            onPress={() => navigation.goBack()}
                            style={({ pressed }) => [s.navBtn, s.navBtnPrimary, pressed && { opacity: 0.8 }]}
                        >
                            <Text style={s.navBtnPrimaryText}>Done</Text>
                        </Pressable>
                    ) : (
                        <Pressable
                            onPress={goNext}
                            disabled={!canGoNext()}
                            style={({ pressed }) => [s.navBtn, s.navBtnPrimary, !canGoNext() && { opacity: 0.4 }, pressed && { opacity: 0.8 }]}
                        >
                            <Text style={s.navBtnPrimaryText}>Next</Text>
                        </Pressable>
                    )}
                </View>
            )}

            {/* Progress dots */}
            <View style={s.dots}>
                {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                    <View key={i} style={[s.dot, i === current && s.dotActive]} />
                ))}
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
        backgroundColor: colors.white,
        paddingHorizontal: layout.contentPadding,
    },

    /* Progress */
    dots: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: spacing.md,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.divider,
    },
    dotActive: {
        width: 24,
        backgroundColor: colors.primary,
    },

    /* Content — centered info steps */
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
    },
    icon: {
        fontSize: 56,
        marginBottom: spacing.lg,
    },
    stepLabel: {
        ...typography.label,
        color: colors.primary,
        marginBottom: spacing.sm,
    },
    title: {
        ...typography.h2,
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    body: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        maxWidth: 340,
    },

    /* Buttons */
    actionBtn: {
        marginTop: spacing.xl,
        paddingVertical: 14,
        paddingHorizontal: spacing.xl,
        borderRadius: layout.borderRadiusPill,
        backgroundColor: colors.ctaPrimary,
        alignItems: 'center',
    },
    actionBtnText: {
        ...typography.button,
        color: colors.ctaPrimaryText,
    },
    scanBtn: {
        marginTop: spacing.lg,
        paddingVertical: 14,
        borderRadius: layout.borderRadiusPill,
        backgroundColor: colors.offWhite,
        alignItems: 'center',
    },

    /* Feedback badges */
    successBadge: {
        marginTop: spacing.lg,
        color: '#34c759',
        fontSize: 16,
        fontWeight: '700',
    },
    errorText: {
        ...typography.bodySmall,
        color: colors.negative,
        marginTop: spacing.sm,
        textAlign: 'center',
    },
    troubleshootList: {
        marginTop: spacing.lg,
        alignSelf: 'stretch',
        backgroundColor: colors.offWhite,
        borderRadius: layout.borderRadiusSm,
        padding: spacing.md,
        gap: spacing.sm,
    },
    troubleshootItem: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        lineHeight: 20,
    },

    /* WiFi step (scrollable) */
    scrollContent: {
        paddingTop: spacing.xl,
        paddingBottom: spacing.xxl,
    },
    networkList: {
        marginTop: spacing.lg,
        borderRadius: layout.borderRadiusSm,
        overflow: 'hidden',
    },
    networkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.divider,
    },
    networkRowSelected: {
        backgroundColor: colors.primary + '10',
    },
    passwordSection: {
        marginTop: spacing.xl,
    },
    input: {
        backgroundColor: colors.offWhite,
        borderRadius: layout.borderRadiusPill,
        padding: spacing.md,
        fontSize: 16,
        color: colors.textPrimary,
        marginBottom: spacing.xs,
    },

    /* Nav buttons */
    navRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        paddingTop: spacing.md,
    },
    navBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 16,
        borderRadius: layout.borderRadiusPill,
    },
    navBtnPrimary: {
        backgroundColor: colors.ctaPrimary,
    },
    navBtnPrimaryText: {
        ...typography.button,
        color: colors.ctaPrimaryText,
    },
    navBtnSecondary: {
        backgroundColor: colors.offWhite,
    },
    navBtnSecondaryText: {
        ...typography.button,
        color: colors.textSecondary,
    },
});
