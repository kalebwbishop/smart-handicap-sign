// Type definitions for auth

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

// API Response types
export interface ApiResponse<T> {
    data?: T;
    error?: string;
    message?: string;
}

// ── Sign types ──────────────────────────────────────────────────────

export type SignStatus = 'available' | 'assistance_requested' | 'assistance_in_progress' | 'offline' | 'error' | 'training_ready' | 'training_positive' | 'training_negative';

export interface Sign {
    id: string;
    name: string;
    location: string;
    status: SignStatus;
    lastUpdated: string;
    last_updated?: string;
}

// ── Notification types ──────────────────────────────────────────────

export interface SignNotification {
    id: string;
    event_id: string | null;
    title: string;
    body: string;
    read: boolean;
    created_at: string;
    updated_at: string;
}
