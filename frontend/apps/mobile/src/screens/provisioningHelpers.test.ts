import { getProvisioningFormError, sortNetworks } from './provisioningHelpers';

describe('provisioningHelpers', () => {
    it('requires a wifi network name before submitting', () => {
        expect(getProvisioningFormError('')).toBe(
            'Enter the Wi-Fi network name for the sign.',
        );
        expect(getProvisioningFormError('OfficeWiFi')).toBeNull();
    });

    it('deduplicates blank and repeated SSIDs while keeping the strongest signal first', () => {
        expect(sortNetworks([
            { ssid: 'Guest', rssi: -72, authmode: 3 },
            { ssid: ' ', rssi: -10, authmode: 0 },
            { ssid: 'OfficeWiFi', rssi: -55, authmode: 3 },
            { ssid: 'Guest', rssi: -60, authmode: 4 },
        ])).toEqual([
            { ssid: 'OfficeWiFi', rssi: -55, authmode: 3 },
            { ssid: 'Guest', rssi: -60, authmode: 4 },
        ]);
    });
});
