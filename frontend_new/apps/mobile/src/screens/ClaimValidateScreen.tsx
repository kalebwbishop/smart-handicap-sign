import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, layout, shadows } from '../theme/spacing';
import { deviceClaimsAPI } from '../api/deviceClaims';
import type { ClaimValidateResponse, ClaimErrorCode, DeviceLifecycleStatus } from '../types/device';
import type { RootStackParamList } from '../types/navigation';

// ── Route params ────────────────────────────────────────────────────

type ClaimValidateParams = {
  serial_number: string;
  claim_id: string;
};

// ── Error copy map ──────────────────────────────────────────────────

const ERROR_MESSAGES: Record<ClaimErrorCode, { title: string; subtitle: string; icon: string }> = {
  invalid_serial: {
    title: 'Invalid Serial Number',
    subtitle: 'The serial number format is not recognized.',
    icon: '❌',
  },
  device_not_found: {
    title: 'Device Not Found',
    subtitle: 'Please check the serial number.',
    icon: '❌',
  },
  invalid_claim_id: {
    title: 'Invalid Claim Code',
    subtitle: 'Please scan the QR code again.',
    icon: '❌',
  },
  claim_already_used: {
    title: 'Claim Already Used',
    subtitle: 'This claim code has already been used.',
    icon: '⚠️',
  },
  claim_expired: {
    title: 'Claim Expired',
    subtitle: 'This claim code has expired. Contact your administrator.',
    icon: '⚠️',
  },
  claim_revoked: {
    title: 'Claim Revoked',
    subtitle: 'This claim code has been revoked.',
    icon: '⚠️',
  },
  device_already_active: {
    title: 'Already Registered',
    subtitle: 'This device is already registered.',
    icon: '⚠️',
  },
  device_revoked: {
    title: 'Device Revoked',
    subtitle: 'This device has been revoked and cannot be registered.',
    icon: '❌',
  },
  device_retired: {
    title: 'Device Retired',
    subtitle: 'This device has been retired.',
    icon: '❌',
  },
  device_not_claimable: {
    title: 'Device Not Claimable',
    subtitle: 'This device cannot be claimed in its current state.',
    icon: '❌',
  },
  no_claim_configured: {
    title: 'No Claim Code',
    subtitle: 'This device has no claim code configured. Contact support.',
    icon: '❌',
  },
  unauthorized: {
    title: 'Unauthorized',
    subtitle: 'You do not have permission to claim this device.',
    icon: '❌',
  },
  rate_limited: {
    title: 'Too Many Attempts',
    subtitle: 'Please wait a moment and try again.',
    icon: '⚠️',
  },
};

// ── Lifecycle badge colors ──────────────────────────────────────────

const LIFECYCLE_BADGE: Record<DeviceLifecycleStatus, { bg: string; text: string }> = {
  manufactured: { bg: '#e8e8ed', text: colors.textSecondary },
  unclaimed: { bg: '#e0f0ff', text: '#0071e3' },
  claiming: { bg: '#fff3cd', text: '#856404' },
  active: { bg: '#d4edda', text: '#155724' },
  lost: { bg: '#fff3cd', text: '#856404' },
  revoked: { bg: '#f8d7da', text: '#721c24' },
  retired: { bg: '#e8e8ed', text: colors.textSecondary },
};

