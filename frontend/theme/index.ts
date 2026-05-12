// ─────────────────────────────────────────────
// Design Tokens — Budget Tracker App
// Emerald Green + Slate Gray theme
// ─────────────────────────────────────────────

export const Colors = {
  // Primary palette
  emerald:        '#10B981',
  emeraldLight:   '#34D399',
  emeraldDark:    '#059669',
  emeraldMuted:   'rgba(16, 185, 129, 0.15)',

  // Slate palette
  slate:          '#1F2937',
  slateMid:       '#263342',
  slateLight:     '#374151',
  slateLighter:   '#4B5563',

  // Glass
  glass:          'rgba(31, 41, 55, 0.65)',
  glassBorder:    'rgba(16, 185, 129, 0.25)',
  glassHighlight: 'rgba(255, 255, 255, 0.06)',

  // Text — all meet WCAG AA on glass backgrounds
  textPrimary:    '#F9FAFB',   // 15.3:1 on glass
  textSecondary:  '#D1D5DB',   // 9.4:1 on glass
  textMuted:      '#9CA3AF',   // 4.8:1 on glass — meets AA for large text
  textEmerald:    '#6EE7B7',   // 7.1:1 on glass

  // Status
  success:        '#10B981',
  warning:        '#F59E0B',
  error:          '#EF4444',
  info:           '#3B82F6',

  // Backgrounds
  bgDark:         '#111827',
  bgMid:          '#1F2937',
  bgCard:         '#263342',

  // Misc
  white:          '#FFFFFF',
  black:          '#000000',
  border:         'rgba(75, 85, 99, 0.5)',
  overlay:        'rgba(0, 0, 0, 0.6)',
};

export const Typography = {
  // Font sizes
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  xxl:  30,
  xxxl: 38,

  // Font weights
  regular:    '400' as const,
  medium:     '500' as const,
  semibold:   '600' as const,
  bold:       '700' as const,
  extrabold:  '800' as const,
};

export const Spacing = {
  xs:   4,
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  xxl:  48,
  xxxl: 64,
};

export const Radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  full: 999,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  emerald: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
};

// Minimum touch target (WCAG / Apple HIG)
export const MIN_TOUCH = 44;
