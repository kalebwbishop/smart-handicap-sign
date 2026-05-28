export type NotificationOpenNavigationState = {
    hasPendingNotificationOpen: boolean;
    shouldNavigateHome: boolean;
};

type HandleNotificationOpenInput = {
    hasPendingNotificationOpen: boolean;
    isNavigationReady: boolean;
};

type ConsumePendingNotificationOpenInput = {
    hasPendingNotificationOpen: boolean;
};

export function handleNotificationOpen({
    hasPendingNotificationOpen,
    isNavigationReady,
}: HandleNotificationOpenInput): NotificationOpenNavigationState {
    if (isNavigationReady) {
        return {
            hasPendingNotificationOpen: false,
            shouldNavigateHome: true,
        };
    }

    return {
        hasPendingNotificationOpen: true,
        shouldNavigateHome: false,
    };
}

export function consumePendingNotificationOpen({
    hasPendingNotificationOpen,
}: ConsumePendingNotificationOpenInput): NotificationOpenNavigationState {
    if (!hasPendingNotificationOpen) {
        return {
            hasPendingNotificationOpen: false,
            shouldNavigateHome: false,
        };
    }

    return {
        hasPendingNotificationOpen: false,
        shouldNavigateHome: true,
    };
}
