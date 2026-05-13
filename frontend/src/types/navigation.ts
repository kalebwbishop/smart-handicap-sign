import { SignNotification } from './types';
import { AccessibleParkingType } from './device';

export type RootStackParamList = {
    Home: undefined;
    LandingScreen: undefined;
    LoginScreen: undefined;
    WiFiSetup: undefined;
    Organizations: undefined;
    SetupGuide: undefined;
    Feedback: undefined;
    Preferences: undefined;
    NotificationDetail: { notification: SignNotification };
    ClaimValidate: { serial_number: string; claim_id: string };
    ClaimAssign: {
        serial_number: string;
        claim_id: string;
        model_code?: string;
        hardware_revision?: string;
    };
    ClaimPhotos: {
        serial_number: string;
        claim_id: string;
        customer_id: string;
        site_id: string;
        parking_space_id: string;
        accessible_type: AccessibleParkingType;
    };
    ClaimConfirm: {
        serial_number: string;
        claim_id: string;
        customer_id: string;
        site_id: string;
        parking_space_id: string;
        accessible_type: AccessibleParkingType;
        installation_photos: string[];
        install_notes?: string;
    };
    DeviceList: undefined;
    DeviceDetail: { serial_number: string };
    InferenceDebug: undefined;
    QRScan: undefined;
};
