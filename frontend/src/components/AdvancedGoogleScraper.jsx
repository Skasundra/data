import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Paper, TextField, Button, Typography, CircularProgress,
  Alert, Chip, Slider, Fade, LinearProgress, Radio, RadioGroup,
  FormControlLabel, FormControl, FormLabel, Tabs, Tab, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Grid, Card, CardContent, Divider, Tooltip, Checkbox
} from '@mui/material';
import AutoAwesomeMotionIcon from '@mui/icons-material/AutoAwesomeMotion';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CancelIcon from '@mui/icons-material/Cancel';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ListAltIcon from '@mui/icons-material/ListAlt';
import InfoIcon from '@mui/icons-material/Info';

import {
  createAdvancedGoogleJob,
  fetchAdvancedGoogleJobs,
  fetchAdvancedGoogleJobStatus,
  fetchAdvancedGoogleJobResults,
  deleteAdvancedGoogleJob
} from '../services/api';
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

const AdvancedGoogleScraper = () => {
  // ── Tab state ──
  const [tabIndex, setTabIndex] = useState(0);

  // ── Form State ──
  const [taskName, setTaskName] = useState('');
  const [executionMode, setExecutionMode] = useState('parallel');
  const [concurrency, setConcurrency] = useState(2);
  const [defaultMaxResults, setDefaultMaxResults] = useState(20);
  const [defaultLocation, setDefaultLocation] = useState('Dubai');
  const [extractCompanyDetails, setExtractCompanyDetails] = useState(false);
  const [bulkText, setBulkText] = useState(
    "restaurant near Dubai\ncafe near Abu Dhabi\nauto repair, Tokyo\nplumber, 40.7128, -74.0060"
  );
  
  // ── Configured Queries list ──
  const [queries, setQueries] = useState([
    { keyword: 'restaurant', location: 'Dubai', maxResults: 20 },
    { keyword: 'cafe', location: 'Abu Dhabi', maxResults: 20 },
    { keyword: 'auto repair', location: 'Tokyo', maxResults: 20 },
    { keyword: 'plumber', location: '40.7128, -74.0060', maxResults: 20 }
  ]);

  // ── Active Scrape / History State ──
  const [jobs, setJobs] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [activeResults, setActiveResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Reference for active polling ──
  const pollTimerRef = useRef(null);
  const terminalEndRef = useRef(null);
  const [consoleOpen, setConsoleOpen] = useState(true);

  // Auto-scroll terminal log
  useEffect(() => {
    if (activeJob?.logs && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeJob?.logs]);

  // ── Load historical jobs ──
  const loadJobsList = useCallback(async () => {
    try {
      const res = await fetchAdvancedGoogleJobs();
      if (res?.status === 200) {
        setJobs(res.data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch jobs list.');
    }
  }, []);

  useEffect(() => {
    loadJobsList();
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [loadJobsList]);

  // ── Real-time Status Polling ──
  const startPollingJobStatus = useCallback((jobId) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetchAdvancedGoogleJobStatus(jobId);
        if (res?.status === 200) {
          const updatedJob = res.data;
          setActiveJob(updatedJob);

          // Update in jobs history list as well
          setJobs((prevJobs) =>
            prevJobs.map((j) => (j.id === jobId ? updatedJob : j))
          );

          // If job completed/failed/cancelled, stop polling and load results
          if (['Completed', 'Failed', 'Cancelled'].includes(updatedJob.status)) {
            clearInterval(pollTimerRef.current);
            loadJobResults(jobId);
            loadJobsList();
          }
        }
      } catch (err) {
        log.error('Polling job failed:', err);
      }
    }, 2500);
  }, [loadJobsList]);

  // ── Load Results ──
  const loadJobResults = async (jobId) => {
    setLoading(true);
    try {
      const res = await fetchAdvancedGoogleJobResults(jobId);
      if (res?.status === 200) {
        setActiveResults(res.data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to retrieve job results.');
    } finally {
      setLoading(false);
    }
  };

  // ── Set active job for viewing ──
  const handleSelectJob = async (job) => {
    setActiveJob(job);
    setActiveResults([]);
    setError(null);

    if (['Pending', 'Running'].includes(job.status)) {
      startPollingJobStatus(job.id);
    } else {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      await loadJobResults(job.id);
    }
  };

  // ── Delete / Abort job ──
  const handleDeleteJob = async (jobId, event) => {
    if (event) event.stopPropagation();
    if (!window.confirm('Are you sure you want to cancel and delete this job?')) return;

    try {
      await deleteAdvancedGoogleJob(jobId);
      if (activeJob?.id === jobId) {
        setActiveJob(null);
        setActiveResults([]);
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      }
      loadJobsList();
    } catch (err) {
      setError(err.message || 'Failed to delete job.');
    }
  };

  // ── Parse bulk query text ──
  const handleParseQueries = () => {
    if (!bulkText.trim()) return;

    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed = lines.map(line => {
      // 1. Check comma split
      if (line.includes(',')) {
        const parts = line.split(',');
        const keyword = parts[0].trim();
        const location = parts.slice(1).join(',').trim();
        return { keyword, location, maxResults: defaultMaxResults };
      }

      // 2. Check " in " split
      const inMatch = line.match(/(.+)\s+in\s+(.+)/i);
      if (inMatch) {
        return { keyword: inMatch[1].trim(), location: inMatch[2].trim(), maxResults: defaultMaxResults };
      }

      // 3. Check " near " split
      const nearMatch = line.match(/(.+)\s+near\s+(.+)/i);
      if (nearMatch) {
        return { keyword: nearMatch[1].trim(), location: nearMatch[2].trim(), maxResults: defaultMaxResults };
      }

      // 4. Fallback: whole line is keyword, default location
      return { keyword: line, location: defaultLocation || 'Dubai', maxResults: defaultMaxResults };
    });

    setQueries((prev) => [...prev, ...parsed]);
  };

  // ── Edit query rows ──
  const handleUpdateQueryField = (index, field, value) => {
    setQueries((prev) =>
      prev.map((q, idx) => (idx === index ? { ...q, [field]: value } : q))
    );
  };

  const handleRemoveQuery = (index) => {
    setQueries((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddEmptyQuery = () => {
    setQueries((prev) => [
      ...prev,
      { keyword: '', location: defaultLocation || 'Dubai', maxResults: defaultMaxResults }
    ]);
  };

  const handleClearQueriesList = () => {
    setQueries([]);
  };

  // ── Create job execution ──
  const handleStartBulkScrape = async () => {
    if (queries.length === 0) {
      setError('Please configure at least one search query.');
      return;
    }

    const invalid = queries.some(q => !q.keyword.trim() || !q.location.trim());
    if (invalid) {
      setError('All queries must specify both a keyword and location.');
      return;
    }

    setLoading(true);
    setError(null);
    setActiveResults([]);

    const payload = {
      name: taskName.trim() || `Bulk Job - ${new Date().toLocaleDateString()}`,
      executionMode,
      concurrency,
      extractCompanyDetails,
      queries: queries.map(q => ({
        keyword: q.keyword.trim(),
        location: q.location.trim(),
        maxResults: q.maxResults
      }))
    };

    try {
      const res = await createAdvancedGoogleJob(payload);
      if (res?.status === 201) {
        const createdJob = res.data;
        setActiveJob(createdJob);
        setTabIndex(1); // switch to logs/details tab
        loadJobsList();
        startPollingJobStatus(createdJob.id);
      }
    } catch (err) {
      setError(err.message || 'Failed to start bulk scraping job.');
    } finally {
      setLoading(false);
    }
  };

  // ── Export functionality ──
  const handleDownloadCSV = () => {
    if (!activeResults || activeResults.length === 0) return;

    const columns = [
      'storeName', 'category', 'phone', 'bizWebsite', 'address', 'stars',
      'numberOfReviews', 'priceLevel', 'hours', 'latitude', 'longitude',
      'searchKeyword', 'searchLocation', 'scrapedAt'
    ];

    const csv = [
      columns.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(','),
      ...activeResults.map(row => columns.map(col => {
        const val = row[col] === null || row[col] === undefined ? '' : row[col];
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bulk_results_${activeJob.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.csv`;
    link.click();
  };

  const handleDownloadJSON = () => {
    if (!activeResults || activeResults.length === 0) return;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeResults, null, 2));
    const link = document.createElement('a');
    link.href = dataStr;
    link.download = `bulk_results_${activeJob.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.json`;
    link.click();
  };

  const handleImportQueries = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const ext = file.name.split('.').pop().toLowerCase();
    
    try {
      if (ext === 'csv') {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target.result;
          parseCsvQueries(text);
        };
        reader.readAsText(file);
      } else if (['xlsx', 'xls'].includes(ext)) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const data = new Uint8Array(event.target.result);
            const XLSX = await import('xlsx');
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            parseExcelRows(json);
          } catch (err) {
            setError('Failed to parse Excel file: ' + err.message);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        setError('Unsupported file type. Please upload a CSV or Excel file.');
      }
    } catch (err) {
      setError('Import failed: ' + err.message);
    }

    // Reset input
    e.target.value = '';
  };

  const parseCsvQueries = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed = [];
    
    const startIdx = (lines[0].toLowerCase().includes('keyword') || lines[0].toLowerCase().includes('query')) ? 1 : 0;
    
    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      if (parts.length > 0) {
        const keyword = parts[0].replace(/^"|"$/g, '').trim();
        const location = parts[1] ? parts[1].replace(/^"|"$/g, '').trim() : defaultLocation;
        const maxResults = parts[2] ? parseInt(parts[2].replace(/^"|"$/g, '').trim(), 10) || defaultMaxResults : defaultMaxResults;
        if (keyword) {
          parsed.push({ keyword, location, maxResults });
        }
      }
    }
    
    if (parsed.length > 0) {
      setQueries((prev) => [...prev, ...parsed]);
    } else {
      setError('No valid queries found in CSV.');
    }
  };

  const parseExcelRows = (rows) => {
    if (rows.length === 0) return;
    
    const parsed = [];
    const headers = rows[0].map(h => String(h).toLowerCase().trim());
    
    let keyIdx = headers.indexOf('keyword');
    if (keyIdx === -1) keyIdx = headers.indexOf('query');
    if (keyIdx === -1) keyIdx = headers.findIndex(h => h.includes('search'));
    if (keyIdx === -1) keyIdx = 0;
    
    let locIdx = headers.indexOf('location');
    if (locIdx === -1) locIdx = headers.indexOf('place');
    if (locIdx === -1) locIdx = headers.findIndex(h => h.includes('city') || h.includes('address'));
    if (locIdx === -1) locIdx = 1;
    
    let limitIdx = headers.indexOf('limit');
    if (limitIdx === -1) limitIdx = headers.indexOf('maxresults');
    if (limitIdx === -1) limitIdx = headers.indexOf('max results');
    
    const startRow = (headers.includes('keyword') || headers.includes('location') || headers.includes('query')) ? 1 : 0;
    
    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i];
      const keyword = row[keyIdx] ? String(row[keyIdx]).trim() : '';
      const location = row[locIdx] ? String(row[locIdx]).trim() : defaultLocation;
      const maxResults = limitIdx !== -1 && row[limitIdx] ? parseInt(row[limitIdx], 10) || defaultMaxResults : defaultMaxResults;
      
      if (keyword) {
        parsed.push({ keyword, location, maxResults });
      }
    }
    
    if (parsed.length > 0) {
      setQueries((prev) => [...prev, ...parsed]);
    } else {
      setError('No valid queries found in Excel sheet.');
    }
  };

  // ── Render Status Helper ──
  const getStatusChip = (status) => {
    const config = {
      Pending: { color: 'default', icon: <HourglassEmptyIcon fontSize="small" /> },
      Running: { color: 'primary', icon: <AutorenewIcon className="spin-animation" fontSize="small" /> },
      Completed: { color: 'success', icon: <CheckCircleIcon fontSize="small" /> },
      Failed: { color: 'error', icon: <ErrorIcon fontSize="small" /> },
      Cancelled: { color: 'warning', icon: <CancelIcon fontSize="small" /> }
    };

    const c = config[status] || { color: 'default', icon: null };
    return <Chip label={status} size="small" color={c.color} icon={c.icon} sx={{ fontWeight: 600 }} />;
  };

  // ── Progress calculations ──
  const getJobProgress = () => {
    if (!activeJob || !activeJob.queries) return 0;
    const completed = activeJob.queries.filter(q => ['Completed', 'Failed', 'Cancelled'].includes(q.status)).length;
    return Math.round((completed / activeJob.queries.length) * 100);
  };

  const getResultsCount = () => activeResults.length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ── Heading Banner ── */}
      <Paper elevation={0} sx={paperSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Box sx={iconBoxSx}>
            <AutoAwesomeMotionIcon />
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#111111' }}>
              Advanced Google Scraper
            </Typography>
            <Typography variant="body2" sx={{ color: '#6b7280' }}>
              Create bulk scraping jobs, query multiple search configurations, and aggregate results in one export.
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        <Tabs value={tabIndex} onChange={(_, val) => setTabIndex(val)} textColor="inherit" sx={{ '& .MuiTabs-indicator': { bgcolor: '#111111' } }}>
          <Tab label="Create Bulk Task" sx={{ fontWeight: 600 }} />
          <Tab label="Task Monitor & Logs" sx={{ fontWeight: 600 }} />
        </Tabs>
      </Paper>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: 2, border: '1px solid #fecaca' }}>
          {error}
        </Alert>
      )}

      {/* ── Tab 0: Create Bulk Task ── */}
      {tabIndex === 0 && (
        <Grid container spacing={3}>
          {/* Left Column: Job Configuration & Bulk Textarea */}
          <Grid item xs={12} lg={5} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Paper elevation={0} sx={paperSx}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#111111', mb: 2 }}>
                Job Settings
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <TextField
                  label="Task Name"
                  placeholder="e.g. Dubai Hotels & Retail"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  fullWidth
                  sx={inputSx}
                />

                <FormControl component="fieldset">
                  <FormLabel sx={{ fontWeight: 600, color: '#111111', mb: 1, fontSize: '0.85rem' }}>Execution Mode</FormLabel>
                  <RadioGroup row value={executionMode} onChange={(e) => setExecutionMode(e.target.value)}>
                    <FormControlLabel value="sequential" control={<Radio sx={{ '&.Mui-checked': { color: '#111111' } }} />} label="Sequential" />
                    <FormControlLabel value="parallel" control={<Radio sx={{ '&.Mui-checked': { color: '#111111' } }} />} label="Parallel" />
                  </RadioGroup>
                </FormControl>

                {executionMode === 'parallel' && (
                  <Box>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 600, color: '#111111' }}>
                      Concurrency Limit: {concurrency} active tabs
                    </Typography>
                    <Slider
                      value={concurrency}
                      onChange={(_, val) => setConcurrency(val)}
                      min={1}
                      max={5}
                      step={1}
                      marks
                      sx={{ color: '#111111' }}
                    />
                  </Box>
                )}

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={extractCompanyDetails}
                      onChange={(e) => setExtractCompanyDetails(e.target.checked)}
                      sx={{ '&.Mui-checked': { color: '#111111' } }}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#111111' }}>
                        Extract Company Details
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#6b7280', display: 'block' }}>
                        Crawls business websites for emails, phone numbers, and social links.
                      </Typography>
                    </Box>
                  }
                />

                <Divider />

                <Typography variant="caption" sx={{ fontWeight: 600, color: '#6b7280' }}>
                  Default query parameters used when parsing text inputs:
                </Typography>

                <TextField
                  label="Default Location"
                  value={defaultLocation}
                  onChange={(e) => setDefaultLocation(e.target.value)}
                  placeholder="Dubai"
                  fullWidth
                  sx={inputSx}
                />

                <Box>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 600, color: '#111111' }}>
                    Default Max Results: {defaultMaxResults} leads/query
                  </Typography>
                  <Slider
                    value={defaultMaxResults}
                    onChange={(_, val) => setDefaultMaxResults(val)}
                    min={5}
                    max={100}
                    step={5}
                    marks={[
                      { value: 5, label: '5' },
                      { value: 20, label: '20' },
                      { value: 50, label: '50' },
                      { value: 100, label: '100' }
                    ]}
                    sx={{ color: '#111111' }}
                  />
                </Box>
              </Box>
            </Paper>

            <Paper elevation={0} sx={paperSx}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#111111', mb: 1 }}>
                Bulk Paste Keywords
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: '#6b7280', mb: 2 }}>
                Enter keywords/queries, one per line. Formats: "Keyword, Location" or "Keyword in Location" or just "Keyword" (uses Default Location). Coordinates accepted.
              </Typography>

              <TextField
                multiline
                rows={6}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="restaurant near Dubai&#10;cafe near Abu Dhabi&#10;auto repair Tokyo&#10;plumber, 40.7128, -74.0060"
                fullWidth
                sx={inputSx}
              />

              <Button
                variant="outlined"
                color="inherit"
                onClick={handleParseQueries}
                startIcon={<ListAltIcon />}
                fullWidth
                sx={{ mt: 2, py: 1.25, fontWeight: 600, border: '1px solid #111111', '&:hover': { border: '2px solid #111111', bgcolor: '#f9f9f9' } }}
              >
                Parse & Add to List
              </Button>
            </Paper>
          </Grid>

          {/* Right Column: Configured Queries list and execution */}
          <Grid item xs={12} lg={7}>
            <Paper elevation={0} sx={{ ...paperSx, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#111111' }}>
                    Configured Queries ({queries.length})
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#6b7280' }}>
                    Review or manually adjust query criteria before executing
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    component="label"
                    color="inherit"
                    startIcon={<ListAltIcon />}
                    sx={{ fontWeight: 600 }}
                  >
                    Import CSV/Excel
                    <input
                      type="file"
                      hidden
                      accept=".csv,.xlsx,.xls"
                      onChange={handleImportQueries}
                    />
                  </Button>
                  <Button size="small" color="inherit" onClick={handleClearQueriesList} disabled={queries.length === 0} sx={{ fontWeight: 600 }}>
                    Clear All
                  </Button>
                  <Button size="small" color="inherit" startIcon={<AddIcon />} onClick={handleAddEmptyQuery} sx={{ fontWeight: 600 }}>
                    Add Row
                  </Button>
                </Box>
              </Box>

              <TableContainer sx={{ flexGrow: 1, border: '1px solid #e5e5e5', borderRadius: 2, maxHeight: 420, overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ '& th': { bgcolor: '#fafafa', fontWeight: 600 } }}>
                      <TableCell>Keyword</TableCell>
                      <TableCell>Location / Coords</TableCell>
                      <TableCell width={110}>Limit</TableCell>
                      <TableCell width={50} align="center"></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {queries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 6, color: '#9ca3af' }}>
                          No queries configured. Add manually or parse bulk text.
                        </TableCell>
                      </TableRow>
                    ) : (
                      queries.map((query, index) => (
                        <TableRow key={index} sx={{ '&:hover': { bgcolor: '#fafafa' } }}>
                          <TableCell>
                            <TextField
                              value={query.keyword}
                              onChange={(e) => handleUpdateQueryField(index, 'keyword', e.target.value)}
                              placeholder="e.g. Hotel"
                              variant="standard"
                              fullWidth
                              InputProps={{ disableUnderline: true }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              value={query.location}
                              onChange={(e) => handleUpdateQueryField(index, 'location', e.target.value)}
                              placeholder="e.g. Dubai"
                              variant="standard"
                              fullWidth
                              InputProps={{ disableUnderline: true }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              value={query.maxResults}
                              onChange={(e) => handleUpdateQueryField(index, 'maxResults', parseInt(e.target.value, 10) || 10)}
                              type="number"
                              variant="standard"
                              fullWidth
                              InputProps={{ disableUnderline: true }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton size="small" onClick={() => handleRemoveQuery(index)} color="error">
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Button
                variant="contained"
                size="large"
                disabled={queries.length === 0 || loading}
                onClick={handleStartBulkScrape}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <RocketLaunchIcon />}
                sx={{
                  mt: 3, py: 1.75, fontSize: '1rem', fontWeight: 600, borderRadius: 2.5,
                  background: queries.length === 0 ? '#d1d5db' : '#111111',
                  boxShadow: 'none',
                  '&:hover': { background: '#333333' }
                }}
              >
                {loading ? 'Starting Task...' : 'Launch Bulk Scraper Task'}
              </Button>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ── Tab 1: Task Monitor & Logs ── */}
      {tabIndex === 1 && (
        <Grid container spacing={3}>
          {/* Left Column: Job History List */}
          <Grid item xs={12} lg={4}>
            <Paper elevation={0} sx={{ ...paperSx, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#111111' }}>
                  Task History
                </Typography>
                <IconButton size="small" onClick={loadJobsList}>
                  <RefreshIcon />
                </IconButton>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: 600, overflow: 'auto' }}>
                {jobs.length === 0 ? (
                  <Typography variant="body2" sx={{ color: '#9ca3af', textAlign: 'center', py: 4 }}>
                    No scraping history found.
                  </Typography>
                ) : (
                  jobs.map((job) => {
                    const isSelected = activeJob?.id === job.id;
                    const completedQueries = job.queries?.filter(q => ['Completed', 'Failed', 'Cancelled'].includes(q.status))?.length || 0;
                    const totalQueries = job.queries?.length || 0;

                    return (
                      <Card
                        key={job.id}
                        variant="outlined"
                        onClick={() => handleSelectJob(job)}
                        sx={{
                          cursor: 'pointer',
                          borderColor: isSelected ? '#111111' : '#e5e5e5',
                          borderWidth: isSelected ? '1.5px' : '1px',
                          bgcolor: isSelected ? '#fcfcfc' : '#ffffff',
                          transition: 'all 0.2s',
                          '&:hover': { bgcolor: '#fafafa', transform: 'translateY(-1px)' }
                        }}
                      >
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#111111' }}>
                              {job.name}
                            </Typography>
                            {getStatusChip(job.status)}
                          </Box>
                          
                          <Typography variant="caption" sx={{ display: 'block', color: '#6b7280', mb: 1.5 }}>
                            Created: {new Date(job.createdAt).toLocaleString()}
                          </Typography>

                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 600 }}>
                              Progress: {completedQueries} / {totalQueries} queries ({job.executionMode})
                            </Typography>
                            
                            <IconButton size="small" color="error" onClick={(e) => handleDeleteJob(job.id, e)}>
                              <DeleteIcon fontSize="inherit" />
                            </IconButton>
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </Box>
            </Paper>
          </Grid>

          {/* Right Column: Selected Job Details & Combined Results */}
          <Grid item xs={12} lg={8}>
            {activeJob ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Active Job Progress Header */}
                <Paper elevation={0} sx={paperSx}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {activeJob.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#6b7280', display: 'block' }}>
                        Job ID: {activeJob.id} | Mode: {activeJob.executionMode} {activeJob.executionMode === 'parallel' ? `(concurrency: ${activeJob.concurrency})` : ''}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {getStatusChip(activeJob.status)}
                      
                      {['Pending', 'Running'].includes(activeJob.status) && (
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          startIcon={<CancelIcon />}
                          onClick={(e) => handleDeleteJob(activeJob.id, e)}
                          sx={{ fontWeight: 600 }}
                        >
                          Abort
                        </Button>
                      )}

                      {activeResults.length > 0 && (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            startIcon={<DownloadIcon />}
                            onClick={handleDownloadCSV}
                            sx={{ background: '#111111', '&:hover': { background: '#333333' }, fontWeight: 600 }}
                          >
                            CSV ({getResultsCount()})
                          </Button>
                          <Button
                            variant="outlined"
                            color="inherit"
                            size="small"
                            startIcon={<DownloadIcon />}
                            onClick={handleDownloadJSON}
                            sx={{ fontWeight: 600, border: '1px solid #111111', '&:hover': { border: '2px solid #111111' } }}
                          >
                            JSON ({getResultsCount()})
                          </Button>
                        </Box>
                      )}
                    </Box>
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Task Progression</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{getJobProgress()}%</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={getJobProgress()}
                      sx={{ height: 8, borderRadius: 1.5, bgcolor: '#f0f0f0', '& .MuiLinearProgress-bar': { bgcolor: '#111111' } }}
                    />
                  </Box>

                  {/* Summary Metric Cards */}
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <Card variant="outlined" sx={{ textAlign: 'center', py: 1.5 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>{activeJob.queries.length}</Typography>
                        <Typography variant="caption" sx={{ color: '#6b7280' }}>Total Queries</Typography>
                      </Card>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Card variant="outlined" sx={{ textAlign: 'center', py: 1.5, borderColor: '#bbf7d0', bgcolor: '#f0fdf4' }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#16a34a' }}>
                          {activeJob.queries.filter(q => q.status === 'Completed').length}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#16a34a' }}>Completed</Typography>
                      </Card>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Card variant="outlined" sx={{ textAlign: 'center', py: 1.5, borderColor: '#fecaca', bgcolor: '#fdf2f2' }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#dc2626' }}>
                          {activeJob.queries.filter(q => q.status === 'Failed').length}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#dc2626' }}>Failed</Typography>
                      </Card>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Card variant="outlined" sx={{ textAlign: 'center', py: 1.5 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>{getResultsCount()}</Typography>
                        <Typography variant="caption" sx={{ color: '#6b7280' }}>Leads Scraped</Typography>
                      </Card>
                    </Grid>
                  </Grid>
                </Paper>

                {/* Live Console Log Terminal */}
                <Paper elevation={0} sx={paperSx}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: consoleOpen ? 2 : 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AutoAwesomeMotionIcon sx={{ fontSize: 20, color: '#111111' }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#111111' }}>
                        Live Console Log
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      color="inherit"
                      onClick={() => setConsoleOpen(!consoleOpen)}
                      sx={{ fontWeight: 600 }}
                    >
                      {consoleOpen ? "Hide Console" : "Show Console"}
                    </Button>
                  </Box>

                  {consoleOpen && (
                    <Box
                      sx={{
                        p: 2,
                        bgcolor: '#1e1e1e',
                        borderRadius: 2,
                        height: 220,
                        overflowY: 'auto',
                        fontFamily: 'Consolas, Monaco, "Courier New", Courier, monospace',
                        fontSize: '0.8rem',
                        color: '#a9b1d6',
                        border: '1px solid #333333',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5,
                        '&::-webkit-scrollbar': {
                          width: '6px',
                        },
                        '&::-webkit-scrollbar-thumb': {
                          background: '#444444',
                          borderRadius: '3px',
                        },
                      }}
                    >
                      {!activeJob.logs || activeJob.logs.length === 0 ? (
                        <Typography variant="caption" sx={{ color: '#555555', fontStyle: 'italic' }}>
                          Console ready. Waiting for task logs...
                        </Typography>
                      ) : (
                        activeJob.logs.map((logStr, idx) => {
                          let color = '#a9b1d6';
                          if (logStr.includes('completed') || logStr.includes('Completed')) color = '#9ece6a';
                          if (logStr.includes('failed') || logStr.includes('Failed') || logStr.includes('failure')) color = '#f7768e';
                          if (logStr.includes('Started') || logStr.includes('started') || logStr.includes('initialized')) color = '#7aa2f7';
                          if (logStr.includes('Navigating') || logStr.includes('Waiting') || logStr.includes('Scrolling') || logStr.includes('Scraping')) color = '#e0af68';
                          
                          return (
                            <Box key={idx} sx={{ color, whiteSpace: 'pre-wrap' }}>
                              {logStr}
                            </Box>
                          );
                        })
                      )}
                      <div ref={terminalEndRef} />
                    </Box>
                  )}
                </Paper>

                {/* Sub-Queries logs list */}
                <Paper elevation={0} sx={paperSx}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#111111', mb: 2 }}>
                    Query Execution Logs
                  </Typography>

                  <TableContainer sx={{ border: '1px solid #e5e5e5', borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ '& th': { bgcolor: '#fafafa', fontWeight: 600 } }}>
                          <TableCell>Query details</TableCell>
                          <TableCell width={120}>Status</TableCell>
                          <TableCell width={100} align="right">Count</TableCell>
                          <TableCell width={100} align="right">Limit</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {activeJob.queries.map((query) => (
                          <TableRow key={query.id} sx={{ '&:hover': { bgcolor: '#fafafa' } }}>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#111111' }}>
                                {query.keyword}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#6b7280' }}>
                                Location: {query.location}
                              </Typography>
                              {query.error && (
                                <Tooltip title={query.error}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, color: '#dc2626' }}>
                                    <InfoIcon sx={{ fontSize: 14 }} />
                                    <Typography variant="caption" sx={{ display: 'block', maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {query.error}
                                    </Typography>
                                  </Box>
                                </Tooltip>
                              )}
                            </TableCell>
                            <TableCell>{getStatusChip(query.status)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>{query.resultCount}</TableCell>
                            <TableCell align="right">{query.maxResults}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>

                {/* Combined Results Table */}
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#111111', mb: 1 }}>
                    Aggregated Search Results
                  </Typography>
                  {loading ? (
                    <Paper elevation={0} sx={{ ...paperSx, textAlign: 'center', py: 8 }}>
                      <CircularProgress color="inherit" size={32} sx={{ mb: 2 }} />
                      <Typography variant="body2" sx={{ color: '#6b7280' }}>Loading job results...</Typography>
                    </Paper>
                  ) : (
                    <ResultsTable results={activeResults} scraperId="advanced-google-scrape" />
                  )}
                </Box>
              </Box>
            ) : (
              <Paper elevation={0} sx={{ ...paperSx, textAlign: 'center', py: 12 }}>
                <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyCenter: 'center', margin: '0 auto 16px', justifyContent: 'center' }}>
                  <AutoAwesomeMotionIcon sx={{ fontSize: 32, color: '#9ca3af' }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#111111', mb: 1 }}>
                  No Active Task Monitored
                </Typography>
                <Typography variant="body2" sx={{ color: '#6b7280', mb: 3 }}>
                  Select a past scraping task from the History list, or configure and launch a new bulk scrape job.
                </Typography>
              </Paper>
            )}
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default AdvancedGoogleScraper;
