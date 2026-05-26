import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, Alert, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';
import {
    useFonts,
    Montserrat_300Light,
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 2,
            staleTime: 1000 * 60 * 5,
        },
    },
});

export default function RootLayout() {
    const [appReady, setAppReady] = useState(false);
    const restoreSession = useAuthStore((s) => s.restoreSession);
    const sessionExpiredMessage = useAuthStore((s) => s.sessionExpiredMessage);

    const [fontsLoaded] = useFonts({
        Montserrat_300Light,
        Montserrat_400Regular,
        Montserrat_500Medium,
        Montserrat_600SemiBold,
        Montserrat_700Bold,
    });

    useEffect(() => {
        restoreSession().finally(() => setAppReady(true));
    }, []);

    useEffect(() => {
        if (sessionExpiredMessage) {
            if (Platform.OS === 'web') {
                // eslint-disable-next-line no-restricted-globals
                (globalThis as any).alert?.(sessionExpiredMessage);
            } else {
                Alert.alert('Session Expired', sessionExpiredMessage);
            }
        }
    }, [sessionExpiredMessage]);

    if (!appReady || !fontsLoaded) {
        return (
            <View style={s.splash}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <QueryClientProvider client={queryClient}>
            <Stack screenOptions={{ headerShown: false }} />
            <StatusBar style="light" />
        </QueryClientProvider>
    );
}

const s = StyleSheet.create({
    splash: {
        flex: 1,
        backgroundColor: colors.grayLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
