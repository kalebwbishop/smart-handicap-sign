export interface ApiDevice {
  deviceId: string;
  serialNumber: string | null;
  modelCode: string | null;
  hardwareRevision: string | null;
  firmwareVersion: string | null;
  lifecycleStatus: string;
  connectivityStatus: string;
  operationalStatus: string;
  batteryPercentage: number;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceActionResponse {
  deviceId: string;
  operationalStatus: string | null;
}

export interface HealthResponse {
  status: string;
}

const API_BASE_URL = "/function-api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      message = payload.error?.message || message;
    } catch {
      // Keep the useful status-based error when the service returns no JSON.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export const hazardHeroApi = {
  health: () => request<HealthResponse>("/health"),
  listDevices: () => request<ApiDevice[]>("/devices"),
  acknowledgeDevice: (deviceId: string) =>
    request<DeviceActionResponse>(`/devices/${encodeURIComponent(deviceId)}/acknowledge`, {
      method: "POST",
    }),
  resolveDevice: (deviceId: string) =>
    request<DeviceActionResponse>(`/devices/${encodeURIComponent(deviceId)}/resolve`, {
      method: "POST",
    }),
};
