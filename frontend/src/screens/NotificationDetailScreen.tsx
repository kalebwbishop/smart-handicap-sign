import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/types/navigation';
import { notificationAPI } from '@/api/api';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, layout } from '@/theme/spacing';

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }) + ' at ' + d.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
    });
}

export default function NotificationDetailScreen() {
    const route = useRoute<RouteProp<RootStackParamList, 'NotificationDetail'>>();
    const navigation = useNavigation();
    const { notification } = route.params;

    const handleAcknowledge = async () => {
        try {
            await notificationAPI.markAsRead(notification.id);
            navigation.goBack();
        } catch (err) {
            console.error('Failed to acknowledge notification:', err);
        }
    };

    return (
        <ScrollView style={s.container} contentContainerStyle={s.content}>
            <View style={s.header}>
                <Text style={s.title}>{notification.title}</Text>
                <Text style={s.date}>{formatDate(notification.created_at)}</Text>
            </View>

            <View style={s.bodyCard}>
                <Text style={s.body}>{notification.body}</Text>
            </View>

            <View style={s.meta}>
                <View style={s.metaRow}>
                    <Text style={s.metaLabel}>Status</Text>
                    <View style={[s.badge, notification.read ? s.badgeRead : s.badgeUnread]}>
                        <Text style={[s.badgeText, notification.read ? s.badgeTextRead : s.badgeTextUnread]}>
                            {notification.read ? 'Read' : 'Unread'}
                        </Text>
                    </View>
                </View>
            </View>

            {!notification.read && (
                <Pressable
                    onPress={handleAcknowledge}
                    style={({ pressed }) => [s.ackButton, pressed && { opacity: 0.85 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Acknowledge this notification"
                >
                    <Text style={s.ackButtonText}>Acknowledge</Text>
                </Pressable>
            )}
        </ScrollView>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.offWhite,
    },
    content: {
        padding: layout.contentPadding,
    },
    header: {
        marginBottom: spacing.lg,
    },
    title: {
        ...typography.h2,
        color: colors.textPrimary,
        marginBottom: spacing.xs,
    },
    date: {
        ...typography.bodySmall,
        color: colors.textMuted,
    },
    bodyCard: {
        backgroundColor: colors.white,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
    },
    body: {
        ...typography.body,
        color: colors.textPrimary,
        lineHeight: 22,
    },
    meta: {
        backgroundColor: colors.white,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.xl,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    metaLabel: {
        ...typography.body,
        color: colors.textSecondary,
        fontFamily: 'Montserrat_500Medium',
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeUnread: {
        backgroundColor: colors.primary + '18',
    },
    badgeRead: {
        backgroundColor: colors.gray + '30',
    },
    badgeText: {
        ...typography.bodySmall,
        fontFamily: 'Montserrat_600SemiBold',
    },
    badgeTextUnread: {
        color: colors.primary,
    },
    badgeTextRead: {
        color: colors.textMuted,
    },
    ackButton: {
        backgroundColor: colors.primary,
        paddingVertical: 14,
        borderRadius: 9999,
        alignItems: 'center',
    },
    ackButtonText: {
        ...typography.button,
        color: colors.white,
    },
});
