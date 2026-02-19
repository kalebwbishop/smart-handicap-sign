import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import Storage from '../utils/storage';
import { useAuthStore } from '../store/authStore';

// Get API URL from environment variable
const API_URL = process.env.API_URL || 'http://localhost:8000/api/v1';
// const API_URL = process.env.API_URL || 'https://res007-0-8a1a2ecf605e412c-dev.redground-500683d1.eastus.azurecontainerapps.io/api/v1';

class ApiClient {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: API_URL,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Request interceptor to add auth token
        this.client.interceptors.request.use(
            async (config) => {
                const token = await Storage.getKey('auth_token');
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor for error handling
        this.client.interceptors.response.use(
            (response) => response,
            async (error) => {
                const requestUrl = error.config?.url || '';
                // Skip auto-logout for the logout endpoint to avoid infinite loop
                if (
                    (error.response?.status === 401 || error.response?.status === 403) &&
                    !requestUrl.includes('/auth/logout')
                ) {
                    // Token is invalid or expired - logout user
                    console.error('[API] Unauthorized (401/403) - logging out user');
                    const { logout } = useAuthStore.getState();
                    await logout();
                }
                return Promise.reject(error);
            }
        );
    }

    async get<T>(url: string, config?: AxiosRequestConfig) {
        const response = await this.client.get<T>(url, config);
        return response.data;
    }

    async post<T>(url: string, data?: any, config?: AxiosRequestConfig) {
        const response = await this.client.post<T>(url, data, config);
        return response.data;
    }

    async put<T>(url: string, data?: any, config?: AxiosRequestConfig) {
        const response = await this.client.put<T>(url, data, config);
        return response.data;
    }

    async patch<T>(url: string, data?: any, config?: AxiosRequestConfig) {
        const response = await this.client.patch<T>(url, data, config);
        return response.data;
    }

    async delete<T>(url: string, config?: AxiosRequestConfig) {
        const response = await this.client.delete<T>(url, config);
        return response.data;
    }
}

export const apiClient = new ApiClient();
export default apiClient;
