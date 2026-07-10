console.log('[NAV] RootNavigator module evaluating...');
import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import LandingScreen from '../screens/LandingScreen';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import RequestsScreen from '../screens/RequestsScreen';
import NotificationDetailScreen from '../screens/NotificationDetailScreen';
import ProvisionSignScreen from '../screens/ProvisionSignScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SignDetailsScreen from '../screens/SignDetailsScreen';
import SignsScreen from '../screens/SignsScreen';
import { useAuthStore } from '../store/authStore';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import Feather from '@expo/vector-icons/Feather';
import {
    useFonts,
    Montserrat_300Light,
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import Header from "../components/Header"
import SignIcon from '@/components/SignIcon';
console.log('[NAV] All RootNavigator imports resolved');

const Stack = createNativeStackNavigator<RootStackParamList>();

const sharedHeaderStyle = {
    headerStyle: { backgroundColor: colors.white },
    headerTintColor: colors.textPrimary,
    headerTitleStyle: { fontFamily: 'Montserrat_600SemiBold', fontWeight: '600' as const },
    headerShadowVisible: false,
};

function MainTabs({ navigation }: { navigation: NativeStackNavigationProp<RootStackParamList> }) {
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<'Dashboard' | 'Signs' | 'Requests' | 'Settings'>('Dashboard');
    const headerTitle = activeTab;

    const renderScreen = () => {
        switch (activeTab) {
            case 'Signs':
                return <SignsScreen />;
            case 'Requests':
                return <RequestsScreen />;
            case 'Settings':
                return <SettingsScreen />;
            default:
                return <HomeScreen />;
        }
    };

    const getTabIcon = (tab: 'Dashboard' | 'Signs' | 'Requests' | 'Settings', isActive: boolean, size: number = 24, color: string = isActive ? colors.primary : colors.textSecondary) => {
        if (tab === 'Dashboard') {
            return <Feather name="home" size={size} color={color} />;
        }
        if (tab === 'Signs') {
            return <SignIcon size={size} color={color} />;
        }
        if (tab === 'Requests') {
            return <Feather name="bell" size={size} color={color} />;
        }
        if (tab === 'Settings') {
            return <Feather name="settings" size={size} color={color} />;
        }
        return <SignIcon size={size} color={color} />;
    };

    return (
        <View style={{ flex: 1 }}>
            <Header headerTitle={headerTitle} onPressRequests={() => setActiveTab('Requests')} />
            <View style={{ flex: 1 }}>
                {renderScreen()}
            </View>
            <View style={{ flexDirection: 'row', borderTopColor: colors.divider, borderTopWidth: 1, backgroundColor: colors.white, paddingBottom: Math.max(insets.bottom, 8) }}>
                {(['Dashboard', 'Signs', 'Requests', 'Settings'] as const).map((tab) => {
                    const isActive = activeTab === tab;
                    return (
                        <Pressable
                            key={tab}
                            onPress={() => setActiveTab(tab)}
                            style={{ flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}
                        >
                            {getTabIcon(tab, isActive, 24, isActive ? colors.primary : colors.textSecondary)}
                            <Text style={{ color: isActive ? colors.primary : colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                                {tab}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
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
        <Stack.Navigator screenOptions={{ headerShown: true, headerBackTitle: '', ...sharedHeaderStyle }}>
            {isAuthenticated ? (
                <>
                    <Stack.Screen
                        name="MainTabs"
                        children={({ navigation }) => <MainTabs navigation={navigation} />}
                        options={{ title: '', headerShown: false }}
                    />
                    <Stack.Screen
                        name="NotificationDetail"
                        component={NotificationDetailScreen}
                        options={{ title: 'Request Details' }}
                    />
                    <Stack.Screen
                        name="SignDetails"
                        component={SignDetailsScreen}
                        options={{
                            title: 'Sign Details',
                            presentation: 'transparentModal',
                            animation: 'slide_from_bottom',
                            headerShown: false,
                            contentStyle: { backgroundColor: 'transparent' },
                        }}
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
