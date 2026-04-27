console.log('[APP] App.tsx module evaluating...');
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo } from 'react';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import { RootStackParamList } from './src/types/navigation';
import { View, StyleSheet, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { authAPI } from './src/api/api';
import { useAuthStore } from './src/store/authStore';
import { AuthResponse } from './src/types/types';
console.log('[APP] All App.tsx imports resolved');

const linking: LinkingOptions<RootStackParamList> = {
    prefixes: [Linking.createURL('/'), 'http://localhost:8081/', 'https://localhost:8081/'],
    config: {
        screens: {
            LandingScreen: '',
            Home: {
                path: 'home',
                parse: {
                    code: String,
                },
            },
        },
    },
};

function useQueryParam(name: string) {
    const url = Linking.useURL();

    return useMemo(() => {
        if (!url) return null;
        console.log('[DeepLink] Full URL:', url);
        const { queryParams } = Linking.parse(url);
        console.log('[DeepLink] Parsed queryParams:', queryParams);
        const v = queryParams?.[name];
        const result = typeof v === "string" ? v : (Array.isArray(v) ? v[0] : null);
        console.log(`[DeepLink] ${name} param:`, result);
        return result;
    }, [url, name]);
}

export default function App() {
    console.log('[APP] App() rendering');

    const code = useQueryParam("code");
    const [processedCode, setProcessedCode] = React.useState<string | null>(null);
    const { setUser } = useAuthStore();

    useEffect(() => {
        if (!code || code === processedCode) return;

        console.log("[OAuth] Code received:", code);
        setProcessedCode(code);
        
        authAPI.handleCallback(code)
            .then(async (response: AuthResponse) => {
                console.log("[OAuth] Exchange successful", response.user.email);
                await setUser(response.user, response.accessToken, response.refreshToken);
            })
            .catch((error) => {
                console.error("[OAuth] Exchange failed:", error);
                console.error("[OAuth] Error details:", {
                    message: error?.message,
                    status: error?.response?.status,
                    data: error?.response?.data,
                });
            });
    }, [code, processedCode])

    return (
        <View style={styles.container}>
            <View style={[styles.appContainer, Platform.OS === 'web' && styles.webAppContainer]}>
                <NavigationContainer linking={linking}>
                    <RootNavigator />
                </NavigationContainer>
                <StatusBar style="auto" />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    appContainer: {
        flex: 1,
        width: '100%',
        backgroundColor: '#f5f5f7',
    },
    webAppContainer: {
        height: '100%',
    },
});

