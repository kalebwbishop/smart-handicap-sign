import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    Platform,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, layout } from '@/theme/spacing';
import apiClient from '@/api/client';

/* ──────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────── */

interface InferenceEntry {
    timestamp: number;
    serial_number: string | null;
    label: string;
    confidence: number;
    samples: number[];
}

/* ──────────────────────────────────────────────
 * Simple SVG Line Chart (web-compatible)
 * ────────────────────────────────────────────── */

function WaveformChart({ samples, label, confidence }: { samples: number[]; label: string; confidence: number }) {
    const width = 600;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 30, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Scale samples (0-4095) to chart coordinates
    const points = samples.map((val, i) => {
        const x = padding.left + (i / (samples.length - 1)) * chartWidth;
        const y = padding.top + chartHeight - (val / 4095) * chartHeight;
        return `${x},${y}`;
    }).join(' ');

    const midY = padding.top + chartHeight - (2048 / 4095) * chartHeight;
    const strokeColor = label === 'wave' ? '#22c55e' : '#2563EB';

    if (Platform.OS === 'web') {
        return (
            <View style={chartStyles.container}>
                <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ maxWidth: width }}>
                    {/* Background */}
                    <rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight} fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />

                    {/* Midpoint line */}
                    <line x1={padding.left} y1={midY} x2={width - padding.right} y2={midY} stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="4,4" />

                    {/* Waveform */}
                    <polyline points={points} fill="none" stroke={strokeColor} strokeWidth="1.5" />

                    {/* Y-axis labels */}
                    <text x={padding.left - 5} y={padding.top + 5} textAnchor="end" fontSize="10" fill="#64748b">4095</text>
                    <text x={padding.left - 5} y={midY + 3} textAnchor="end" fontSize="10" fill="#64748b">2048</text>
                    <text x={padding.left - 5} y={padding.top + chartHeight + 3} textAnchor="end" fontSize="10" fill="#64748b">0</text>

                    {/* X-axis label */}
                    <text x={width / 2} y={height - 5} textAnchor="middle" fontSize="10" fill="#64748b">Sample Index (0–511)</text>

                    {/* Classification badge */}
                    <rect x={width - padding.right - 130} y={padding.top + 5} width="120" height="24" rx="4" fill={strokeColor} fillOpacity="0.15" />
                    <text x={width - padding.right - 70} y={padding.top + 21} textAnchor="middle" fontSize="12" fontWeight="bold" fill={strokeColor}>
                        {label.toUpperCase()} {(confidence * 100).toFixed(1)}%
                    </text>
                </svg>
            </View>
        );
    }

    // Non-web fallback: show the backend-generated graph image
    return (
        <View style={chartStyles.container}>
            <Text style={[typography.bodySmall, { color: colors.textMuted, textAlign: 'center' }]}>
                Chart available on web. Label: {label.toUpperCase()} ({(confidence * 100).toFixed(1)}%)
            </Text>
        </View>
    );
}

/* ──────────────────────────────────────────────
 * Main Component
 * ────────────────────────────────────────────── */

