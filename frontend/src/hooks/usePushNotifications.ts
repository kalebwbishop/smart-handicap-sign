import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import type { EventSubscription } from 'expo-modules-core';
import { pushTokenAPI } from '@/api/api';
import { useAuthStore } from '@/store/authStore';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export function usePushNotifications() {
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const notificationListener = useRef<EventSubscription | null>(null);
    const responseListener = useRef<EventSubscription | null>(null);

    useEffect(() => {
        registerForPushNotifications().then(token => {
            if (token) {
                setExpoPushToken(token);
                // Store token in auth store so logout can unregister it
                useAuthStore.getState().setPushToken(token);
                // Register with backend
                pushTokenAPI.register(token, Device.modelName ?? undefined)
                    .catch(err => console.warn('Failed to register push token:', err));
            }
        });

        // Listen for incoming notifications while app is foregrounded
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            console.log('Notification received:', notification);
        });

        // Listen for user tapping on a notification
        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data;
            console.log('Notification tapped:', data);
            // Navigation could be added here based on data.event_id
        });

        return () => {
            notificationListener.current?.remove();
            responseListener.current?.remove();
        };
    }, []);

    return { expoPushToken };
}

async function registerForPushNotifications(): Promise<string | null> {
    // Push notifications don't work on simulators/emulators or web
    if (!Device.isDevice || Platform.OS === 'web') {
        console.log('Push notifications require a physical device');
        return null;
    }

    // Check/request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('Push notification permission not granted');
        return null;
    }

    // Set notification channel for Android
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    // Get the Expo push token
    try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: undefined, // Uses EAS projectId from app.json if configured
        });
        return tokenData.data;
    } catch (error) {
        console.error('Failed to get push token:', error);
        return null;
    }
}
