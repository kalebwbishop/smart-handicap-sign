import { AuthResponse, LoginInitResponse, initiateLogoutResponse, User, Sign, SignNotification } from '../types/types';
import apiClient from './client';

// Auth API
export const authAPI = {
    initiateLogin: async (): Promise<LoginInitResponse> => {
        const response = await apiClient.get<LoginInitResponse>('/auth/login');
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
    getSign: async (signId: string): Promise<Sign> => {
        const response = await apiClient.get<Sign>(`/signs/${signId}`);
        return response;
    },

    getMySign: async (): Promise<Sign> => {
        const response = await apiClient.get<Sign>('/signs/me');
        return response;
    },
};

// Notification API
export const notificationAPI = {
    getNotifications: async (): Promise<SignNotification[]> => {
        const response = await apiClient.get<SignNotification[]>('/notifications');
        return response;
    },

    acknowledgeNotification: async (notificationId: string): Promise<{ success: boolean }> => {
        const response = await apiClient.post<{ success: boolean }>(`/notifications/${notificationId}/acknowledge`);
        return response;
    },

    acknowledgeAll: async (): Promise<{ success: boolean }> => {
        const response = await apiClient.post<{ success: boolean }>('/notifications/acknowledge-all');
        return response;
    },
};
