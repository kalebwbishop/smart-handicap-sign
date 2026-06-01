import type * as Notifications from 'expo-notifications';
import type { SignNotification } from '@/types/types';

export function buildForegroundNotification(
    notification: Notifications.Notification,
    receivedAt: string = new Date().toISOString(),
): SignNotification {
    const notificationId = notification.request.content.data?.notificationId;

    return {
        id:
            typeof notificationId === 'string' && notificationId.trim().length > 0
                ? notificationId
                : notification.request.identifier,
        device_event_id: null,
        user_id: null,
        title: notification.request.content.title?.trim() || 'New assistance request',
        body: notification.request.content.body?.trim() || 'Open the app to view the latest request.',
        read: false,
        created_at: receivedAt,
        updated_at: receivedAt,
    };
}
