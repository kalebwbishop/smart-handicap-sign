import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { createApiServices, getApiV1BaseUrl } from "@hazard-hero/shared";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./tokens";

const API_URL = getApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);

const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return null;
      const { data } = await axios.post<{ accessToken: string; refreshToken?: string }>(
        `${API_URL}/auth/refresh`,
        { refreshToken }
      );
      await setTokens(data.accessToken, data.refreshToken ?? refreshToken);
      return data.accessToken;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (!original || original._retry || error.response?.status !== 401) {
      throw error;
    }
    original._retry = true;
    const token = await refreshAccessToken();
    if (!token) {
      await clearTokens();
      throw error;
    }
    original.headers = original.headers ?? {};
    original.headers.Authorization = `Bearer ${token}`;
    return axiosInstance.request(original);
  }
);

const apiClient = {
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await axiosInstance.get<T>(url, config);
    return response.data;
  },
  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await axiosInstance.post<T>(url, data, config);
    return response.data;
  },
  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await axiosInstance.put<T>(url, data, config);
    return response.data;
  },
  async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await axiosInstance.patch<T>(url, data, config);
    return response.data;
  },
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await axiosInstance.delete<T>(url, config);
    return response.data;
  },
};

export const sharedApi = createApiServices(apiClient);
