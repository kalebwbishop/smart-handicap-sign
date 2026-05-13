import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, layout } from '@/theme/spacing';

/* ──────────────────────────────────────────────
 * Local navigation type (standalone until
 * RootStackParamList is updated in a follow-up)
 * ────────────────────────────────────────────── */

type QRScanParamList = {
  QRScan: undefined;
  ClaimValidate: { serial_number: string; claim_id: string };
};

type Nav = NativeStackNavigationProp<QRScanParamList, 'QRScan'>;

/* ──────────────────────────────────────────────
 * Validation helpers
 * ────────────────────────────────────────────── */

const SERIAL_PREFIX = 'SHS-';
const CLAIM_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function isValidSerial(s: string): boolean {
  return s.startsWith(SERIAL_PREFIX) && s.length > SERIAL_PREFIX.length;
}

function isValidClaim(c: string): boolean {
  return CLAIM_PATTERN.test(c);
}

/** Parse a QR / deep-link URL and return the serial + claim, or null. */
function parseSetupUrl(raw: string): { serial: string; claim: string } | null {
  try {
    // Handle both https:// URLs and smartsign:// deep links
    const url = new URL(raw);
    const serial = url.searchParams.get('serial');
    const claim = url.searchParams.get('claim');
    if (serial && claim) return { serial, claim };
  } catch {
    // Not a valid URL
  }
  return null;
}

/* ──────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────── */

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_AREA_SIZE = SCREEN_WIDTH * 0.65;

/* ──────────────────────────────────────────────
 * Component
 * ────────────────────────────────────────────── */

export default function QRScanScreen() {
  const navigation = useNavigation<Nav>();
  const [permission, requestPermission] = useCameraPermissions();

  const [scanned, setScanned] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [serialInput, setSerialInput] = useState('');
  const [claimInput, setClaimInput] = useState('');

  // Prevent double-navigation
  const navigatingRef = useRef(false);

  /* ── Deep-link handling ───────────────────── */
  const handleDeepLink = useCallback(
    (url: string) => {
      const params = parseSetupUrl(url);
      if (!params) return;
      if (!isValidSerial(params.serial) || !isValidClaim(params.claim)) return;
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      navigation.navigate('ClaimValidate', {
        serial_number: params.serial,
        claim_id: params.claim,
      });
    },
    [navigation],
  );

  useEffect(() => {
    // Check if the app was opened with a URL
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // Listen for incoming deep links while the screen is mounted
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  }, [handleDeepLink]);

  /* ── Barcode scanned callback ─────────────── */
  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scanned || navigatingRef.current) return;
      setScanned(true);

      const params = parseSetupUrl(data);

      if (!params) {
        Alert.alert(
          'Invalid QR Code',
          'This doesn\u2019t look like a valid device QR code. Please scan the code on the Smart Sign.',
          [{ text: 'Try Again', onPress: () => setScanned(false) }],
        );
        return;
      }

      if (!isValidSerial(params.serial)) {
        Alert.alert(
          'Invalid Serial Number',
          `Serial number must start with "${SERIAL_PREFIX}".`,
          [{ text: 'Try Again', onPress: () => setScanned(false) }],
        );
        return;
      }

      if (!isValidClaim(params.claim)) {
        Alert.alert(
          'Invalid Claim ID',
          'Claim ID format is not recognised. Expected format: XXXX-XXXX.',
          [{ text: 'Try Again', onPress: () => setScanned(false) }],
        );
        return;
      }

      navigatingRef.current = true;
      navigation.navigate('ClaimValidate', {
        serial_number: params.serial,
        claim_id: params.claim,
      });
    },
    [scanned, navigation],
  );

  /* ── Manual entry submit ──────────────────── */
  const handleManualSubmit = () => {
    const serial = serialInput.trim();
    const claim = claimInput.trim().toUpperCase();

    if (!isValidSerial(serial)) {
      Alert.alert('Invalid Serial', `Serial number must start with "${SERIAL_PREFIX}".`);
      return;
    }
    if (!isValidClaim(claim)) {
      Alert.alert('Invalid Claim ID', 'Expected format: XXXX-XXXX (letters and digits).');
      return;
    }
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    navigation.navigate('ClaimValidate', {
      serial_number: serial,
      claim_id: claim,
    });
  };

  /* ── Reset navigating guard on focus ──────── */
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      navigatingRef.current = false;
      setScanned(false);
    });
    return unsubscribe;
  }, [navigation]);

  /* ──────────────────────────────────────────
   * Permission states
   * ────────────────────────────────────────── */

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permBody}>
          We need camera access to scan the QR code on your Smart Sign device.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  /* ──────────────────────────────────────────
   * Main render — camera + overlay
   * ────────────────────────────────────────── */

  return (
    <View style={styles.container}>
      {/* Camera */}
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
      />

      {/* Overlay */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Top overlay */}
        <View style={styles.overlayTop} />

        {/* Middle row: left | scanArea | right */}
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.scanArea}>
            {/* Corner brackets */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.overlaySide} />
        </View>

        {/* Bottom overlay */}
        <View style={styles.overlayBottom}>
          <Text style={styles.instruction}>Scan the QR code on the device</Text>
        </View>
      </View>

      {/* Manual entry toggle + form */}
      <View style={styles.manualSection}>
        <TouchableOpacity onPress={() => setManualOpen((o) => !o)}>
          <Text style={styles.manualToggle}>
            {manualOpen ? 'Hide manual entry ▲' : 'Enter code manually ▼'}
          </Text>
        </TouchableOpacity>

        {manualOpen && (
          <View style={styles.manualForm}>
            <TextInput
              style={styles.input}
              placeholder="Serial number (SHS-...)"
              placeholderTextColor={colors.textMuted}
              value={serialInput}
              onChangeText={setSerialInput}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder="Claim ID (XXXX-XXXX)"
              placeholderTextColor={colors.textMuted}
              value={claimInput}
              onChangeText={setClaimInput}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleManualSubmit}>
              <Text style={styles.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

/* ──────────────────────────────────────────────
 * Styles
 * ────────────────────────────────────────────── */

const OVERLAY_COLOR = 'rgba(0,0,0,0.55)';
const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.contentPadding,
    backgroundColor: colors.white,
  },

  /* Camera */
  camera: {
    flex: 1,
  },

  /* Overlay layers */
  overlayTop: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
  },
  overlayMiddle: {
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
    alignItems: 'center',
    paddingTop: spacing.lg,
  },

  /* Scan area (transparent hole) */
  scanArea: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
  },

  /* Corner bracket decorations */
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: colors.white,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 4,
  },

  /* Instruction text */
  instruction: {
    ...typography.body,
    color: colors.white,
    textAlign: 'center',
  },

  /* Permission screen */
  permTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  permBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  /* Manual entry */
  manualSection: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.contentPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  manualToggle: {
    ...typography.caption,
    color: colors.primary,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
  manualForm: {
    marginTop: spacing.md,
  },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: layout.borderRadiusSm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginBottom: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.offWhite,
  },

  /* Buttons */
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: layout.borderRadiusSm,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  primaryBtnText: {
    ...typography.body,
    color: colors.ctaPrimaryText,
    fontWeight: '600',
  },
});
