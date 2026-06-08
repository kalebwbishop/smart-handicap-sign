import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Switch,
    Text,
    View,
} from 'react-native';
import { notificationAPI } from '../api/api';
import { useSettings } from '../context/SettingsContext';
import { colors } from '../theme/colors';
import { layout, spacing, shadows } from '../theme/spacing';
import { typography } from '../theme/typography';

export default function SettingsScreen() {
    const { 
        playToneOnAssistanceRequest, setPlayToneOnAssistanceRequest,
        receiveNotifications, setReceiveNotifications,
        isSettingsLoaded } = useSettings();
    const [isSavingNotifications, setIsSavingNotifications] = useState(false);

    const handleReceiveNotificationsChange = useCallback(
        async (enabled: boolean) => {
            setIsSavingNotifications(true);

            try {
                await notificationAPI.updatePreferences({
                    assistance_requests_enabled: enabled,
                });
                setReceiveNotifications(enabled);
            } catch (error) {
                console.error(
                    '[Settings] Failed to update notification preferences:',
                    error,
                );
            } finally {
                setIsSavingNotifications(false);
            }
        },
        [setReceiveNotifications],
    );

    if (!isSettingsLoaded) {
        return (
            <View style={styles.loadingRoot}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={styles.loadingText}>Loading settings…</Text>
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <View style={styles.card}>
                <View style={styles.row}>
                    <View style={styles.copy}>
                        <Text style={styles.label}>Play tone on assistance request</Text>
                        <Text style={styles.helper}>
                            When enabled, a tone will play when assistance is requested.
                        </Text>
                    </View>
                    <Switch
                        accessibilityLabel="Play tone on assistance request"
                        value={playToneOnAssistanceRequest}
                        onValueChange={setPlayToneOnAssistanceRequest}
                        trackColor={{
                            false: colors.divider,
                            true: colors.primaryLight,
                        }}
                        thumbColor={playToneOnAssistanceRequest ? colors.primary : colors.white}
                    />
                </View>
            </View>
            <View style={styles.card}>
                <View style={styles.row}>
                    <View style={styles.copy}>
                        <Text style={styles.label}>
                            Receive assistance notifications
                        </Text>
                        <Text style={styles.helper}>
                            Turn this off to pause assistance alerts in the
                            inbox.
                        </Text>
                    </View>
                    <Switch
                        accessibilityLabel="Receive assistance notifications"
                        value={receiveNotifications}
                        onValueChange={handleReceiveNotificationsChange}
                        disabled={isSavingNotifications}
                        trackColor={{
                            false: colors.divider,
                            true: colors.primaryLight,
                        }}
                        thumbColor={receiveNotifications ? colors.primary : colors.white}
                    />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    loadingRoot: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: colors.offWhite,
        justifyContent: 'center',
        padding: spacing.lg,
    },
    loadingText: {
        ...typography.body,
        color: colors.textSecondary,
        marginTop: spacing.md,
    },
    root: {
        flex: 1,
        backgroundColor: colors.offWhite,
        padding: spacing.lg,
    },
    title: {
        ...typography.h3,
        color: colors.textPrimary,
        marginBottom: spacing.xs,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        marginBottom: spacing.lg,
    },
    card: {
        backgroundColor: colors.white,
        borderRadius: layout.borderRadiusMd,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        ...shadows.card,
    },
    row: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.md,
    },
    copy: {
        flex: 1,
    },
    label: {
        ...typography.body,
        color: colors.textPrimary,
        fontFamily: 'Montserrat_600SemiBold',
        marginBottom: spacing.xs,
    },
    helper: {
        ...typography.bodySmall,
        color: colors.textSecondary,
    },
});
