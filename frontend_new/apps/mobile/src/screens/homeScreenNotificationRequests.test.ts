import {
    finishNotificationRequest,
    isNotificationRequestCanceled,
    startNotificationRequest,
} from './homeScreenNotificationRequests';

describe('homeScreenNotificationRequests', () => {
    it('skips polling when a notification request is already in flight', () => {
        const activeController = new AbortController();

        const nextController = startNotificationRequest(activeController, true);

        expect(nextController).toBeNull();
        expect(activeController.signal.aborted).toBe(false);
    });

    it('aborts the prior request before starting a foreground refresh', () => {
        const activeController = new AbortController();

        const nextController = startNotificationRequest(activeController, false);

        expect(nextController).toBeInstanceOf(AbortController);
        expect(nextController).not.toBe(activeController);
        expect(activeController.signal.aborted).toBe(true);
    });

    it('only clears the active request when the same controller finishes', () => {
        const activeController = new AbortController();
        const staleController = new AbortController();

        expect(finishNotificationRequest(activeController, staleController)).toBe(activeController);
        expect(finishNotificationRequest(activeController, activeController)).toBeNull();
    });

    it('treats aborted axios requests as non-errors', () => {
        expect(isNotificationRequestCanceled({ code: 'ERR_CANCELED' })).toBe(true);
        expect(isNotificationRequestCanceled(new Error('timeout'))).toBe(false);
    });
});
