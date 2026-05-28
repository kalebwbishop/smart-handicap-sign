import { DeviceEvent } from './device';

export type RootStackParamList = {
    Home: undefined;
    LandingScreen: undefined;
    LoginScreen: undefined;
    ProvisionSign: undefined;
    NotificationDetail: { event: DeviceEvent };
};
