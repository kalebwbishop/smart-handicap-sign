describe('assistanceAlertSound', () => {
    afterEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('loads the looping alert once while active', async () => {
        const unloadAsync = jest.fn().mockResolvedValue(undefined);
        const createAsync = jest.fn().mockResolvedValue({
            sound: {
                unloadAsync,
            },
        });
        const setAudioModeAsync = jest.fn().mockResolvedValue(undefined);

        jest.doMock('expo-av', () => ({
            Audio: {
                setAudioModeAsync,
                Sound: {
                    createAsync,
                },
            },
        }));

        const { startAssistanceAlertSound } = require('./assistanceAlertSound') as typeof import('./assistanceAlertSound');

        await startAssistanceAlertSound();
        await startAssistanceAlertSound();

        expect(setAudioModeAsync).toHaveBeenCalledTimes(1);
        expect(createAsync).toHaveBeenCalledTimes(1);
        expect(createAsync).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                isLooping: true,
                shouldPlay: true,
            }),
        );
    });

    it('unloads the sound when the request is no longer active', async () => {
        const firstUnloadAsync = jest.fn().mockResolvedValue(undefined);
        const secondUnloadAsync = jest.fn().mockResolvedValue(undefined);
        const createAsync = jest
            .fn()
            .mockResolvedValueOnce({
                sound: {
                    unloadAsync: firstUnloadAsync,
                },
            })
            .mockResolvedValueOnce({
                sound: {
                    unloadAsync: secondUnloadAsync,
                },
            });
        const setAudioModeAsync = jest.fn().mockResolvedValue(undefined);

        jest.doMock('expo-av', () => ({
            Audio: {
                setAudioModeAsync,
                Sound: {
                    createAsync,
                },
            },
        }));

        const { startAssistanceAlertSound, stopAssistanceAlertSound } = require('./assistanceAlertSound') as typeof import('./assistanceAlertSound');

        await startAssistanceAlertSound();
        await stopAssistanceAlertSound();
        await startAssistanceAlertSound();

        expect(createAsync).toHaveBeenCalledTimes(2);
        expect(firstUnloadAsync).toHaveBeenCalledTimes(1);
        expect(secondUnloadAsync).not.toHaveBeenCalled();
    });
});
