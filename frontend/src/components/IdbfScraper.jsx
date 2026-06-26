import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Paper, TextField, Button, Typography, CircularProgress,
  Alert, Autocomplete, Chip, InputAdornment, FormControl,
  InputLabel, Select, MenuItem, Slider, Fade, LinearProgress,
  Checkbox, FormControlLabel,
} from '@mui/material';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import CategoryIcon from '@mui/icons-material/Category';
import PublicIcon from '@mui/icons-material/Public';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import FilterListIcon from '@mui/icons-material/FilterList';
import { fetchIdbfStates, fetchIdbfCategories, searchIdbf } from '../services/api';
import ResultsTable from './ResultsTable';

// ─── Styles ──────────────────────────────────────────────────────────────────
const paperSx = {
  p: 4,
  background: '#ffffff',
  border: '1px solid #e5e5e5',
  borderRadius: 3,
};

const iconBoxSx = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 56, height: 56, borderRadius: 2.5,
  background: '#111111',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  color: '#ffffff',
};

const selectSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: '#fafafa',
    transition: 'all 0.2s',
    '&:hover': { backgroundColor: '#f5f5f5' },
    '&.Mui-focused': { backgroundColor: '#ffffff', '& fieldset': { borderWidth: '2px' } },
  },
  '& .MuiInputLabel-root': { fontWeight: 500 },
};

const dropdownPaperSx = {
  mt: 0.5, bgcolor: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 2,
};

