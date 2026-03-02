import { AuthResponse, LoginInitResponse, initiateLogoutResponse, User, Sign, SignNotification } from '../types/types';
// Note: NotificationType was removed — notifications no longer carry a type field
import apiClient from './client';

// Auth API
export const authAPI = {
    initiateLogin: async (mobileRedirect?: string): Promise<LoginInitResponse> => {
        const params = mobileRedirect ? `?mobile_redirect=${encodeURIComponent(mobileRedirect)}` : '';
        const response = await apiClient.get<LoginInitResponse>(`/auth/login${params}`);
        console.log('response', response);
        return response;
    },

    handleCallback: async (code: string): Promise<AuthResponse> => {
        console.log('[API] Calling /auth/exchange with code:', code);
        const response = await apiClient.post<AuthResponse>(`/auth/exchange`, { data: { code } });
        return response;
    },

    getCurrentUser: async (): Promise<User> => {
        const response = await apiClient.get<User>('/auth/me');
        return response;
    },

    initiateLogout: async (): Promise<initiateLogoutResponse> => {
        const response = await apiClient.post<initiateLogoutResponse>('/auth/logout');
        return response;
    },
};

// Sign API
export const signAPI = {
    getSigns: async (): Promise<Sign[]> => {
        const response = await apiClient.get<Sign[]>('/signs');
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
