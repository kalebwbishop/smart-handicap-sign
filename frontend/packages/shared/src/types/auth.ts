export interface User {
  id: string;
  workosUserId: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface LoginInitResponse {
  authorizationUrl: string;
}

export interface initiateLoginResponse {
  authorizationUrl: string;
}

export interface initiateLogoutResponse {
  message: string;
  logoutUrl: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export type OrgRole = "owner" | "admin" | "member";

export interface Organization {
  id: string;
  name: string;
  role?: OrgRole;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  email?: string;
  user_name?: string;
  created_at: string;
  updated_at: string;
}

export interface SignNotification {
  id: string;
  device_event_id: string | null;
  user_id: string | null;
  device_event_correct_response: boolean | null;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  assistance_requests_enabled: boolean;
  push_enabled: boolean;
}

export interface PushTokenRegistration {
  expo_push_token: string;
}

export interface PushTokenRemoval {
  removed: boolean;
}
