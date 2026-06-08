describe('tokenStorage', () => {
    afterEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('reuses the in-memory native access token cache after the first secure-store read', async () => {
        const getItemAsync = jest
            .fn()
            .mockResolvedValueOnce('expired-token')
            .mockResolvedValueOnce('fresh-token');
        const setItemAsync = jest.fn().mockResolvedValue(undefined);
        const deleteItemAsync = jest.fn().mockResolvedValue(undefined);

        jest.doMock('react-native', () => ({
            Platform: { OS: 'ios' },
        }));
        jest.doMock('expo-secure-store', () => ({
            getItemAsync,
            setItemAsync,
            deleteItemAsync,
        }));

        const { tokenStorage } = require('./auth');

        await expect(tokenStorage.getAccessToken()).resolves.toBe('expired-token');
        await expect(tokenStorage.getAccessToken()).resolves.toBe('expired-token');
        expect(getItemAsync).toHaveBeenCalledTimes(1);

        await tokenStorage.setAccessToken('fresh-token');
        await expect(tokenStorage.getAccessToken()).resolves.toBe('fresh-token');
        expect(setItemAsync).toHaveBeenCalledWith('auth_access_token', 'fresh-token');
        expect(getItemAsync).toHaveBeenCalledTimes(1);
    });

    it('clears both the in-memory cache and secure store on logout', async () => {
        const getItemAsync = jest.fn().mockResolvedValue('expired-token');
        const setItemAsync = jest.fn().mockResolvedValue(undefined);
        const deleteItemAsync = jest.fn().mockResolvedValue(undefined);

        jest.doMock('react-native', () => ({
            Platform: { OS: 'ios' },
        }));
        jest.doMock('expo-secure-store', () => ({
            getItemAsync,
            setItemAsync,
            deleteItemAsync,
        }));

        const { tokenStorage } = require('./auth');

        await expect(tokenStorage.getAccessToken()).resolves.toBe('expired-token');
        await tokenStorage.clear();
        await expect(tokenStorage.getAccessToken()).resolves.toBeNull();
        expect(deleteItemAsync).toHaveBeenCalledTimes(2);
    });
});
