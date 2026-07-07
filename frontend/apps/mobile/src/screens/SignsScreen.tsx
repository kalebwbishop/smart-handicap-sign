import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { devicesAPI } from '../api/api';
import { Device } from '../types/device';
import { RootStackParamList } from '../types/navigation';
import { colors } from '../theme/colors';
import { layout, shadows, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export default function SignsScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadDevices = useCallback(async () => {
        setLoading(true);
        try {
            const result = await devicesAPI.list();
            setDevices(result);
            setError(result.length === 0 ? 'No signs are linked yet.' : null);
        } catch (err) {
            console.error('[Signs] Failed to load signs:', err);
            setError('Unable to load signs right now.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadDevices();
    }, [loadDevices]);

    if (loading) {
        return (
            <View style={styles.loadingRoot}>
                <ActivityIndicator color={colors.primary} size="large" />
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.root}>
            {error ? <Text style={styles.emptyText}>{error}</Text> : null}
            {devices.map((device) => (
                <Pressable
                    key={device.id}
                    onPress={() => navigation.navigate('SignDetails', { device })}
                    style={({ pressed }) => [
                        styles.card,
                        pressed && styles.cardPressed,
                    ]}
                >
                    <Text style={styles.title}>{device.name || 'Unnamed sign'}</Text>
                    <Text style={styles.subtitle}>Serial: {device.serial_number}</Text>
                    <Text style={styles.helper}>Tap for status and controls</Text>
                </Pressable>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    loadingRoot: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.offWhite,
    },
    root: {
        backgroundColor: colors.offWhite,
        padding: spacing.lg,
        flexGrow: 1,
    },
    card: {
        backgroundColor: colors.white,
        borderRadius: layout.borderRadiusMd,
        padding: spacing.lg,
        marginBottom: spacing.md,
        ...shadows.card,
    },
    cardPressed: {
        opacity: 0.92,
    },
    title: {
        ...typography.bodyLarge,
        color: colors.textPrimary,
        fontFamily: 'Montserrat_600SemiBold',
    },
    subtitle: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    helper: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        marginTop: spacing.sm,
    },
    emptyText: {
        ...typography.body,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },
});
