import React, { useState, useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter, Slot, Stack } from 'expo-router';
import { useAuth0 } from 'react-native-auth0';
import { loadAsync } from 'expo-font';
import { MainProvider } from '@/providers/MainProvider';

SplashScreen.preventAutoHideAsync();

const loadResourcesAsync = async () => {
    await loadAsync({
        SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
        PoppinsRegular: require('../assets/fonts/Poppins-Regular.ttf'),
        PoppinsSemiBold: require('../assets/fonts/Poppins-SemiBold.ttf'),
    })

    // await new Promise((resolve) => setTimeout(resolve, 3000));
};

export default function RootLayout() {
    const [isReady, setIsReady] = useState(false);
    const { user } = useAuth0();
    const router = useRouter();

    useEffect(() => {
        const prepare = async () => {
            try {
                await loadAsync({
                    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
                    PoppinsRegular: require('../assets/fonts/Poppins-Regular.ttf'),
                    PoppinsSemiBold: require('../assets/fonts/Poppins-SemiBold.ttf'),
                });
            } catch (e) {
                console.error(e);
            } finally {
                setIsReady(true);
                SplashScreen.hideAsync();
            }
        };

        prepare();
    }, []);

    // useEffect(() => {
    //     if (isReady && !user) {
    //         console.log('Redirecting to login');
    //         router.replace('/Auth'); // Redirect to login if not authenticated
    //     }
    // }, [isReady, user]);


    if (!isReady) {
        return null; // Or a splash/loading component
    }

    return (
        <MainProvider>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Auth" options={{ gestureEnabled: false}}/>
                <Stack.Screen name="index" options={{ gestureEnabled: false}}/>
                <Stack.Screen name="Sign" />
                <Stack.Screen name="UserSettings" />
                <Stack.Screen name="Testing" />
            </Stack>
        </MainProvider>
    )
}
