describe('pushNotifications', () => {
    afterEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('plays a sound for foreground assistance notifications', async () => {
        const setNotificationHandler = jest.fn();

        jest.doMock('@react-native-async-storage/async-storage', () => ({
            __esModule: true,
            default: {
                getItem: jest.fn(),
                setItem: jest.fn(),
                removeItem: jest.fn(),
            },
        }));
        jest.doMock('expo-constants', () => ({
            __esModule: true,
            default: {
                expoConfig: { extra: {} },
                easConfig: null,
            },
        }));
        jest.doMock('expo-device', () => ({
            isDevice: true,
        }));
        jest.doMock('expo-notifications', () => ({
            setNotificationHandler,
            getPermissionsAsync: jest.fn(),
            requestPermissionsAsync: jest.fn(),
            getExpoPushTokenAsync: jest.fn(),
        }));
        jest.doMock('react-native', () => ({
            Platform: { OS: 'ios' },
        }));

        require('./pushNotifications');

        await expect(setNotificationHandler.mock.calls[0][0].handleNotification()).resolves.toEqual({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        });
    });
});
