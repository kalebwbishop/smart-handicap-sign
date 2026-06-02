import { buildForegroundNotification } from './foregroundNotification';

describe('buildForegroundNotification', () => {
    it('uses the backend notification id when Expo payload data includes it', () => {
        const receivedAt = '2026-05-28T22:00:00.000Z';

        expect(
            buildForegroundNotification(
                {
                    request: {
                        identifier: 'expo-request-id',
                        content: {
                            title: 'Need assistance',
                            body: 'Sign A needs help',
                            data: {
                                notificationId: 'backend-notification-id',
                            },
                        },
                    },
                } as never,
                receivedAt,
            ),
        ).toEqual({
            id: 'backend-notification-id',
            device_event_id: null,
            user_id: null,
            device_event_correct_response: true,
            title: 'Need assistance',
            body: 'Sign A needs help',
            read: false,
            created_at: receivedAt,
            updated_at: receivedAt,
        });
    });

    it('falls back to Expo metadata and default copy when payload fields are missing', () => {
        const receivedAt = '2026-05-28T22:00:00.000Z';

        expect(
            buildForegroundNotification(
                {
                    request: {
                        identifier: 'expo-request-id',
                        content: {
                            title: '   ',
                            body: '',
                            data: {},
                        },
                    },
                } as never,
                receivedAt,
            ),
        ).toEqual({
            id: 'expo-request-id',
            device_event_id: null,
            user_id: null,
            device_event_correct_response: true,
            title: 'New assistance request',
            body: 'Open the app to view the latest request.',
            read: false,
            created_at: receivedAt,
            updated_at: receivedAt,
        });
    });
});
