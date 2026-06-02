describe('homeLiveUpdates', () => {
    const loadModule = () => {
        jest.doMock('react-native', () => ({
            Platform: { OS: 'ios' },
        }));

        return require('./homeLiveUpdates') as typeof import('./homeLiveUpdates');
    };

    afterEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('parses notification updates', () => {
        const { parseHomeLiveUpdateMessage } = loadModule();
        const update = parseHomeLiveUpdateMessage(
            JSON.stringify({ scope: 'notifications', notification_id: 'notif-1' }),
        );

        expect(update).toEqual({
            scope: 'notifications',
            notification_id: 'notif-1',
        });
    });

    it('parses device status updates', () => {
        const { parseHomeLiveUpdateMessage } = loadModule();
        const update = parseHomeLiveUpdateMessage(
            JSON.stringify({ scope: 'device_status', serial_number: 'SHS-1' }),
        );

        expect(update).toEqual({
            scope: 'device_status',
            serial_number: 'SHS-1',
        });
    });

    it('ignores invalid payloads', () => {
        const { parseHomeLiveUpdateMessage } = loadModule();

        expect(parseHomeLiveUpdateMessage('')).toBeNull();
        expect(parseHomeLiveUpdateMessage('not-json')).toBeNull();
        expect(parseHomeLiveUpdateMessage(JSON.stringify({}))).toBeNull();
    });

    it('marks both live update scopes as refresh-worthy', () => {
        const { shouldRefreshHomeOnLiveUpdate } = loadModule();

        expect(shouldRefreshHomeOnLiveUpdate({ scope: 'notifications' })).toBe(true);
        expect(shouldRefreshHomeOnLiveUpdate({ scope: 'device_status' })).toBe(true);
    });
});
