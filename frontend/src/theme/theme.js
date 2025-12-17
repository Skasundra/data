import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#6366f1', // Indigo 500
            light: '#818cf8',
            dark: '#4338ca',
            contrastText: '#ffffff',
        },
        secondary: {
            main: '#ec4899', // Pink 500
            light: '#f472b6',
            dark: '#db2777',
            contrastText: '#ffffff',
        },
        background: {
            default: '#0f172a', // Slate 900
            paper: 'rgba(30, 41, 59, 0.7)', // Slate 800 with opacity for glassmorphism
        },
        text: {
            primary: '#f1f5f9', // Slate 100
            secondary: '#94a3b8', // Slate 400
        },
        action: {
            hover: 'rgba(255, 255, 255, 0.08)',
        }
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        h1: {
            fontWeight: 700,
            fontSize: '2.5rem',
            letterSpacing: '-0.02em',
            background: 'linear-gradient(45deg, #6366f1 30%, #ec4899 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
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
            textTransform: 'none', // Remove uppercase default
            fontWeight: 600,
        },
    },
    shape: {
        borderRadius: 16, // More rounded corners
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    backgroundImage: 'radial-gradient(circle at 15% 50%, rgba(99, 102, 241, 0.15), transparent 25%), radial-gradient(circle at 85% 30%, rgba(236, 72, 153, 0.15), transparent 25%)',
                    backgroundAttachment: 'fixed',
                    scrollbarColor: '#475569 #0f172a',
                    '&::-webkit-scrollbar': {
                        width: '8px',
                    },
                    '&::-webkit-scrollbar-track': {
                        background: '#0f172a',
                    },
                    '&::-webkit-scrollbar-thumb': {
                        backgroundColor: '#475569',
                        borderRadius: '4px',
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backdropFilter: 'blur(12px)', // Glassmorphism
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    padding: '10px 24px',
                    boxShadow: 'none',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    },
                },
                containedPrimary: {
                    background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
                    }
                },
                containedSecondary: {
                    background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                }
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        transition: 'all 0.2s',
                        '&:hover fieldset': {
                            borderColor: '#818cf8',
                        },
                        '&.Mui-focused fieldset': {
                            borderColor: '#6366f1',
                            borderWidth: '2px',
                        },
                    }
                }
            }
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                },
                head: {
                    fontWeight: 600,
                    color: '#94a3b8',
                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                }
            }
        }
    },
});

export default theme;
