import { getApiV1BaseUrl } from '../../../../packages/shared/src/config/api';

describe('getApiV1BaseUrl', () => {
    it('appends /api/v1 when given a backend origin', () => {
        expect(getApiV1BaseUrl('https://example.com')).toBe('https://example.com/api/v1');
    });

    it('does not double-append /api/v1 when already present', () => {
        expect(getApiV1BaseUrl('https://example.com/api/v1/')).toBe('https://example.com/api/v1');
    });

    it('ignores accidental inline comments in env values', () => {
        expect(getApiV1BaseUrl('https://example.com# Environment')).toBe('https://example.com/api/v1');
    });

    it('returns an empty string for an unset base URL', () => {
        expect(getApiV1BaseUrl(undefined)).toBe('');
    });
});
