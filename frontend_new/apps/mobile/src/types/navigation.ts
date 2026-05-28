import { Device } from './device';
import { SignNotification } from './types';

export type RootStackParamList = {
    Home: undefined;
    LandingScreen: undefined;
    LoginScreen: undefined;
    ProvisionSign: undefined;
    SignDetails: { device: Device };
    NotificationDetail: { notification: SignNotification; device?: Device | null };
};
