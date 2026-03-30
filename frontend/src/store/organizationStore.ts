import { create } from 'zustand';
import { Organization, OrgMember } from '../types/types';
import { organizationAPI } from '../api/api';

interface OrganizationState {
    organizations: Organization[];
    selectedOrg: Organization | null;
    members: OrgMember[];
    isLoading: boolean;
    error: string | null;

    fetchOrganizations: () => Promise<void>;
    selectOrganization: (org: Organization | null) => void;
    fetchMembers: (orgId: string) => Promise<void>;
    createOrganization: (name: string) => Promise<Organization>;
    addMember: (orgId: string, email: string, role?: 'owner' | 'admin' | 'member') => Promise<OrgMember>;
    removeMember: (orgId: string, userId: string) => Promise<void>;
    updateMemberRole: (orgId: string, userId: string, role: 'owner' | 'admin' | 'member') => Promise<void>;
    deleteOrganization: (orgId: string) => Promise<void>;
}

export const useOrganizationStore = create<OrganizationState>((set, get) => ({
    organizations: [],
    selectedOrg: null,
    members: [],
    isLoading: false,
    error: null,

    fetchOrganizations: async () => {
        set({ isLoading: true, error: null });
        try {
            const orgs = await organizationAPI.getOrganizations();
            const current = get().selectedOrg;
            set({
                organizations: orgs,
                // Auto-select first org if none selected
                selectedOrg: current && orgs.find(o => o.id === current.id) ? current : orgs[0] || null,
                isLoading: false,
            });
        } catch (error: any) {
            set({ error: error?.message || 'Failed to fetch organizations', isLoading: false });
        }
    },

    selectOrganization: (org) => {
        set({ selectedOrg: org, members: [] });
    },

    fetchMembers: async (orgId) => {
        try {
            const members = await organizationAPI.getMembers(orgId);
            set({ members });
        } catch (error: any) {
            set({ error: error?.message || 'Failed to fetch members' });
        }
    },

    createOrganization: async (name) => {
        const org = await organizationAPI.createOrganization(name);
        set((state) => ({
            organizations: [...state.organizations, org],
            selectedOrg: state.selectedOrg || org,
        }));
        return org;
    },

    addMember: async (orgId, email, role = 'member') => {
        const member = await organizationAPI.addMember(orgId, email, role);
        set((state) => ({ members: [...state.members, member] }));
        return member;
    },

    removeMember: async (orgId, userId) => {
        await organizationAPI.removeMember(orgId, userId);
        set((state) => ({ members: state.members.filter(m => m.user_id !== userId) }));
    },

    updateMemberRole: async (orgId, userId, role) => {
        await organizationAPI.updateMemberRole(orgId, userId, role);
        set((state) => ({
            members: state.members.map(m =>
                m.user_id === userId ? { ...m, role } : m
            ),
        }));
    },

    deleteOrganization: async (orgId) => {
        await organizationAPI.deleteOrganization(orgId);
        set((state) => {
            const remaining = state.organizations.filter(o => o.id !== orgId);
            return {
                organizations: remaining,
                selectedOrg: state.selectedOrg?.id === orgId ? remaining[0] || null : state.selectedOrg,
                members: state.selectedOrg?.id === orgId ? [] : state.members,
            };
        });
    },
}));
