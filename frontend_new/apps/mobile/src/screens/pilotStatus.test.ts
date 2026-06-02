import {
    canAcknowledgeRequest,
    canMarkFalsePositiveRequest,
    canResolveRequest,
    getLatestAssistanceRequestNotification,
    getPilotStatus,
    isDeviceStale,
    shouldShowOfflineIndicator,
} from './pilotStatus';
import type { Device } from '../types/device';
import type { SignNotification } from '@/types/types';

function createDevice(overrides: Partial<Device> = {}): Device {
    return {
        id: 'device-1',
        serial_number: 'SHS-2605-S01-A7K-00001-J',
        model_code: 'S01',
        hardware_revision: 'rev3',
        firmware_version: '1.0.0',
        manufacture_batch: null,
        lifecycle_status: 'active',
        connectivity_status: 'online',
        operational_status: 'available',
        claim_status: null,
        claimed_at: null,
        organization_id: null,
        current_site_id: null,
        current_parking_space_id: null,
        name: 'Pilot Sign',
        last_seen_at: '2026-05-27T15:50:00Z',
        created_at: '2026-05-27T15:00:00Z',
        updated_at: '2026-05-27T15:50:00Z',
        ...overrides,
    };
}

function createNotification(overrides: Partial<SignNotification> = {}): SignNotification {
    return {
        id: 'notification-1',
        device_event_id: 'event-1',
        user_id: 'user-1',
        device_event_correct_response: true,
        title: 'Assistance requested',
        body: 'Pilot sign needs help',
        read: false,
        created_at: '2026-05-27T15:00:00Z',
        updated_at: '2026-05-27T15:00:00Z',
        ...overrides,
    };
}

describe('pilotStatus', () => {
    const env = globalThis.process?.env ?? {};
    const originalStaleMinutes = env.EXPO_PUBLIC_DEVICE_STALE_MINUTES;

    afterEach(() => {
        if (typeof originalStaleMinutes === 'undefined') {
            delete env.EXPO_PUBLIC_DEVICE_STALE_MINUTES;
            return;
        }

        env.EXPO_PUBLIC_DEVICE_STALE_MINUTES = originalStaleMinutes;
    });

    it('marks a device stale after 15 minutes without being seen', () => {
        const device = createDevice({ last_seen_at: '2026-05-27T15:00:00Z' });

        expect(isDeviceStale(device, new Date('2026-05-27T15:16:00Z'))).toBe(true);
    });

    it('uses the configured stale threshold from the Expo public environment', () => {
        env.EXPO_PUBLIC_DEVICE_STALE_MINUTES = '5';
        const device = createDevice({ last_seen_at: '2026-05-27T15:00:00Z' });

        expect(isDeviceStale(device, new Date('2026-05-27T15:06:00Z'))).toBe(true);
    });

    it('falls back to 15 minutes when the configured stale threshold is invalid', () => {
        env.EXPO_PUBLIC_DEVICE_STALE_MINUTES = 'not-a-number';
        const device = createDevice({ last_seen_at: '2026-05-27T15:00:00Z' });

        expect(isDeviceStale(device, new Date('2026-05-27T15:06:00Z'))).toBe(false);
    });

    it('keeps the assistance status visible when the device is stale', () => {
        const device = createDevice({
            operational_status: 'assistance_requested',
            last_seen_at: '2026-05-27T15:00:00Z',
        });

        expect(getPilotStatus(device, new Date('2026-05-27T15:16:00Z')).label).toBe('Assistance Requested');
        expect(shouldShowOfflineIndicator(device, new Date('2026-05-27T15:16:00Z'))).toBe(true);
        expect(canAcknowledgeRequest(device)).toBe(true);
        expect(canResolveRequest(device)).toBe(false);
    });

    it('keeps the assistance status visible when the backend marks the device offline', () => {
        const device = createDevice({
            connectivity_status: 'offline',
            operational_status: 'assistance_requested',
            last_seen_at: '2026-05-27T15:15:30Z',
        });

        expect(getPilotStatus(device, new Date('2026-05-27T15:16:00Z')).label).toBe('Assistance Requested');
        expect(shouldShowOfflineIndicator(device, new Date('2026-05-27T15:16:00Z'))).toBe(true);
    });

    it('keeps resolve available when the device is offline and assistance is in progress', () => {
        const device = createDevice({
            connectivity_status: 'offline',
            operational_status: 'assistance_in_progress',
            last_seen_at: '2026-05-27T15:15:30Z',
        });

        expect(getPilotStatus(device, new Date('2026-05-27T15:16:00Z')).label).toBe('Assistance In Progress');
        expect(shouldShowOfflineIndicator(device, new Date('2026-05-27T15:16:00Z'))).toBe(true);
        expect(canAcknowledgeRequest(device)).toBe(false);
        expect(canResolveRequest(device)).toBe(true);
    });

    it('shows offline without a separate offline indicator when the device is offline but available', () => {
        const device = createDevice({
            connectivity_status: 'offline',
            operational_status: 'available',
            last_seen_at: '2026-05-27T15:15:30Z',
        });

        expect(getPilotStatus(device, new Date('2026-05-27T15:16:00Z')).label).toBe('Offline');
        expect(shouldShowOfflineIndicator(device, new Date('2026-05-27T15:16:00Z'))).toBe(false);
    });

    it('keeps the reported status when the device was seen recently', () => {
        const device = createDevice({
            operational_status: 'assistance_requested',
            last_seen_at: '2026-05-27T15:10:30Z',
        });

        expect(getPilotStatus(device, new Date('2026-05-27T15:16:00Z')).label).toBe('Assistance Requested');
    });

    it('selects the latest assistance-request notification even after it is labeled false', () => {
        const notifications = [
            createNotification({
                id: 'latest-false-positive',
                device_event_correct_response: false,
            }),
            createNotification({
                id: 'older-request',
                created_at: '2026-05-27T15:00:00Z',
                device_event_correct_response: true,
            }),
        ];

        expect(getLatestAssistanceRequestNotification(notifications)?.id).toBe('latest-false-positive');
    });

    it('allows false positive labeling only for an active assistance request', () => {
        const activeDevice = createDevice({ operational_status: 'assistance_requested' });
        const requestNotification = createNotification({
            device_event_id: 'event-1',
            device_event_correct_response: true,
        });

        expect(canMarkFalsePositiveRequest(activeDevice, requestNotification)).toBe(true);
        expect(
            canMarkFalsePositiveRequest(
                createDevice({ operational_status: 'available' }),
                requestNotification,
            ),
        ).toBe(false);
        expect(
            canMarkFalsePositiveRequest(
                activeDevice,
                createNotification({ device_event_correct_response: false }),
            ),
        ).toBe(false);
        expect(
            canMarkFalsePositiveRequest(
                activeDevice,
                createNotification({ device_event_id: null }),
            ),
        ).toBe(false);
    });
});
