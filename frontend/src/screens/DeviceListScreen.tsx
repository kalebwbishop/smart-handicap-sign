import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '@/types/navigation';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, layout, shadows } from '@/theme/spacing';
import { devicesAPI } from '@/api/devices';
import { Device, DeviceLifecycleStatus } from '@/types/device';

/* ──────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────── */

type FilterTab = 'all' | DeviceLifecycleStatus;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'unclaimed', label: 'Unclaimed' },
  { key: 'revoked', label: 'Revoked' },
  { key: 'retired', label: 'Retired' },
];

const STATUS_BADGE: Record<DeviceLifecycleStatus, { bg: string; text: string; label: string }> = {
  active:       { bg: '#34C75920', text: '#34C759', label: 'Active' },
  unclaimed:    { bg: '#007AFF20', text: '#007AFF', label: 'Unclaimed' },
  manufactured: { bg: '#8E8E9320', text: '#8E8E93', label: 'Manufactured' },
  claiming:     { bg: '#FF950020', text: '#FF9500', label: 'Claiming' },
  lost:         { bg: '#FF6B3520', text: '#FF6B35', label: 'Lost' },
  revoked:      { bg: '#FF3B3020', text: '#FF3B30', label: 'Revoked' },
  retired:      { bg: '#8E8E9320', text: '#6e6e73', label: 'Retired' },
};

/* ──────────────────────────────────────────────
 * Component
 * ────────────────────────────────────────────── */

export default function DeviceListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  /* ── Data fetching ── */

  const fetchDevices = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await devicesAPI.list();
      setDevices(data);
    } catch (err: any) {
      console.error('[DeviceList] Failed to fetch devices:', err);
      setError(err?.message || 'Failed to load devices');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const onRefresh = useCallback(() => fetchDevices(true), [fetchDevices]);

  /* ── Filtering ── */

  const filteredDevices =
    activeFilter === 'all'
      ? devices
      : devices.filter((d) => d.lifecycle_status === activeFilter);

  /* ── Renderers ── */

  const renderFilterChip = ({ key, label }: { key: FilterTab; label: string }) => {
    const isActive = activeFilter === key;
    return (
      <TouchableOpacity
        key={key}
        style={[styles.chip, isActive && styles.chipActive]}
        onPress={() => setActiveFilter(key)}
        activeOpacity={0.7}
      >
        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const renderDevice = ({ item }: { item: Device }) => {
    const badge = STATUS_BADGE[item.lifecycle_status];
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('DeviceDetail', { serial_number: item.serial_number })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.serialNumber} numberOfLines={1}>
            {item.serial_number}
          </Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        {item.name ? (
          <Text style={styles.deviceName} numberOfLines={1}>{item.name}</Text>
        ) : null}

        <View style={styles.cardMeta}>
          {item.model_code ? (
            <Text style={styles.metaText}>Model: {item.model_code}</Text>
          ) : null}
          {item.current_site_id ? (
            <Text style={styles.metaText}>Site assigned</Text>
          ) : null}
          {item.current_parking_space_id ? (
            <Text style={styles.metaText}>Space assigned</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📱</Text>
        <Text style={styles.emptyTitle}>No devices found</Text>
        <Text style={styles.emptySubtitle}>
          {activeFilter === 'all'
            ? 'Scan a QR code to claim your first device.'
            : `No ${activeFilter} devices.`}
        </Text>
      </View>
    );
  };

  /* ── Main render ── */

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Devices</Text>
        <TouchableOpacity
          style={styles.scanButton}
          activeOpacity={0.7}
          onPress={() => {
            // Navigate to QR scan screen if it exists
            (navigation as any).navigate('QRScan');
          }}
        >
          <Text style={styles.scanButtonText}>Scan QR</Text>
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTER_TABS.map(renderFilterChip)}
      </View>

      {/* Error banner */}
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchDevices()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Loading state */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredDevices}
          keyExtractor={(item) => item.id}
          renderItem={renderDevice}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

/* ──────────────────────────────────────────────
 * Styles
 * ────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.contentPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  } as any,
  scanButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: layout.borderRadiusPill,
  },
  scanButtonText: {
    ...typography.label,
    color: colors.ctaPrimaryText,
  } as any,

  /* Filter chips */
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.contentPadding,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: layout.borderRadiusPill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.label,
    color: colors.textSecondary,
  } as any,
  chipTextActive: {
    color: colors.ctaPrimaryText,
  },

  /* Device card */
  card: {
    backgroundColor: colors.card,
    borderRadius: layout.borderRadiusMd,
    marginHorizontal: spacing.contentPadding,
    marginBottom: spacing.md,
    padding: spacing.md,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  serialNumber: {
    ...typography.captionBold,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  } as any,
  deviceName: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  } as any,
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
    borderRadius: layout.borderRadiusPill,
  },
  badgeText: {
    ...typography.label,
    fontSize: 11,
  } as any,
  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  metaText: {
    ...typography.small,
    color: colors.textMuted,
  } as any,

  /* Empty state */
  emptyContainer: {
    alignItems: 'center',
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.contentPadding,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  } as any,
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  } as any,

  /* Error */
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FF3B3010',
    marginHorizontal: spacing.contentPadding,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: layout.borderRadiusSm,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.negative,
    flex: 1,
  } as any,
  retryText: {
    ...typography.captionBold,
    color: colors.primary,
    marginLeft: spacing.sm,
  } as any,

  /* Loading */
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* List */
  listContent: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
  },
});
