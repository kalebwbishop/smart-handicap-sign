console.log('[NAV] RootNavigator module evaluating...');
import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import LandingScreen from '../screens/LandingScreen';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import WiFiSetupScreen from '../screens/WiFiSetupScreen';
import SignDetailScreen from '../screens/SignDetailScreen';
import OrganizationScreen from '../screens/OrganizationScreen';
import SetupGuideScreen from '../screens/SetupGuideScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
import { useAuthStore } from '../store/authStore';
import { ActivityIndicator, Platform, View } from 'react-native';
import { colors } from '../theme/colors';
import { usePushNotifications } from '../hooks/usePushNotifications';
import {
    useFonts,
    Montserrat_300Light,
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
console.log('[NAV] All RootNavigator imports resolved');

const Stack = createNativeStackNavigator<RootStackParamList>();

const sharedHeaderStyle = {
    headerStyle: { backgroundColor: colors.white },
    headerTintColor: colors.textPrimary,
    headerTitleStyle: { fontFamily: 'Montserrat_600SemiBold', fontWeight: '600' as const },
    headerShadowVisible: false,
};

/** Registers for push notifications when authenticated. Renders nothing. */
function PushNotificationRegistrar() {
    usePushNotifications();
    return null;
}

export default function RootNavigator() {
    const { isAuthenticated, isLoading, restoreSession } = useAuthStore();

    const [fontsLoaded] = useFonts({
        Montserrat_300Light,
        Montserrat_400Regular,
        Montserrat_500Medium,
        Montserrat_600SemiBold,
        Montserrat_700Bold,
    });

    console.log('[NAV] RootNavigator render — isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);

    useEffect(() => {
        console.log('[NAV] useEffect firing restoreSession()');
        restoreSession();
    }, [restoreSession]);

    if (isLoading || !fontsLoaded) {
        console.log('[NAV] Showing loading spinner (isLoading=true)');
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <>
            {isAuthenticated && <PushNotificationRegistrar />}
            <Stack.Navigator screenOptions={{ headerShown: true, headerBackTitle: '', ...sharedHeaderStyle }}>
                {isAuthenticated ? (
                    <>
                        <Stack.Screen
                            name="Home"
                            component={HomeScreen}
                            options={{ title: '', headerShown: false }}
                        />
                        <Stack.Screen
                            name="SignDetail"
                            component={SignDetailScreen}
                            options={{ title: 'Sign Details' }}
                        />
                        <Stack.Screen
                            name="Organizations"
                            component={OrganizationScreen}
                            options={{ title: 'Organizations' }}
                        />
                        <Stack.Screen
                            name="Feedback"
                            component={FeedbackScreen}
                            options={{ title: 'Send Feedback' }}
                        />
                        {Platform.OS !== 'web' && (
                            <Stack.Screen
                                name="SetupGuide"
                                component={SetupGuideScreen}
                                options={{ title: 'Setup Guide' }}
                            />
                        )}
                        {Platform.OS !== 'web' && (
                            <Stack.Screen
                                name="WiFiSetup"
                                component={WiFiSetupScreen}
                                options={{ title: 'Wi-Fi Setup' }}
                            />
                        )}
                    </>
                ) : Platform.OS === 'web' ? (
                    <Stack.Screen
                        name="LandingScreen"
                        component={LandingScreen}
                        options={{ title: 'Hazard Hero', headerShown: false }}
                    />
                ) : (
                    <Stack.Screen
                        name="LoginScreen"
                        component={LoginScreen}
                        options={{ title: 'Hazard Hero', headerShown: false }}
                    />
                )}
            </Stack.Navigator>
        </>
    );
}
