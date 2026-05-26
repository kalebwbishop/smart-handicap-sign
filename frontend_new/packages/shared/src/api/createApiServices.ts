import type {
  AuthResponse,
  Device,
  DeviceEvent,
  DeviceLifecycleStatus,
  LoginInitResponse,
  Organization,
  OrgMember,
  OrgRole,
  RevokeRequest,
  SignNotification,
  Site,
  SiteCreate,
  TransferRequest,
  ParkingSpace,
  ParkingSpaceCreate,
  User,
  ClaimValidateRequest,
  ClaimValidateResponse,
  ClaimRequest,
  ClaimResponse,
  initiateLogoutResponse,
} from "../types";
import type { ApiClient } from "./types";

export function createApiServices(apiClient: ApiClient) {
  const authAPI = {
    initiateLogin: async (redirectUri?: string): Promise<LoginInitResponse> => {
      const params = redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : "";
      return apiClient.get<LoginInitResponse>(`/auth/login${params}`);
    },
    handleCallback: async (code: string): Promise<AuthResponse> => {
      return apiClient.post<AuthResponse>("/auth/exchange", { data: { code } });
    },
    getCurrentUser: async (): Promise<User> => {
      const response = await apiClient.get<{ user: User }>("/auth/me");
      return response.user;
    },
    initiateLogout: async (): Promise<initiateLogoutResponse> => {
      return apiClient.post<initiateLogoutResponse>("/auth/logout");
    },
  };

  const organizationAPI = {
    getOrganizations: async (): Promise<Organization[]> => {
      return apiClient.get<Organization[]>("/organizations");
    },
    getOrganization: async (orgId: string): Promise<Organization> => {
      return apiClient.get<Organization>(`/organizations/${orgId}`);
    },
    createOrganization: async (name: string): Promise<Organization> => {
      return apiClient.post<Organization>("/organizations", { name });
    },
    updateOrganization: async (orgId: string, name: string): Promise<Organization> => {
      return apiClient.patch<Organization>(`/organizations/${orgId}`, { name });
    },
    deleteOrganization: async (orgId: string): Promise<void> => {
      await apiClient.delete<void>(`/organizations/${orgId}`);
    },
    getMembers: async (orgId: string): Promise<OrgMember[]> => {
      return apiClient.get<OrgMember[]>(`/organizations/${orgId}/members`);
    },
    addMember: async (orgId: string, email: string, role: OrgRole = "member"): Promise<OrgMember> => {
      return apiClient.post<OrgMember>(`/organizations/${orgId}/members`, { email, role });
    },
    updateMemberRole: async (orgId: string, userId: string, role: OrgRole): Promise<OrgMember> => {
      return apiClient.patch<OrgMember>(`/organizations/${orgId}/members/${userId}`, { role });
    },
    removeMember: async (orgId: string, userId: string): Promise<void> => {
      await apiClient.delete<void>(`/organizations/${orgId}/members/${userId}`);
    },
  };

  const notificationAPI = {
    getNotifications: async (
      params?: { after?: string; read?: boolean },
      config?: unknown,
    ): Promise<SignNotification[]> => {
      const query = new URLSearchParams();
      if (params?.after) query.append("after", params.after);
      if (params?.read !== undefined) query.append("read", String(params.read));
      const qs = query.toString();
      return apiClient.get<SignNotification[]>(`/notifications${qs ? `?${qs}` : ""}`, config);
    },
    getUnreadCount: async (): Promise<{ unread_count: number }> => {
      return apiClient.get<{ unread_count: number }>("/notifications/unread/count");
    },
    markAsRead: async (notificationId: string): Promise<SignNotification> => {
      return apiClient.post<SignNotification>(`/notifications/${notificationId}/read`);
    },
    markAllAsRead: async (): Promise<{ marked_read: number }> => {
      return apiClient.post<{ marked_read: number }>("/notifications/read-all");
    },
  };

  const pushTokenAPI = {
    register: (expo_push_token: string, device_id?: string) =>
      apiClient.post("/push-tokens", { expo_push_token, device_id }),
    unregister: (expo_push_token: string) =>
      apiClient.delete("/push-tokens", { data: { expo_push_token } }),
  };

  const devicesAPI = {
    list: async (params?: { organization_id?: string; lifecycle_status?: DeviceLifecycleStatus }): Promise<Device[]> => {
      const query = new URLSearchParams();
      if (params?.organization_id) query.append("organization_id", params.organization_id);
      if (params?.lifecycle_status) query.append("lifecycle_status", params.lifecycle_status);
      const qs = query.toString();
      return apiClient.get<Device[]>(`/devices${qs ? `?${qs}` : ""}`);
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

  const deviceClaimsAPI = {
    validate: async (request: ClaimValidateRequest): Promise<ClaimValidateResponse> => {
      return apiClient.post<ClaimValidateResponse>("/device-claims/validate", request);
    },
    claim: async (request: ClaimRequest): Promise<ClaimResponse> => {
      return apiClient.post<ClaimResponse>("/device-claims/claim", request);
    },
  };

  const sitesAPI = {
    list: async (organizationId?: string): Promise<Site[]> => {
      const query = organizationId ? `?organization_id=${organizationId}` : "";
      return apiClient.get<Site[]>(`/sites${query}`);
    },
    get: async (siteId: string): Promise<Site> => {
      return apiClient.get<Site>(`/sites/${siteId}`);
    },
    create: async (site: SiteCreate): Promise<Site> => {
      return apiClient.post<Site>("/sites", site);
    },
    update: async (siteId: string, updates: Partial<SiteCreate>): Promise<Site> => {
      return apiClient.patch<Site>(`/sites/${siteId}`, updates);
    },
    delete: async (siteId: string): Promise<void> => {
      await apiClient.delete<void>(`/sites/${siteId}`);
    },
    listParkingSpaces: async (siteId: string): Promise<ParkingSpace[]> => {
      return apiClient.get<ParkingSpace[]>(`/sites/${siteId}/parking-spaces`);
    },
    createParkingSpace: async (siteId: string, space: Omit<ParkingSpaceCreate, "site_id">): Promise<ParkingSpace> => {
      return apiClient.post<ParkingSpace>(`/sites/${siteId}/parking-spaces`, space);
    },
    getParkingSpace: async (spaceId: string): Promise<ParkingSpace> => {
      return apiClient.get<ParkingSpace>(`/parking-spaces/${spaceId}`);
    },
    updateParkingSpace: async (spaceId: string, updates: Partial<ParkingSpaceCreate>): Promise<ParkingSpace> => {
      return apiClient.patch<ParkingSpace>(`/parking-spaces/${spaceId}`, updates);
    },
    deleteParkingSpace: async (spaceId: string): Promise<void> => {
      await apiClient.delete<void>(`/parking-spaces/${spaceId}`);
    },
  };

  return {
    authAPI,
    organizationAPI,
    notificationAPI,
    pushTokenAPI,
    devicesAPI,
    deviceClaimsAPI,
    sitesAPI,
  };
}
