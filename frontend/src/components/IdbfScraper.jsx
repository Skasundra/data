import { useState, useMemo, useCallback } from 'react';
import {
  Box, Paper, TextField, Button, Typography, CircularProgress,
  Alert, Autocomplete, Chip, InputAdornment, Slider, alpha, Fade, LinearProgress,
} from '@mui/material';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import CategoryIcon from '@mui/icons-material/Category';
import PublicIcon from '@mui/icons-material/Public';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import FilterListIcon from '@mui/icons-material/FilterList';
import { searchIdbf } from '../services/api';
import { IDBF_STATES, IDBF_SERVICE_OPTIONS } from '../data/idbfData';
import ResultsTable from './ResultsTable';

// ─── Styles ──────────────────────────────────────────────────────────────────
const paperSx = {
  p: 4,
  background: 'rgba(30, 41, 59, 0.7)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 3,
};

const gradientText = {
  fontWeight: 700,
  background: 'linear-gradient(45deg, #6366f1 30%, #ec4899 90%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

const iconBoxSx = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 56, height: 56, borderRadius: 2.5,
  background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
  boxShadow: '0 8px 20px -4px rgba(99, 102, 241, 0.6)',
};

const selectSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: alpha('#0f172a', 0.4),
    transition: 'all 0.2s',
    '&:hover': { backgroundColor: alpha('#0f172a', 0.6) },
    '&.Mui-focused': { backgroundColor: alpha('#0f172a', 0.6), '& fieldset': { borderWidth: '2px' } },
  },
  '& .MuiInputLabel-root': { fontWeight: 500 },
};

