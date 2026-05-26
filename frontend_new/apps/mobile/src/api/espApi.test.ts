import { configureWifi } from './espApi';

describe('configureWifi', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        jest.useFakeTimers();
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({ ok: true }),
        });
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('sends claim_id when claimId is provided', async () => {
        await configureWifi('OfficeWiFi', 'fake-password', { claimId: 'ABCD-EF23' });

        expect(global.fetch).toHaveBeenCalledWith(
            'http://192.168.4.1/configure',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ ssid: 'OfficeWiFi', password: 'fake-password', claim_id: 'ABCD-EF23' }),
            })
        );
    });

    it('sends setup_code when setupCode is provided', async () => {
        await configureWifi('OfficeWiFi', '', { setupCode: 'SETUP-1234' });

        expect(global.fetch).toHaveBeenCalledWith(
            'http://192.168.4.1/configure',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ ssid: 'OfficeWiFi', password: '', setup_code: 'SETUP-1234' }),
            })
        );
    });

    it('rejects missing or ambiguous setup credentials before fetch', async () => {
        await expect(configureWifi('OfficeWiFi', 'fake-password', {})).rejects.toThrow('Provide exactly one setup or claim code.');
        await expect(
            configureWifi('OfficeWiFi', 'fake-password', { claimId: 'ABCD-EF23', setupCode: 'SETUP-1234' })
        ).rejects.toThrow('Provide exactly one setup or claim code.');

        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('propagates ESP error bodies', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 403,
            json: jest.fn().mockResolvedValue({ error: 'Invalid setup code' }),
        });

        await expect(configureWifi('OfficeWiFi', 'fake-password', { claimId: 'WRONG' })).rejects.toThrow('Invalid setup code');
    });

    it('turns request timeout into AP unreachable guidance', async () => {
        global.fetch = jest.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));

        await expect(configureWifi('OfficeWiFi', 'fake-password', { claimId: 'ABCD-EF23' })).rejects.toThrow(
            'Could not reach the SmartSign device. Make sure you are connected to the SmartSign WiFi network.'
        );
    });
});
