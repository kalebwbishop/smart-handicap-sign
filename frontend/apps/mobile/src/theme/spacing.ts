/**
 * Hazard Hero – Spacing & Layout Constants
 *
 * Apple-inspired: 8px base unit, purposeful radius tiers (5→8→16→28→56→pill),
 * restrained shadows, and contrast-led separation.
 * See DESIGN.md §5 for full specification.
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
  section: 80,
  contentPadding: 24,
} as const;

export const layout = {
  maxWidth: 980,
  contentPadding: 24,
  /** Tiny utility – tags, small shells */
  borderRadiusXs: 5,
  /** Standard controls, compact fields – 8-12px */
  borderRadiusSm: 8,
  borderRadius: 12,
  /** Cards, module frames – 16-18px */
  borderRadiusMd: 16,
  borderRadiusLg: 18,
  /** Spotlight containers – 28-36px */
  borderRadiusXl: 28,
  /** Capsule/pill CTA */
  borderRadiusPill: 980,
  /** Circle for media/selection controls */
  borderRadiusCircle: 9999,
} as const;

export const shadows = {
  /** Level 2 – highlighted cards, elevated modules */
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  /** Level 2 stronger – dialogs, menus */
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
} as const;
