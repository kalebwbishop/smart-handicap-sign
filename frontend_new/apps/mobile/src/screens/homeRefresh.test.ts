import { shouldRefreshOnAppActive, shouldRefreshOnHomeFocus } from './homeRefresh';

describe('homeRefresh', () => {
    it('skips the first focus event because the initial page load already refreshes Home', () => {
        expect(
            shouldRefreshOnHomeFocus({
                hasLoadedOnce: false,
                hasFocusedBefore: false,
            }),
        ).toBe(false);
    });

    it('refreshes when Home regains focus after it has already loaded once', () => {
        expect(
            shouldRefreshOnHomeFocus({
                hasLoadedOnce: true,
                hasFocusedBefore: true,
            }),
        ).toBe(true);
    });

    it('refreshes when the app becomes active while Home is focused', () => {
        expect(
            shouldRefreshOnAppActive({
                hasLoadedOnce: true,
                isScreenFocused: true,
                previousAppState: 'background',
                nextAppState: 'active',
            }),
        ).toBe(true);
    });

    it('skips app-resume refresh when Home is not the active screen', () => {
        expect(
            shouldRefreshOnAppActive({
                hasLoadedOnce: true,
                isScreenFocused: false,
                previousAppState: 'background',
                nextAppState: 'active',
            }),
        ).toBe(false);
    });

    it('skips app-resume refresh before Home has loaded once', () => {
        expect(
            shouldRefreshOnAppActive({
                hasLoadedOnce: false,
                isScreenFocused: true,
                previousAppState: 'inactive',
                nextAppState: 'active',
            }),
        ).toBe(false);
    });
});
