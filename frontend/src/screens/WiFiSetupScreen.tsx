import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TextInput,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    Platform,
    FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, layout } from '@/theme/spacing';
import { checkEspStatus, scanNetworks, configureWifi, WifiNetwork } from '@/api/espApi';

/* ──────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────── */

/** Map RSSI to a simple signal-strength label + icon. */
function signalLabel(rssi: number): { icon: string; text: string } {
    if (rssi >= -50) return { icon: '📶', text: 'Excellent' };
    if (rssi >= -60) return { icon: '📶', text: 'Good' };
    if (rssi >= -70) return { icon: '📶', text: 'Fair' };
    return { icon: '📶', text: 'Weak' };
}

/** Auth-mode number → readable label. */
function authmodeLabel(mode: number): string {
    const map: Record<number, string> = {
        0: 'Open',
        1: 'WEP',
        2: 'WPA-PSK',
        3: 'WPA2-PSK',
        4: 'WPA/WPA2-PSK',
    };
    return map[mode] ?? 'Secured';
}

/* ──────────────────────────────────────────────
 * Component
 * ────────────────────────────────────────────── */

export default function WiFiSetupScreen() {
    const navigation = useNavigation();

    // Connection check
    const [connected, setConnected] = useState(false);
    const [checking, setChecking] = useState(false);
    const [checkError, setCheckError] = useState<string | null>(null);

    // Network scan
    const [networks, setNetworks] = useState<WifiNetwork[]>([]);
    const [scanning, setScanning] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);

    // Selected network + password
    const [selectedSsid, setSelectedSsid] = useState<string | null>(null);
    const [password, setPassword] = useState('');

    // Configure state
    const [configuring, setConfiguring] = useState(false);
    const [success, setSuccess] = useState(false);
    const [configError, setConfigError] = useState<string | null>(null);

    /* ── Actions ── */

    const handleCheckConnection = useCallback(async () => {
        setChecking(true);
        setCheckError(null);
        try {
            await checkEspStatus();
            setConnected(true);
        } catch (err: any) {
            setCheckError(err.message || 'Could not connect to SmartSign device.');
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
            setSuccess(true);
        } catch (err: any) {
            // The ESP32 reboots immediately so the connection may drop — treat as success
            if (err.message?.includes('Network request failed') || err.message?.includes('Could not reach')) {
                setSuccess(true);
            } else {
                setConfigError(err.message || 'Configuration failed.');
            }
        } finally {
            setConfiguring(false);
        }
    }, [selectedSsid, password]);

    /* ── Render helpers ── */

    const renderNetworkItem = useCallback(
        ({ item }: { item: WifiNetwork }) => {
            const sig = signalLabel(item.rssi);
            const isSelected = item.ssid === selectedSsid;
            return (
                <Pressable
                    onPress={() => {
                        setSelectedSsid(item.ssid);
                        setPassword('');
                        setConfigError(null);
                    }}
                    style={({ pressed }) => [
                        s.networkRow,
                        isSelected && s.networkRowSelected,
                        pressed && { opacity: 0.8 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${item.ssid}`}
                >
                    <View style={s.networkInfo}>
                        <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '700' }]}>
                            {item.ssid}
                        </Text>
                        <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                            {sig.icon} {sig.text} · {authmodeLabel(item.authmode)}
                        </Text>
                    </View>
                    {isSelected && <Text style={{ fontSize: 18 }}>✓</Text>}
                </Pressable>
            );
        },
        [selectedSsid],
    );

    /* ── Main render ── */

    return (
        <View style={s.root}>
            <ScrollView style={s.scrollView} contentContainerStyle={s.scrollContent}>
                <View style={s.content}>
                    {success ? (
                        /* ── Success state ── */
                        <View style={s.card}>
                            <View style={s.successContainer}>
                                <Text style={{ fontSize: 48 }}>✅</Text>
                                <Text
                                    style={[
                                        typography.h3,
                                        { color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' },
                                    ]}
                                >
                                    WiFi Configured!
                                </Text>
                                <Text
                                    style={[
                                        typography.body,
                                        {
                                            color: colors.textSecondary,
                                            marginTop: spacing.sm,
                                            textAlign: 'center',
                                        },
                                    ]}
                                >
                                    The SmartSign device is rebooting and will connect to{' '}
                                    <Text style={{ fontWeight: '700' }}>{selectedSsid}</Text>. You can now
                                    reconnect your phone to your regular WiFi.
                                </Text>
                                <Pressable
                                    onPress={() => navigation.goBack()}
                                    style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.8 }]}
                                    accessibilityRole="button"
                                >
                                    <Text style={[typography.button, { color: colors.ctaPrimaryText }]}>Done</Text>
                                </Pressable>
                            </View>
                        </View>
                    ) : !connected ? (
                        /* ── Step 1: Connect to ESP32 AP ── */
                        <View style={s.card}>
                            <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                                Step 1: Connect to Device
                            </Text>
                            <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
                                Open your phone's WiFi settings and connect to the network named{' '}
                                <Text style={{ fontWeight: '700' }}>SmartSign-XXXX</Text>. Then come back here
                                and tap the button below.
                            </Text>
                            <Pressable
                                onPress={handleCheckConnection}
                                disabled={checking}
                                style={({ pressed }) => [
                                    s.primaryBtn,
                                    checking && { opacity: 0.6 },
                                    pressed && { opacity: 0.8 },
                                ]}
                                accessibilityRole="button"
                            >
                                {checking ? (
                                    <ActivityIndicator size="small" color={colors.ctaPrimaryText} />
                                ) : (
                                    <Text style={[typography.button, { color: colors.ctaPrimaryText }]}>
                                        I'm Connected — Check Device
                                    </Text>
                                )}
                            </Pressable>
                            {checkError && (
                                <Text style={[typography.bodySmall, { color: colors.negative, marginTop: spacing.sm }]}>
                                    {checkError}
                                </Text>
                            )}
                        </View>
                    ) : (
                        /* ── Step 2: Scan & configure ── */
                        <>
                            <View style={s.card}>
                                <Text
                                    style={[
                                        typography.h3,
                                        { color: colors.textPrimary, marginBottom: spacing.sm },
                                    ]}
                                >
                                    Step 2: Select WiFi Network
                                </Text>
                                <Text
                                    style={[
                                        typography.body,
                                        { color: colors.textSecondary, marginBottom: spacing.lg },
                                    ]}
                                >
                                    Scan for nearby networks, then choose the one you want the SmartSign to
                                    connect to.
                                </Text>

                                <Pressable
                                    onPress={handleScan}
                                    disabled={scanning}
                                    style={({ pressed }) => [
                                        s.secondaryBtn,
                                        scanning && { opacity: 0.6 },
                                        pressed && { opacity: 0.8 },
                                    ]}
                                    accessibilityRole="button"
                                >
                                    {scanning ? (
                                        <ActivityIndicator size="small" color={colors.textPrimary} />
                                    ) : (
                                        <Text style={[typography.button, { color: colors.textPrimary }]}>
                                            {networks.length > 0 ? 'Rescan Networks' : 'Scan Networks'}
                                        </Text>
                                    )}
                                </Pressable>

                                {scanError && (
                                    <Text
                                        style={[
                                            typography.bodySmall,
                                            { color: colors.negative, marginTop: spacing.sm },
                                        ]}
                                    >
                                        {scanError}
                                    </Text>
                                )}

                                {networks.length > 0 && (
                                    <View style={s.networkList}>
                                        <FlatList
                                            data={networks}
                                            keyExtractor={(item) => item.ssid}
                                            renderItem={renderNetworkItem}
                                            scrollEnabled={false}
                                        />
                                    </View>
                                )}
                            </View>

                            {/* Password + Submit */}
                            {selectedSsid && (
                                <View style={s.card}>
                                    <Text
                                        style={[
                                            typography.h3,
                                            { color: colors.textPrimary, marginBottom: spacing.sm },
                                        ]}
                                    >
                                        Step 3: Enter Password
                                    </Text>
                                    <Text
                                        style={[
                                            typography.body,
                                            { color: colors.textSecondary, marginBottom: spacing.md },
                                        ]}
                                    >
                                        Enter the WiFi password for{' '}
                                        <Text style={{ fontWeight: '700' }}>{selectedSsid}</Text>.
                                    </Text>

                                    <View style={s.fieldGroup}>
                                        <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                                            PASSWORD
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
                                            accessibilityLabel="WiFi password"
                                        />
                                    </View>

                                    <Pressable
                                        onPress={handleConfigure}
                                        disabled={configuring}
                                        style={({ pressed }) => [
                                            s.primaryBtn,
                                            configuring && { opacity: 0.6 },
                                            pressed && { opacity: 0.8 },
                                        ]}
                                        accessibilityRole="button"
                                    >
                                        {configuring ? (
                                            <ActivityIndicator size="small" color={colors.ctaPrimaryText} />
                                        ) : (
                                            <Text style={[typography.button, { color: colors.ctaPrimaryText }]}>
                                                Save & Connect
                                            </Text>
                                        )}
                                    </Pressable>

                                    {configError && (
                                        <Text
                                            style={[
                                                typography.bodySmall,
                                                { color: colors.negative, marginTop: spacing.sm },
                                            ]}
                                        >
                                            {configError}
                                        </Text>
                                    )}
                                </View>
                            )}
                        </>
                    )}
                </View>
            </ScrollView>
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
        alignItems: 'center',
    },
    backBtn: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        width: 60,
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
        backgroundColor: colors.card,
        borderRadius: layout.borderRadius,
        padding: spacing.xl,
        ...Platform.select({
            web: { boxShadow: '0px 8px 8px rgba(0,0,0,0.3)' },
            default: {
                elevation: 8,
                shadowColor: colors.shadowMedium,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 1,
                shadowRadius: 8,
            },
        }),
    },

    /* Buttons */
    primaryBtn: {
        marginTop: spacing.md,
        backgroundColor: colors.ctaPrimary,
        paddingVertical: 14,
        borderRadius: layout.borderRadiusPill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryBtn: {
        paddingVertical: 14,
        borderRadius: layout.borderRadiusPill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.grayMid,
    },

    /* Network list */
    networkList: {
        marginTop: spacing.lg,
    },
    networkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: layout.borderRadiusSm,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
    },
    networkRowSelected: {
        backgroundColor: 'rgba(24,119,242,0.08)',
        borderLeftWidth: 3,
        borderLeftColor: colors.accent,
    },
    networkInfo: {
        flex: 1,
    },

    /* Form */
    fieldGroup: {
        marginBottom: spacing.sm,
    },
    input: {
        backgroundColor: colors.grayMid,
        borderRadius: layout.borderRadiusPill,
        padding: spacing.md,
        fontSize: 16,
        color: colors.textPrimary,
    },

    /* Success */
    successContainer: {
        alignItems: 'center',
        paddingVertical: spacing.lg,
    },
});
