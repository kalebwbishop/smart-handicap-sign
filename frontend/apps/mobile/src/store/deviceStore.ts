import { create } from 'zustand';
import { Device } from "@/types/device";

interface DeviceState {
    devices: Device[];
    setDevices: (devices: Device[]) => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
    devices: [],
    setDevices: (devices) => set({ devices }),
}));
