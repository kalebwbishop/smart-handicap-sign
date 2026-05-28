import { Device, DeviceEvent } from './device';

export type RootStackParamList = {
    Home: undefined;
    LandingScreen: undefined;
    LoginScreen: undefined;
    ProvisionSign: undefined;
    SignDetails: { device: Device };
    NotificationDetail: { event: DeviceEvent };
};
