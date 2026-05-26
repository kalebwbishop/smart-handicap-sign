import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, layout } from '@/theme/spacing';

export default function FeedbackScreen() {
    const insets = useSafeAreaInsets();
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = useCallback(async () => {
        if (!text.trim()) return;
        setLoading(true);
        try {
            // await apiClient.post('/feedback', { message: text });
            console.log('[Feedback]', text);
            setSubmitted(true);
            setText('');
        } catch (err) {
            console.error('[FeedbackScreen] error:', err);
        } finally {
            setLoading(false);
        }
    }, [text]);

    return (
        <KeyboardAvoidingView
            style={s.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={[s.container, { paddingBottom: insets.bottom + spacing.lg }]}>
                {submitted ? (
                    <View style={s.successWrap}>
                        <Text style={{ fontSize: 48 }}>✅</Text>
                        <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.md }]}>
                            Thanks for your feedback!
                        </Text>
                        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
                            Your input helps us improve Hazard Hero.
                        </Text>
                        <Pressable
                            onPress={() => setSubmitted(false)}
                            style={({ pressed }) => [s.sendAnotherBtn, pressed && { opacity: 0.7 }]}
                            accessibilityRole="button"
                            accessibilityLabel="Send another feedback"
                        >
                            <Text style={[typography.button, { color: colors.primary }]}>Send Another</Text>
                        </Pressable>
                    </View>
                ) : (
                    <View style={s.formWrap}>
                        <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.md }]}>
                            Let us know about issues, ideas, or anything else.
                        </Text>
                        <TextInput
                            style={s.input}
                            value={text}
                            onChangeText={setText}
                            placeholder="What's on your mind?"
                            placeholderTextColor={colors.textMuted}
                            multiline
                            numberOfLines={6}
                            textAlignVertical="top"
                            accessibilityLabel="Feedback message"
                        />
                        <Pressable
                            onPress={handleSubmit}
                            disabled={!text.trim() || loading}
                            style={({ pressed }) => [
                                s.submitBtn,
                                (!text.trim() || loading) && { opacity: 0.5 },
                                pressed && { opacity: 0.8 },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="Submit feedback"
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={colors.ctaPrimaryText} />
                            ) : (
                                <Text style={[typography.button, { color: colors.ctaPrimaryText }]}>Submit Feedback</Text>
                            )}
                        </Pressable>
                    </View>
                )}
            </View>
        </KeyboardAvoidingView>
    );
}

const s = StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.white },
    container: {
        flex: 1,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
    },
    formWrap: { flex: 1 },
    input: {
        backgroundColor: colors.offWhite,
        borderRadius: layout.borderRadius,
        borderWidth: 1,
        borderColor: colors.divider,
        padding: spacing.md,
        minHeight: 140,
        fontSize: 17,
        color: colors.textPrimary,
        lineHeight: 25,
    },
    submitBtn: {
        marginTop: spacing.md,
        backgroundColor: colors.ctaPrimary,
        paddingVertical: 14,
        borderRadius: layout.borderRadiusPill,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
    },
    successWrap: {
        flex: 1,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
    },
    sendAnotherBtn: {
        marginTop: spacing.lg,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: layout.borderRadiusPill,
        backgroundColor: 'rgba(0,113,227,0.10)',
    },
});
