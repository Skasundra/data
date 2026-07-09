import { useState, useCallback } from 'react';
import {
  Box, Paper, TextField, Button, Typography, CircularProgress,
  Alert, InputAdornment, Chip, Fade, LinearProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, Checkbox, FormControlLabel,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PlaceIcon from '@mui/icons-material/Place';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LanguageIcon from '@mui/icons-material/Language';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BusinessIcon from '@mui/icons-material/Business';
import { scrapeData } from '../../services/api';
import { tokens } from '../../theme/theme';

/**
 * DirectoryScraper — A self-contained module for directory-based scrapers.
 * Used by: Yellow Pages, JustDial, YP Canada, SuperPages, CitySearch.
 * Each instance is independent with its own form, results table, and export.
 */
const DirectoryScraper = ({
  moduleId,
  title,
  description,
  icon: ModuleIcon,
  accentColor,
  endpoint,
  keywordPlaceholder = 'e.g., Restaurant',
  locationPlaceholder = 'e.g., New York',
  maxResultsDefault = 20,
  columns = ['storeName', 'category', 'phone', 'website', 'address'],
  columnLabels = {},
}) => {
  const [keyword, setKeyword] = useState('');
  const [place, setPlace] = useState('');
  const [maxResults, setMaxResults] = useState(maxResultsDefault);
  const [storeData, setStoreData] = useState(false);
  const [results, setResults] = useState([]);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const rowsPerPage = 15;

  const canScrape = keyword.trim() && place.trim() && !scraping;

  const handleScrape = useCallback(async () => {
    if (!keyword.trim() || !place.trim()) return;
    setScraping(true); setError(null); setResults([]); setPage(0);
    setProgressMsg('Connecting...');
    const msgs = ['Connecting...', 'Loading results...', 'Extracting data...', 'Processing...', 'Almost done...'];
    let i = 0;
    const t = setInterval(() => { i = Math.min(i + 1, msgs.length - 1); setProgressMsg(msgs[i]); }, 6000);
    try {
      const res = await scrapeData(endpoint, { keyword: keyword.trim(), place: place.trim(), maxResults, storeData });
      clearInterval(t); setProgressMsg('');
      const data = res?.data || [];
      if (Array.isArray(data) && data.length > 0) setResults(data);
      else setError('No results found. Try different search terms.');
    } catch (err) {
      clearInterval(t); setProgressMsg('');
      setError(err.message || 'Scraping failed.');
    } finally { setScraping(false); }
  }, [keyword, place, maxResults, storeData, endpoint]);

  const handleDownloadCSV = () => {
    if (!results.length) return;
    const cols = columns.filter(c => results[0] && c in results[0]);
    const csv = [
      cols.map(c => getLabel(c)).join(','),
      ...results.map(row => cols.map(c => `"${(row[c] || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${moduleId}-results-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const getLabel = (col) => {
    if (columnLabels[col]) return columnLabels[col];
    const map = { storeName: 'Business Name', category: 'Category', phone: 'Phone', website: 'Website', address: 'Address', stars: 'Rating', numberOfReviews: 'Reviews', pincode: 'Pincode', city: 'City', state: 'State', googleUrl: 'Google Maps', bizWebsite: 'Website', idbfUrl: 'IDBF Link' };
    return map[col] || col.charAt(0).toUpperCase() + col.slice(1);
  };

  const isUrl = (col) => ['website', 'bizWebsite', 'googleUrl', 'url', 'idbfUrl'].includes(col);
  const paginated = results.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const totalPages = Math.ceil(results.length / rowsPerPage);
  const displayCols = columns.filter(c => results[0] && c in results[0]);

  return (
    <Box className="animate-fade-in" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: `${accentColor}12`, color: accentColor,
        }}>
          <ModuleIcon sx={{ fontSize: 24 }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h3">{title}</Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: tokens.textSecondary }}>{description}</Typography>
        </Box>
        {results.length > 0 && (
          <Chip icon={<CheckCircleIcon sx={{ fontSize: 14 }} />} label={`${results.length} results`} color="success" size="small" />
        )}
      </Box>

      {/* ── Form ── */}
      <Paper sx={{ p: 3, borderRadius: '12px' }}>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2.5 }}>{error}</Alert>}

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <TextField
            label="Keyword" placeholder={keywordPlaceholder} value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canScrape) handleScrape(); }}
            size="small" sx={{ flex: '1 1 240px' }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: tokens.textMuted }} /></InputAdornment> }}
          />
          <TextField
            label="Location" placeholder={locationPlaceholder} value={place}
            onChange={(e) => setPlace(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canScrape) handleScrape(); }}
            size="small" sx={{ flex: '1 1 240px' }}
            InputProps={{ startAdornment: <InputAdornment position="start"><PlaceIcon sx={{ fontSize: 18, color: tokens.textMuted }} /></InputAdornment> }}
          />
          <TextField
            label="Max Results" type="number" value={maxResults}
            onChange={(e) => setMaxResults(Math.min(200, Math.max(5, parseInt(e.target.value) || 20)))}
            size="small" sx={{ flex: '0 0 130px' }}
            InputProps={{ inputProps: { min: 5, max: 200 } }}
          />
          <FormControlLabel
            control={<Checkbox checked={storeData} onChange={(e) => setStoreData(e.target.checked)} size="small" sx={{ color: tokens.textMuted, '&.Mui-checked': { color: tokens.primary } }} />}
            label={<Typography sx={{ fontSize: '0.8125rem', fontWeight: 500 }}>Store</Typography>}
            sx={{ m: 0 }}
          />
          <Button
            variant="contained" disabled={!canScrape} onClick={handleScrape}
            startIcon={scraping ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
            sx={{ height: 40, minWidth: 130, bgcolor: accentColor, '&:hover': { bgcolor: accentColor, filter: 'brightness(0.9)' } }}
          >
            {scraping ? 'Scraping...' : 'Scrape'}
          </Button>
        </Box>

        {scraping && (
          <Fade in>
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography sx={{ fontSize: '0.75rem', color: tokens.textMuted, mt: 0.8, textAlign: 'center' }}>{progressMsg}</Typography>
            </Box>
          </Fade>
        )}
      </Paper>

      {/* ── Results ── */}
      {results.length > 0 ? (
        <Paper sx={{ borderRadius: '12px', overflow: 'hidden' }}>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${tokens.borderLight}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: tokens.text }}>Results</Typography>
              <Chip label={`${results.length} records`} size="small" color="success" sx={{ height: 22, fontSize: '0.6875rem' }} />
            </Box>
            <Button size="small" variant="outlined" startIcon={<DownloadIcon sx={{ fontSize: 16 }} />} onClick={handleDownloadCSV}
              sx={{ fontSize: '0.75rem', height: 32 }}>
              Export CSV
            </Button>
          </Box>

          <TableContainer sx={{ maxHeight: 520 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 50 }}>#</TableCell>
                  {displayCols.map(col => <TableCell key={col}>{getLabel(col)}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {paginated.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell sx={{ color: tokens.textMuted, fontSize: '0.75rem' }}>{page * rowsPerPage + idx + 1}</TableCell>
                    {displayCols.map(col => (
                      <TableCell key={col}>
                        {isUrl(col) && row[col] ? (
                          <Tooltip title={row[col]}>
                            <IconButton size="small" onClick={() => window.open(row[col], '_blank')}
                              sx={{ bgcolor: '#f3f4f6', borderRadius: '6px', '&:hover': { bgcolor: '#e5e7eb' } }}>
                              <LanguageIcon sx={{ fontSize: 16, color: tokens.primary }} />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Typography sx={{ fontSize: '0.8125rem', color: row[col] ? tokens.text : tokens.textMuted }}>
                            {row[col] || '—'}
                          </Typography>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {totalPages > 1 && (
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${tokens.borderLight}` }}>
              <Typography sx={{ fontSize: '0.8125rem', color: tokens.textSecondary }}>
                Page {page + 1} of {totalPages}
              </Typography>
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
          <Typography sx={{ fontSize: '0.8125rem', color: tokens.textSecondary }}>
            Enter a keyword and location above, then hit <strong>Scrape</strong> to find business leads.
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default DirectoryScraper;
