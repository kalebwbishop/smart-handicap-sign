import { AuthResponse, LoginInitResponse, initiateLogoutResponse, User, Sign, SignNotification, Organization, OrgMember, OrgRole } from '../types/types';
// Note: NotificationType was removed — notifications no longer carry a type field
import apiClient from './client';

// Auth API
export const authAPI = {
    initiateLogin: async (redirectUri?: string): Promise<LoginInitResponse> => {
        const params = redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : '';
        const response = await apiClient.get<LoginInitResponse>(`/auth/login${params}`);
        return response;
    },

    handleCallback: async (code: string): Promise<AuthResponse> => {
        console.log('[API] Calling /auth/exchange with code:', code);
        const response = await apiClient.post<AuthResponse>(`/auth/exchange`, { data: { code } });
        return response;
    },

    getCurrentUser: async (): Promise<User> => {
        const response = await apiClient.get<{ user: User }>('/auth/me');
        return response.user;
    },

    initiateLogout: async (): Promise<initiateLogoutResponse> => {
        const response = await apiClient.post<initiateLogoutResponse>('/auth/logout');
        return response;
    },
};

// Organization API
export const organizationAPI = {
    getOrganizations: async (): Promise<Organization[]> => {
        const response = await apiClient.get<Organization[]>('/organizations');
        return response;
    },

    getOrganization: async (orgId: string): Promise<Organization> => {
        const response = await apiClient.get<Organization>(`/organizations/${orgId}`);
        return response;
    },

    createOrganization: async (name: string): Promise<Organization> => {
        const response = await apiClient.post<Organization>('/organizations', { name });
        return response;
    },

    updateOrganization: async (orgId: string, name: string): Promise<Organization> => {
        const response = await apiClient.patch<Organization>(`/organizations/${orgId}`, { name });
        return response;
    },

    deleteOrganization: async (orgId: string): Promise<void> => {
        await apiClient.delete(`/organizations/${orgId}`);
    },

    getMembers: async (orgId: string): Promise<OrgMember[]> => {
        const response = await apiClient.get<OrgMember[]>(`/organizations/${orgId}/members`);
        return response;
    },

    addMember: async (orgId: string, email: string, role: OrgRole = 'member'): Promise<OrgMember> => {
        const response = await apiClient.post<OrgMember>(`/organizations/${orgId}/members`, { email, role });
        return response;
    },

    updateMemberRole: async (orgId: string, userId: string, role: OrgRole): Promise<OrgMember> => {
        const response = await apiClient.patch<OrgMember>(`/organizations/${orgId}/members/${userId}`, { role });
        return response;
    },

    removeMember: async (orgId: string, userId: string): Promise<void> => {
        await apiClient.delete(`/organizations/${orgId}/members/${userId}`);
    },
};

// Sign API
export const signAPI = {
    getSigns: async (organizationId?: string): Promise<Sign[]> => {
        const query = organizationId ? `?organization_id=${organizationId}` : '';
        const response = await apiClient.get<Sign[]>(`/signs${query}`);
        return response;
    },

    getSign: async (signId: string): Promise<Sign> => {
        const response = await apiClient.get<Sign>(`/signs/${signId}`);
        return response;
    },

    getMySign: async (): Promise<Sign> => {
        const response = await apiClient.get<Sign>('/signs/me');
        return response;
    },

    createSign: async (name: string, location: string, organizationId?: string): Promise<Sign> => {
        const response = await apiClient.post<Sign>('/signs', {
            name,
            location,
            organization_id: organizationId,
        });
        return response;
    },

    updateSignStatus: async (signId: string, status: string): Promise<Sign> => {
        const response = await apiClient.patch<Sign>(`/signs/${signId}`, { status });
        return response;
    },

    acknowledgeSign: async (signId: string): Promise<Sign> => {
        const response = await apiClient.post<Sign>(`/signs/${signId}/acknowledge`);
        return response;
    },

    resolveSign: async (signId: string): Promise<Sign> => {
        const response = await apiClient.post<Sign>(`/signs/${signId}/resolve`);
        return response;
    },

    deleteSign: async (signId: string): Promise<void> => {
        await apiClient.delete(`/signs/${signId}`);
    },
};

// Notification API
export const notificationAPI = {
    getNotifications: async (params?: { after?: string; read?: boolean }): Promise<SignNotification[]> => {
        const query = new URLSearchParams();
        if (params?.after) query.append('after', params.after);
        if (params?.read !== undefined) query.append('read', String(params.read));
        const qs = query.toString();
        const response = await apiClient.get<SignNotification[]>(`/notifications${qs ? `?${qs}` : ''}`);
        return response;
    },

    getUnreadCount: async (): Promise<{ unread_count: number }> => {
        const response = await apiClient.get<{ unread_count: number }>('/notifications/unread/count');
        return response;
    },

    markAsRead: async (notificationId: string): Promise<SignNotification> => {
        const response = await apiClient.post<SignNotification>(`/notifications/${notificationId}/read`);
        return response;
    },

    markAllAsRead: async (): Promise<{ marked_read: number }> => {
        const response = await apiClient.post<{ marked_read: number }>('/notifications/read-all');
        return response;
    },
};

// Push Token API
export const pushTokenAPI = {
    register: (expo_push_token: string, device_id?: string) =>
        apiClient.post('/push-tokens', { expo_push_token, device_id }).then(r => r.data),
    unregister: (expo_push_token: string) =>
        apiClient.delete('/push-tokens', { data: { expo_push_token } }),
};
