import { Platform } from 'react-native';
import { resolveApiV1BaseUrl } from '../api/baseUrl';

export type HomeLiveUpdateScope = 'notifications' | 'device_status';

export type HomeLiveUpdatePayload = {
    scope: HomeLiveUpdateScope;
    occurred_at?: string;
    action?: string;
    user_id?: string;
    notification_id?: string;
    serial_number?: string;
    event_type?: string;
    new_status?: string;
    status_field?: string;
    kind?: string;
};

export type HomeLiveUpdatesConnection = {
    close: () => void;
};

type NativeEventSource = {
    addEventListener: (eventName: 'open' | 'message' | 'error', handler: (event: { data?: unknown }) => void) => void;
    close: () => void;
};

export type HomeLiveUpdateHandlers = {
    onOpen?: () => void;
    onMessage?: (update: HomeLiveUpdatePayload) => void;
    onError?: (error: unknown) => void;
};

export function parseHomeLiveUpdateMessage(data: string): HomeLiveUpdatePayload | null {
    try {
        const parsed = JSON.parse(data);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }

        const scope = (parsed as { scope?: unknown }).scope;
        if (scope !== 'notifications' && scope !== 'device_status') {
            return null;
        }

        return parsed as HomeLiveUpdatePayload;
    } catch {
        return null;
    }
}

export function shouldRefreshHomeOnLiveUpdate(update: HomeLiveUpdatePayload): boolean {
    return update.scope === 'notifications' || update.scope === 'device_status';
}

export function openHomeLiveUpdatesConnection(
    accessToken: string,
    handlers: HomeLiveUpdateHandlers,
): HomeLiveUpdatesConnection | null {
    const token = accessToken.trim();
    if (Platform.OS === 'web' || !token) {
        return null;
    }

    const { EventSource } = require('react-native-sse') as {
        EventSource: new (
            url: string,
            options: {
                headers: Record<string, string>;
            },
        ) => NativeEventSource;
    };

    const eventSource = new EventSource(`${resolveApiV1BaseUrl()}/mobile/home/updates`, {
        headers: {
            Accept: 'text/event-stream',
            Authorization: `Bearer ${token}`,
        },
    });

    eventSource.addEventListener('open', () => {
        handlers.onOpen?.();
    });

    eventSource.addEventListener('message', (event) => {
        const update = parseHomeLiveUpdateMessage(String(event.data ?? ''));
        if (update) {
            handlers.onMessage?.(update);
        }
    });

    eventSource.addEventListener('error', (event) => {
        handlers.onError?.(event);
    });

    return {
        close: () => {
            eventSource.close();
        },
    };
}
