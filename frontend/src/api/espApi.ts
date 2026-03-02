/**
 * Lightweight API client for communicating with the ESP32
 * provisioning server over its local AP (192.168.4.1).
 *
 * This does NOT use the authenticated ApiClient — the ESP32 AP
 * has no internet connectivity and no auth.
 */

const ESP_BASE_URL = 'http://192.168.4.1';
const TIMEOUT_MS = 10_000;

export interface WifiNetwork {
    ssid: string;
    rssi: number;
    authmode: number;
}

export interface EspStatus {
    device_id: string;
    ap_active: boolean;
}

async function espFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const res = await fetch(`${ESP_BASE_URL}${path}`, {
            ...options,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                ...(options?.headers || {}),
            },
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data?.error || `ESP responded with ${res.status}`);
        }

        return data as T;
    } catch (err: any) {
        if (err.name === 'AbortError') {
            throw new Error(
                'Could not reach the SmartSign device. Make sure you are connected to the SmartSign WiFi network.'
            );
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

/** Check if the phone can reach the ESP32 AP. */
export async function checkEspStatus(): Promise<EspStatus> {
    return espFetch<EspStatus>('/status');
}

/** Ask the ESP32 to scan for nearby WiFi networks. */
export async function scanNetworks(): Promise<WifiNetwork[]> {
    return espFetch<WifiNetwork[]>('/scan');
}

/** Send WiFi credentials to the ESP32. It will save them and reboot. */
export async function configureWifi(ssid: string, password: string): Promise<void> {
    await espFetch<{ ok: boolean }>('/configure', {
        method: 'POST',
        body: JSON.stringify({ ssid, password }),
    });
}
