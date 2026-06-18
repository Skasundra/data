import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: '#111111',
            light: '#333333',
            dark: '#000000',
            contrastText: '#ffffff',
        },
        secondary: {
            main: '#444444',
            light: '#666666',
            dark: '#222222',
            contrastText: '#ffffff',
        },
        background: {
            default: '#f8f8f8',
            paper: '#ffffff',
        },
        text: {
            primary: '#111111',
            secondary: '#6b7280',
        },
        action: {
            hover: 'rgba(0, 0, 0, 0.04)',
            selected: 'rgba(0, 0, 0, 0.08)',
        },
        divider: '#e5e5e5',
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        h1: {
            fontWeight: 700,
            fontSize: '2.5rem',
            letterSpacing: '-0.02em',
            color: '#111111',
        },
        h2: {
            fontWeight: 600,
            letterSpacing: '-0.01em',
        },
        h4: {
            fontWeight: 600,
            letterSpacing: '0.02em',
        },
        h6: {
            fontWeight: 600,
        },
        button: {
            textTransform: 'none',
            fontWeight: 600,
        },
    },
    shape: {
        borderRadius: 12,
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    background: '#f8f8f8',
                    scrollbarColor: '#d1d5db #f8f8f8',
                    '&::-webkit-scrollbar': {
                        width: '8px',
                    },
                    '&::-webkit-scrollbar-track': {
                        background: '#f8f8f8',
                    },
                    '&::-webkit-scrollbar-thumb': {
                        backgroundColor: '#d1d5db',
                        borderRadius: '4px',
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    border: '1px solid #e5e5e5',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 10,
                    padding: '10px 24px',
                    boxShadow: 'none',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    },
                },
                containedPrimary: {
                    background: '#111111',
                    '&:hover': {
                        background: '#333333',
                    }
                },
                containedSecondary: {
                    background: '#444444',
                }
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        transition: 'all 0.2s',
                        '&:hover fieldset': {
                            borderColor: '#999999',
                        },
                        '&.Mui-focused fieldset': {
                            borderColor: '#111111',
                            borderWidth: '2px',
                        },
                    }
                }
            }
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    borderBottom: '1px solid #f0f0f0',
                },
                head: {
                    fontWeight: 600,
                    color: '#6b7280',
                    backgroundColor: '#fafafa',
                }
            }
        }
    },
});

export default theme;
