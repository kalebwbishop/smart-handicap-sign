import { Device } from './device';
import { SignNotification } from './types';

export type RootStackParamList = {
    MainTabs: undefined;
    LandingScreen: undefined;
    LoginScreen: undefined;
    ProvisionSign: undefined;
    Settings: undefined;
    SignDetails: { device: Device };
    NotificationDetail: { notification: SignNotification; device?: Device | null };
};

export type MainTabParamList = {
    Dashboard: undefined;
    Signs: undefined;
    Requests: undefined;
    Settings: undefined;
};
