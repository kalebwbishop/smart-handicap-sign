import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, Image, Dimensions } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

/**
 * Native-only login screen that automatically initiates the WorkOS OAuth flow.
 * Shown instead of the marketing LandingScreen on iOS/Android.
 */
export default function LoginScreen() {
    const login = useAuthStore((s) => s.login);
    const [isLoading, setIsLoading] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);

    const handleLogin = useCallback(async () => {
        console.log('[LOGIN] handleLogin pressed');
        setIsLoading(true);
        try {
            await login();
        } catch (error: any) {
            console.error('[LOGIN] Error:', error?.message);
            console.error('[LOGIN] Error details:', error?.response?.status, error?.response?.data);
            Alert.alert('Login failed', 'Something went wrong during login. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [login]);

    return (
        <View style={s.container}>
            <View style={s.content}>
                <Image
                    source={require('../../assets/splash.png')}
                    style={s.logo}
                    resizeMode="contain"
                    onLoad={() => setImageLoaded(true)}
                />

                {imageLoaded && (
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
                )}
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.white,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
    },
    logo: {
        width: Dimensions.get('window').width * 0.8,
        height: undefined,
        aspectRatio: 1,
        marginBottom: spacing.lg,
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
