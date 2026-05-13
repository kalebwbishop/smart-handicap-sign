import {
  Device,
  DeviceLifecycleStatus,
  TransferRequest,
  RevokeRequest,
  DeviceEvent,
} from '../types/device';
import apiClient from './client';

export const devicesAPI = {
  list: async (params?: { organization_id?: string; lifecycle_status?: DeviceLifecycleStatus }): Promise<Device[]> => {
    const query = new URLSearchParams();
    if (params?.organization_id) query.append('organization_id', params.organization_id);
    if (params?.lifecycle_status) query.append('lifecycle_status', params.lifecycle_status);
    const qs = query.toString();
    return apiClient.get<Device[]>(`/devices${qs ? `?${qs}` : ''}`);
  },

  getBySerial: async (serialNumber: string): Promise<Device> => {
    return apiClient.get<Device>(`/devices/${encodeURIComponent(serialNumber)}`);
  },

  acknowledge: async (serialNumber: string): Promise<Device> => {
    return apiClient.post<Device>(`/devices/${encodeURIComponent(serialNumber)}/acknowledge`);
  },

  resolve: async (serialNumber: string): Promise<Device> => {
    return apiClient.post<Device>(`/devices/${encodeURIComponent(serialNumber)}/resolve`);
  },

  revoke: async (serialNumber: string, request: RevokeRequest): Promise<Device> => {
    return apiClient.post<Device>(`/devices/${encodeURIComponent(serialNumber)}/revoke`, request);
  },

  transfer: async (serialNumber: string, request: TransferRequest): Promise<Device> => {
    return apiClient.post<Device>(`/devices/${encodeURIComponent(serialNumber)}/transfer`, request);
  },

  release: async (serialNumber: string): Promise<Device> => {
    return apiClient.post<Device>(`/devices/${encodeURIComponent(serialNumber)}/release`);
  },

  regenerateClaim: async (serialNumber: string): Promise<{ claim_id: string }> => {
    return apiClient.post<{ claim_id: string }>(`/devices/${encodeURIComponent(serialNumber)}/regenerate-claim`);
  },

  getEvents: async (serialNumber: string): Promise<DeviceEvent[]> => {
    return apiClient.get<DeviceEvent[]>(`/devices/${encodeURIComponent(serialNumber)}/events`);
  },
};
