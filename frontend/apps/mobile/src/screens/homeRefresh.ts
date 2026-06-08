import type { AppStateStatus } from 'react-native';

type FocusRefreshInput = {
    hasLoadedOnce: boolean;
    hasFocusedBefore: boolean;
};

type AppActiveRefreshInput = {
    hasLoadedOnce: boolean;
    isScreenFocused: boolean;
    previousAppState: AppStateStatus;
    nextAppState: AppStateStatus;
};

export function shouldRefreshOnHomeFocus({
    hasLoadedOnce,
    hasFocusedBefore,
}: FocusRefreshInput): boolean {
    return hasLoadedOnce && hasFocusedBefore;
}

export function shouldRefreshOnAppActive({
    hasLoadedOnce,
    isScreenFocused,
    previousAppState,
    nextAppState,
}: AppActiveRefreshInput): boolean {
    const becameActive =
        nextAppState === 'active' &&
        (previousAppState === 'inactive' || previousAppState === 'background');

    return hasLoadedOnce && isScreenFocused && becameActive;
}
