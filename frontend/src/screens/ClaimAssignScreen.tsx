import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, layout } from '../theme/spacing';
import { organizationAPI } from '../api/api';
import { sitesAPI } from '../api/sites';
import { Organization } from '../types/types';
import { Site, ParkingSpace, AccessibleParkingType } from '../types/device';
import { RootStackParamList } from '../types/navigation';

const ACCESSIBLE_TYPE_LABELS: Record<AccessibleParkingType, string> = {
  standard: 'Standard Accessible',
  van_accessible: 'Van Accessible',
  temporary: 'Temporary',
  reserved: 'Reserved',
};

const ACCESSIBLE_TYPES: AccessibleParkingType[] = [
  'standard',
  'van_accessible',
  'temporary',
  'reserved',
];

export default function ClaimAssignScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'ClaimAssign'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { serial_number, claim_id } = route.params;

  // ── Organization state ─────────────────────────────────────────
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [orgSaving, setOrgSaving] = useState(false);

  // ── Site state ─────────────────────────────────────────────────
  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [creatingSite, setCreatingSite] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteAddress, setNewSiteAddress] = useState('');
  const [newSiteCity, setNewSiteCity] = useState('');
  const [newSiteState, setNewSiteState] = useState('');
  const [newSitePostal, setNewSitePostal] = useState('');
  const [siteSaving, setSiteSaving] = useState(false);

  // ── Parking Space state ────────────────────────────────────────
  const [spaces, setSpaces] = useState<ParkingSpace[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [newSpaceLabel, setNewSpaceLabel] = useState('');
  const [spaceSaving, setSpaceSaving] = useState(false);

  // ── Accessible type state ──────────────────────────────────────
  const [accessibleType, setAccessibleType] = useState<AccessibleParkingType>('standard');

  // ── Load organizations on mount ────────────────────────────────
  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = useCallback(async () => {
    setOrgsLoading(true);
    try {
      const orgs = await organizationAPI.getOrganizations();
      setOrganizations(orgs);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load organizations');
    }
    setOrgsLoading(false);
  }, []);

  // ── Load sites when org changes ────────────────────────────────
  useEffect(() => {
    if (selectedOrgId) {
      loadSites(selectedOrgId);
    } else {
      setSites([]);
      setSelectedSiteId(null);
    }
  }, [selectedOrgId]);

  const loadSites = useCallback(async (orgId: string) => {
    setSitesLoading(true);
    setSelectedSiteId(null);
    setSpaces([]);
    setSelectedSpaceId(null);
    setCreatingSite(false);
    try {
      const result = await sitesAPI.list(orgId);
      setSites(result);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load sites');
    }
    setSitesLoading(false);
  }, []);

  // ── Load spaces when site changes ──────────────────────────────
  useEffect(() => {
    if (selectedSiteId) {
      loadSpaces(selectedSiteId);
    } else {
      setSpaces([]);
      setSelectedSpaceId(null);
    }
  }, [selectedSiteId]);

  const loadSpaces = useCallback(async (siteId: string) => {
    setSpacesLoading(true);
    setSelectedSpaceId(null);
    setCreatingSpace(false);
    try {
      const result = await sitesAPI.listParkingSpaces(siteId);
      setSpaces(result);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load parking spaces');
    }
    setSpacesLoading(false);
  }, []);

  // ── Create handlers ────────────────────────────────────────────
  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    setOrgSaving(true);
    try {
      const org = await organizationAPI.createOrganization(newOrgName.trim());
      setOrganizations((prev) => [...prev, org]);
      setSelectedOrgId(org.id);
      setCreatingOrg(false);
      setNewOrgName('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create organization');
    }
    setOrgSaving(false);
  };

  const handleCreateSite = async () => {
    if (!selectedOrgId || !newSiteName.trim()) return;
    setSiteSaving(true);
    try {
      const site = await sitesAPI.create({
        organization_id: selectedOrgId,
        name: newSiteName.trim(),
        address_line_1: newSiteAddress.trim() || undefined,
        city: newSiteCity.trim() || undefined,
        state: newSiteState.trim() || undefined,
        postal_code: newSitePostal.trim() || undefined,
      });
      setSites((prev) => [...prev, site]);
      setSelectedSiteId(site.id);
      setCreatingSite(false);
      setNewSiteName('');
      setNewSiteAddress('');
      setNewSiteCity('');
      setNewSiteState('');
      setNewSitePostal('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create site');
    }
    setSiteSaving(false);
  };

  const handleCreateSpace = async () => {
    if (!selectedSiteId || !newSpaceLabel.trim()) return;
    setSpaceSaving(true);
    try {
      const space = await sitesAPI.createParkingSpace(selectedSiteId, {
        label: newSpaceLabel.trim(),
        accessible_type: accessibleType,
      });
      setSpaces((prev) => [...prev, space]);
      setSelectedSpaceId(space.id);
      setCreatingSpace(false);
      setNewSpaceLabel('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create parking space');
    }
    setSpaceSaving(false);
  };

  // ── Selection handlers ─────────────────────────────────────────
  const handleSelectOrg = (orgId: string) => {
    setSelectedOrgId(orgId);
    setCreatingOrg(false);
  };

  const handleSelectSite = (siteId: string) => {
    setSelectedSiteId(siteId);
    setCreatingSite(false);
  };

  const handleSelectSpace = (spaceId: string) => {
    setSelectedSpaceId(spaceId);
    setCreatingSpace(false);
  };

  // ── Continue ───────────────────────────────────────────────────
  const canContinue = !!(selectedOrgId && selectedSiteId && selectedSpaceId && accessibleType);

  const handleContinue = () => {
    if (!canContinue) return;
    navigation.navigate('ClaimPhotos', {
      serial_number,
      claim_id,
      customer_id: selectedOrgId!,
      site_id: selectedSiteId!,
      parking_space_id: selectedSpaceId!,
      accessible_type: accessibleType,
    });
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── 1. Organization ──────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.sectionHeader}>1. Organization</Text>

        {orgsLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <>
            {organizations.map((org) => (
              <Pressable
                key={org.id}
                style={[styles.listItem, selectedOrgId === org.id && styles.listItemSelected]}
                onPress={() => handleSelectOrg(org.id)}
              >
                <Text
                  style={[
                    styles.listItemText,
                    selectedOrgId === org.id && styles.listItemTextSelected,
                  ]}
                >
                  {org.name}
                </Text>
                {selectedOrgId === org.id && <Text style={styles.checkmark}>✓</Text>}
              </Pressable>
            ))}

            {organizations.length === 0 && !creatingOrg && (
              <Text style={styles.emptyText}>No organizations yet.</Text>
            )}

            {!creatingOrg ? (
              <Pressable style={styles.createNewBtn} onPress={() => setCreatingOrg(true)}>
                <Text style={styles.createNewText}>＋ Create New Organization</Text>
              </Pressable>
            ) : (
              <View style={styles.inlineForm}>
                <TextInput
                  style={styles.input}
                  placeholder="Organization name"
                  placeholderTextColor={colors.textMuted}
                  value={newOrgName}
                  onChangeText={setNewOrgName}
                  autoFocus
                />
                <View style={styles.formActions}>
                  <Pressable
                    style={styles.cancelBtn}
                    onPress={() => {
                      setCreatingOrg(false);
                      setNewOrgName('');
                    }}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.saveBtn,
                      (!newOrgName.trim() || orgSaving) && styles.btnDisabled,
                    ]}
                    onPress={handleCreateOrg}
                    disabled={!newOrgName.trim() || orgSaving}
                  >
                    <Text style={styles.saveBtnText}>
                      {orgSaving ? 'Creating…' : 'Create'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </>
        )}
      </View>

      {/* ── 2. Site ──────────────────────────────────────── */}
      <View style={[styles.card, !selectedOrgId && styles.cardDisabled]}>
        <Text style={[styles.sectionHeader, !selectedOrgId && styles.textDisabled]}>
          2. Site
        </Text>

        {!selectedOrgId ? (
          <Text style={styles.hintText}>Select an organization first</Text>
        ) : sitesLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <>
            {sites.map((site) => (
              <Pressable
                key={site.id}
                style={[styles.listItem, selectedSiteId === site.id && styles.listItemSelected]}
                onPress={() => handleSelectSite(site.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.listItemText,
                      selectedSiteId === site.id && styles.listItemTextSelected,
                    ]}
                  >
                    {site.name}
                  </Text>
                  {site.address_line_1 && (
                    <Text style={styles.listItemSubtext}>
                      {[site.address_line_1, site.city, site.state]
                        .filter(Boolean)
                        .join(', ')}
                    </Text>
                  )}
                </View>
                {selectedSiteId === site.id && <Text style={styles.checkmark}>✓</Text>}
              </Pressable>
            ))}

            {sites.length === 0 && !creatingSite && (
              <Text style={styles.emptyText}>No sites yet. Create one below.</Text>
            )}

            {!creatingSite ? (
              <Pressable style={styles.createNewBtn} onPress={() => setCreatingSite(true)}>
                <Text style={styles.createNewText}>＋ Create New Site</Text>
              </Pressable>
            ) : (
              <View style={styles.inlineForm}>
                <TextInput
                  style={styles.input}
                  placeholder="Site name"
                  placeholderTextColor={colors.textMuted}
                  value={newSiteName}
                  onChangeText={setNewSiteName}
                  autoFocus
                />
                <TextInput
                  style={styles.input}
                  placeholder="Address"
                  placeholderTextColor={colors.textMuted}
                  value={newSiteAddress}
                  onChangeText={setNewSiteAddress}
                />
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, { flex: 2 }]}
                    placeholder="City"
                    placeholderTextColor={colors.textMuted}
                    value={newSiteCity}
                    onChangeText={setNewSiteCity}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="State"
                    placeholderTextColor={colors.textMuted}
                    value={newSiteState}
                    onChangeText={setNewSiteState}
                    autoCapitalize="characters"
                  />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="ZIP"
                    placeholderTextColor={colors.textMuted}
                    value={newSitePostal}
                    onChangeText={setNewSitePostal}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.formActions}>
                  <Pressable
                    style={styles.cancelBtn}
                    onPress={() => {
                      setCreatingSite(false);
                      setNewSiteName('');
                      setNewSiteAddress('');
                      setNewSiteCity('');
                      setNewSiteState('');
                      setNewSitePostal('');
                    }}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.saveBtn,
                      (!newSiteName.trim() || siteSaving) && styles.btnDisabled,
                    ]}
                    onPress={handleCreateSite}
                    disabled={!newSiteName.trim() || siteSaving}
                  >
                    <Text style={styles.saveBtnText}>
                      {siteSaving ? 'Creating…' : 'Create'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </>
        )}
      </View>

      {/* ── 3. Parking Space ─────────────────────────────── */}
      <View style={[styles.card, !selectedSiteId && styles.cardDisabled]}>
        <Text style={[styles.sectionHeader, !selectedSiteId && styles.textDisabled]}>
          3. Parking Space
        </Text>

        {!selectedSiteId ? (
          <Text style={styles.hintText}>Select a site first</Text>
        ) : spacesLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <>
            {spaces.map((space) => (
              <Pressable
                key={space.id}
                style={[
                  styles.listItem,
                  selectedSpaceId === space.id && styles.listItemSelected,
                ]}
                onPress={() => handleSelectSpace(space.id)}
              >
                <Text
                  style={[
                    styles.listItemText,
                    selectedSpaceId === space.id && styles.listItemTextSelected,
                  ]}
                >
                  {space.label}
                </Text>
                {selectedSpaceId === space.id && <Text style={styles.checkmark}>✓</Text>}
              </Pressable>
            ))}

            {spaces.length === 0 && !creatingSpace && (
              <Text style={styles.emptyText}>No parking spaces yet. Create one below.</Text>
            )}

            {!creatingSpace ? (
              <Pressable style={styles.createNewBtn} onPress={() => setCreatingSpace(true)}>
                <Text style={styles.createNewText}>＋ Create New Parking Space</Text>
              </Pressable>
            ) : (
              <View style={styles.inlineForm}>
                <TextInput
                  style={styles.input}
                  placeholder="Space label (e.g. A1, Spot #3)"
                  placeholderTextColor={colors.textMuted}
                  value={newSpaceLabel}
                  onChangeText={setNewSpaceLabel}
                  autoFocus
                />
                <View style={styles.formActions}>
                  <Pressable
                    style={styles.cancelBtn}
                    onPress={() => {
                      setCreatingSpace(false);
                      setNewSpaceLabel('');
                    }}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.saveBtn,
                      (!newSpaceLabel.trim() || spaceSaving) && styles.btnDisabled,
                    ]}
                    onPress={handleCreateSpace}
                    disabled={!newSpaceLabel.trim() || spaceSaving}
                  >
                    <Text style={styles.saveBtnText}>
                      {spaceSaving ? 'Creating…' : 'Create'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </>
        )}
      </View>

      {/* ── 4. Accessible Type ───────────────────────────── */}
      <View style={[styles.card, !selectedSpaceId && styles.cardDisabled]}>
        <Text style={[styles.sectionHeader, !selectedSpaceId && styles.textDisabled]}>
          4. Accessible Type
        </Text>

        {!selectedSpaceId ? (
          <Text style={styles.hintText}>Select a parking space first</Text>
        ) : (
          <View style={styles.typeGrid}>
            {ACCESSIBLE_TYPES.map((type) => (
              <Pressable
                key={type}
                style={[styles.typeChip, accessibleType === type && styles.typeChipSelected]}
                onPress={() => setAccessibleType(type)}
              >
                <View style={[styles.radio, accessibleType === type && styles.radioSelected]}>
                  {accessibleType === type && <View style={styles.radioDot} />}
                </View>
                <Text
                  style={[
                    styles.typeChipText,
                    accessibleType === type && styles.typeChipTextSelected,
                  ]}
                >
                  {ACCESSIBLE_TYPE_LABELS[type]}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* ── Continue ─────────────────────────────────────── */}
      <Pressable
        style={[styles.continueBtn, !canContinue && styles.btnDisabled]}
        onPress={handleContinue}
        disabled={!canContinue}
      >
        <Text style={styles.continueBtnText}>Continue</Text>
      </Pressable>
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.grayLight },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },

  // Card
  card: {
    backgroundColor: colors.card,
    borderRadius: layout.borderRadiusMd,
    padding: spacing.md,
    ...Platform.select({
      ios: {},
      android: {},
      web: { boxShadow: '0 2px 12px rgba(0,0,0,0.08)' } as any,
    }),
  },
  cardDisabled: { opacity: 0.5 },

  // Section header
  sectionHeader: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  textDisabled: { color: colors.textMuted },

  // List items
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: layout.borderRadius,
    marginBottom: 4,
  },
  listItemSelected: { backgroundColor: 'rgba(0,113,227,0.10)' },
  listItemText: { fontSize: 16, color: colors.textPrimary, fontWeight: '400' },
  listItemTextSelected: { color: colors.primary, fontWeight: '600' },
  listItemSubtext: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  checkmark: { fontSize: 16, color: colors.primary, fontWeight: '700' },

  // Create new
  createNewBtn: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: layout.borderRadius,
    borderWidth: 1,
    borderColor: colors.divider,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginTop: 4,
  },
  createNewText: { fontSize: 15, color: colors.primary, fontWeight: '600' },

  // Inline form
  inlineForm: {
    marginTop: spacing.sm,
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.offWhite,
    borderRadius: layout.borderRadiusSm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: layout.borderRadiusSm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: colors.offWhite,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  cancelBtnText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: colors.primary,
  },
  saveBtnText: { ...typography.bodySmall, color: colors.white, fontWeight: '600' },

  // Accessible type
  typeGrid: { gap: spacing.sm },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: layout.borderRadius,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.white,
  },
  typeChipSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0,113,227,0.06)',
  },
  typeChipText: { fontSize: 15, color: colors.textPrimary, fontWeight: '400', marginLeft: 12 },
  typeChipTextSelected: { color: colors.primary, fontWeight: '600' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },

  // Continue
  continueBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 9999,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  continueBtnText: { ...typography.button, color: colors.white },

  // Utility
  btnDisabled: { opacity: 0.4 },
  loader: { paddingVertical: 16 },
  emptyText: {
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
    fontSize: 14,
  },
  hintText: {
    color: colors.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
});
