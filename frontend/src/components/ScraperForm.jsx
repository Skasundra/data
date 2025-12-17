import { useState } from 'react';
import { Box, TextField, Button, Paper, Typography, CircularProgress, Alert, alpha, Chip, FormControlLabel, Checkbox } from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import * as Icons from '@mui/icons-material';
import { scrapeData } from '../services/api';

const ScraperForm = ({ scraper, onResultsReceived }) => {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleCheckboxChange = (fieldName, checked) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: checked
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {};
    scraper.fields.forEach(field => {
      const value = formData[field.name] !== undefined ? formData[field.name] : field.default;
      if (field.type === 'number') {
        payload[field.name] = Number(value) || field.default || 0;
      } else if (field.type === 'checkbox') {
        payload[field.name] = Boolean(value);
      } else {
        payload[field.name] = value || '';
      }
    });

    try {
      const response = await scrapeData(scraper.endpoint, payload);
      const results = response.data || response || [];

      if (Array.isArray(results) && results.length > 0) {
        onResultsReceived(results);
      } else if (Array.isArray(results)) {
        setError('No results found. Try different search terms.');
      } else {
        setError('Unexpected response format from server.');
      }
    } catch (err) {
      setError(err.message || 'Failed to scrape data. Please check if backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (iconName) => {
    const IconComponent = Icons[iconName];
    return IconComponent ? <IconComponent /> : <Icons.Search />;
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 3,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: 2.5,
            background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
            boxShadow: '0 8px 20px -4px rgba(99, 102, 241, 0.6)',
          }}
        >
          {getIcon(scraper.icon)}
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              mb: 0.5,
              background: 'linear-gradient(45deg, #6366f1 30%, #ec4899 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {scraper.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure your search parameters below
          </Typography>
        </Box>
        <Chip
          label="Active"
          size="small"
          sx={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981',
            fontWeight: 600,
            fontSize: '0.75rem',
          }}
        />
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            borderRadius: 2,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            '& .MuiAlert-icon': {
              color: '#ef4444',
            }
          }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2,
            alignItems: { xs: 'stretch', md: 'flex-end' },
            flexWrap: 'wrap',
          }}
        >
          {scraper.fields.map((field) => (
            field.type === 'checkbox' ? (
              <FormControlLabel
                key={field.name}
                control={
                  <Checkbox
                    checked={formData[field.name] !== undefined ? formData[field.name] : field.default}
                    onChange={(e) => handleCheckboxChange(field.name, e.target.checked)}
                    sx={{
                      color: '#818cf8',
                      '&.Mui-checked': {
                        color: '#6366f1',
                      },
                    }}
                  />
                }
                label={field.label}
                sx={{
                  flex: { xs: '1 1 100%', md: '1 1 calc(33.333% - 11px)' },
                  minWidth: { xs: '100%', md: '200px' },
                  '& .MuiFormControlLabel-label': {
                    fontWeight: 500,
                    color: 'text.primary',
                  },
                }}
              />
            ) : (
              <TextField
                key={field.name}
                label={field.label}
                type={field.type}
                required={field.required}
                placeholder={field.placeholder}
                value={formData[field.name] || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                variant="outlined"
                sx={{
                  flex: { xs: '1 1 100%', md: '1 1 calc(33.333% - 11px)' },
                  minWidth: { xs: '100%', md: '200px' },
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: alpha('#0f172a', 0.4),
                    transition: 'all 0.2s',
                    '&:hover': {
                      backgroundColor: alpha('#0f172a', 0.6),
                    },
                    '&.Mui-focused': {
                      backgroundColor: alpha('#0f172a', 0.6),
                      '& fieldset': {
                        borderWidth: '2px',
                      }
                    }
                  },
                  '& .MuiInputLabel-root': {
                    fontWeight: 500,
                  }
                }}
              />
            )
          ))}

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <RocketLaunchIcon />}
            sx={{
              flex: { xs: '1 1 100%', md: '0 0 auto' },
              minWidth: { xs: '100%', md: '180px' },
              py: 1.75,
              px: 4,
              fontSize: '1rem',
              fontWeight: 600,
              borderRadius: 2,
              background: loading
                ? 'rgba(100, 116, 139, 0.5)'
                : 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
              boxShadow: loading
                ? 'none'
                : '0 8px 20px -4px rgba(99, 102, 241, 0.6)',
              '&:hover': {
                background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
                transform: loading ? 'none' : 'translateY(-2px)',
                boxShadow: loading
                  ? 'none'
                  : '0 12px 24px -4px rgba(99, 102, 241, 0.7)',
              },
              transition: 'all 0.2s ease-in-out',
            }}
          >
            {loading ? 'Scraping...' : 'Start Scraping'}
          </Button>
        </Box>

        {loading && (
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Please wait while we fetch your data...
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default ScraperForm;
