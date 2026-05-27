import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@/types/navigation';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, layout } from '@/theme/spacing';
import { DeviceEvent } from '@/types/device';

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

function formatEventTitle(event: DeviceEvent): string {
    switch (event.event_type) {
        case 'assistance_requested':
            return 'Assistance requested';
        case 'assistance_acknowledged':
            return 'Request acknowledged';
        case 'assistance_resolved':
            return 'Request resolved';
        case 'pilot_seeded':
            return 'Pilot sign created';
        default:
            return event.event_type.replace(/_/g, ' ');
    }
}

function formatEventBody(event: DeviceEvent): string {
    const message = typeof event.payload?.message === 'string' ? event.payload.message : null;
    if (message) return message;

    const previousStatus = typeof event.payload?.previous_status === 'string'
        ? event.payload.previous_status
        : null;
    const newStatus = typeof event.payload?.new_status === 'string'
        ? event.payload.new_status
        : null;
    const confidence = typeof event.payload?.confidence === 'number'
        ? `${Math.round(event.payload.confidence * 100)}% confidence`
        : null;

    const parts = [
        previousStatus && newStatus ? `${previousStatus} -> ${newStatus}` : newStatus,
        confidence,
    ].filter(Boolean);

    if (parts.length > 0) {
        return parts.join(' • ');
    }

    return 'Recorded device event for the pilot sign.';
}

export default function NotificationDetailScreen() {
    const route = useRoute<RouteProp<RootStackParamList, 'NotificationDetail'>>();
    const { event } = route.params;

    return (
        <ScrollView style={s.container} contentContainerStyle={s.content}>
            <View style={s.header}>
                <Text style={s.title}>{formatEventTitle(event)}</Text>
                <Text style={s.date}>{formatDate(event.created_at)}</Text>
            </View>

            <View style={s.bodyCard}>
                <Text style={s.body}>{formatEventBody(event)}</Text>
            </View>

            <View style={s.meta}>
                <View style={s.metaRow}>
                    <Text style={s.metaLabel}>Event type</Text>
                    <Text style={s.metaValue}>{event.event_type}</Text>
                </View>
                {'new_status' in event.payload || 'previous_status' in event.payload ? (
                    <View style={[s.metaRow, s.metaRowSpaced]}>
                        <Text style={s.metaLabel}>Transition</Text>
                        <Text style={s.metaValue}>
                            {typeof event.payload.previous_status === 'string' ? event.payload.previous_status : 'unknown'}
                            {' -> '}
                            {typeof event.payload.new_status === 'string' ? event.payload.new_status : 'unknown'}
                        </Text>
                    </View>
                ) : null}
            </View>
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
});
