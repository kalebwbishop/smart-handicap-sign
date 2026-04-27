import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TextInput,
    Pressable,
    Linking,
    StyleSheet,
    useWindowDimensions,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, layout } from '@/theme/spacing';

/* ──────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────── */

const BREAKPOINT_MD = 768;

function useResponsive() {
    const { width } = useWindowDimensions();
    return { isMobile: width < BREAKPOINT_MD, width };
}

/* ──────────────────────────────────────────────
 * Reusable Primitives
 * ────────────────────────────────────────────── */

interface SectionContainerProps {
    background?: string;
    children: React.ReactNode;
    style?: object;
}

function SectionContainer({ background = 'transparent', children, style }: SectionContainerProps) {
    return (
        <View style={[s.section, { backgroundColor: background }, style]}>
            <View style={s.sectionInner}>{children}</View>
        </View>
    );
}

function SectionHeading({ children, light }: { children: string; light?: boolean }) {
    return (
        <Text
            style={[
                typography.h2,
                s.sectionHeading,
                light ? { color: colors.heroText } : { color: colors.textPrimary },
            ]}
            accessibilityRole="header"
        >
            {children}
        </Text>
    );
}

interface CTAButtonProps {
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'outline';
    loading?: boolean;
}

function CTAButton({ label, onPress, variant = 'primary', loading }: CTAButtonProps) {
    const isPrimary = variant === 'primary';
    return (
        <Pressable
            onPress={onPress}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={({ pressed }) => [
                s.ctaButton,
                isPrimary ? s.ctaPrimary : s.ctaOutline,
                pressed && { opacity: 0.85 },
            ]}
        >
            {loading ? (
                <ActivityIndicator color={isPrimary ? colors.ctaPrimaryText : colors.ctaSecondaryText} />
            ) : (
                <Text
                    style={[
                        typography.button,
                        { color: isPrimary ? colors.ctaPrimaryText : colors.ctaSecondaryText },
                    ]}
                >
                    {label}
                </Text>
            )}
        </Pressable>
    );
}

function IconCircle({ emoji, size = 56 }: { emoji: string; size?: number }) {
    return (
        <View
            style={[
                s.iconCircle,
                { width: size, height: size, borderRadius: size / 2 },
            ]}
            accessibilityElementsHidden
        >
            <Text style={{ fontSize: size * 0.45 }}>{emoji}</Text>
        </View>
    );
}

/* ──────────────────────────────────────────────
 * Data
 * ────────────────────────────────────────────── */

const PROBLEMS = [
    { emoji: '🚗', title: 'Wasted Time', body: 'Drivers circle lots looking for open accessible spaces, causing frustration and delays.' },
    { emoji: '🏥', title: 'No Visibility', body: 'Facilities lack real-time insight into handicap parking availability and usage.' },
    { emoji: '⚖️', title: 'Compliance Gaps', body: 'Misuse and compliance concerns go undetected without proper monitoring.' },
];

const FEATURES = [
    'Real-time occupancy detection',
    'Clear visual availability indicator on the sign',
    'Data dashboard for facilities managers',
    'Easy retrofit installation — no trenching required',
    'ADA-conscious, weather-resistant design',
];

const STEPS = [
    { emoji: '🔧', title: 'Install the Smart Sign', body: 'Quick, non-invasive setup on any standard parking sign post.' },
    { emoji: '📡', title: 'Monitor in Real Time', body: 'Space availability is tracked and displayed instantly.' },
    { emoji: '✅', title: 'Improve Access & Compliance', body: 'Better experience for users, better data for you.' },
];

const USE_CASES = [
    { emoji: '🏥', title: 'Hospitals', body: 'Reduce patient stress with guaranteed accessible parking visibility.' },
    { emoji: '🩺', title: 'Medical Centers', body: 'Streamline parking for patients with mobility needs.' },
    { emoji: '🏛️', title: 'Municipal Buildings', body: 'Meet ADA mandates with modern infrastructure.' },
    { emoji: '🎓', title: 'Universities', body: 'Serve students and visitors across sprawling campuses.' },
    { emoji: '✈️', title: 'Airports', body: 'High-traffic facilities with constant accessible parking demand.' },
];