// ─── Component ───────────────────────────────────────────────────────────────
const IdbfScraper = () => {
  // ── Data state ──
  const [results, setResults] = useState([]);

  // ── Selection state ──
  const [selectedState, setSelectedState] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [maxResults, setMaxResults] = useState(20);

  // ── UI state ──
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState(null);
  const [progressMsg, setProgressMsg] = useState('');

  // ── Derived (instant — from static data, no API calls) ──
  const cities = useMemo(() => {
    if (!selectedState) return [];
    return selectedState.cities || [];
  }, [selectedState]);

  const canScrape = selectedCity && selectedCategory && !scraping;

  // ── Reset downstream on state change ──
  const handleStateChange = useCallback((val) => {
    setSelectedState(val);
    setSelectedCity(null);
    setSelectedCategory(null);
    setResults([]);
    setError(null);
  }, []);

  const handleCityChange = useCallback((val) => {
    setSelectedCity(val);
    setSelectedCategory(null);
    setResults([]);
    setError(null);
  }, []);

  // ── Scrape ──
  const handleScrape = async () => {
    if (!selectedCity || !selectedCategory) return;
    setScraping(true);
    setError(null);
    setResults([]);
    setProgressMsg('Connecting to IDBF.in...');

    const msgInterval = setInterval(() => {
      setProgressMsg((prev) => {
        const msgs = [
          'Connecting to IDBF.in...',
          'Loading category page...',
          'Extracting business listings...',
          'Fetching business details...',
          'Almost done, please wait...',
        ];
        const idx = msgs.indexOf(prev);
        return idx < msgs.length - 1 ? msgs[idx + 1] : prev;
      });
    }, 8000);

    try {
      const res = await searchIdbf({
        city: selectedCity.slug,
        category: selectedCategory.slug,
        maxResults,
      });

      clearInterval(msgInterval);
      setProgressMsg('');

      const data = res?.data || [];
      if (Array.isArray(data) && data.length > 0) {
        setResults(data);
      } else {
        setError('No results found. Try a different category or city.');
      }
    } catch (err) {
      clearInterval(msgInterval);
      setProgressMsg('');
      setError(err.message || 'Scraping failed. Please check if backend is running.');
    } finally {
      setScraping(false);
    }
  };

  // ── Render ──
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ── Form Panel ── */}
      <Paper elevation={0} sx={paperSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Box sx={iconBoxSx}>
            <PublicIcon />
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h5" sx={gradientText}>
              IDBF.in — India Business Directory
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Select State, City, and Category to scrape business leads
            </Typography>
          </Box>
          <Chip
            label="Active"
            size="small"
            sx={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#10b981', fontWeight: 600, fontSize: '0.75rem',
            }}
          />
        </Box>

        {error && (
          <Alert
            severity="error"
            onClose={() => setError(null)}
            sx={{
              mb: 3, borderRadius: 2,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              '& .MuiAlert-icon': { color: '#ef4444' },
            }}
          >
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* ── Row 1: State + City ── */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* State */}
            <Autocomplete
              options={IDBF_STATES}
              getOptionLabel={(opt) => opt.state || ''}
              value={selectedState}
              onChange={(_e, val) => handleStateChange(val)}
              sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 8px)' }, minWidth: { xs: '100%', md: 280 }, ...selectSx }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select State"
                  placeholder="Search state..."
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <InputAdornment position="start">
                          <PublicIcon sx={{ color: '#818cf8', fontSize: 20 }} />
                        </InputAdornment>
                        {params.InputProps.startAdornment}
                      </>
                    ),
                    endAdornment: params.InputProps.endAdornment,
                  }}
                />
              )}
              renderOption={(props, opt) => (
                <Box component="li" {...props} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">{opt.state}</Typography>
                  <Chip label={`${opt.cities?.length || 0} cities`} size="small"
                    sx={{ height: 20, fontSize: '0.7rem', bgcolor: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }} />
                </Box>
              )}
              noOptionsText="No states found"
              PaperComponent={({ children }) => (
                <Paper sx={{ mt: 0.5, bgcolor: 'rgba(15,23,42,0.98)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 2 }}>
                  {children}
                </Paper>
              )}
            />

            {/* City */}
            <Autocomplete
              options={cities}
              getOptionLabel={(opt) => opt.name || ''}
              value={selectedCity}
              onChange={(_e, val) => handleCityChange(val)}
              disabled={!selectedState}
              sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 8px)' }, minWidth: { xs: '100%', md: 280 }, ...selectSx }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select City"
                  placeholder={selectedState ? 'Search city...' : 'Select a state first'}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <InputAdornment position="start">
                          <LocationCityIcon sx={{ color: '#818cf8', fontSize: 20 }} />
                        </InputAdornment>
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                />
              )}
              noOptionsText={selectedState ? 'No cities in this state' : 'Select a state first'}
              PaperComponent={({ children }) => (
                <Paper sx={{ mt: 0.5, bgcolor: 'rgba(15,23,42,0.98)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 2 }}>
                  {children}
                </Paper>
              )}
            />
          </Box>

          {/* ── Row 2: Category + Max Results ── */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Category */}
            <Autocomplete
              options={IDBF_SERVICE_OPTIONS}
              getOptionLabel={(opt) => opt.name || ''}
              value={selectedCategory}
              onChange={(_e, val) => setSelectedCategory(val)}
              disabled={!selectedCity}
              sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 8px)' }, minWidth: { xs: '100%', md: 280 }, ...selectSx }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Category / Service"
                  placeholder={selectedCity ? 'e.g., Dentist, Restaurant...' : 'Select a city first'}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <InputAdornment position="start">
                          <CategoryIcon sx={{ color: '#818cf8', fontSize: 20 }} />
                        </InputAdornment>
                        {params.InputProps.startAdornment}
                      </>
                    ),
                    endAdornment: params.InputProps.endAdornment,
                  }}
                />
              )}
              noOptionsText={selectedCity ? 'No matching categories' : 'Select a city first'}
              PaperComponent={({ children }) => (
                <Paper sx={{ mt: 0.5, bgcolor: 'rgba(15,23,42,0.98)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 2, maxHeight: 300 }}>
                  {children}
                </Paper>
              )}
            />

            {/* Max Results */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 8px)' }, minWidth: { xs: '100%', md: 280 } }}>
              <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600 }}>
                Scrape Limit: {maxResults} results
              </Typography>
              <Slider
                value={maxResults}
                onChange={(_e, val) => setMaxResults(val)}
                min={5}
                max={200}
                step={5}
                marks={[
                  { value: 5, label: '5' },
                  { value: 50, label: '50' },
                  { value: 100, label: '100' },
                  { value: 200, label: '200' },
                ]}
                sx={{
                  color: '#6366f1',
                  '& .MuiSlider-thumb': { backgroundColor: '#6366f1' },
                  '& .MuiSlider-markLabel': { color: 'text.secondary', fontSize: '0.7rem' },
                }}
              />
            </Box>
          </Box>

          {/* ── Selection summary ── */}
          {(selectedState || selectedCity || selectedCategory) && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <FilterListIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              {selectedState && (
                <Chip label={`State: ${selectedState.state}`} size="small"
                  sx={{ bgcolor: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }} />
              )}
              {selectedCity && (
                <Chip label={`City: ${selectedCity.name}`} size="small"
                  sx={{ bgcolor: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }} />
              )}
              {selectedCategory && (
                <Chip label={`Category: ${selectedCategory.name}`} size="small"
                  sx={{ bgcolor: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }} />
              )}
              <Chip label={`Max: ${maxResults}`} size="small"
                sx={{ bgcolor: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }} />
            </Box>
          )}

          {/* ── Scrape button ── */}
          <Button
            variant="contained"
            size="large"
            disabled={!canScrape}
            onClick={handleScrape}
            startIcon={scraping ? <CircularProgress size={20} color="inherit" /> : <RocketLaunchIcon />}
            sx={{
              minWidth: { xs: '100%', md: 220 },
              py: 1.75, px: 4, fontSize: '1rem', fontWeight: 600, borderRadius: 2,
              background: !canScrape
                ? 'rgba(100, 116, 139, 0.5)'
                : 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
              boxShadow: !canScrape
                ? 'none'
                : '0 8px 20px -4px rgba(99, 102, 241, 0.6)',
              '&:hover': {
                background: canScrape
                  ? 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)'
                  : undefined,
                transform: canScrape ? 'translateY(-2px)' : 'none',
              },
              transition: 'all 0.2s ease-in-out',
            }}
          >
            {scraping ? 'Scraping...' : 'Start Scraping'}
          </Button>

          {/* ── Progress ── */}
          {scraping && (
            <Fade in>
              <Box>
                <LinearProgress
                  sx={{ borderRadius: 1, bgcolor: 'rgba(99,102,241,0.15)', '& .MuiLinearProgress-bar': { bgcolor: '#6366f1' } }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.8, textAlign: 'center' }}>
                  {progressMsg}
                </Typography>
              </Box>
            </Fade>
          )}
        </Box>
      </Paper>

      {/* ── Results ── */}
      <ResultsTable results={results} scraperId="idbf" />
    </Box>
  );
};

export default IdbfScraper;