export default function InferenceDebugScreen() {
    const insets = useSafeAreaInsets();
    const [history, setHistory] = useState<InferenceEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [selectedEntry, setSelectedEntry] = useState<InferenceEntry | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchHistory = useCallback(async () => {
        try {
            const data = await apiClient.get<InferenceEntry[]>('/inference/history?limit=30');
            setHistory(data);
            if (data.length > 0 && !selectedEntry) {
                setSelectedEntry(data[0]);
            } else if (data.length > 0 && selectedEntry) {
                // Update the selected entry if new data came in
                setSelectedEntry(data[0]);
            }
        } catch (err) {
            console.error('[InferenceDebug] Failed to fetch history:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    useEffect(() => {
        if (autoRefresh) {
            intervalRef.current = setInterval(fetchHistory, 3000);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [autoRefresh, fetchHistory]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchHistory();
        setRefreshing(false);
    }, [fetchHistory]);

    const formatTime = (ts: number) => {
        const d = new Date(ts * 1000);
        return d.toLocaleTimeString();
    };

    return (
        <View style={[s.root, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={s.header}>
                <Text style={[typography.h3, { color: colors.textPrimary }]}>Inference Debug</Text>
                <Pressable
                    onPress={() => setAutoRefresh(!autoRefresh)}
                    style={({ pressed }) => [s.autoRefreshBtn, autoRefresh && s.autoRefreshActive, pressed && { opacity: 0.7 }]}
                >
                    <Text style={[typography.bodySmall, { color: autoRefresh ? '#fff' : colors.textSecondary }]}>
                        {autoRefresh ? '⏸ Pause' : '▶ Auto-refresh'}
                    </Text>
                </Pressable>
            </View>

            <ScrollView
                style={s.scrollView}
                contentContainerStyle={s.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
                {loading ? (
                    <View style={s.center}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>
                            Waiting for inference data…
                        </Text>
                    </View>
                ) : history.length === 0 ? (
                    <View style={s.center}>
                        <Text style={{ fontSize: 48 }}>📡</Text>
                        <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
                            No inference data yet.{'\n'}Waiting for device to send samples…
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* Latest waveform chart */}
                        {selectedEntry && (
                            <View style={s.card}>
                                <Text style={[typography.h4, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
                                    Latest Waveform
                                </Text>
                                <Text style={[typography.bodySmall, { color: colors.textMuted, marginBottom: spacing.sm }]}>
                                    {selectedEntry.serial_number || 'Unknown'} • {formatTime(selectedEntry.timestamp)}
                                </Text>
                                <WaveformChart
                                    samples={selectedEntry.samples}
                                    label={selectedEntry.label}
                                    confidence={selectedEntry.confidence}
                                />
                            </View>
                        )}

                        {/* Stats summary */}
                        <View style={s.card}>
                            <Text style={[typography.h4, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                                Recent Stats
                            </Text>
                            <View style={s.statsRow}>
                                <StatBadge
                                    label="Total"
                                    value={history.length.toString()}
                                    color={colors.primary}
                                />
                                <StatBadge
                                    label="Waves"
                                    value={history.filter(e => e.label === 'wave').length.toString()}
                                    color="#22c55e"
                                />
                                <StatBadge
                                    label="Non-waves"
                                    value={history.filter(e => e.label !== 'wave').length.toString()}
                                    color="#6b7280"
                                />
                                {history.length > 0 && (
                                    <StatBadge
                                        label="Avg Conf"
                                        value={`${(history.reduce((s, e) => s + e.confidence, 0) / history.length * 100).toFixed(0)}%`}
                                        color="#8b5cf6"
                                    />
                                )}
                            </View>
                        </View>

                        {/* History list */}
                        <View style={s.card}>
                            <Text style={[typography.h4, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                                History ({history.length})
                            </Text>
                            {history.map((entry, idx) => (
                                <Pressable
                                    key={`${entry.timestamp}-${idx}`}
                                    onPress={() => setSelectedEntry(entry)}
                                    style={({ pressed }) => [
                                        s.historyRow,
                                        selectedEntry === entry && s.historyRowSelected,
                                        pressed && { opacity: 0.7 },
                                    ]}
                                >
                                    <View style={[s.labelDot, { backgroundColor: entry.label === 'wave' ? '#22c55e' : '#6b7280' }]} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={[typography.body, { color: colors.textPrimary }]}>
                                            {entry.label.toUpperCase()} — {(entry.confidence * 100).toFixed(1)}%
                                        </Text>
                                        <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                                            {entry.serial_number || 'Unknown'} • {formatTime(entry.timestamp)}
                                        </Text>
                                    </View>
                                    <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                                        min:{Math.min(...entry.samples)} max:{Math.max(...entry.samples)}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
}

/* ──────────────────────────────────────────────
 * Sub-components
 * ────────────────────────────────────────────── */

function StatBadge({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <View style={[s.statBadge, { borderColor: color + '40' }]}>
            <Text style={[typography.h3, { color }]}>{value}</Text>
            <Text style={[typography.bodySmall, { color: colors.textMuted }]}>{label}</Text>
        </View>
    );
}

/* ──────────────────────────────────────────────
 * Styles
 * ────────────────────────────────────────────── */

const chartStyles = StyleSheet.create({
    container: {
        alignItems: 'center',
        overflow: 'hidden',
    },
});

const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: colors.offWhite,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: layout.contentPadding,
        paddingVertical: spacing.md,
        backgroundColor: colors.white,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.divider,
    },
    autoRefreshBtn: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: 16,
        backgroundColor: colors.offWhite,
        borderWidth: 1,
        borderColor: colors.divider,
    },
    autoRefreshActive: {
        backgroundColor: '#2563EB',
        borderColor: '#2563EB',
    },
    scrollView: { flex: 1 },
    scrollContent: {
        padding: layout.contentPadding,
        paddingBottom: spacing.xxl,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
    },
    card: {
        backgroundColor: colors.white,
        borderRadius: 12,
        padding: spacing.lg,
        marginBottom: spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    statsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    statBadge: {
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 8,
        borderWidth: 1,
        minWidth: 70,
    },
    historyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderRadius: 8,
        marginBottom: 2,
    },
    historyRowSelected: {
        backgroundColor: '#eff6ff',
    },
    labelDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: spacing.sm,
    },
});
