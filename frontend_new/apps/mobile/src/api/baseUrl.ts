import { Platform } from 'react-native';
import { getApiV1BaseUrl } from '@hazard-hero/shared';

type SupportedPlatform = 'android' | 'ios' | 'web';
type EnvReader = {
    process?: {
        env?: Record<string, string | undefined>;
    };
};

const DEFAULT_DEV_API_ORIGIN: Record<SupportedPlatform, string> = {
    android: 'http://10.0.2.2:8000',
    ios: 'http://localhost:8000',
    web: 'http://localhost:8000',
};

export function getExpoPublicApiUrl(): string | undefined {
    return (globalThis as typeof globalThis & EnvReader).process?.env?.EXPO_PUBLIC_API_URL;
}

export function resolveApiV1BaseUrl(
    rawBaseUrl = getExpoPublicApiUrl(),
    platform: SupportedPlatform = Platform.OS as SupportedPlatform,
): string {
    const configuredBaseUrl = rawBaseUrl?.trim();
    if (configuredBaseUrl) {
        return getApiV1BaseUrl(configuredBaseUrl);
    }

    const fallbackOrigin = DEFAULT_DEV_API_ORIGIN[platform] ?? DEFAULT_DEV_API_ORIGIN.ios;

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn(
            `[CLIENT] EXPO_PUBLIC_API_URL is not set. Falling back to ${fallbackOrigin} for local development.`,
        );
    }

    return getApiV1BaseUrl(fallbackOrigin);
}