function formatLifecycleLabel(status: DeviceLifecycleStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// ── Component ───────────────────────────────────────────────────────

export default function ClaimValidateScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'ClaimValidate'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  const { serial_number, claim_id } = route.params;

  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState<ClaimValidateResponse | null>(null);
  const [networkError, setNetworkError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function validate() {
      setLoading(true);
      setNetworkError(false);
      setResponse(null);

      try {
        const result = await deviceClaimsAPI.validate({ serial_number, claim_id });
        if (!cancelled) setResponse(result);
      } catch {
        if (!cancelled) setNetworkError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    validate();
    return () => { cancelled = true; };
  }, [serial_number, claim_id]);

  const handleContinue = () => {
    if (!response?.device) return;
    navigation.navigate('ClaimAssign', {
      serial_number: response.device.serial_number,
      claim_id,
      model_code: response.device.model_code,
      hardware_revision: response.device.hardware_revision,
    });
  };

  const handleScanAgain = () => {
    navigation.goBack();
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@hazardhero.com');
  };

  const handleRetry = () => {
    setLoading(true);
    setNetworkError(false);
    setResponse(null);
    deviceClaimsAPI
      .validate({ serial_number, claim_id })
      .then(setResponse)
      .catch(() => setNetworkError(true))
      .finally(() => setLoading(false));
  };

  // ── Render helpers ──────────────────────────────────────────────

  const renderLoading = () => (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[typography.body, styles.loadingText]}>Validating device…</Text>
    </View>
  );

  const renderNetworkError = () => (
    <View style={styles.centered}>
      <Text style={styles.errorIcon}>⚠️</Text>
      <Text style={[typography.h3, styles.errorTitle]}>Connection Error</Text>
      <Text style={[typography.body, styles.errorSubtitle]}>
        Unable to reach the server. Check your internet connection and try again.
      </Text>
      <TouchableOpacity style={styles.primaryButton} onPress={handleRetry} activeOpacity={0.8}>
        <Text style={[typography.button, styles.primaryButtonText]}>Try Again</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={handleScanAgain} activeOpacity={0.8}>
        <Text style={[typography.button, styles.secondaryButtonText]}>Scan Again</Text>
      </TouchableOpacity>
    </View>
  );

  const renderError = () => {
    const code = response?.error_code;
    const msg = code && ERROR_MESSAGES[code]
      ? ERROR_MESSAGES[code]
      : { title: 'Validation Failed', subtitle: response?.error ?? 'An unexpected error occurred.', icon: '❌' };

    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>{msg.icon}</Text>
        <Text style={[typography.h3, styles.errorTitle]}>{msg.title}</Text>
        <Text style={[typography.body, styles.errorSubtitle]}>{msg.subtitle}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={handleScanAgain} activeOpacity={0.8}>
          <Text style={[typography.button, styles.primaryButtonText]}>Scan Again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleContactSupport} activeOpacity={0.6}>
          <Text style={[typography.caption, styles.supportLink]}>Contact Support</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderSuccess = () => {
    const device = response!.device!;
    const badge = LIFECYCLE_BADGE[device.lifecycle_status] ?? LIFECYCLE_BADGE.manufactured;

    return (
      <View style={styles.successContainer}>
        <Text style={[typography.h3, styles.heading]}>Device Verified</Text>
        <Text style={[typography.body, styles.subheading]}>
          Review the details below and continue to setup.
        </Text>

        <View style={[styles.card, shadows.card]}>
          <InfoRow label="Serial Number" value={device.serial_number} />
          <View style={styles.divider} />
          <InfoRow label="Model" value={device.model_code} />
          <View style={styles.divider} />
          <InfoRow label="Hardware Revision" value={device.hardware_revision} />
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={[typography.caption, styles.infoLabel]}>Status</Text>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[typography.label, { color: badge.text }]}>
                {formatLifecycleLabel(device.lifecycle_status)}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleContinue} activeOpacity={0.8}>
          <Text style={[typography.button, styles.primaryButtonText]}>Continue to Setup</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleScanAgain} activeOpacity={0.8}>
          <Text style={[typography.button, styles.secondaryButtonText]}>Scan Different Device</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Main render ─────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {loading && renderLoading()}
      {!loading && networkError && renderNetworkError()}
      {!loading && !networkError && response && !response.valid && renderError()}
      {!loading && !networkError && response?.valid && response.device && renderSuccess()}
    </ScrollView>
  );
}

// ── Info Row sub-component ──────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[typography.caption, styles.infoLabel]}>{label}</Text>
      <Text style={[typography.body, styles.infoValue]}>{value}</Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.contentPadding,
  },

  // Loading
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
  },

  // Error
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  errorTitle: {
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  errorSubtitle: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    maxWidth: 300,
  },
  supportLink: {
    color: colors.primary,
    marginTop: spacing.md,
  },

  // Success
  successContainer: {
    flex: 1,
    paddingTop: spacing.xl,
  },
  heading: {
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subheading: {
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },

  // Card
  card: {
    backgroundColor: colors.card,
    borderRadius: layout.borderRadiusMd,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginVertical: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    color: colors.textSecondary,
  },
  infoValue: {
    color: colors.textPrimary,
    flexShrink: 1,
    textAlign: 'right',
  },

  // Badge
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: layout.borderRadiusXs,
  },

  // Buttons
  primaryButton: {
    backgroundColor: colors.ctaPrimary,
    borderRadius: layout.borderRadiusSm,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  primaryButtonText: {
    color: colors.ctaPrimaryText,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: layout.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textPrimary,
  },
});
