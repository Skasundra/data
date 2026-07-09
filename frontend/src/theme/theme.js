import { createTheme, alpha } from '@mui/material/styles';

// ─── Design Tokens ──────────────────────────────────────────────────────────
const tokens = {
  primary: '#4F46E5',
  primaryLight: '#6366F1',
  primaryDark: '#4338CA',
  primaryGhost: 'rgba(79, 70, 229, 0.08)',

  sidebar: '#0f172a',
  sidebarHover: '#1e293b',
  sidebarActive: 'rgba(79, 70, 229, 0.12)',
  sidebarText: '#94a3b8',
  sidebarTextActive: '#ffffff',

  bg: '#f9fafb',
  card: '#ffffff',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',

  text: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',

  success: '#059669',
  successBg: '#ecfdf5',
  successBorder: '#a7f3d0',
  warning: '#d97706',
  warningBg: '#fffbeb',
  warningBorder: '#fde68a',
  error: '#dc2626',
  errorBg: '#fef2f2',
  errorBorder: '#fecaca',
  info: '#2563eb',
  infoBg: '#eff6ff',
  infoBorder: '#bfdbfe',
};

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: tokens.primary,
      light: tokens.primaryLight,
      dark: tokens.primaryDark,
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#6b7280',
      light: '#9ca3af',
      dark: '#4b5563',
      contrastText: '#ffffff',
    },
    success: {
      main: tokens.success,
      light: tokens.successBg,
      dark: '#047857',
    },
    warning: {
      main: tokens.warning,
      light: tokens.warningBg,
      dark: '#b45309',
    },
    error: {
      main: tokens.error,
      light: tokens.errorBg,
      dark: '#b91c1c',
    },
    info: {
      main: tokens.info,
      light: tokens.infoBg,
      dark: '#1d4ed8',
    },
    background: {
      default: tokens.bg,
      paper: tokens.card,
    },
    text: {
      primary: tokens.text,
      secondary: tokens.textSecondary,
      disabled: tokens.textMuted,
    },
    divider: tokens.border,
    action: {
      hover: alpha(tokens.primary, 0.04),
      selected: alpha(tokens.primary, 0.08),
      focus: alpha(tokens.primary, 0.12),
    },
  },

  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: { fontWeight: 800, fontSize: '2rem', letterSpacing: '-0.025em', color: tokens.text, lineHeight: 1.2 },
    h2: { fontWeight: 700, fontSize: '1.5rem', letterSpacing: '-0.02em', color: tokens.text, lineHeight: 1.3 },
    h3: { fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.015em', color: tokens.text, lineHeight: 1.3 },
    h4: { fontWeight: 600, fontSize: '1.125rem', letterSpacing: '-0.01em', color: tokens.text, lineHeight: 1.4 },
    h5: { fontWeight: 600, fontSize: '1rem', color: tokens.text, lineHeight: 1.4 },
    h6: { fontWeight: 600, fontSize: '0.875rem', color: tokens.text, lineHeight: 1.5 },
    subtitle1: { fontWeight: 500, fontSize: '0.9375rem', color: tokens.textSecondary },
    subtitle2: { fontWeight: 600, fontSize: '0.8125rem', color: tokens.textSecondary, letterSpacing: '0.02em', textTransform: 'uppercase' },
    body1: { fontSize: '0.9375rem', color: tokens.text, lineHeight: 1.6 },
    body2: { fontSize: '0.8125rem', color: tokens.textSecondary, lineHeight: 1.6 },
    caption: { fontSize: '0.75rem', color: tokens.textMuted, lineHeight: 1.5 },
    button: { textTransform: 'none', fontWeight: 600, fontSize: '0.8125rem' },
    overline: { textTransform: 'uppercase', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', color: tokens.textMuted },
  },

  shape: { borderRadius: 10 },

  shadows: [
    'none',
    '0 1px 2px 0 rgba(0,0,0,0.05)',
    '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.06)',
    '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)',
    '0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -4px rgba(0,0,0,0.05)',
    '0 20px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05)',
    '0 25px 50px -12px rgba(0,0,0,0.12)',
    ...Array(18).fill('none'),
  ],

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
        '@keyframes slideUp': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
        body: {
          background: tokens.bg,
          scrollbarColor: `${tokens.border} transparent`,
          '&::-webkit-scrollbar': { width: 6, height: 6 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { backgroundColor: '#d1d5db', borderRadius: 3 },
        },
      },
    },

    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${tokens.border}`,
          transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 18px',
          fontWeight: 600,
          fontSize: '0.8125rem',
          boxShadow: 'none',
          transition: 'all 0.15s ease',
          '&:hover': { boxShadow: 'none' },
        },
        containedPrimary: {
          background: tokens.primary,
          '&:hover': { background: tokens.primaryDark, transform: 'translateY(-1px)', boxShadow: `0 4px 12px ${alpha(tokens.primary, 0.3)}` },
        },
        outlinedPrimary: {
          borderColor: alpha(tokens.primary, 0.3),
          color: tokens.primary,
          '&:hover': { borderColor: tokens.primary, background: alpha(tokens.primary, 0.04) },
        },
        text: {
          '&:hover': { background: alpha(tokens.primary, 0.04) },
        },
      },
    },

    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            fontSize: '0.875rem',
            transition: 'all 0.15s ease',
            '& fieldset': { borderColor: tokens.border },
            '&:hover fieldset': { borderColor: '#d1d5db' },
            '&.Mui-focused fieldset': { borderColor: tokens.primary, borderWidth: 2 },
          },
          '& .MuiInputLabel-root': { fontSize: '0.8125rem', fontWeight: 500, color: tokens.textSecondary },
          '& .MuiInputLabel-root.Mui-focused': { color: tokens.primary },
        },
      },
    },

    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.border },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#d1d5db' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: tokens.primary },
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, fontSize: '0.75rem', borderRadius: 6 },
        colorPrimary: { background: alpha(tokens.primary, 0.08), color: tokens.primary, border: `1px solid ${alpha(tokens.primary, 0.2)}` },
        colorSuccess: { background: tokens.successBg, color: tokens.success, border: `1px solid ${tokens.successBorder}` },
        colorWarning: { background: tokens.warningBg, color: tokens.warning, border: `1px solid ${tokens.warningBorder}` },
        colorError: { background: tokens.errorBg, color: tokens.error, border: `1px solid ${tokens.errorBorder}` },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${tokens.borderLight}`, padding: '12px 16px', fontSize: '0.8125rem' },
        head: { fontWeight: 600, color: tokens.textSecondary, backgroundColor: '#f9fafb', fontSize: '0.75rem', letterSpacing: '0.02em', textTransform: 'uppercase' },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.1s ease',
          '&:hover': { backgroundColor: '#f9fafb' },
        },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 8, fontSize: '0.8125rem', fontWeight: 500 },
        standardSuccess: { background: tokens.successBg, border: `1px solid ${tokens.successBorder}`, color: '#065f46' },
        standardError: { background: tokens.errorBg, border: `1px solid ${tokens.errorBorder}`, color: '#991b1b' },
        standardWarning: { background: tokens.warningBg, border: `1px solid ${tokens.warningBorder}`, color: '#92400e' },
        standardInfo: { background: tokens.infoBg, border: `1px solid ${tokens.infoBorder}`, color: '#1e40af' },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 12, border: `1px solid ${tokens.border}` },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: tokens.sidebar, fontSize: '0.75rem', fontWeight: 500, borderRadius: 6, padding: '6px 12px' },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, height: 4, backgroundColor: alpha(tokens.primary, 0.1) },
        bar: { borderRadius: 4, backgroundColor: tokens.primary },
      },
    },

    MuiTabs: {
      styleOverrides: {
        indicator: { backgroundColor: tokens.primary, height: 2, borderRadius: '2px 2px 0 0' },
      },
    },

    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 500, fontSize: '0.8125rem', minHeight: 44, '&.Mui-selected': { fontWeight: 600, color: tokens.primary } },
      },
    },

    MuiAccordion: {
      styleOverrides: {
        root: { borderRadius: '8px !important', border: `1px solid ${tokens.border}`, '&:before': { display: 'none' }, '&.Mui-expanded': { margin: 0 } },
      },
    },
  },
});

export { tokens };
export default theme;
