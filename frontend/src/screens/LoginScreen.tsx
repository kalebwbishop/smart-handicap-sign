import React, { useEffect, useCallback, useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import { authAPI } from '@/api/api';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

/**
 * Native-only login screen that automatically initiates the WorkOS OAuth flow.
 * Shown instead of the marketing LandingScreen on iOS/Android.
 */
export default function LoginScreen() {
    const setUser = useAuthStore((s) => s.setUser);
    const [isLoading, setIsLoading] = useState(false);
    const hasAutoTriggered = useRef(false);

    const handleLogin = useCallback(async () => {
        console.log('[LOGIN] handleLogin pressed');
        setIsLoading(true);
        try {
            const redirectUrl = ExpoLinking.createURL('callback');
            console.log('[LOGIN] redirectUrl:', redirectUrl);
            console.log('[LOGIN] Calling authAPI.initiateLogin...');
            const response = await authAPI.initiateLogin(redirectUrl);
            console.log('[LOGIN] initiateLogin response:', JSON.stringify(response)?.substring(0, 200));
            if (response.authorizationUrl) {
                console.log('[LOGIN] Opening auth session:', response.authorizationUrl?.substring(0, 80));
                const result = await WebBrowser.openAuthSessionAsync(
                    response.authorizationUrl,
                    redirectUrl,
                );
                console.log('[LOGIN] Auth session result type:', result.type);

                if (result.type === 'success' && result.url) {
                    console.log('[LOGIN] Success URL:', result.url?.substring(0, 100));
                    const parsed = ExpoLinking.parse(result.url);
                    const code = parsed.queryParams?.code as string | undefined;
                    console.log('[LOGIN] Parsed code:', code ? `${code.substring(0, 10)}...` : 'none');

                    if (code) {
                        console.log('[LOGIN] Exchanging code...');
                        const authResponse = await authAPI.handleCallback(code);
                        console.log('[LOGIN] Exchange success, user:', authResponse?.user?.email);
                        await setUser(
                            authResponse.user,
                            authResponse.accessToken,
                            authResponse.refreshToken,
                        );
                    }
                }
            } else {
                console.warn('[LOGIN] No authorizationUrl in response');
            }
        } catch (error: any) {
            console.error('[LOGIN] Error:', error?.message);
            console.error('[LOGIN] Error details:', error?.response?.status, error?.response?.data);
            Alert.alert('Login failed', 'Something went wrong during login. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [setUser]);

    // Auto-trigger login on first mount
    useEffect(() => {
        if (!hasAutoTriggered.current) {
            hasAutoTriggered.current = true;
            handleLogin();
        }
    }, [handleLogin]);

    return (
        <View style={s.container}>
            <View style={s.content}>
                <Text style={s.icon}>♿</Text>
                <Text style={s.title}>Hazard Hero</Text>
                <Text style={s.subtitle}>Sign in to manage your signs</Text>

                <Pressable
                    style={({ pressed }) => [s.button, pressed && s.buttonPressed]}
                    onPress={handleLogin}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color={colors.white} />
                    ) : (
                        <Text style={s.buttonText}>Sign In</Text>
                    )}
                </Pressable>
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.grayLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
    },
    icon: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    title: {
        ...typography.h1,
        color: colors.white,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    button: {
        backgroundColor: colors.ctaPrimary,
        paddingVertical: 12,
        paddingHorizontal: spacing.xl,
        borderRadius: 9999,
        minWidth: 200,
        alignItems: 'center',
    },
    buttonPressed: {
        opacity: 0.85,
    },
    buttonText: {
        ...typography.button,
        color: colors.ctaPrimaryText,
    },
});
