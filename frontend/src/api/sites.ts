import {
  Site,
  SiteCreate,
  ParkingSpace,
  ParkingSpaceCreate,
} from '../types/device';
import apiClient from './client';

export const sitesAPI = {
  list: async (organizationId?: string): Promise<Site[]> => {
    const query = organizationId ? `?organization_id=${organizationId}` : '';
    return apiClient.get<Site[]>(`/sites${query}`);
  },

  get: async (siteId: string): Promise<Site> => {
    return apiClient.get<Site>(`/sites/${siteId}`);
  },

  create: async (site: SiteCreate): Promise<Site> => {
    return apiClient.post<Site>('/sites', site);
  },

  update: async (siteId: string, updates: Partial<SiteCreate>): Promise<Site> => {
    return apiClient.patch<Site>(`/sites/${siteId}`, updates);
  },

  delete: async (siteId: string): Promise<void> => {
    await apiClient.delete(`/sites/${siteId}`);
  },

  // Parking spaces nested under sites
  listParkingSpaces: async (siteId: string): Promise<ParkingSpace[]> => {
    return apiClient.get<ParkingSpace[]>(`/sites/${siteId}/parking-spaces`);
  },

  createParkingSpace: async (siteId: string, space: Omit<ParkingSpaceCreate, 'site_id'>): Promise<ParkingSpace> => {
    return apiClient.post<ParkingSpace>(`/sites/${siteId}/parking-spaces`, space);
  },

  getParkingSpace: async (spaceId: string): Promise<ParkingSpace> => {
    return apiClient.get<ParkingSpace>(`/parking-spaces/${spaceId}`);
  },

  updateParkingSpace: async (spaceId: string, updates: Partial<ParkingSpaceCreate>): Promise<ParkingSpace> => {
    return apiClient.patch<ParkingSpace>(`/parking-spaces/${spaceId}`, updates);
  },

  deleteParkingSpace: async (spaceId: string): Promise<void> => {
    await apiClient.delete(`/parking-spaces/${spaceId}`);
  },
};
