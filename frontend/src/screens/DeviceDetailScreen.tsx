import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types/navigation';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, layout, shadows } from '@/theme/spacing';
import { devicesAPI } from '@/api/devices';
import { Device, DeviceEvent, DeviceLifecycleStatus } from '@/types/device';

/* ──────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────── */

const STATUS_BADGE: Record<DeviceLifecycleStatus, { bg: string; text: string; label: string }> = {
  active:       { bg: '#34C75920', text: '#34C759', label: 'Active' },
  unclaimed:    { bg: '#007AFF20', text: '#007AFF', label: 'Unclaimed' },
  manufactured: { bg: '#8E8E9320', text: '#8E8E93', label: 'Manufactured' },
  claiming:     { bg: '#FF950020', text: '#FF9500', label: 'Claiming' },
  lost:         { bg: '#FF6B3520', text: '#FF6B35', label: 'Lost' },
  revoked:      { bg: '#FF3B3020', text: '#FF3B30', label: 'Revoked' },
  retired:      { bg: '#8E8E9320', text: '#6e6e73', label: 'Retired' },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

export default function DeviceDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'DeviceDetail'>>();
  const { serial_number } = route.params;

  const [device, setDevice] = useState<Device | null>(null);
  const [events, setEvents] = useState<DeviceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  /* ── Data fetching ── */

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [deviceData, eventData] = await Promise.all([
        devicesAPI.getBySerial(serial_number),
        devicesAPI.getEvents(serial_number),
      ]);
      setDevice(deviceData);
      setEvents(eventData);
    } catch (err: any) {
      console.error('[DeviceDetail] Failed to fetch:', err);
      setError(err?.message || 'Failed to load device');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [serial_number]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => fetchData(true), [fetchData]);

  /* ── Admin actions ── */

  const handleTransfer = () => {
    Alert.alert(
      'Transfer Device',
      'Enter the new site ID and parking space ID to transfer this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: () => {
            // For now, show a prompt for site ID. A full implementation
            // would navigate to a picker screen.
            if (Platform.OS === 'ios') {
              Alert.prompt(
                'New Site ID',
                'Enter the site ID for the transfer:',
                async (siteId) => {
                  if (!siteId?.trim()) return;
                  Alert.prompt(
                    'New Parking Space ID',
                    'Enter the parking space ID:',
                    async (spaceId) => {
                      if (!spaceId?.trim()) return;
                      setActionLoading(true);
                      try {
                        const updated = await devicesAPI.transfer(serial_number, {
                          new_site_id: siteId.trim(),
                          new_parking_space_id: spaceId.trim(),
                          accessible_type: 'standard',
                        });
                        setDevice(updated);
                        Alert.alert('Success', 'Device transferred successfully.');
                      } catch (err: any) {
                        Alert.alert('Error', err?.message || 'Transfer failed.');
                      } finally {
                        setActionLoading(false);
                      }
                    },
                  );
                },
              );
            } else {
              // Android does not support Alert.prompt
              Alert.alert(
                'Transfer',
                'Transfer functionality requires the full transfer screen. This will be available in a future update.',
              );
            }
          },
        },
      ],
    );
  };

  const handleRelease = () => {
    Alert.alert(
      'Release Device',
      'This will unassign the device from its current site and parking space. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Release',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const updated = await devicesAPI.release(serial_number);
              setDevice(updated);
              Alert.alert('Success', 'Device released successfully.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Release failed.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleRevoke = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Revoke Device',
        'Enter a reason for revoking this device:',
        async (reason) => {
          if (!reason?.trim()) return;
          setActionLoading(true);
          try {
            const updated = await devicesAPI.revoke(serial_number, { reason: reason.trim() });
            setDevice(updated);
            Alert.alert('Success', 'Device has been revoked.');
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Revoke failed.');
          } finally {
            setActionLoading(false);
          }
        },
        'plain-text',
        '',
        'Enter reason…',
      );
    } else {
      Alert.alert(
        'Revoke Device',
        'Are you sure you want to revoke this device? This action cannot be easily undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Revoke',
            style: 'destructive',
            onPress: async () => {
              setActionLoading(true);
              try {
                const updated = await devicesAPI.revoke(serial_number, { reason: 'Revoked by admin' });
                setDevice(updated);
                Alert.alert('Success', 'Device has been revoked.');
              } catch (err: any) {
                Alert.alert('Error', err?.message || 'Revoke failed.');
              } finally {
                setActionLoading(false);
              }
            },
          },
        ],
      );
    }
  };

  const handleRegenerateClaim = () => {
    Alert.alert(
      'Regenerate Claim ID',
      'A new claim ID will be generated. The old one will no longer work. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          onPress: async () => {
            setActionLoading(true);
            try {
              const { claim_id } = await devicesAPI.regenerateClaim(serial_number);
              Alert.alert(
                'New Claim ID',
                `Save this claim ID — it will only be shown once:\n\n${claim_id}`,
                [{ text: 'OK' }],
              );
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Regeneration failed.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  /* ── Render helpers ── */

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !device) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>⚠️</Text>
        <Text style={styles.errorMessage}>{error || 'Device not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchData()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const badge = STATUS_BADGE[device.lifecycle_status];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Action loading overlay */}
      {actionLoading ? (
        <View style={styles.actionOverlay}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.actionOverlayText}>Processing…</Text>
        </View>
      ) : null}

      {/* ── Header ── */}
      <View style={styles.headerCard}>
        <Text style={styles.headerSerial}>{device.serial_number}</Text>
        {device.name ? <Text style={styles.headerName}>{device.name}</Text> : null}
        <View style={[styles.badge, { backgroundColor: badge.bg, alignSelf: 'flex-start', marginTop: spacing.sm }]}>
          <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
        </View>
      </View>

      {/* ── Device Info ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Device Info</Text>
        <InfoRow label="Model" value={device.model_code} />
        <InfoRow label="Hardware Rev." value={device.hardware_revision} />
        <InfoRow label="Firmware" value={device.firmware_version} />
        <InfoRow label="Batch" value={device.manufacture_batch} />
        <InfoRow label="Created" value={formatDate(device.created_at)} />
        <InfoRow label="Updated" value={formatDate(device.updated_at)} />
      </View>

      {/* ── Assignment ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Assignment</Text>
        <InfoRow label="Organization" value={device.organization_id} />
        <InfoRow label="Site" value={device.current_site_id} />
        <InfoRow label="Parking Space" value={device.current_parking_space_id} />
        <InfoRow label="Claimed At" value={device.claimed_at ? formatDate(device.claimed_at) : null} />
      </View>

      {/* ── Admin Actions ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Actions</Text>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleTransfer}
          disabled={actionLoading}
          activeOpacity={0.7}
        >
          <Text style={styles.actionButtonText}>Transfer Device</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleRelease}
          disabled={actionLoading}
          activeOpacity={0.7}
        >
          <Text style={styles.actionButtonText}>Release Device</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonDanger]}
          onPress={handleRevoke}
          disabled={actionLoading}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionButtonText, styles.actionButtonDangerText]}>Revoke Device</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={handleRegenerateClaim}
          disabled={actionLoading}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionButtonText, styles.actionButtonSecondaryText]}>
            Regenerate Claim ID
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Event History ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Event History</Text>
        {events.length === 0 ? (
          <Text style={styles.emptyEvents}>No events recorded yet.</Text>
        ) : (
          events.map((evt) => (
            <View key={evt.id} style={styles.eventRow}>
              <View style={styles.eventDot} />
              <View style={styles.eventContent}>
                <Text style={styles.eventType}>{evt.event_type}</Text>
                <Text style={styles.eventTime}>{timeAgo(evt.created_at)}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

/* ──────────────────────────────────────────────
 * InfoRow sub-component
 * ────────────────────────────────────────────── */

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value || '—'}
      </Text>
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
  scrollContent: {
    paddingHorizontal: spacing.contentPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },

  /* Centered states */
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.offWhite,
    paddingHorizontal: spacing.contentPadding,
  },
  errorTitle: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  errorMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  } as any,
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: layout.borderRadiusPill,
  },
  retryButtonText: {
    ...typography.button,
    color: colors.ctaPrimaryText,
  } as any,

  /* Action overlay */
  actionOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: layout.borderRadiusSm,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  actionOverlayText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  } as any,

  /* Header card */
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: layout.borderRadiusMd,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  headerSerial: {
    ...typography.h4,
    color: colors.textPrimary,
  } as any,
  headerName: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  } as any,

  /* Badge */
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: layout.borderRadiusPill,
  },
  badgeText: {
    ...typography.label,
    fontSize: 12,
  } as any,

  /* Section cards */
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: layout.borderRadiusMd,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  sectionTitle: {
    ...typography.captionBold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  } as any,

  /* Info rows */
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  infoLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  } as any,
  infoValue: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flex: 1.5,
    textAlign: 'right',
  } as any,

  /* Action buttons */
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: layout.borderRadiusSm,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  actionButtonText: {
    ...typography.button,
    fontSize: 15,
    color: colors.ctaPrimaryText,
  } as any,
  actionButtonDanger: {
    backgroundColor: colors.negative,
  },
  actionButtonDangerText: {
    color: colors.white,
  },
  actionButtonSecondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  actionButtonSecondaryText: {
    color: colors.primary,
  },

  /* Events */
  emptyEvents: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  } as any,
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 5,
    marginRight: spacing.sm,
  },
  eventContent: {
    flex: 1,
  },
  eventType: {
    ...typography.captionBold,
    color: colors.textPrimary,
  } as any,
  eventTime: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
  } as any,
});
