import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TextInput,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    Alert,
    Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useOrganizationStore } from '@/store/organizationStore';
import { useAuthStore } from '@/store/authStore';
import { Organization, OrgMember, OrgRole } from '@/types/types';
import { RootStackParamList } from '@/types/navigation';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, layout } from '@/theme/spacing';

const ROLE_LABELS: Record<OrgRole, { label: string; color: string }> = {
    owner: { label: 'Owner', color: '#8B5CF6' },
    admin: { label: 'Admin', color: '#0071e3' },
    member: { label: 'Member', color: '#34C759' },
};

const ROLE_OPTIONS: OrgRole[] = ['owner', 'admin', 'member'];

function confirmAction(title: string, message: string, onConfirm: () => void) {
    if (Platform.OS === 'web') {
        // eslint-disable-next-line no-restricted-globals
        if (typeof globalThis !== 'undefined' && (globalThis as any).confirm?.(`${title}\n\n${message}`)) onConfirm();
    } else {
        Alert.alert(title, message, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Confirm', style: 'destructive', onPress: onConfirm },
        ]);
    }
}

export default function OrganizationScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { user } = useAuthStore();
    const {
        organizations,
        selectedOrg,
        members,
        isLoading,
        fetchOrganizations,
        selectOrganization,
        fetchMembers,
        createOrganization,
        addMember,
        removeMember,
        updateMemberRole,
        deleteOrganization,
    } = useOrganizationStore();

    const [refreshing, setRefreshing] = useState(false);
    const [newOrgName, setNewOrgName] = useState('');
    const [creating, setCreating] = useState(false);
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [newMemberRole, setNewMemberRole] = useState<OrgRole>('member');
    const [addingMember, setAddingMember] = useState(false);
    const [memberError, setMemberError] = useState<string | null>(null);

    useEffect(() => {
        fetchOrganizations();
    }, []);

    useEffect(() => {
        if (selectedOrg) {
            fetchMembers(selectedOrg.id);
        }
    }, [selectedOrg?.id]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchOrganizations();
        if (selectedOrg) await fetchMembers(selectedOrg.id);
        setRefreshing(false);
    }, [selectedOrg?.id]);

    const handleCreateOrg = async () => {
        if (!newOrgName.trim()) return;
        setCreating(true);
        try {
            await createOrganization(newOrgName.trim());
            setNewOrgName('');
        } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to create organization');
        }
        setCreating(false);
    };

    const handleAddMember = async () => {
        if (!selectedOrg || !newMemberEmail.trim()) return;
        setAddingMember(true);
        setMemberError(null);
        try {
            await addMember(selectedOrg.id, newMemberEmail.trim(), newMemberRole);
            setNewMemberEmail('');
            setNewMemberRole('member');
        } catch (e: any) {
            const msg = e?.response?.data?.detail || e?.message || 'Failed to add member';
            setMemberError(msg);
        }
        setAddingMember(false);
    };

    const handleRemoveMember = (member: OrgMember) => {
        if (!selectedOrg) return;
        confirmAction(
            'Remove Member',
            `Remove ${member.user_name || member.email} from ${selectedOrg.name}?`,
            () => removeMember(selectedOrg.id, member.user_id),
        );
    };

    const handleRoleChange = async (member: OrgMember, newRole: OrgRole) => {
        if (!selectedOrg || member.role === newRole) return;
        try {
            await updateMemberRole(selectedOrg.id, member.user_id, newRole);
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.detail || e?.message || 'Failed to update role');
        }
    };

    const handleDeleteOrg = () => {
        if (!selectedOrg) return;
        confirmAction(
            'Delete Organization',
            `Permanently delete "${selectedOrg.name}"? All sign assignments will be removed.`,
            () => deleteOrganization(selectedOrg.id),
        );
    };

    const currentUserRole = selectedOrg?.role;
    const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin';
    const canDeleteOrg = currentUserRole === 'owner';

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* ── Create Organization ──────────────────────────────── */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Create Organization</Text>
                <View style={styles.row}>
                    <TextInput
                        style={styles.input}
                        placeholder="Organization name"
                        placeholderTextColor={colors.textMuted}
                        value={newOrgName}
                        onChangeText={setNewOrgName}
                    />
                    <Pressable
                        style={[styles.btn, styles.btnPrimary, (!newOrgName.trim() || creating) && styles.btnDisabled]}
                        onPress={handleCreateOrg}
                        disabled={!newOrgName.trim() || creating}
                    >
                        <Text style={styles.btnText}>{creating ? '...' : 'Create'}</Text>
                    </Pressable>
                </View>
            </View>

            {/* ── Organization Selector ───────────────────────────── */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Your Organizations</Text>
                {isLoading && organizations.length === 0 ? (
                    <ActivityIndicator color={colors.primary} />
                ) : organizations.length === 0 ? (
                    <Text style={styles.emptyText}>No organizations yet. Create one above.</Text>
                ) : (
                    organizations.map((org) => (
                        <Pressable
                            key={org.id}
                            style={[styles.orgItem, selectedOrg?.id === org.id && styles.orgItemSelected]}
                            onPress={() => selectOrganization(org)}
                        >
                            <View style={styles.orgItemContent}>
                                <Text style={[styles.orgName, selectedOrg?.id === org.id && styles.orgNameSelected]}>
                                    {org.name}
                                </Text>
                                {org.role && (
                                    <View style={[styles.roleBadge, { backgroundColor: ROLE_LABELS[org.role].color + '20' }]}>
                                        <Text style={[styles.roleBadgeText, { color: ROLE_LABELS[org.role].color }]}>
                                            {ROLE_LABELS[org.role].label}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </Pressable>
                    ))
                )}
            </View>

            {/* ── Selected Organization Details ──────────────────── */}
            {selectedOrg && (
                <>
                    {/* Members */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Members — {selectedOrg.name}</Text>

                        {canManageMembers && (
                            <>
                                <View style={styles.row}>
                                    <TextInput
                                        style={[styles.input, { flex: 1 }]}
                                        placeholder="Email address"
                                        placeholderTextColor={colors.textMuted}
                                        value={newMemberEmail}
                                        onChangeText={setNewMemberEmail}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                    />
                                </View>
                                <View style={[styles.row, { marginTop: 8 }]}>
                                    {ROLE_OPTIONS.filter(r => currentUserRole === 'owner' || r !== 'owner').map((role) => (
                                        <Pressable
                                            key={role}
                                            style={[styles.roleChip, newMemberRole === role && styles.roleChipSelected]}
                                            onPress={() => setNewMemberRole(role)}
                                        >
                                            <Text style={[styles.roleChipText, newMemberRole === role && styles.roleChipTextSelected]}>
                                                {ROLE_LABELS[role].label}
                                            </Text>
                                        </Pressable>
                                    ))}
                                    <View style={{ flex: 1 }} />
                                    <Pressable
                                        style={[styles.btn, styles.btnPrimary, (!newMemberEmail.trim() || addingMember) && styles.btnDisabled]}
                                        onPress={handleAddMember}
                                        disabled={!newMemberEmail.trim() || addingMember}
                                    >
                                        <Text style={styles.btnText}>{addingMember ? '...' : 'Add'}</Text>
                                    </Pressable>
                                </View>
                                {memberError && <Text style={styles.errorText}>{memberError}</Text>}
                            </>
                        )}

                        <View style={styles.memberList}>
                            {members.map((member) => (
                                <View key={member.id} style={styles.memberRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.memberName}>
                                            {member.user_name || member.email}
                                            {member.user_id === user?.id ? ' (you)' : ''}
                                        </Text>
                                        <Text style={styles.memberEmail}>{member.email}</Text>
                                    </View>
                                    <View style={[styles.roleBadge, { backgroundColor: ROLE_LABELS[member.role].color + '20' }]}>
                                        <Text style={[styles.roleBadgeText, { color: ROLE_LABELS[member.role].color }]}>
                                            {ROLE_LABELS[member.role].label}
                                        </Text>
                                    </View>
                                    {canManageMembers && member.user_id !== user?.id && (
                                        <Pressable
                                            style={[styles.btn, styles.btnDanger, { marginLeft: 8 }]}
                                            onPress={() => handleRemoveMember(member)}
                                        >
                                            <Text style={styles.btnDangerText}>✕</Text>
                                        </Pressable>
                                    )}
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Danger Zone */}
                    {canDeleteOrg && (
                        <View style={[styles.card, styles.dangerCard]}>
                            <Text style={styles.cardTitle}>Danger Zone</Text>
                            <Pressable style={[styles.btn, styles.btnDangerFull]} onPress={handleDeleteOrg}>
                                <Text style={styles.btnText}>Delete Organization</Text>
                            </Pressable>
                        </View>
                    )}
                </>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.grayLight },
    content: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },
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
    dangerCard: { borderWidth: 1, borderColor: '#FF3B30' },
    cardTitle: { ...typography.h3, marginBottom: spacing.sm, color: colors.textPrimary },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.divider,
        borderRadius: layout.borderRadiusSm,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 14,
        color: colors.textPrimary,
        backgroundColor: colors.offWhite,
    },
    btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
    btnPrimary: { backgroundColor: colors.primary },
    btnDisabled: { opacity: 0.5 },
    btnDanger: { backgroundColor: 'rgba(255,59,48,0.10)', paddingHorizontal: 10 },
    btnDangerFull: { backgroundColor: '#f3727f', borderRadius: 9999 },
    btnDangerText: { color: '#f3727f', fontWeight: '700' },
    btnText: { ...typography.button, color: colors.white },
    orgItem: {
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: layout.borderRadius,
        marginBottom: 4,
    },
    orgItemSelected: { backgroundColor: 'rgba(24,119,242,0.15)' },
    orgItemContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    orgName: { fontSize: 16, color: colors.textPrimary, fontWeight: '400' },
    orgNameSelected: { color: colors.primary, fontWeight: '700' },
    roleBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 9999 },
    roleBadgeText: { fontSize: 12, fontWeight: '700' },
    emptyText: { color: colors.textSecondary, fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 },
    errorText: { color: '#f3727f', fontSize: 13, marginTop: 6 },
    memberList: { marginTop: spacing.sm },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.divider,
    },
    memberName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    memberEmail: { fontSize: 12, color: colors.textSecondary },
    roleChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 9999,
        backgroundColor: colors.grayMid,
    },
    roleChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    roleChipText: { fontSize: 13, color: colors.textSecondary },
    roleChipTextSelected: { color: colors.white, fontWeight: '700' },
});
