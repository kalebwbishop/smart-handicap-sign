import type { SignNotification } from '@/types/types';

export function getLatestUnseenUnreadNotification(
    notifications: SignNotification[],
    knownNotificationIds: ReadonlySet<string>,
    hasHydrated: boolean,
): SignNotification | null {
    if (!hasHydrated) {
        return null;
    }

    return (
        notifications
            .filter((notification) => !notification.read && !knownNotificationIds.has(notification.id))
            .sort(
                (left, right) =>
                    new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
            )[0] ?? null
    );
}
