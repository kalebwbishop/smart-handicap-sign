import { create } from 'zustand';

interface SettingsState {
    playToneOnAssistanceRequest: boolean;
    setPlayToneOnAssistanceRequest: (enabled: boolean) => void;
    receiveNotifications: boolean;
    setReceiveNotifications: (enabled: boolean) => void;
    lowBatteryAlerts: boolean;
    setLowBatteryAlerts: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
    playToneOnAssistanceRequest: false,
    setPlayToneOnAssistanceRequest: (enabled) => set({ playToneOnAssistanceRequest: enabled }),
    receiveNotifications: false,
    setReceiveNotifications: (enabled) => set({ receiveNotifications: enabled }),
    lowBatteryAlerts: false,
    setLowBatteryAlerts: (enabled) => set({ lowBatteryAlerts: enabled }),
}));
