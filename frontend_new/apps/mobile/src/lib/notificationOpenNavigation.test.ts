import {
    consumePendingNotificationOpen,
    handleNotificationOpen,
    type NotificationOpenNavigationState,
} from './notificationOpenNavigation';

describe('notificationOpenNavigation', () => {
    it('navigates immediately when navigation is ready', () => {
        expect(
            handleNotificationOpen({
                hasPendingNotificationOpen: false,
                isNavigationReady: true,
            }),
        ).toEqual({
            hasPendingNotificationOpen: false,
            shouldNavigateHome: true,
        } satisfies NotificationOpenNavigationState);
    });

    it('queues the navigation when notification open happens before navigation is ready', () => {
        expect(
            handleNotificationOpen({
                hasPendingNotificationOpen: false,
                isNavigationReady: false,
            }),
        ).toEqual({
            hasPendingNotificationOpen: true,
            shouldNavigateHome: false,
        } satisfies NotificationOpenNavigationState);
    });

    it('consumes a pending notification open when navigation becomes ready', () => {
        expect(
            consumePendingNotificationOpen({
                hasPendingNotificationOpen: true,
            }),
        ).toEqual({
            hasPendingNotificationOpen: false,
            shouldNavigateHome: true,
        } satisfies NotificationOpenNavigationState);
    });
});
