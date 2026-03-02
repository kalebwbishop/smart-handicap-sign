import { Sign } from './types';

export type RootStackParamList = {
    Home: undefined;
    LandingScreen: undefined;
    SignDetail: { sign: Sign };
    WiFiSetup: undefined;
};
