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

    it('sends only wifi credentials to the provisioning endpoint', async () => {
        await configureWifi('OfficeWiFi', 'fake-password');

        expect(global.fetch).toHaveBeenCalledWith(
            'http://192.168.4.1/configure',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ ssid: 'OfficeWiFi', password: 'fake-password' }),
            })
        );
    });

    it('allows open networks with an empty password', async () => {
        await configureWifi('OfficeWiFi', '');

        expect(global.fetch).toHaveBeenCalledWith(
            'http://192.168.4.1/configure',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ ssid: 'OfficeWiFi', password: '' }),
            })
        );
    });

    it('propagates ESP error bodies', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 403,
            json: jest.fn().mockResolvedValue({ error: 'Invalid setup code' }),
        });

        await expect(configureWifi('OfficeWiFi', 'fake-password')).rejects.toThrow('Invalid setup code');
    });

    it('turns request timeout into AP unreachable guidance', async () => {
        global.fetch = jest.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));

        await expect(configureWifi('OfficeWiFi', 'fake-password')).rejects.toThrow(
            'Could not reach the SmartSign device. Make sure you are connected to the SmartSign WiFi network.'
        );
    });
});
