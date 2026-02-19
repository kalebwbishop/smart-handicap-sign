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

export type SignStatus = 'available' | 'occupied' | 'offline' | 'error';

export interface Sign {
    id: string;
    name: string;
    location: string;
    status: SignStatus;
    lastUpdated: string;
    batteryLevel: number;      // 0–100
    signalStrength: number;    // 0–100
}

// ── Notification types ──────────────────────────────────────────────

export type NotificationType = 'status_change' | 'alert' | 'maintenance' | 'misuse';

export interface SignNotification {
    id: string;
    signId: string;
    type: NotificationType;
    title: string;
    message: string;
    timestamp: string;
    acknowledged: boolean;
}
