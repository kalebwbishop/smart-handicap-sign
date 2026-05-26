import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation, CommonActions } from '@react-navigation/native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, layout, shadows } from '@/theme/spacing';
import { deviceClaimsAPI } from '@/api/deviceClaims';
import { ClaimRequest, AccessibleParkingType } from '@/types/device';

type ClaimConfirmParams = {
  serial_number: string;
  claim_id: string;
  customer_id: string;
  site_id: string;
  parking_space_id: string;
  accessible_type: AccessibleParkingType;
  installation_photos: string[];
  install_notes?: string;
};

const ACCESSIBLE_TYPE_LABELS: Record<AccessibleParkingType, string> = {
  standard: 'Standard Accessible',
  van_accessible: 'Van Accessible',
  temporary: 'Temporary',
  reserved: 'Reserved',
};

export default function ClaimConfirmScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const params = route.params as ClaimConfirmParams;

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    const request: ClaimRequest = {
      serial_number: params.serial_number,
      claim_id: params.claim_id,
      customer_id: params.customer_id,
      site_id: params.site_id,
      parking_space_id: params.parking_space_id,
      accessible_type: params.accessible_type,
      installation_photos: params.installation_photos,
      ...(params.install_notes ? { install_notes: params.install_notes } : {}),
    };

    try {
      const response = await deviceClaimsAPI.claim(request);
      if (response.success) {
        setSuccess(true);
      } else {
        setError(response.error ?? 'Activation failed. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDone = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      }),
    );
  };

  /* ── Success state ─────────────────────── */

  if (success) {
    return (
      <View style={styles.successRoot}>
        <View style={styles.successContent}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text style={styles.successHeading}>Device Activated!</Text>
          <Text style={styles.successSerial}>{params.serial_number}</Text>
          <Text style={styles.successDetail}>
            Site {params.site_id} · Space {params.parking_space_id}
          </Text>
        </View>
        <View style={styles.successBottomBar}>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={handleDone}
            activeOpacity={0.8}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* ── Summary row helper ────────────────── */

  const SummaryRow = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );

  /* ── Main render ───────────────────────── */

  const photoCount = params.installation_photos?.length ?? 0;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.title}>Review & Confirm</Text>
        <Text style={styles.subtitle}>
          Please review the details below before activating the device.
        </Text>

        {/* Summary card */}
        <View style={styles.card}>
          <SummaryRow label="Device" value={params.serial_number} />
          <View style={styles.divider} />
          <SummaryRow label="Organization" value={params.customer_id} />
          <View style={styles.divider} />
          <SummaryRow label="Site" value={params.site_id} />
          <View style={styles.divider} />
          <SummaryRow label="Parking Space" value={params.parking_space_id} />
          <View style={styles.divider} />
          <SummaryRow
            label="Accessible Type"
            value={ACCESSIBLE_TYPE_LABELS[params.accessible_type] ?? params.accessible_type}
          />
          <View style={styles.divider} />
          <SummaryRow
            label="Photos"
            value={photoCount > 0 ? `${photoCount} photo${photoCount !== 1 ? 's' : ''} attached` : 'None'}
          />
          <View style={styles.divider} />
          <SummaryRow
            label="Notes"
            value={params.install_notes?.trim() || 'None'}
          />
        </View>

        {/* Error banner */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <View style={styles.errorActions}>
              <TouchableOpacity
                style={styles.errorRetryButton}
                onPress={handleSubmit}
                activeOpacity={0.7}
              >
                <Text style={styles.errorRetryText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.errorBackButton}
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
              >
                <Text style={styles.errorBackText}>Go Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.confirmButton, submitting && styles.confirmButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color={colors.ctaPrimaryText} />
          ) : (
            <Text style={styles.confirmButtonText}>Confirm & Activate</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── Styles ──────────────────────────────── */

const SUCCESS_GREEN = '#34c759';

const styles = StyleSheet.create({
  /* ── Main layout ──────────────── */
  root: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.contentPadding,
    paddingBottom: 120,
  },

  /* ── Header ───────────────────── */
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },

  /* ── Summary card ─────────────── */
  card: {
    backgroundColor: colors.card,
    borderRadius: layout.borderRadiusMd,
    padding: spacing.md,
    ...shadows.card,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  summaryValue: {
    ...typography.captionBold,
    color: colors.textPrimary,
    flex: 2,
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
  },

  /* ── Error banner ─────────────── */
  errorBanner: {
    backgroundColor: '#fff2f0',
    borderRadius: layout.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.negative,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.negative,
    marginBottom: spacing.sm,
  },
  errorActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  errorRetryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: layout.borderRadiusSm,
    backgroundColor: colors.negative,
  },
  errorRetryText: {
    ...typography.captionBold,
    color: colors.white,
  },
  errorBackButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: layout.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  errorBackText: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },

  /* ── Bottom bar ───────────────── */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.contentPadding,
    paddingBottom: spacing.xl,
    backgroundColor: colors.offWhite,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  confirmButton: {
    backgroundColor: SUCCESS_GREEN,
    paddingVertical: spacing.md,
    borderRadius: layout.borderRadiusPill,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    ...typography.button,
    color: colors.white,
  },

  /* ── Success state ────────────── */
  successRoot: {
    flex: 1,
    backgroundColor: colors.white,
  },
  successContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.contentPadding,
  },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: SUCCESS_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  checkIcon: {
    fontSize: 48,
    color: colors.white,
    fontWeight: '700',
  },
  successHeading: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  successSerial: {
    ...typography.h4,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  successDetail: {
    ...typography.caption,
    color: colors.textMuted,
  },
  successBottomBar: {
    padding: spacing.contentPadding,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  doneButton: {
    backgroundColor: colors.ctaPrimary,
    paddingVertical: spacing.md,
    borderRadius: layout.borderRadiusPill,
    alignItems: 'center',
  },
  doneButtonText: {
    ...typography.button,
    color: colors.ctaPrimaryText,
  },
});
