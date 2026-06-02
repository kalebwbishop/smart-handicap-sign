import type { Device, DeviceLifecycleStatus, DeviceConnectivityStatus } from '../types/device';
import type { SignNotification } from '@/types/types';
import { colors } from '../theme/colors';

type EnvReader = {
    process?: {
        env?: Record<string, string | undefined>;
    };
};

const DEFAULT_STALE_THRESHOLD_MINUTES = 15;
const STALE_THRESHOLD_ENV_KEY = 'EXPO_PUBLIC_DEVICE_STALE_MINUTES';

const LIFECYCLE_STATUS: Record<DeviceLifecycleStatus, { label: string; color: string }> = {
    active: { label: 'Ready for requests', color: '#34C759' },
    manufactured: { label: 'Not active yet', color: colors.textMuted },
    unclaimed: { label: 'Not active yet', color: colors.textMuted },
    claiming: { label: 'Setup in progress', color: colors.warning },
    lost: { label: 'Needs support', color: colors.negative },
    revoked: { label: 'Needs support', color: colors.negative },
    retired: { label: 'Offline', color: colors.textMuted },
};

const OPERATIONAL_STATUS: Record<string, { label: string; color: string; tone: string }> = {
    available: { label: 'Available', color: '#34C759', tone: '#34C75912' },
    assistance_requested: { label: 'Assistance Requested', color: colors.negative, tone: '#FF3B3012' },
    assistance_in_progress: { label: 'Assistance In Progress', color: colors.warning, tone: '#FF950012' },
    offline: { label: 'Offline', color: colors.textMuted, tone: '#86868B12' },
    error: { label: 'Needs Attention', color: colors.warning, tone: '#FF950012' },
    unknown: { label: 'Unknown status', color: colors.textMuted, tone: '#86868B12' },
};

const CONNECTIVITY_STATUS: Record<DeviceConnectivityStatus, { label: string; color: string }> = {
    online: { label: 'Online', color: '#34C759' },
    offline: { label: 'Offline', color: colors.textMuted },
};

type ActiveAssistanceStatus = Extract<Device['operational_status'], 'assistance_requested' | 'assistance_in_progress'>;

function isActiveAssistanceStatus(status: Device['operational_status']): status is ActiveAssistanceStatus {
    return status === 'assistance_requested' || status === 'assistance_in_progress';
}

function getConfiguredStaleThresholdMinutes(): number {
    const rawValue = (globalThis as typeof globalThis & EnvReader).process?.env?.[STALE_THRESHOLD_ENV_KEY]?.trim();
    if (!rawValue) {
        return DEFAULT_STALE_THRESHOLD_MINUTES;
    }

    const parsedMinutes = Number(rawValue);
    if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
        return DEFAULT_STALE_THRESHOLD_MINUTES;
    }

    return parsedMinutes;
}

export function isDeviceStale(device: Device, now = new Date()): boolean {
    if (!device.last_seen_at) {
        return true;
    }

    const lastSeenMs = new Date(device.last_seen_at).getTime();
    if (Number.isNaN(lastSeenMs)) {
        return true;
    }

    return now.getTime() - lastSeenMs > getConfiguredStaleThresholdMinutes() * 60 * 1000;
}

export function isDeviceOffline(device: Device, now = new Date()): boolean {
    if (device.connectivity_status === 'offline') {
        return true;
    }

    return isDeviceStale(device, now);
}

export function canAcknowledgeRequest(device: Device): boolean {
    return device.operational_status === 'assistance_requested';
}

export function canResolveRequest(device: Device): boolean {
    return device.operational_status === 'assistance_in_progress';
}

export function getLatestAssistanceRequestNotification(
    notifications: SignNotification[],
): SignNotification | null {
    return notifications.find((notification) => notification.device_event_correct_response != null) ?? null;
}

export function canMarkFalsePositiveRequest(
    device: Device,
    notification: SignNotification | null,
): boolean {
    return (
        device.operational_status === 'assistance_requested' &&
        notification?.device_event_id != null &&
        notification.device_event_correct_response === true
    );
}

export function shouldShowOfflineIndicator(device: Device, now = new Date()): boolean {
    return isDeviceOffline(device, now) && isActiveAssistanceStatus(device.operational_status);
}

export function getPilotStatus(device: Device, now = new Date()) {
    if (isDeviceOffline(device, now)) {
        if (isActiveAssistanceStatus(device.operational_status)) {
            return OPERATIONAL_STATUS[device.operational_status];
        }

        return OPERATIONAL_STATUS.offline;
    }

    if (device.lifecycle_status === 'active' && device.operational_status) {
        return OPERATIONAL_STATUS[device.operational_status] ?? OPERATIONAL_STATUS.available;
    }

    const lifecycleStatus = LIFECYCLE_STATUS[device.lifecycle_status];
    return {
        ...lifecycleStatus,
        tone: `${lifecycleStatus.color}12`,
    };
}

export function getOperationalStatus(device: Device) {
    if (!device.operational_status) {
        return OPERATIONAL_STATUS.unknown;
    }
    return OPERATIONAL_STATUS[device.operational_status] || OPERATIONAL_STATUS.unknown;
}

export function getConnectivityStatus(device: Device) {
    if (!device.connectivity_status) {
        return CONNECTIVITY_STATUS.offline;
    }
    return device.connectivity_status === 'online' ? CONNECTIVITY_STATUS.online : CONNECTIVITY_STATUS.offline;
}