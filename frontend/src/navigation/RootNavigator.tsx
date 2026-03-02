import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import LandingScreen from '../screens/LandingScreen';
import HomeScreen from '../screens/HomeScreen';
import WiFiSetupScreen from '../screens/WiFiSetupScreen';
import SignDetailScreen from '../screens/SignDetailScreen';
import { useAuthStore } from '../store/authStore';
import { ActivityIndicator, View } from 'react-native';

const Stack = createNativeStackNavigator<RootStackParamList>();

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
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {isAuthenticated ? (
                <>
                    <Stack.Screen name="Home" component={HomeScreen} />
                    <Stack.Screen name="SignDetail" component={SignDetailScreen} />
                    <Stack.Screen name="WiFiSetup" component={WiFiSetupScreen} />
                </>
            ) : (
                <Stack.Screen name="LandingScreen" component={LandingScreen} />
            )}
        </Stack.Navigator>
    );
}
