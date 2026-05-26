import axios from 'axios';

export function startNotificationRequest(
    activeController: AbortController | null,
    isPolling: boolean,
): AbortController | null {
    if (isPolling && activeController) {
        return null;
    }

    activeController?.abort();
    return new AbortController();
}

export function finishNotificationRequest(
    activeController: AbortController | null,
    controller: AbortController,
): AbortController | null {
    return activeController === controller ? null : activeController;
}

export function isNotificationRequestCanceled(error: unknown): boolean {
    if (axios.isCancel(error)) {
        return true;
    }

    if (typeof error !== 'object' || error === null) {
        return false;
    }

    return 'code' in error && (error as { code?: string }).code === 'ERR_CANCELED';
}
