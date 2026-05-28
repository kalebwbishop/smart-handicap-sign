import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types/navigation';
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
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { notification, device } = route.params;

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
                    <Text style={s.metaValue}>{notification.read ? 'Read' : 'Unread'}</Text>
                </View>
                <View style={[s.metaRow, s.metaRowSpaced]}>
                    <Text style={s.metaLabel}>Notification ID</Text>
                    <Text style={s.metaValue}>{notification.id}</Text>
                </View>
            </View>

            {device ? (
                <Pressable
                    accessibilityLabel={`Open sign details for ${device.name || 'sign'}`}
                    accessibilityRole="button"
                    onPress={() => navigation.navigate('SignDetails', { device })}
                    style={({ pressed }) => [s.primaryAction, pressed && s.pressed]}
                >
                    <Text style={s.primaryActionText}>Open sign details</Text>
                </Pressable>
            ) : null}
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
        borderColor: colors.divider,
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
        borderColor: colors.divider,
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
    metaRowSpaced: {
        marginTop: spacing.sm,
    },
    metaValue: {
        ...typography.bodySmall,
        color: colors.textPrimary,
        fontFamily: 'Montserrat_600SemiBold',
    },
    primaryAction: {
        alignItems: 'center',
        backgroundColor: colors.ctaPrimary,
        borderRadius: layout.borderRadiusPill,
        marginBottom: spacing.xl,
        paddingHorizontal: spacing.lg,
        paddingVertical: 14,
    },
    primaryActionText: {
        ...typography.button,
        color: colors.ctaPrimaryText,
    },
    pressed: {
        opacity: 0.82,
    },
});
