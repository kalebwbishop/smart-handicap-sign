import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type Dispatch,
    type PropsWithChildren,
    type SetStateAction,
} from 'react';

const SETTINGS_STORAGE_KEY = '@hazard-hero/settings';

type SettingsKey =
    | 'playToneOnAssistanceRequest'
    | 'receiveNotifications';

type SettingsState = Record<SettingsKey, boolean>;
type SettingsStorageShape = Partial<Record<SettingsKey, unknown>>;

type SettingsContextValue = SettingsState & {
    setPlayToneOnAssistanceRequest: Dispatch<SetStateAction<boolean>>;
    setReceiveNotifications: Dispatch<SetStateAction<boolean>>;
    isSettingsLoaded: boolean;
};

const SETTINGS_KEYS: SettingsKey[] = [
    'playToneOnAssistanceRequest',
    'receiveNotifications',
];

const SettingsContext = createContext<SettingsContextValue | undefined>(
    undefined,
);

function parseSetting(rawValue: string | null, key: SettingsKey): boolean {
    if (!rawValue) {
        return false;
    }

    try {
        const parsedValue: unknown = JSON.parse(rawValue);

        if (typeof parsedValue === 'boolean') {
            return parsedValue;
        }

        if (
            typeof parsedValue === 'object' &&
            parsedValue !== null &&
            key in parsedValue &&
            typeof (parsedValue as SettingsStorageShape)[key] === 'boolean'
        ) {
            return (parsedValue as SettingsStorageShape)[key] as boolean;
        }
    } catch (error) {
        console.error('[Settings] Failed to parse stored settings:', error);
    }

    return false;
}

function buildSettingsState(rawValue: string | null): SettingsState {
    return SETTINGS_KEYS.reduce((state, key) => {
        state[key] = parseSetting(rawValue, key);
        return state;
    }, {} as SettingsState);
}

export function SettingsProvider({ children }: PropsWithChildren) {
    const [playToneOnAssistanceRequest, setPlayToneOnAssistanceRequest] =
        useState(false);
    const [receiveNotifications, setReceiveNotifications] = useState(false);
    const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

    useEffect(() => {
        let isActive = true;

        const loadSettings = async () => {
            try {
                const storedValue = await AsyncStorage.getItem(
                    SETTINGS_STORAGE_KEY,
                );

                if (!isActive) {
                    return;
                }

                const settings = buildSettingsState(storedValue);
                setPlayToneOnAssistanceRequest(
                    settings.playToneOnAssistanceRequest,
                );
                setReceiveNotifications(settings.receiveNotifications);
            } catch (error) {
                console.error('[Settings] Failed to load settings from storage:', error);
            } finally {
                if (isActive) {
                    setIsSettingsLoaded(true);
                }
            }
        };

        void loadSettings();

        return () => {
            isActive = false;
        };
    }, []);

    useEffect(() => {
        if (!isSettingsLoaded) {
            return;
        }

        const saveSettings = async () => {
            try {
                await AsyncStorage.setItem(
                    SETTINGS_STORAGE_KEY,
                    JSON.stringify({
                        playToneOnAssistanceRequest,
                        receiveNotifications,
                    }),
                );
            } catch (error) {
                console.error('[Settings] Failed to save settings to storage:', error);
            }
        };

        void saveSettings();
    }, [isSettingsLoaded, playToneOnAssistanceRequest, receiveNotifications]);

    const value = useMemo<SettingsContextValue>(
        () => ({
            playToneOnAssistanceRequest,
            setPlayToneOnAssistanceRequest,
            receiveNotifications,
            setReceiveNotifications,
            isSettingsLoaded,
        }),
        [
            isSettingsLoaded,
            playToneOnAssistanceRequest,
            receiveNotifications,
        ],
    );

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);

    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }

    return context;
}
