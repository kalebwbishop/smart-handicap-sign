/**
 * Smart Handicap Sign – Design System Colors
 *
 * Palette: Deep blue, white, light gray with accessible green accent.
 * All color pairs meet WCAG AA contrast requirements.
 */

export const colors = {
  /** Primary brand – deep blue */
  primary: '#0F2B46',
  primaryLight: '#1A3D5C',

  /** Accent – accessible green (4.58:1 on white, passes AA-large) */
  accent: '#1A7F37',
  accentHover: '#15692D',

  /** Neutrals */
  white: '#FFFFFF',
  offWhite: '#F7F8FA',
  grayLight: '#F0F2F5',
  grayMid: '#D1D5DB',
  grayDark: '#6B7280',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',

  /** Semantic */
  ctaPrimary: '#1A7F37',
  ctaPrimaryText: '#FFFFFF',
  ctaSecondary: '#0F2B46',
  ctaSecondaryText: '#0F2B46',

  /** Section backgrounds */
  heroBackground: '#0F2B46',
  heroText: '#FFFFFF',
  sectionAlt: '#F0F2F5',
  footerBackground: '#0B1D30',
  footerText: '#D1D5DB',

  /** Misc */
  divider: '#E5E7EB',
  shadow: 'rgba(0,0,0,0.08)',
} as const;
