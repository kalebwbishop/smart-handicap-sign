console.log('[NAV] RootNavigator module evaluating...');
import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import LandingScreen from '../screens/LandingScreen';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import NotificationDetailScreen from '../screens/NotificationDetailScreen';
import ProvisionSignScreen from '../screens/ProvisionSignScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SignDetailsScreen from '../screens/SignDetailsScreen';
import { useAuthStore } from '../store/authStore';
import { ActivityIndicator, Platform, View } from 'react-native';
import { colors } from '../theme/colors';
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
        <Stack.Navigator screenOptions={{ headerShown: true, headerBackTitle: '', ...sharedHeaderStyle }}>
            {isAuthenticated ? (
                <>
                    <Stack.Screen
                        name="Home"
                        component={HomeScreen}
                        options={{ title: '', headerShown: false }}
                    />
                    <Stack.Screen
                        name="NotificationDetail"
                        component={NotificationDetailScreen}
                        options={{ title: 'Request Details' }}
                    />
                    <Stack.Screen
                        name="Settings"
                        component={SettingsScreen}
                        options={{ title: 'Settings' }}
                    />
                    <Stack.Screen
                        name="SignDetails"
                        component={SignDetailsScreen}
                        options={{ title: 'Sign Details' }}
                    />
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
            <Stack.Screen
                name="ProvisionSign"
                component={ProvisionSignScreen}
                options={{ title: 'Set Up Test Sign' }}
            />
        </Stack.Navigator>
    );
}
