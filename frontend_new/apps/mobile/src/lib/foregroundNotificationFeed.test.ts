import type { SignNotification } from '@/types/types';
import { getLatestUnseenUnreadNotification } from './foregroundNotificationFeed';

function buildNotification(overrides: Partial<SignNotification>): SignNotification {
    return {
        id: 'notification-1',
        device_event_id: null,
        user_id: null,
        device_event_correct_response: true,
        title: 'Need assistance',
        body: 'Sign A needs help',
        read: false,
        created_at: '2026-05-28T22:00:00.000Z',
        updated_at: '2026-05-28T22:00:00.000Z',
        ...overrides,
    };
}

describe('getLatestUnseenUnreadNotification', () => {
    it('does not surface old unread notifications during initial hydration', () => {
        const notifications = [buildNotification({ id: 'existing-unread' })];

        expect(getLatestUnseenUnreadNotification(notifications, new Set<string>(), false)).toBeNull();
    });

    it('returns the newest unread notification that was not seen before', () => {
        const notifications = [
            buildNotification({
                id: 'older-unseen',
                created_at: '2026-05-28T21:00:00.000Z',
                updated_at: '2026-05-28T21:00:00.000Z',
            }),
            buildNotification({
                id: 'newest-unseen',
                created_at: '2026-05-28T22:00:00.000Z',
                updated_at: '2026-05-28T22:00:00.000Z',
            }),
            buildNotification({
                id: 'already-known',
                created_at: '2026-05-28T23:00:00.000Z',
                updated_at: '2026-05-28T23:00:00.000Z',
            }),
        ];

        expect(
            getLatestUnseenUnreadNotification(notifications, new Set<string>(['already-known']), true),
        )?.toMatchObject({
            id: 'newest-unseen',
        });
    });

    it('ignores read notifications', () => {
        const notifications = [
            buildNotification({
                id: 'read-notification',
                read: true,
            }),
        ];

        expect(getLatestUnseenUnreadNotification(notifications, new Set<string>(), true)).toBeNull();
    });
});
