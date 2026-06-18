import { useState } from 'react';
import { Box, TextField, Button, Paper, Typography, CircularProgress, Alert, Chip, FormControlLabel, Checkbox } from '@mui/material';
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
        background: '#ffffff',
        border: '1px solid #e5e5e5',
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
            background: '#111111',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <Box sx={{ color: '#ffffff' }}>
            {getIcon(scraper.icon)}
          </Box>
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              mb: 0.5,
              color: '#111111',
            }}
          >
            {scraper.name}
          </Typography>
          <Typography variant="body2" sx={{ color: '#6b7280' }}>
            Configure your search parameters below
          </Typography>
        </Box>
        <Chip
          label="Active"
          size="small"
          sx={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#16a34a',
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
            border: '1px solid #fecaca',
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
                      color: '#9ca3af',
                      '&.Mui-checked': {
                        color: '#111111',
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
                    color: '#111111',
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
                    backgroundColor: '#fafafa',
                    transition: 'all 0.2s',
                    '&:hover': {
                      backgroundColor: '#f5f5f5',
                    },
                    '&.Mui-focused': {
                      backgroundColor: '#ffffff',
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
              background: loading ? '#d1d5db' : '#111111',
              boxShadow: loading ? 'none' : '0 2px 8px rgba(0,0,0,0.15)',
              '&:hover': {
                background: loading ? '#d1d5db' : '#333333',
                transform: loading ? 'none' : 'translateY(-1px)',
                boxShadow: loading ? 'none' : '0 4px 12px rgba(0,0,0,0.2)',
              },
              transition: 'all 0.2s ease-in-out',
            }}
          >
            {loading ? 'Scraping...' : 'Start Scraping'}
          </Button>
        </Box>

        {loading && (
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="caption" sx={{ color: '#6b7280' }}>
              Please wait while we fetch your data...
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default ScraperForm;
