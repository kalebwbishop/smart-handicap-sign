import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import { set } from '@/redux/signsSlice';


interface NotificationsContextType {
    expoPushToken: string | null;
    notification: Notifications.Notification | null;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const dispatch = useDispatch();

    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [notification, setNotification] = useState<Notifications.Notification | null>(null);
    const notificationListener = useRef<Notifications.Subscription | null>(null);
    const responseListener = useRef<Notifications.Subscription | null>(null);

    useEffect(() => {
        const setupNotifications = async () => {
            const token = await registerForPushNotificationsAsync();
            setExpoPushToken(token);

            if (Platform.OS === 'android') {
                const channels = await Notifications.getNotificationChannelsAsync();
                console.log('Notification Channels:', channels);
            }

            notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
                setNotification(notification);
                dispatch(set(notification.request.content.data));
            });

            responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
                console.log('Notification response:', response);
            });
        };

        setupNotifications();

        return () => {
            if (notificationListener.current) {
                Notifications.removeNotificationSubscription(notificationListener.current);
            }
            if (responseListener.current) {
                Notifications.removeNotificationSubscription(responseListener.current);
            }
        };
    }, []);

    return (
        <NotificationsContext.Provider value={{ expoPushToken, notification }}>
            {children}
        </NotificationsContext.Provider>
    );
};

// Helper function to register for push notifications
async function registerForPushNotificationsAsync(): Promise<string | null> {
    let token = null;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('myNotificationChannel', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            alert('Failed to get push token for push notifications!');
            return null;
        }

        const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
        if (!projectId) {
            throw new Error('Project ID not found');
        }

        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } else {
        alert('Must use physical device for Push Notifications');
    }

    return token;
}

// Hook to use the Notifications Context
export const useNotifications = (): NotificationsContextType => {
    const context = useContext(NotificationsContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationsProvider');
    }
    return context;
};
