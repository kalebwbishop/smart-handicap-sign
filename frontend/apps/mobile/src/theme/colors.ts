/**
 * Hazard Hero – Design System Colors
 *
 * Apple-inspired palette: light neutral canvases, restrained blue accents,
 * near-black ink for text, and purposeful surface stepping.
 * See DESIGN.md for full specification.
 */

export const colors = {
  /** Brand – Apple Action Blue */
  primary: '#0071e3',
  primaryLight: '#2997ff',

  /** Accent – action & link semantics only */
  accent: '#0071e3',
  accentHover: '#0066cc',

  /** Surfaces */
  white: '#ffffff',
  offWhite: '#f5f5f7',         // Pale Apple Gray – main light surface
  grayLight: '#f5f5f7',        // Level 0 base background
  grayMid: '#ffffff',           // Interactive surfaces, card backgrounds
  grayDark: '#86868b',          // Mid Border Gray

  /** Text on light */
  textPrimary: '#1d1d1f',      // Near-Black Ink
  textSecondary: '#6e6e73',    // Secondary Neutral Gray
  textMuted: '#86868b',        // Mid-tone muted text

  /** CTA */
  ctaPrimary: '#0071e3',       // Apple Action Blue
  ctaPrimaryText: '#ffffff',
  ctaSecondary: '#1d1d1f',     // Dark fill action
  ctaSecondaryText: '#ffffff',

  /** Sections */
  heroBackground: '#000000',   // Absolute Black
  heroText: '#ffffff',
  sectionAlt: '#f5f5f7',       // Pale Apple Gray
  footerBackground: '#f5f5f7',
  footerText: '#6e6e73',

  /** Semantic */
  negative: '#ff3b30',
  warning: '#ff9500',
  announcement: '#2997ff',

  /** Borders & misc */
  divider: '#d2d2d7',          // Soft Border Gray
  borderSubtle: '#d2d2d7',
  shadow: 'rgba(0,0,0,0.08)',
  shadowMedium: 'rgba(0,0,0,0.04)',

  /** Card surface */
  card: '#ffffff',

  /** Dark surfaces (for dark-context modules) */
  graphiteA: '#272729',
  graphiteB: '#262629',
  graphiteC: '#28282b',
  graphiteD: '#2a2a2c',

  /** Utility */
  utilityDarkGray: '#424245',
} as const;
