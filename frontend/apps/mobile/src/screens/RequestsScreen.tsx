import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { notificationAPI } from '../api/api';
import { SignNotification } from '../types/types';
import { RootStackParamList } from '../types/navigation';
import { colors } from '../theme/colors';
import { layout, shadows, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export default function RequestsScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [notifications, setNotifications] = useState<SignNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const result = await notificationAPI.getNotifications();
            setNotifications(result);
            setError(result.length === 0 ? 'No assistance requests yet.' : null);
        } catch (err) {
            console.error('[Requests] Failed to load requests:', err);
            setError('Unable to load requests right now.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadNotifications();
    }, [loadNotifications]);

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
            {notifications.map((notification) => (
                <Pressable
                    key={notification.id}
                    onPress={() => navigation.navigate('NotificationDetail', { notification })}
                    style={({ pressed }) => [
                        styles.card,
                        pressed && styles.cardPressed,
                    ]}
                >
                    <Text style={styles.title}>{notification.title}</Text>
                    <Text style={styles.subtitle} numberOfLines={2}>
                        {notification.body}
                    </Text>
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
    emptyText: {
        ...typography.body,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },
});
