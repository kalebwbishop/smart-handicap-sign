import React from 'react';
import { Slot } from 'expo-router';
import { Provider as ReduxProvider } from 'react-redux';
import { Auth0Provider } from 'react-native-auth0';
import { NotificationsProvider } from '@/providers/NotificationProvider';
import store from '@/redux/store';

export const MainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <ReduxProvider store={store}>
            <Auth0Provider
                domain="dev-7u0x4ktpv0rpskm0.us.auth0.com"
                clientId="stzc7vjTS4OT9pzUvLRhQ1JgZVWxU7v7"
            >
                <NotificationsProvider>
                    {children}
                </NotificationsProvider>
            </Auth0Provider>
        </ReduxProvider>
    );
}
