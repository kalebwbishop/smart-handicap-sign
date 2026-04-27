console.log('[CLIENT] client.ts module evaluating...');
import axios, { AxiosRequestConfig } from 'axios';
import { setupAuthInterceptor } from 'deploy-box-react-native/src/auth/authInterceptor';
import { tokenStorage } from '../lib/auth';

const API_URL = (process.env.EXPO_PUBLIC_API_URL || '') + '/api/v1';
console.log('[CLIENT] API_URL resolved to:', API_URL);
console.log('[CLIENT] EXPO_PUBLIC_API_URL env:', process.env.EXPO_PUBLIC_API_URL);

const axiosInstance = axios.create({
    baseURL: API_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Refresh function uses a separate axios call to avoid interceptor loops
async function refreshFn(refreshToken: string) {
    const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
    return data as { accessToken: string; refreshToken?: string };
}

// Wire up the shared auth interceptor (adds Bearer token + silent refresh)
console.log('[CLIENT] Setting up auth interceptor...');
setupAuthInterceptor(
    axiosInstance,
    tokenStorage,
    refreshFn,
    () => {
        console.log('[CLIENT] Session expired callback triggered');
        const { useAuthStore } = require('../store/authStore');
        useAuthStore.getState().handleSessionExpired();
    },
);
console.log('[CLIENT] Auth interceptor set up');

class ApiClient {
    async get<T>(url: string, config?: AxiosRequestConfig) {
        const response = await axiosInstance.get<T>(url, config);
        return response.data;
    }

    async post<T>(url: string, data?: any, config?: AxiosRequestConfig) {
        const response = await axiosInstance.post<T>(url, data, config);
        return response.data;
    }

    async put<T>(url: string, data?: any, config?: AxiosRequestConfig) {
        const response = await axiosInstance.put<T>(url, data, config);
        return response.data;
    }

    async patch<T>(url: string, data?: any, config?: AxiosRequestConfig) {
        const response = await axiosInstance.patch<T>(url, data, config);
        return response.data;
    }

    async delete<T>(url: string, config?: AxiosRequestConfig) {
        const response = await axiosInstance.delete<T>(url, config);
        return response.data;
    }
}

export const apiClient = new ApiClient();
export default apiClient;
