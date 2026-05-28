import type { WifiNetwork } from '@/api/espApi';

export function getProvisioningFormError(ssid: string): string | null {
    if (!ssid.trim()) {
        return 'Enter the Wi-Fi network name for the sign.';
    }

    return null;
}

export function sortNetworks(networks: WifiNetwork[]): WifiNetwork[] {
    const deduped = new Map<string, WifiNetwork>();

    for (const network of networks) {
        const ssid = network.ssid.trim();
        if (!ssid) {
            continue;
        }

        const existing = deduped.get(ssid);
        if (!existing || network.rssi > existing.rssi) {
            deduped.set(ssid, { ...network, ssid });
        }
    }

    return Array.from(deduped.values()).sort((left, right) => right.rssi - left.rssi);
}
