import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Switch, StyleSheet, ActivityIndicator, Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { pushTokenAPI } from '@/api/api';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

export default function PreferencesScreen() {
    const { _pushToken, setPushToken } = useAuthStore();
    const [pushEnabled, setPushEnabled] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setPushEnabled(!!_pushToken);
        setLoading(false);
    }, [_pushToken]);

    const togglePush = useCallback(async (value: boolean) => {
        if (!Device.isDevice || Platform.OS === 'web') {
            Alert.alert('Not supported', 'Push notifications require a physical device.');
            return;
        }

        setLoading(true);
        try {
            if (value) {
                // Request permission and register
                const { status: existingStatus } = await Notifications.getPermissionsAsync();
                let finalStatus = existingStatus;
                if (existingStatus !== 'granted') {
                    const { status } = await Notifications.requestPermissionsAsync();
                    finalStatus = status;
                }
                if (finalStatus !== 'granted') {
                    Alert.alert('Permission denied', 'Please enable notifications in your device settings.');
                    setLoading(false);
                    return;
                }

                if (Platform.OS === 'android') {
                    await Notifications.setNotificationChannelAsync('default', {
                        name: 'Default',
                        importance: Notifications.AndroidImportance.MAX,
                        vibrationPattern: [0, 250, 250, 250],
                        lightColor: '#FF231F7C',
                    });
                }

                const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: undefined });
                const token = tokenData.data;
                await pushTokenAPI.register(token, Device.modelName ?? undefined);
                setPushToken(token);
                setPushEnabled(true);
            } else {
                // Unregister
                if (_pushToken) {
                    await pushTokenAPI.unregister(_pushToken);
                }
                setPushToken(null);
                setPushEnabled(false);
            }
        } catch (err) {
            console.error('Failed to toggle push notifications:', err);
            Alert.alert('Error', 'Failed to update push notification preference.');
        } finally {
            setLoading(false);
        }
    }, [_pushToken, setPushToken]);

    return (
        <View style={s.container}>
            <View style={s.section}>
                <Text style={s.sectionTitle}>Notifications</Text>
                <View style={s.row}>
                    <View style={s.rowText}>
                        <Text style={s.rowLabel}>Push Notifications</Text>
                        <Text style={s.rowDescription}>
                            Receive alerts when assistance is requested at your signs
                        </Text>
                    </View>
                    {loading ? (
                        <ActivityIndicator color={colors.primary} />
                    ) : (
                        <Switch
                            value={pushEnabled}
                            onValueChange={togglePush}
                            trackColor={{ false: colors.gray, true: colors.primary }}
                            thumbColor={colors.white}
                        />
                    )}
                </View>
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.grayLight,
    },
    section: {
        marginTop: spacing.lg,
        backgroundColor: colors.white,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
    },
    sectionTitle: {
        ...typography.caption,
        color: colors.textSecondary,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.xs,
        textTransform: 'uppercase',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
    rowText: {
        flex: 1,
        marginRight: spacing.md,
    },
    rowLabel: {
        ...typography.body,
        color: colors.textPrimary,
        fontFamily: 'Montserrat_500Medium',
    },
    rowDescription: {
        ...typography.caption,
        color: colors.textSecondary,
        marginTop: 2,
    },
});
