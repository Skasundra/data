import { useState, useCallback } from 'react';
import {
  Box, Paper, TextField, Button, Typography, CircularProgress,
  Alert, Chip, InputAdornment, Slider, Fade, LinearProgress,
  Checkbox, FormControlLabel,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PlaceIcon from '@mui/icons-material/Place';
import CategoryIcon from '@mui/icons-material/Category';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import FilterListIcon from '@mui/icons-material/FilterList';
import MapIcon from '@mui/icons-material/Map';
import { scrapeData } from '../services/api';
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

const inputSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: '#fafafa',
    transition: 'all 0.2s',
    '&:hover': { backgroundColor: '#f5f5f5' },
    '&.Mui-focused': { backgroundColor: '#ffffff', '& fieldset': { borderWidth: '2px' } },
  },
  '& .MuiInputLabel-root': { fontWeight: 500 },
};

// ─── Component ───────────────────────────────────────────────────────────────
const GoogleMapsScraper = () => {
  // ── Form state ──
  const [keyword, setKeyword] = useState('');
  const [place, setPlace] = useState('');
  const [maxResults, setMaxResults] = useState(20);
  const [storeData, setStoreData] = useState(false);

  // ── UI state ──
  const [results, setResults] = useState([]);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState(null);
  const [progressMsg, setProgressMsg] = useState('');

  // ── Derived ──
  const canScrape = keyword.trim() && place.trim() && !scraping;

  // ── Scrape ──
  const handleScrape = useCallback(async () => {
    if (!keyword.trim() || !place.trim()) return;
    setScraping(true);
    setError(null);
    setResults([]);
    setProgressMsg('Connecting to Google Maps...');

    const msgInterval = setInterval(() => {
      setProgressMsg((prev) => {
        const msgs = [
          'Connecting to Google Maps...',
          'Loading search results...',
          'Scrolling to load more listings...',
          'Extracting business data...',
          'Processing results...',
          'Almost done, please wait...',
        ];
        const idx = msgs.indexOf(prev);
        return idx < msgs.length - 1 ? msgs[idx + 1] : prev;
      });
    }, 8000);

    try {
      const res = await scrapeData('/search', {
        keyword: keyword.trim(),
        place: place.trim(),
        maxResults,
        storeData,
      });

      clearInterval(msgInterval);
      setProgressMsg('');

      const data = res?.data || [];
      if (Array.isArray(data) && data.length > 0) {
        setResults(data);
      } else {
        setError('No results found. Try a different keyword or location.');
      }
    } catch (err) {
      clearInterval(msgInterval);
      setProgressMsg('');
      setError(err.message || 'Scraping failed. Please check if backend is running.');
    } finally {
      setScraping(false);
    }
  }, [keyword, place, maxResults, storeData]);

  // ── Render ──
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ── Form Panel ── */}
      <Paper elevation={0} sx={paperSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Box sx={iconBoxSx}>
            <MapIcon />
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#111111' }}>
              Google Maps — Business Scraper
            </Typography>
            <Typography variant="body2" sx={{ color: '#6b7280' }}>
              Enter a keyword and location to scrape business leads from Google Maps
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
          {/* ── Row 1: Keyword + Place ── */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <TextField
              label="Keyword / Business Type"
              placeholder="e.g., Restaurant, IT Company, Dentist"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canScrape) handleScrape(); }}
              sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 8px)' }, minWidth: { xs: '100%', md: 280 }, ...inputSx }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#6b7280', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Location / Place"
              placeholder="e.g., Ahmedabad, New York, Mumbai"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canScrape) handleScrape(); }}
              sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 8px)' }, minWidth: { xs: '100%', md: 280 }, ...inputSx }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PlaceIcon sx={{ color: '#6b7280', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {/* ── Row 2: Max Results Slider ── */}
          <Box>
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

          {/* ── Selection summary ── */}
          {(keyword.trim() || place.trim()) && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <FilterListIcon sx={{ fontSize: 18, color: '#6b7280' }} />
              {keyword.trim() && (
                <Chip label={`Keyword: ${keyword.trim()}`} size="small"
                  sx={{ bgcolor: '#f5f5f5', color: '#111111', border: '1px solid #e5e5e5' }} />
              )}
              {place.trim() && (
                <Chip label={`Location: ${place.trim()}`} size="small"
                  sx={{ bgcolor: '#f5f5f5', color: '#111111', border: '1px solid #e5e5e5' }} />
              )}
              <Chip label={`Max: ${maxResults}`} size="small"
                sx={{ bgcolor: '#fefce8', color: '#a16207', border: '1px solid #fde68a' }} />
              {storeData && (
                <Chip label="💾 Store Data" size="small"
                  sx={{ bgcolor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }} />
              )}
            </Box>
          )}

          {/* ── Store Data Checkbox ── */}
          <FormControlLabel
            control={
              <Checkbox
                checked={storeData}
                onChange={(e) => setStoreData(e.target.checked)}
                sx={{ color: '#111111', '&.Mui-checked': { color: '#111111' } }}
              />
            }
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Store Data to JSON File
                </Typography>
                <Typography variant="caption" sx={{ color: '#6b7280' }}>
                  Saves results on the server organized by Location → Keyword (avoids duplicates)
                </Typography>
              </Box>
            }
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
      <ResultsTable results={results} scraperId="google-maps" />
    </Box>
  );
};

export default GoogleMapsScraper;