// ─── Component ───────────────────────────────────────────────────────────────
const IdbfScraper = () => {
  // ── Data state ──
  const [states, setStates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [results, setResults] = useState([]);

  // ── Selection state ──
  const [selectedState, setSelectedState] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [maxResults, setMaxResults] = useState(20);
  const [storeData, setStoreData] = useState(false);

  // ── UI state ──
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState(null);
  const [progressMsg, setProgressMsg] = useState('');

  // ── Derived ──
  const cities = useMemo(() => {
    if (!selectedState) return [];
    return selectedState.cities || [];
  }, [selectedState]);

  const canScrape = selectedCity && selectedCategory && !scraping;

  // ── Load states on mount ──
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingStates(true);
      try {
        const res = await fetchIdbfStates();
        if (!cancelled && res?.data) {
          setStates(res.data);
        }
      } catch (err) {
        if (!cancelled) setError('Failed to load states: ' + err.message);
      } finally {
        if (!cancelled) setLoadingStates(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Load categories when city changes ──
  useEffect(() => {
    if (!selectedCity) { setCategories([]); return; }
    let cancelled = false;
    const load = async () => {
      setLoadingCategories(true);
      setCategories([]);
      setSelectedCategory(null);
      try {
        const res = await fetchIdbfCategories(selectedCity.slug);
        if (!cancelled && res?.data) {
          setCategories(res.data);
        }
      } catch (err) {
        if (!cancelled) setError('Failed to load categories: ' + err.message);
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedCity]);

  // ── Reset downstream on state change ──
  const handleStateChange = useCallback((val) => {
    setSelectedState(val);
    setSelectedCity(null);
    setSelectedCategory(null);
    setCategories([]);
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
        storeData,
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
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#111111' }}>
              IDBF.in — India Business Directory
            </Typography>
            <Typography variant="body2" sx={{ color: '#6b7280' }}>
              Select State, City, and Category to scrape business leads
            </Typography>
          </Box>
          <Chip
            label="Active"
            size="small"
            sx={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#16a34a', fontWeight: 600, fontSize: '0.75rem',
            }}
          />
        </Box>

        {error && (
          <Alert
            severity="error"
            onClose={() => setError(null)}
            sx={{ mb: 3, borderRadius: 2, border: '1px solid #fecaca' }}
          >
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* ── Row 1: State + City ── */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <Autocomplete
              options={states}
              getOptionLabel={(opt) => opt.state || ''}
              value={selectedState}
              onChange={(_e, val) => handleStateChange(val)}
              loading={loadingStates}
              disabled={loadingStates}
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
                          <PublicIcon sx={{ color: '#6b7280', fontSize: 20 }} />
                        </InputAdornment>
                        {params.InputProps.startAdornment}
                      </>
                    ),
                    endAdornment: (
                      <>
                        {loadingStates ? <CircularProgress size={18} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, opt) => (
                <Box component="li" {...props} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">{opt.state}</Typography>
                  <Chip label={`${opt.cities?.length || 0} cities`} size="small"
                    sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#f5f5f5', color: '#111111', border: '1px solid #e5e5e5' }} />
                </Box>
              )}
              noOptionsText="No states found"
              PaperComponent={({ children }) => (
                <Paper sx={dropdownPaperSx}>{children}</Paper>
              )}
            />

            <Autocomplete
              options={cities}
              getOptionLabel={(opt) => opt.name || ''}
              value={selectedCity}
              onChange={(_e, val) => handleCityChange(val)}
              disabled={!selectedState || loadingStates}
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
                          <LocationCityIcon sx={{ color: '#6b7280', fontSize: 20 }} />
                        </InputAdornment>
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                />
              )}
              noOptionsText={selectedState ? 'No cities in this state' : 'Select a state first'}
              PaperComponent={({ children }) => (
                <Paper sx={dropdownPaperSx}>{children}</Paper>
              )}
            />
          </Box>

          {/* ── Row 2: Category + Max Results ── */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <Autocomplete
              options={categories}
              getOptionLabel={(opt) => opt.name || ''}
              value={selectedCategory}
              onChange={(_e, val) => setSelectedCategory(val)}
              loading={loadingCategories}
              disabled={!selectedCity || loadingCategories}
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
                          <CategoryIcon sx={{ color: '#6b7280', fontSize: 20 }} />
                        </InputAdornment>
                        {params.InputProps.startAdornment}
                      </>
                    ),
                    endAdornment: (
                      <>
                        {loadingCategories ? <CircularProgress size={18} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, opt) => (
                <Box component="li" {...props} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">{opt.name}</Typography>
                  {opt.count && (
                    <Chip label={`${opt.count} listings`} size="small"
                      sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }} />
                  )}
                </Box>
              )}
              noOptionsText={selectedCity ? (loadingCategories ? 'Loading...' : 'No categories found') : 'Select a city first'}
              PaperComponent={({ children }) => (
                <Paper sx={{ ...dropdownPaperSx, maxHeight: 300 }}>{children}</Paper>
              )}
            />

            <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 8px)' }, minWidth: { xs: '100%', md: 280 } }}>
              <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600, color: '#111111' }}>
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
                  color: '#111111',
                  '& .MuiSlider-thumb': { backgroundColor: '#111111' },
                  '& .MuiSlider-markLabel': { color: '#6b7280', fontSize: '0.7rem' },
                }}
              />
            </Box>
          </Box>

          {/* ── Selection summary ── */}
          {(selectedState || selectedCity || selectedCategory) && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <FilterListIcon sx={{ fontSize: 18, color: '#6b7280' }} />
              {selectedState && (
                <Chip label={`State: ${selectedState.state}`} size="small"
                  sx={{ bgcolor: '#f5f5f5', color: '#111111', border: '1px solid #e5e5e5' }} />
              )}
              {selectedCity && (
                <Chip label={`City: ${selectedCity.name}`} size="small"
                  sx={{ bgcolor: '#f5f5f5', color: '#111111', border: '1px solid #e5e5e5' }} />
              )}
              {selectedCategory && (
                <Chip label={`Category: ${selectedCategory.name}`} size="small"
                  sx={{ bgcolor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }} />
              )}
              <Chip label={`Max: ${maxResults}`} size="small"
                sx={{ bgcolor: '#fefce8', color: '#a16207', border: '1px solid #fde68a' }} />
            </Box>
          )}

          {/* ── Store Data Checkbox ── */}
          <FormControlLabel
            control={
              <Checkbox
                checked={storeData}
                onChange={(e) => setStoreData(e.target.checked)}
                color="primary"
              />
            }
            label="Store Data to JSON File"
          />
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
              background: !canScrape ? '#d1d5db' : '#111111',
              boxShadow: !canScrape ? 'none' : '0 2px 8px rgba(0,0,0,0.15)',
              '&:hover': {
                background: canScrape ? '#333333' : undefined,
                transform: canScrape ? 'translateY(-1px)' : 'none',
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
                  sx={{ borderRadius: 1, bgcolor: '#f0f0f0', '& .MuiLinearProgress-bar': { bgcolor: '#111111' } }}
                />
                <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mt: 0.8, textAlign: 'center' }}>
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