const BENEFITS = [
    'Reduce parking frustration for people with disabilities',
    'Improve the ADA accessibility experience',
    'Gain data-driven insight into parking utilization',
    'Demonstrate your commitment to inclusion',
    'Modernize facility infrastructure with IoT',
];

const FACILITY_TYPES = [
    'Hospital',
    'Medical Center',
    'Municipal Building',
    'University',
    'Airport',
    'Corporate Campus',
    'Other',
];

/* ──────────────────────────────────────────────
 * Main Component
 * ────────────────────────────────────────────── */

export default function LandingScreen() {
    const { isMobile } = useResponsive();
    const login = useAuthStore((s) => s.login);
    const [isLoading, setIsLoading] = useState(false);

    // Demo form state
    const [form, setForm] = useState({
        name: '',
        title: '',
        organization: '',
        email: '',
        phone: '',
        facilityType: '',
    });
    const [formSubmitted, setFormSubmitted] = useState(false);
    const [facilityOpen, setFacilityOpen] = useState(false);

    const handleLogin = useCallback(async () => {
        setIsLoading(true);
        try {
            await login();
        } catch (error) {
            console.error('Login error:', error);
        } finally {
            setIsLoading(false);
        }
    }, [login]);

    const scrollToDemo = useCallback(() => {
        // simple web anchor fallback – works on web
        if (Platform.OS === 'web') {
            const el = document.getElementById('demo-section');
            el?.scrollIntoView({ behavior: 'smooth' });
        }
    }, []);

    const handleSubmitDemo = useCallback(() => {
        if (!form.name || !form.email || !form.organization) return;
        // In production, POST to backend
        console.log('[Demo Request]', form);
        setFormSubmitted(true);
    }, [form]);

    const updateField = (field: keyof typeof form) => (value: string) =>
        setForm((prev) => ({ ...prev, [field]: value }));

    return (
        <ScrollView style={s.root} contentContainerStyle={s.rootContent}>
            {/* ───── Header ───── */}
            <View style={s.header}>
                <View style={s.headerInner}>
                    <View style={s.headerBrand}>
                        <Text style={{ fontSize: 24 }}>♿</Text>
                        <Text style={s.headerTitle}>Hazard Hero</Text>
                    </View>
                    <Pressable
                        onPress={handleLogin}
                        disabled={isLoading}
                        style={({ pressed }) => [s.headerLoginBtn, pressed && { opacity: 0.85 }]}
                    >
                        {isLoading ? (
                            <ActivityIndicator color={colors.ctaPrimaryText} size="small" />
                        ) : (
                            <Text style={s.headerLoginText}>LOG IN</Text>
                        )}
                    </Pressable>
                </View>
            </View>

            {/* ───── 1. Hero ───── */}
            <View style={[s.hero]}>
                <View style={s.sectionInner}>
                    <View style={[s.heroInner, !isMobile && s.heroInnerRow]}>
                        <View style={[s.heroText, !isMobile && { flex: 1 }]}>
                            <Text style={[typography.label, { color: colors.primary, marginBottom: spacing.sm }]}>
                                HAZARD HERO
                            </Text>
                            <Text style={[typography.h1, { color: colors.heroText }]} accessibilityRole="header">
                                Smarter Accessible Parking Starts Here
                            </Text>
                            <Text style={[typography.bodyLarge, { color: colors.textSecondary, marginTop: spacing.md }]}>
                                Real-time handicap parking visibility for hospitals, campuses, and public facilities.
                            </Text>
                            <View style={[s.heroCTARow, isMobile && { flexDirection: 'column' }]}>
                                <CTAButton label="Request a Demo" onPress={scrollToDemo} />
                                <CTAButton label="See How It Works" onPress={handleLogin} variant="outline" loading={isLoading} />
                            </View>
                            <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.md }]}>
                                Built for healthcare facilities and public infrastructure
                            </Text>
                        </View>
                        {!isMobile && (
                            <View style={s.heroImagePlaceholder}>
                                <View style={s.heroMockup}>
                                    <Text style={{ fontSize: 64 }}>♿</Text>
                                    <View style={s.heroMockupIndicator}>
                                        <View style={s.heroMockupDot} />
                                        <Text style={[typography.h4, { color: colors.white }]}>AVAILABLE</Text>
                                    </View>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </View>

            {/* ───── 2. Problem ───── */}
            <SectionContainer background={colors.grayLight}>
                <SectionHeading>The Problem with Accessible Parking Today</SectionHeading>
                <View style={[s.cardRow, isMobile && s.cardRowMobile]}>
                    {PROBLEMS.map((p) => (
                        <View key={p.title} style={[s.card, isMobile && s.cardMobile]}>
                            <IconCircle emoji={p.emoji} />
                            <Text style={[typography.h4, s.cardTitle]}>{p.title}</Text>
                            <Text style={[typography.body, { color: colors.textSecondary }]}>{p.body}</Text>
                        </View>
                    ))}
                </View>
            </SectionContainer>

            {/* ───── 3. Solution ───── */}
            <SectionContainer>
                <SectionHeading>A Smarter Way to Manage Accessible Parking</SectionHeading>
                <View style={[s.solutionRow, isMobile && { flexDirection: 'column' }]}>
                    <View style={[s.solutionImage, isMobile && { marginBottom: spacing.lg }]}>
                        <View style={s.solutionDiagram}>
                            <Text style={{ fontSize: 48 }}>♿</Text>
                            <Text style={[typography.h3, { color: colors.primary, marginTop: spacing.sm }]}>
                                Smart Sign
                            </Text>
                            <View style={s.solutionDiagramRow}>
                                <View style={[s.solutionDot, { backgroundColor: colors.primary }]} />
                                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Sensor</Text>
                                <View style={s.solutionLine} />
                                <View style={[s.solutionDot, { backgroundColor: colors.primary }]} />
                                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Dashboard</Text>
                            </View>
                        </View>
                    </View>
                    <View style={[s.solutionFeatures, isMobile && { flex: 0 }]}>
                        {FEATURES.map((f) => (
                            <View key={f} style={s.featureRow}>
                                <Text style={[typography.body, { color: colors.primary }]}>✓</Text>
                                <Text style={[typography.body, { color: colors.textPrimary, marginLeft: spacing.sm, flex: 1 }]}>
                                    {f}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>
            </SectionContainer>

            {/* ───── 4. How It Works ───── */}
            <SectionContainer background={colors.grayLight}>
                <SectionHeading>Simple. Smart. Effective.</SectionHeading>
                <View style={[s.cardRow, isMobile && s.cardRowMobile]}>
                    {STEPS.map((step, i) => (
                        <View key={step.title} style={[s.card, isMobile && s.cardMobile]}>
                            <View style={s.stepNumber}>
                                <Text style={[typography.h4, { color: colors.white }]}>{i + 1}</Text>
                            </View>
                            <IconCircle emoji={step.emoji} />
                            <Text style={[typography.h4, s.cardTitle]}>{step.title}</Text>
                            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
                                {step.body}
                            </Text>
                        </View>
                    ))}
                </View>
            </SectionContainer>

            {/* ───── 5. Use Cases ───── */}
            <SectionContainer>
                <SectionHeading>Built for Facilities That Serve the Public</SectionHeading>
                <View style={[s.useCaseGrid, isMobile && s.useCaseGridMobile]}>
                    {USE_CASES.map((uc) => (
                        <View key={uc.title} style={[s.useCaseCard, isMobile && s.useCaseCardMobile]}>
                            <Text style={{ fontSize: 36, marginBottom: spacing.sm }}>{uc.emoji}</Text>
                            <Text style={[typography.h4, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
                                {uc.title}
                            </Text>
                            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{uc.body}</Text>
                        </View>
                    ))}
                </View>
            </SectionContainer>

            {/* ───── 6. Benefits ───── */}
            <SectionContainer background={colors.grayLight}>
                <SectionHeading>Why Facilities Choose Hazard Hero</SectionHeading>
                <View style={s.benefitsList}>
                    {BENEFITS.map((b) => (
                        <View key={b} style={s.benefitRow}>
                            <View style={s.benefitBullet} />
                            <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{b}</Text>
                        </View>
                    ))}
                </View>
            </SectionContainer>

            {/* ───── 7. Demo / Lead Capture ───── */}
            <View nativeID="demo-section">
                <SectionContainer background={colors.heroBackground} style={{ paddingVertical: spacing.section }}>
                    <SectionHeading light>See It in Action at Your Facility</SectionHeading>
                    <Text
                        style={[
                            typography.bodyLarge,
                            { color: colors.textSecondary, textAlign: 'center', maxWidth: 560, alignSelf: 'center', marginBottom: spacing.xl },
                        ]}
                    >
                        We're currently partnering with hospitals and public facilities to pilot and gather feedback.
                    </Text>

                    {formSubmitted ? (
                        <View style={s.formSuccess}>
                            <Text style={{ fontSize: 40 }}>🎉</Text>
                            <Text style={[typography.h3, { color: colors.white, marginTop: spacing.md }]}>
                                Thank you!
                            </Text>
                            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
                                We'll be in touch soon to schedule your demo.
                            </Text>
                        </View>
                    ) : (
                        <View style={[s.formContainer, isMobile && { maxWidth: '100%' as any }]}>
                            <View style={[s.formRow, isMobile && { flexDirection: 'column' }]}>
                                <FormField label="Name *" value={form.name} onChangeText={updateField('name')} placeholder="Jane Smith" />
                                <FormField label="Title" value={form.title} onChangeText={updateField('title')} placeholder="Facilities Director" />
                            </View>
                            <View style={[s.formRow, isMobile && { flexDirection: 'column' }]}>
                                <FormField label="Organization *" value={form.organization} onChangeText={updateField('organization')} placeholder="City General Hospital" />
                                <FormField label="Email *" value={form.email} onChangeText={updateField('email')} placeholder="jane@hospital.org" keyboardType="email-address" />
                            </View>
                            <View style={[s.formRow, isMobile && { flexDirection: 'column' }]}>
                                <FormField label="Phone" value={form.phone} onChangeText={updateField('phone')} placeholder="(555) 123-4567" keyboardType="phone-pad" />
                                <View style={[s.formFieldWrap]}>
                                    <Text style={[typography.bodySmall, s.formLabel]}>Facility Type</Text>
                                    <Pressable
                                        style={[s.formInput, s.formSelect]}
                                        onPress={() => setFacilityOpen(!facilityOpen)}
                                        accessibilityRole="button"
                                        accessibilityLabel="Select facility type"
                                    >
                                        <Text style={[typography.body, { color: form.facilityType ? colors.textPrimary : colors.textMuted }]}>
                                            {form.facilityType || 'Select…'}
                                        </Text>
                                        <Text style={{ color: colors.textMuted }}>▾</Text>
                                    </Pressable>
                                    {facilityOpen && (
                                        <View style={s.formDropdown}>
                                            {FACILITY_TYPES.map((ft) => (
                                                <Pressable
                                                    key={ft}
                                                    style={s.formDropdownItem}
                                                    onPress={() => {
                                                        updateField('facilityType')(ft);
                                                        setFacilityOpen(false);
                                                    }}
                                                >
                                                    <Text style={[typography.body, { color: colors.textPrimary }]}>{ft}</Text>
                                                </Pressable>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </View>
                            <CTAButton label="Schedule a Demo" onPress={handleSubmitDemo} />
                        </View>
                    )}
                </SectionContainer>
            </View>

            {/* ───── 8. Footer ───── */}
            <View style={s.footer}>
                <View style={s.sectionInner}>
                    <View style={[s.footerInner, isMobile && { flexDirection: 'column', alignItems: 'center' }]}>
                        <View style={[s.footerBrand, isMobile && { alignItems: 'center', marginBottom: spacing.lg }]}>
                            <Text style={[typography.h4, { color: colors.white }]}>♿ Hazard Hero</Text>
                            <Text style={[typography.bodySmall, { color: colors.footerText, marginTop: spacing.xs }]}>
                                Smarter parking. Better access.
                            </Text>
                        </View>
                        <View style={[s.footerLinks, isMobile && { alignItems: 'center' }]}>
                            <Pressable onPress={() => Linking.openURL('mailto:hello@hazardhero.com')}>
                                <Text style={[typography.bodySmall, s.footerLink]}>hello@hazardhero.com</Text>
                            </Pressable>
                            <Pressable onPress={() => Linking.openURL('tel:+15551234567')}>
                                <Text style={[typography.bodySmall, s.footerLink]}>(555) 123-4567</Text>
                            </Pressable>
                            <Text style={[typography.bodySmall, { color: colors.footerText }]}>Privacy Policy</Text>
                        </View>
                    </View>
                    <View style={s.footerDivider} />
                    <Text style={[typography.bodySmall, { color: colors.textMuted, textAlign: 'center' }]}>
                        © {new Date().getFullYear()} Hazard Hero. All rights reserved.
                    </Text>
                </View>
            </View>
        </ScrollView>
    );
}

/* ──────────────────────────────────────────────
 * Form Field Component
 * ────────────────────────────────────────────── */

interface FormFieldProps {
    label: string;
    value: string;
    onChangeText: (v: string) => void;
    placeholder?: string;
    keyboardType?: 'default' | 'email-address' | 'phone-pad';
}

function FormField({ label, value, onChangeText, placeholder, keyboardType = 'default' }: FormFieldProps) {
    return (
        <View style={s.formFieldWrap}>
            <Text style={[typography.bodySmall, s.formLabel]}>{label}</Text>
            <TextInput
                style={[s.formInput, typography.body]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.textMuted}
                keyboardType={keyboardType}
                autoCapitalize="none"
                accessibilityLabel={label}
            />
        </View>
    );
}

/* ──────────────────────────────────────────────
 * Styles
 * ────────────────────────────────────────────── */

const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: colors.grayLight,
    },
    rootContent: {
        flexGrow: 1,
    },

    /* ── Header ── */
    header: {
        backgroundColor: colors.offWhite,
        paddingVertical: 12,
        paddingHorizontal: spacing.contentPadding,
        ...(Platform.OS === 'web' ? { position: 'sticky' as any, top: 0, zIndex: 100 } : {}),
    },
    headerInner: {
        maxWidth: layout.maxWidth,
        width: '100%',
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerBrand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerTitle: {
        ...typography.h3,
        color: colors.textPrimary,
    },
    headerLoginBtn: {
        backgroundColor: colors.ctaPrimary,
        paddingVertical: 8,
        paddingHorizontal: 24,
        borderRadius: 9999,
    },
    headerLoginText: {
        ...typography.button,
        color: colors.ctaPrimaryText,
    },

    /* Section wrapper */
    section: {
        paddingVertical: spacing.section,
        paddingHorizontal: spacing.contentPadding,
    },
    sectionInner: {
        maxWidth: layout.maxWidth,
        width: '100%',
        alignSelf: 'center',
    },
    sectionHeading: {
        textAlign: 'center',
        marginBottom: spacing.xl,
    },

    /* ── Hero ── */
    hero: {
        backgroundColor: colors.grayLight,
        paddingVertical: spacing.section + 20,
        paddingHorizontal: spacing.contentPadding,
    },
    heroInner: {
        alignItems: 'center',
    },
    heroInnerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xxxl,
    },
    heroText: {
        maxWidth: 560,
    },
    heroCTARow: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.xl,
    },
    heroImagePlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroMockup: {
        width: 280,
        height: 340,
        backgroundColor: colors.card,
        borderRadius: layout.borderRadiusLg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: colors.borderSubtle,
    },
    heroMockupIndicator: {
        marginTop: spacing.lg,
        backgroundColor: 'rgba(24,119,242,0.12)',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: layout.borderRadiusSm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    heroMockupDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#4ADE80',
    },

    /* ── CTA Buttons ── */
    ctaButton: {
        paddingHorizontal: spacing.xl,
        paddingVertical: 14,
        borderRadius: layout.borderRadiusPill,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 180,
    },
    ctaPrimary: {
        backgroundColor: colors.ctaPrimary,
    },
    ctaOutline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },

    /* ── Cards ── */
    cardRow: {
        flexDirection: 'row',
        gap: spacing.lg,
    },
    cardRowMobile: {
        flexDirection: 'column',
    },
    card: {
        flex: 1,
        backgroundColor: colors.card,
        borderRadius: layout.borderRadius,
        padding: spacing.xl,
        alignItems: 'center',
        ...Platform.select({
            web: {
                boxShadow: '0px 8px 8px rgba(0,0,0,0.3)',
            },
            default: {
                elevation: 4,
            },
        }),
    },
    cardMobile: {
        flex: 0,
    },
    cardTitle: {
        color: colors.textPrimary,
        marginTop: spacing.md,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },

    iconCircle: {
        backgroundColor: colors.grayMid,
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* ── Steps ── */
    stepNumber: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(24,119,242,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
    },

    /* ── Solution ── */
    solutionRow: {
        flexDirection: 'row',
        gap: spacing.xxxl,
        alignItems: 'center',
    },
    solutionImage: {
        flex: 1,
        alignItems: 'center',
    },
    solutionDiagram: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: colors.card,
        borderRadius: layout.borderRadiusLg,
        padding: spacing.xl,
        alignItems: 'center',
        ...Platform.select({
            web: {
                boxShadow: '0px 8px 24px rgba(0,0,0,0.5)',
            },
            default: {
                elevation: 8,
            },
        }),
    },
    solutionDiagramRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.lg,
    },
    solutionDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    solutionLine: {
        height: 2,
        width: 40,
        backgroundColor: colors.grayMid,
    },
    solutionFeatures: {
        flex: 1,
        gap: spacing.md,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
    },

    /* ── Use Cases ── */
    useCaseGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.lg,
        justifyContent: 'center',
    },
    useCaseGridMobile: {
        flexDirection: 'column',
    },
    useCaseCard: {
        width: '30%',
        minWidth: 200,
        backgroundColor: colors.card,
        borderRadius: layout.borderRadius,
        padding: spacing.xl,
        ...Platform.select({
            web: {
                boxShadow: '0px 8px 8px rgba(0,0,0,0.3)',
            },
            default: {
                elevation: 4,
            },
        }),
    },
    useCaseCardMobile: {
        width: '100%',
    },

    /* ── Benefits ── */
    benefitsList: {
        maxWidth: 560,
        alignSelf: 'center',
        gap: spacing.md,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    benefitBullet: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary,
    },

    /* ── Form ── */
    formContainer: {
        maxWidth: 600,
        width: '100%',
        alignSelf: 'center',
        gap: spacing.md,
    },
    formRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    formFieldWrap: {
        flex: 1,
        minWidth: 200,
    },
    formLabel: {
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    formInput: {
        backgroundColor: colors.grayMid,
        borderRadius: layout.borderRadiusLg,
        paddingHorizontal: spacing.md,
        paddingVertical: 12,
        color: colors.white,
        fontSize: 16,
    },
    formSelect: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    formDropdown: {
        position: 'absolute',
        top: 70,
        left: 0,
        right: 0,
        backgroundColor: colors.grayMid,
        borderRadius: layout.borderRadius,
        zIndex: 10,
        ...Platform.select({
            web: {
                boxShadow: '0px 8px 24px rgba(0,0,0,0.5)',
            },
            default: {
                elevation: 8,
            },
        }),
    },
    formDropdownItem: {
        paddingHorizontal: spacing.md,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
    },
    formSuccess: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },

    /* ── Footer ── */
    footer: {
        backgroundColor: colors.footerBackground,
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.contentPadding,
    },
    footerInner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    footerBrand: {},
    footerLinks: {
        gap: spacing.sm,
    },
    footerLink: {
        color: colors.footerText,
    },
    footerDivider: {
        height: 1,
        backgroundColor: colors.divider,
        marginVertical: spacing.lg,
    },
});