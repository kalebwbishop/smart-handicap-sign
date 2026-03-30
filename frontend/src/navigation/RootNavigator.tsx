import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import LandingScreen from '../screens/LandingScreen';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import WiFiSetupScreen from '../screens/WiFiSetupScreen';
import SignDetailScreen from '../screens/SignDetailScreen';
import OrganizationScreen from '../screens/OrganizationScreen';
import { useAuthStore } from '../store/authStore';
import { ActivityIndicator, Platform, View } from 'react-native';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();

const sharedHeaderStyle = {
    headerStyle: { backgroundColor: colors.primary },
    headerTintColor: colors.white,
    headerTitleStyle: { fontWeight: '600' as const },
};

export default function RootNavigator() {
    const { isAuthenticated, isLoading, loadStoredAuth } = useAuthStore();

    useEffect(() => {
        loadStoredAuth();
    }, [loadStoredAuth]);

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#0000ff" />
            </View>
        );
    }

    return (
        <Stack.Navigator screenOptions={{ headerShown: true, ...sharedHeaderStyle }}>
            {isAuthenticated ? (
                <>
                    <Stack.Screen
                        name="Home"
                        component={HomeScreen}
                        options={{ title: 'Sign Dashboard' }}
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
                    options={{ title: 'Smart Handicap Sign', headerShown: false }}
                />
            ) : (
                <Stack.Screen
                    name="LoginScreen"
                    component={LoginScreen}
                    options={{ title: 'Smart Handicap Sign', headerShown: false }}
                />
            )}
        </Stack.Navigator>
    );
}
