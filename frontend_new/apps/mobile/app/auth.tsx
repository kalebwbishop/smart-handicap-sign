import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

/**
 * OAuth callback route — WorkOS redirects here with ?code=XXX.
 * Exchanges the code for tokens and navigates to home.
 */
export default function AuthCallback() {
    const { code } = useLocalSearchParams<{ code?: string }>();
    const handleAuthCode = useAuthStore((s) => s.handleAuthCode);
    const router = useRouter();
    const hasHandled = useRef(false);

    useEffect(() => {
        if (!code || hasHandled.current) return;
        hasHandled.current = true;

        handleAuthCode(code)
            .then(() => {
                router.replace('/');
            })
            .catch((err) => {
                console.error('[Auth] Callback failed:', err);
                router.replace('/login');
            });
    }, [code]);

    return (
        <View style={s.container}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={s.text}>Signing in…</Text>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.grayLight,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    text: {
        ...typography.body,
        color: colors.textSecondary,
    },
});
