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
        setIsLoading(true);
        try {
            const redirectUrl = ExpoLinking.createURL('callback');
            const response = await authAPI.initiateLogin(redirectUrl);
            if (response.authorizationUrl) {
                const result = await WebBrowser.openAuthSessionAsync(
                    response.authorizationUrl,
                    redirectUrl,
                );

                if (result.type === 'success' && result.url) {
                    const parsed = ExpoLinking.parse(result.url);
                    const code = parsed.queryParams?.code as string | undefined;

                    if (code) {
                        const authResponse = await authAPI.handleCallback(code);
                        await setUser(
                            authResponse.user,
                            authResponse.accessToken,
                            authResponse.refreshToken,
                        );
                    }
                }
            }
        } catch (error) {
            console.error('Login error:', error);
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
                <Text style={s.title}>Smart Handicap Sign</Text>
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
        backgroundColor: colors.primary,
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
        color: colors.white,
        opacity: 0.85,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    button: {
        backgroundColor: colors.white,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        borderRadius: 12,
        minWidth: 200,
        alignItems: 'center',
    },
    buttonPressed: {
        opacity: 0.85,
    },
    buttonText: {
        ...typography.body,
        color: colors.primary,
        fontWeight: '700',
    },
});
