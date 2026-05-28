import { getPilotStatus, isDeviceStale } from './pilotStatus';
import type { Device } from '../types/device';

function createDevice(overrides: Partial<Device> = {}): Device {
    return {
        id: 'device-1',
        serial_number: 'SHS-2605-S01-A7K-00001-J',
        model_code: 'S01',
        hardware_revision: 'rev3',
        firmware_version: '1.0.0',
        manufacture_batch: null,
        lifecycle_status: 'active',
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

describe('pilotStatus', () => {
    const envKey = 'EXPO_PUBLIC_DEVICE_STALE_MINUTES';
    const originalStaleMinutes = process.env[envKey];

    afterEach(() => {
        if (typeof originalStaleMinutes === 'undefined') {
            delete process.env[envKey];
            return;
        }

        process.env[envKey] = originalStaleMinutes;
    });

    it('marks a device stale after 15 minutes without being seen', () => {
        const device = createDevice({ last_seen_at: '2026-05-27T15:00:00Z' });

        expect(isDeviceStale(device, new Date('2026-05-27T15:16:00Z'))).toBe(true);
    });

    it('uses the configured stale threshold from the Expo public environment', () => {
        process.env[envKey] = '5';
        const device = createDevice({ last_seen_at: '2026-05-27T15:00:00Z' });

        expect(isDeviceStale(device, new Date('2026-05-27T15:06:00Z'))).toBe(true);
    });

    it('falls back to 15 minutes when the configured stale threshold is invalid', () => {
        process.env[envKey] = 'not-a-number';
        const device = createDevice({ last_seen_at: '2026-05-27T15:00:00Z' });

        expect(isDeviceStale(device, new Date('2026-05-27T15:06:00Z'))).toBe(false);
    });

    it('overrides the displayed status to offline when the device is stale', () => {
        const device = createDevice({
            operational_status: 'assistance_requested',
            last_seen_at: '2026-05-27T15:00:00Z',
        });

        expect(getPilotStatus(device, new Date('2026-05-27T15:16:00Z')).label).toBe('Offline');
    });

    it('keeps the reported status when the device was seen recently', () => {
        const device = createDevice({
            operational_status: 'assistance_requested',
            last_seen_at: '2026-05-27T15:10:30Z',
        });

        expect(getPilotStatus(device, new Date('2026-05-27T15:16:00Z')).label).toBe('Assistance Requested');
    });
});
