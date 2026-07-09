import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Paper, TextField, Button, Typography, CircularProgress,
  Alert, Autocomplete, Chip, InputAdornment, FormControl,
  InputLabel, Select, MenuItem, Slider, Fade, LinearProgress,
  Checkbox, FormControlLabel, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Tooltip,
} from '@mui/material';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import CategoryIcon from '@mui/icons-material/Category';
import PublicIcon from '@mui/icons-material/Public';
import StorefrontIcon from '@mui/icons-material/Storefront';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import FilterListIcon from '@mui/icons-material/FilterList';
import DownloadIcon from '@mui/icons-material/Download';
import LanguageIcon from '@mui/icons-material/Language';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BusinessIcon from '@mui/icons-material/Business';
import { fetchIdbfStates, fetchIdbfCategories, searchIdbf } from '../../services/api';
import { tokens } from '../../theme/theme';

const IdbfScraper = () => {
  const [states, setStates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [results, setResults] = useState([]);
  const [selectedState, setSelectedState] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [maxResults, setMaxResults] = useState(20);
  const [storeData, setStoreData] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState(null);
  const [progressMsg, setProgressMsg] = useState('');
  const [page, setPage] = useState(0);
  const rowsPerPage = 15;

  const cities = useMemo(() => selectedState?.cities || [], [selectedState]);
  const canScrape = selectedCity && selectedCategory && !scraping;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingStates(true);
      try { const res = await fetchIdbfStates(); if (!cancelled && res?.data) setStates(res.data); }
      catch (err) { if (!cancelled) setError('Failed to load states: ' + err.message); }
      finally { if (!cancelled) setLoadingStates(false); }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedCity) { setCategories([]); return; }
    let cancelled = false;
    const load = async () => {
      setLoadingCategories(true); setCategories([]); setSelectedCategory(null);
      try { const res = await fetchIdbfCategories(selectedCity.slug); if (!cancelled && res?.data) setCategories(res.data); }
      catch (err) { if (!cancelled) setError('Failed to load categories: ' + err.message); }
      finally { if (!cancelled) setLoadingCategories(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedCity]);

  const handleStateChange = useCallback((val) => {
    setSelectedState(val); setSelectedCity(null); setSelectedCategory(null);
    setCategories([]); setResults([]); setError(null);
  }, []);

  const handleCityChange = useCallback((val) => {
    setSelectedCity(val); setSelectedCategory(null); setResults([]); setError(null);
  }, []);

  const handleScrape = async () => {
    if (!selectedCity || !selectedCategory) return;
    setScraping(true); setError(null); setResults([]); setPage(0);
    setProgressMsg('Connecting to IDBF.in...');
    const msgs = ['Connecting to IDBF.in...', 'Loading category page...', 'Extracting listings...', 'Fetching details...', 'Almost done...'];
    let i = 0;
    const t = setInterval(() => { i = Math.min(i + 1, msgs.length - 1); setProgressMsg(msgs[i]); }, 8000);
    try {
      const res = await searchIdbf({ city: selectedCity.slug, category: selectedCategory.slug, maxResults, storeData });
      clearInterval(t); setProgressMsg('');
      const data = res?.data || [];
      if (Array.isArray(data) && data.length > 0) setResults(data);
      else setError('No results found. Try a different category or city.');
    } catch (err) {
      clearInterval(t); setProgressMsg('');
      setError(err.message || 'Scraping failed.');
    } finally { setScraping(false); }
  };

  const handleDownloadCSV = () => {
    if (!results.length) return;
    const cols = ['storeName', 'category', 'phone', 'address', 'pincode', 'state', 'city'];
    const csv = [cols.join(','), ...results.map(r => cols.map(c => `"${(r[c] || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `idbf-results-${Date.now()}.csv`; a.click();
  };

  const paginated = results.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const totalPages = Math.ceil(results.length / rowsPerPage);
  const cols = ['storeName', 'category', 'phone', 'address', 'pincode', 'city'];
  const colLabels = { storeName: 'Business Name', category: 'Category', phone: 'Phone', address: 'Address', pincode: 'Pincode', city: 'City' };

  const dropdownPaper = { mt: 0.5, bgcolor: '#fff', border: `1px solid ${tokens.border}`, borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' };
  const selectSx = { '& .MuiOutlinedInput-root': { backgroundColor: '#fafafa', borderRadius: '8px', '&:hover': { backgroundColor: '#f5f5f5' }, '&.Mui-focused': { backgroundColor: '#fff' } } };

  return (
    <Box className="animate-fade-in" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ width: 44, height: 44, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#05966912', color: '#059669' }}>
          <StorefrontIcon sx={{ fontSize: 24 }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h3">IDBF.in — India Business Directory</Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: tokens.textSecondary }}>Select State → City → Category to scrape business leads</Typography>
        </Box>
        {results.length > 0 && <Chip icon={<CheckCircleIcon sx={{ fontSize: 14 }} />} label={`${results.length} results`} color="success" size="small" />}
      </Box>

      {/* ── Form ── */}
      <Paper sx={{ p: 3, borderRadius: '12px' }}>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2.5 }}>{error}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Autocomplete options={states} getOptionLabel={(o) => o.state || ''} value={selectedState}
              onChange={(_e, v) => handleStateChange(v)} loading={loadingStates} disabled={loadingStates}
              sx={{ flex: '1 1 280px', ...selectSx }}
              renderInput={(params) => <TextField {...params} label="Select State" placeholder="Search state..." size="small"
                InputProps={{ ...params.InputProps, startAdornment: <><InputAdornment position="start"><PublicIcon sx={{ color: tokens.textMuted, fontSize: 18 }} /></InputAdornment>{params.InputProps.startAdornment}</>,
                  endAdornment: <>{loadingStates ? <CircularProgress size={16} /> : null}{params.InputProps.endAdornment}</> }} />}
              renderOption={(props, opt) => <Box component="li" {...props} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">{opt.state}</Typography>
                <Chip label={`${opt.cities?.length || 0}`} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#f3f4f6' }} />
              </Box>}
              PaperComponent={({ children }) => <Paper sx={dropdownPaper}>{children}</Paper>} />

            <Autocomplete options={cities} getOptionLabel={(o) => o.name || ''} value={selectedCity}
              onChange={(_e, v) => handleCityChange(v)} disabled={!selectedState}
              sx={{ flex: '1 1 280px', ...selectSx }}
              renderInput={(params) => <TextField {...params} label="Select City" placeholder={selectedState ? 'Search city...' : 'Select a state first'} size="small"
                InputProps={{ ...params.InputProps, startAdornment: <><InputAdornment position="start"><LocationCityIcon sx={{ color: tokens.textMuted, fontSize: 18 }} /></InputAdornment>{params.InputProps.startAdornment}</> }} />}
              PaperComponent={({ children }) => <Paper sx={dropdownPaper}>{children}</Paper>} />
          </Box>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Autocomplete options={categories} getOptionLabel={(o) => o.name || ''} value={selectedCategory}
              onChange={(_e, v) => setSelectedCategory(v)} loading={loadingCategories} disabled={!selectedCity}
              sx={{ flex: '1 1 300px', ...selectSx }}
              renderInput={(params) => <TextField {...params} label="Select Category" placeholder={selectedCity ? 'e.g., Dentist...' : 'Select a city first'} size="small"
                InputProps={{ ...params.InputProps, startAdornment: <><InputAdornment position="start"><CategoryIcon sx={{ color: tokens.textMuted, fontSize: 18 }} /></InputAdornment>{params.InputProps.startAdornment}</>,
                  endAdornment: <>{loadingCategories ? <CircularProgress size={16} /> : null}{params.InputProps.endAdornment}</> }} />}
              PaperComponent={({ children }) => <Paper sx={{ ...dropdownPaper, maxHeight: 300 }}>{children}</Paper>} />

            <TextField label="Max Results" type="number" value={maxResults}
              onChange={(e) => setMaxResults(Math.max(5, parseInt(e.target.value) || 20))}
              size="small" sx={{ flex: '0 0 130px' }} InputProps={{ inputProps: { min: 5, max: 200 } }} />

            <FormControlLabel
              control={<Checkbox checked={storeData} onChange={(e) => setStoreData(e.target.checked)} size="small" sx={{ color: tokens.textMuted, '&.Mui-checked': { color: tokens.primary } }} />}
              label={<Typography sx={{ fontSize: '0.8125rem', fontWeight: 500 }}>Store</Typography>}
              sx={{ m: 0 }} />

            <Button variant="contained" disabled={!canScrape} onClick={handleScrape}
              startIcon={scraping ? <CircularProgress size={16} color="inherit" /> : <RocketLaunchIcon />}
              sx={{ height: 40, minWidth: 150, bgcolor: '#059669', '&:hover': { bgcolor: '#047857' } }}>
              {scraping ? 'Scraping...' : 'Start Scraping'}
            </Button>
          </Box>

          {(selectedState || selectedCity || selectedCategory) && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <FilterListIcon sx={{ fontSize: 16, color: tokens.textMuted }} />
              {selectedState && <Chip label={selectedState.state} size="small" sx={{ bgcolor: '#f3f4f6' }} />}
              {selectedCity && <Chip label={selectedCity.name} size="small" sx={{ bgcolor: '#f3f4f6' }} />}
              {selectedCategory && <Chip label={selectedCategory.name} size="small" color="success" />}
            </Box>
          )}

          {scraping && (
            <Fade in><Box>
              <LinearProgress />
              <Typography sx={{ fontSize: '0.75rem', color: tokens.textMuted, mt: 0.8, textAlign: 'center' }}>{progressMsg}</Typography>
            </Box></Fade>
          )}
        </Box>
      </Paper>

      {/* ── Results ── */}
      {results.length > 0 ? (
        <Paper sx={{ borderRadius: '12px', overflow: 'hidden' }}>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${tokens.borderLight}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: tokens.text }}>Results</Typography>
              <Chip label={`${results.length} records`} size="small" color="success" sx={{ height: 22, fontSize: '0.6875rem' }} />
            </Box>
            <Button size="small" variant="outlined" startIcon={<DownloadIcon sx={{ fontSize: 16 }} />} onClick={handleDownloadCSV} sx={{ fontSize: '0.75rem', height: 32 }}>Export CSV</Button>
          </Box>
          <TableContainer sx={{ maxHeight: 520 }}>
            <Table size="small" stickyHeader>
              <TableHead><TableRow>
                <TableCell sx={{ width: 50 }}>#</TableCell>
                {cols.map(c => <TableCell key={c}>{colLabels[c] || c}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {paginated.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell sx={{ color: tokens.textMuted, fontSize: '0.75rem' }}>{page * rowsPerPage + idx + 1}</TableCell>
                    {cols.map(c => (
                      <TableCell key={c}>
                        <Typography sx={{ fontSize: '0.8125rem', color: row[c] ? tokens.text : tokens.textMuted }}>{row[c] || '—'}</Typography>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {totalPages > 1 && (
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${tokens.borderLight}` }}>
              <Typography sx={{ fontSize: '0.8125rem', color: tokens.textSecondary }}>Page {page + 1} of {totalPages}</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" disabled={page === 0} onClick={() => setPage(p => p - 1)} startIcon={<NavigateBeforeIcon />}>Prev</Button>
                <Button size="small" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} endIcon={<NavigateNextIcon />}>Next</Button>
              </Box>
            </Box>
          )}
        </Paper>
      ) : !scraping && (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: '12px' }}>
          <Box sx={{ width: 64, height: 64, borderRadius: '16px', bgcolor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
            <BusinessIcon sx={{ fontSize: 28, color: tokens.textMuted }} />
          </Box>
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: tokens.text, mb: 0.5 }}>Ready to search</Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: tokens.textSecondary }}>Select State → City → Category, then hit <strong>Start Scraping</strong>.</Typography>
        </Paper>
      )}
    </Box>
  );
};

export default IdbfScraper;
