import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRoute, useNavigation } from '@react-navigation/native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, layout, shadows } from '@/theme/spacing';

const MAX_PHOTOS = 5;

type ClaimPhotosParams = {
  serial_number: string;
  claim_id: string;
  customer_id: string;
  site_id: string;
  parking_space_id: string;
  accessible_type: string;
};

export default function ClaimPhotosScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const params = route.params as ClaimPhotosParams;

  const [photos, setPhotos] = useState<string[]>([]);
  const [installNotes, setInstallNotes] = useState('');
  const [skipped, setSkipped] = useState(false);
  const [skipReason, setSkipReason] = useState('');

  /* ── Image helpers ──────────────────────── */

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos(prev => [...prev, result.assets[0].uri].slice(0, MAX_PHOTOS));
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Photo library access is needed to select images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: true,
    });
    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri);
      setPhotos(prev => [...prev, ...uris].slice(0, MAX_PHOTOS));
    }
  };

  const showAddPhotoOptions = () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit reached', `You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    Alert.alert('Add Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Library', onPress: pickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  /* ── Navigation ─────────────────────────── */

  const canContinue = photos.length > 0 || (skipped && skipReason.trim().length > 0);

  const handleContinue = () => {
    navigation.navigate('ClaimConfirm', {
      ...params,
      installation_photos: photos,
      install_notes: installNotes.trim(),
      ...(skipped ? { skip_photos_reason: skipReason.trim() } : {}),
    });
  };

  /* ── Render helpers ─────────────────────── */

  const renderPhotoTile = (uri: string, index: number) => (
    <View key={uri + index} style={styles.photoTile}>
      <Image source={{ uri }} style={styles.photoImage} />
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removePhoto(index)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.removeButtonText}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  const renderAddTile = () => (
    <TouchableOpacity
      style={styles.addPhotoTile}
      onPress={showAddPhotoOptions}
      activeOpacity={0.7}
    >
      <Text style={styles.addPhotoIcon}>+</Text>
      <Text style={styles.addPhotoLabel}>Add Photo</Text>
    </TouchableOpacity>
  );

  /* ── Main render ────────────────────────── */

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Text style={styles.title}>Installation Photos</Text>
        <Text style={styles.subtitle}>
          Capture photos of the completed installation. Up to {MAX_PHOTOS} photos allowed.
        </Text>

        {/* Photo grid */}
        <View style={styles.photoGrid}>
          {photos.map(renderPhotoTile)}
          {photos.length < MAX_PHOTOS && renderAddTile()}
        </View>

        {/* Quick action buttons */}
        {photos.length === 0 && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
              <Text style={styles.actionButtonText}>📷  Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
              <Text style={styles.actionButtonText}>🖼  Choose from Library</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Install notes */}
        <Text style={styles.sectionLabel}>Installation Notes</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Add installation notes (optional)"
          placeholderTextColor={colors.textMuted}
          value={installNotes}
          onChangeText={setInstallNotes}
          multiline
          textAlignVertical="top"
        />

        {/* Skip photos */}
        <TouchableOpacity
          style={styles.skipToggle}
          onPress={() => setSkipped(prev => !prev)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, skipped && styles.checkboxChecked]}>
            {skipped && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.skipToggleText}>Skip — will upload later</Text>
        </TouchableOpacity>

        {skipped && (
          <TextInput
            style={styles.skipReasonInput}
            placeholder="Reason for skipping photos"
            placeholderTextColor={colors.textMuted}
            value={skipReason}
            onChangeText={setSkipReason}
          />
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.continueButtonText,
              !canContinue && styles.continueButtonTextDisabled,
            ]}
          >
            Continue to Confirmation
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── Styles ──────────────────────────────── */

const TILE_GAP = spacing.sm;

const styles = StyleSheet.create({
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

  /* Header */
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

  /* Photo grid – 2 columns */
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TILE_GAP,
    marginBottom: spacing.lg,
  },
  photoTile: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: layout.borderRadiusMd,
    overflow: 'hidden',
    backgroundColor: colors.card,
    ...shadows.card,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeButton: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  addPhotoTile: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: layout.borderRadiusMd,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  addPhotoIcon: {
    fontSize: 32,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  addPhotoLabel: {
    ...typography.captionBold,
    color: colors.primary,
  },

  /* Quick action buttons */
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: layout.borderRadiusSm,
    backgroundColor: colors.card,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  actionButtonText: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },

  /* Notes */
  sectionLabel: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  notesInput: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.card,
    borderRadius: layout.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
    minHeight: 100,
    marginBottom: spacing.lg,
  },

  /* Skip toggle */
  skipToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: layout.borderRadiusXs,
    borderWidth: 2,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  skipToggleText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  skipReasonInput: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.card,
    borderRadius: layout.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
    marginBottom: spacing.md,
  },

  /* Bottom bar */
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
  continueButton: {
    backgroundColor: colors.ctaPrimary,
    paddingVertical: spacing.md,
    borderRadius: layout.borderRadiusPill,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: colors.divider,
  },
  continueButtonText: {
    ...typography.button,
    color: colors.ctaPrimaryText,
  },
  continueButtonTextDisabled: {
    color: colors.textMuted,
  },
});
