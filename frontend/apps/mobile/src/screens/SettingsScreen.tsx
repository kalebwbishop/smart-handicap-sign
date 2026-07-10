import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
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
import { useAuthStore } from '@/store/authStore';
import Feather from '@expo/vector-icons/Feather';
import SectionCard from '@/components/SectionCard'

export default function SettingsScreen() {
    const {
        playToneOnAssistanceRequest, setPlayToneOnAssistanceRequest,
        receiveNotifications, setReceiveNotifications,
        isSettingsLoaded } = useSettings();
    const [isSavingNotifications, setIsSavingNotifications] = useState(false);
    const { user, logout, ensureFreshSession } = useAuthStore();

    const handleSignOut = useCallback(async () => {
        try {
            await ensureFreshSession();
            logout();
        } catch (error) {
            console.error('[Settings] Failed to sign out:', error);
        }
    }, [ensureFreshSession, logout]);

    const userName = user?.name || user?.email || "Operator";


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
        <ScrollView style={styles.root}>
            <View style={styles.card}>
                <View style={styles.row}>
                    <View style={[styles.copy, { flexDirection: 'row', alignItems: 'center' }]}>
                        <View style={{ marginRight: 8, backgroundColor: colors.primaryLight, borderRadius: "50%", padding: 14 }}>
                            <Feather name="user" size={24} color={colors.primary} />
                        </View>
                        <View>
                            <Text style={styles.label}>{userName}</Text>
                            <Text style={[styles.helper, { marginTop: -8 }]}>
                                Sign Operator
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            <SectionCard title="Notifications">
                <View style={styles.row}>
                    <View style={styles.copy}>
                        <Text style={styles.label}>
                            New Assistance Requests
                        </Text>
                        <Text style={styles.helper}>
                            Push notification on incoming requests
                        </Text>
                    </View>
                    <Switch
                        accessibilityLabel="Receive assistance notifications"
                        value={receiveNotifications}
                        onValueChange={handleReceiveNotificationsChange}
                        disabled={isSavingNotifications}
                        style={{ alignSelf: 'center' }}
                        trackColor={{
                            false: colors.divider,
                            true: colors.primaryLight,
                        }}
                        thumbColor={receiveNotifications ? colors.primary : colors.white}
                    />
                </View>
                <View style={styles.row}>
                    <View style={styles.copy}>
                        <Text style={styles.label}>Play tone on assistance request</Text>
                        <Text style={styles.helper}>
                            When enabled, a tone will play when assistance is requested
                        </Text>
                    </View>
                    <Switch
                        accessibilityLabel="Play tone on assistance request"
                        value={playToneOnAssistanceRequest}
                        onValueChange={setPlayToneOnAssistanceRequest}
                        style={{ alignSelf: 'center' }}
                        trackColor={{
                            false: colors.divider,
                            true: colors.primaryLight,
                        }}
                        thumbColor={playToneOnAssistanceRequest ? colors.primary : colors.white}
                    />
                </View>
            </SectionCard>

            <SectionCard title="System">
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text>
                        App Version
                    </Text>
                    <Text style={{ color: colors.textSecondary }}>
                        v0.1.0
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text>
                        Last Sync
                    </Text>
                    <Text style={{ color: colors.textSecondary }}>
                        Just Now
                    </Text>
                </View>
            </SectionCard>


            <Pressable
                style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}
                onPress={handleSignOut}
            >
                <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
        </ScrollView>
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
    signOutButton: {
        backgroundColor: colors.primary,
        borderRadius: layout.borderRadiusMd,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.lg,
    },
    signOutButtonPressed: {
        backgroundColor: colors.primary,
    },
    signOutText: {
        ...typography.body,
        color: colors.white,
        fontFamily: 'Montserrat_600SemiBold',
    },
});
