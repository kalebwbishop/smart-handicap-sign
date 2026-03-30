import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import Storage from '../utils/storage';

// Get API URL from environment variable
// Use LAN IP so physical devices can reach the backend
const API_URL = (process.env.EXPO_PUBLIC_API_URL || '') + '/api/v1';
// const API_URL = process.env.API_URL || 'https://res007-0-8a1a2ecf605e412c-dev.redground-500683d1.eastus.azurecontainerapps.io/api/v1';

class ApiClient {
    private client: AxiosInstance;
    private isRefreshing = false;
    private failedQueue: Array<{
        resolve: (token: string) => void;
        reject: (error: any) => void;
    }> = [];

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

        // Response interceptor — attempt silent refresh on 401
        this.client.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
                const requestUrl = originalRequest?.url || '';

                // Skip refresh logic for auth endpoints to avoid loops
                const isAuthEndpoint =
                    requestUrl.includes('/auth/logout') ||
                    requestUrl.includes('/auth/refresh') ||
                    requestUrl.includes('/auth/exchange');

                if (
                    error.response?.status === 401 &&
                    !originalRequest._retry &&
                    !isAuthEndpoint
                ) {
                    // Try refreshing the token
                    const refreshToken = await Storage.getKey('refresh_token');

                    if (refreshToken) {
                        if (this.isRefreshing) {
                            // Another refresh is already in flight — queue this request
                            return new Promise((resolve, reject) => {
                                this.failedQueue.push({ resolve, reject });
                            }).then((newToken) => {
                                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                                originalRequest._retry = true;
                                return this.client(originalRequest);
                            });
                        }

                        this.isRefreshing = true;
                        originalRequest._retry = true;

                        try {
                            const { data } = await axios.post(`${API_URL}/auth/refresh`, {
                                refreshToken,
                            });

                            const newAccessToken: string = data.accessToken;
                            const newRefreshToken: string = data.refreshToken;

                            // Persist new tokens
                            const { useAuthStore } = require('../store/authStore');
                            const { setTokens } = useAuthStore.getState();
                            await setTokens(newAccessToken, newRefreshToken);

                            // Retry queued requests
                            this.failedQueue.forEach((p) => p.resolve(newAccessToken));
                            this.failedQueue = [];

                            // Retry the original request
                            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                            return this.client(originalRequest);
                        } catch (refreshError) {
                            // Refresh failed — log the user out
                            this.failedQueue.forEach((p) => p.reject(refreshError));
                            this.failedQueue = [];

                            console.error('[API] Token refresh failed — logging out');
                            const { useAuthStore } = require('../store/authStore');
                            const { logout } = useAuthStore.getState();
                            await logout();
                            return Promise.reject(refreshError);
                        } finally {
                            this.isRefreshing = false;
                        }
                    } else {
                        // No refresh token available — log out
                        console.error('[API] Unauthorized (401) with no refresh token — logging out');
                        const { useAuthStore } = require('../store/authStore');
                        const { logout } = useAuthStore.getState();
                        await logout();
                    }
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
