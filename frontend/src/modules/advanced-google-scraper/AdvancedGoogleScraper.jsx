import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Paper, TextField, Button, Typography, CircularProgress,
  Alert, Chip, Slider, Fade, LinearProgress, Radio, RadioGroup,
  FormControlLabel, FormControl, FormLabel, Tabs, Tab, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Grid, Card, CardContent, Divider, Tooltip, Checkbox,
  InputLabel, Select, MenuItem
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
} from '../../services/api';
import JobResultsTable from './JobResultsTable';
import { tokens } from '../../theme/theme';

// ─── Styles ──────────────────────────────────────────────────────────
const paperSx = {
  p: 3,
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
};

const iconBoxSx = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 44, height: 44, borderRadius: '10px',
  bgcolor: `${tokens.primary}12`,
  color: tokens.primary,
};

const inputSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: '#fafafa',
    borderRadius: '8px',
    transition: 'all 0.2s',
    '&:hover': { backgroundColor: '#f5f5f5' },
    '&.Mui-focused': { backgroundColor: '#ffffff', '& fieldset': { borderWidth: '2px' } },
  },
  '& .MuiInputLabel-root': { fontWeight: 500, fontSize: '0.875rem' },
  '& .MuiInputBase-input': { py: 1.25, px: 1.5 },
};

const AdvancedGoogleScraper = () => {
  // ── Tab state ──
  const [tabIndex, setTabIndex] = useState(0);
  const [monitorTabIndex, setMonitorTabIndex] = useState(0);

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
  const terminalScrollRef = useRef(null);
  const [consoleOpen, setConsoleOpen] = useState(true);

  // Auto-scroll terminal log internally without jumping main viewport
  useEffect(() => {
    if (activeJob?.logs && terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
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
        console.error('Polling job failed:', err);
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
    if (rows.length === 0) {
      setError('Excel file is empty');
      return;
    }

    const startIdx = (String(rows[0][0]).toLowerCase().includes('keyword') || String(rows[0][0]).toLowerCase().includes('query')) ? 1 : 0;
    const parsed = [];

    for (let i = startIdx; i < rows.length; i++) {
      const row = rows[i];
      const keyword = row[0] ? String(row[0]).trim() : '';
      const location = row[1] ? String(row[1]).trim() : defaultLocation;
      const maxResults = row[2] ? parseInt(row[2], 10) || defaultMaxResults : defaultMaxResults;

      if (keyword) {
        parsed.push({ keyword, location, maxResults });
      }
    }

    if (parsed.length > 0) {
      setQueries((prev) => [...prev, ...parsed]);
    } else {
      setError('No valid queries found in Excel file.');
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
    return <Chip label={status} size="small" color={c.color} icon={c.icon} sx={{ fontWeight: 600, borderRadius: '16px' }} />;
  };

  // ── Progress calculations ──
  const getJobProgress = () => {
    if (!activeJob || !activeJob.queries) return 0;
    const completed = activeJob.queries.filter(q => ['Completed', 'Failed', 'Cancelled'].includes(q.status)).length;
    return Math.round((completed / activeJob.queries.length) * 100);
  };

  const getResultsCount = () => activeResults.length;

  return (
    <Box className="animate-fade-in" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ── Compact Heading Banner ── */}
      <Paper sx={{ p: 2, borderRadius: '12px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Box sx={iconBoxSx}>
            <AutoAwesomeMotionIcon sx={{ fontSize: 22 }} />
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h3" sx={{ lineHeight: 1.2 }}>
              Advanced Google Scraper
            </Typography>
            <Typography sx={{ fontSize: '0.8125rem', color: tokens.textSecondary }}>
              Bulk Google Maps business scraper supporting parallel queries and custom locations
            </Typography>
          </Box>
        </Box>

        <Tabs value={tabIndex} onChange={(_, val) => setTabIndex(val)}>
          <Tab label="Create Bulk Task" />
          <Tab label="Task Monitor & Logs" />
        </Tabs>
      </Paper>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* ── Tab 0: Compact Create Bulk Task ── */}
      {tabIndex === 0 && (
        <Grid container spacing={3}>
          {/* Left Column: Job Configuration & Bulk Textarea */}
          <Grid size={{ xs: 12, lg: 5 }} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Paper sx={paperSx}>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, mb: 2 }}>
                Job Settings
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Task Name"
                  placeholder="e.g. Dubai Hotels & Retail"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  fullWidth
                  size="small"
                  sx={inputSx}
                />

                <FormControl component="fieldset">
                  <FormLabel component="legend" sx={{ fontSize: '0.75rem', fontWeight: 600, mb: 0.5 }}>
                    Execution Mode
                  </FormLabel>
                  <RadioGroup
                    row
                    value={executionMode}
                    onChange={(e) => setExecutionMode(e.target.value)}
                  >
                    <FormControlLabel 
                      value="parallel" 
                      control={<Radio size="small" />} 
                      label={<Typography sx={{ fontSize: '0.8125rem', fontWeight: 500 }}>Parallel</Typography>} 
                    />
                    <FormControlLabel 
                      value="sequential" 
                      control={<Radio size="small" />} 
                      label={<Typography sx={{ fontSize: '0.8125rem', fontWeight: 500 }}>Sequential</Typography>} 
                    />
                  </RadioGroup>
                </FormControl>

                {executionMode === 'parallel' && (
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Concurrency (Parallel Tasks)
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        {concurrency}
                      </Typography>
                    </Box>
                    <Slider
                      value={concurrency}
                      onChange={(_, val) => setConcurrency(val)}
                      min={1}
                      max={4}
                      step={1}
                      marks={[
                        { value: 1, label: '1' },
                        { value: 2, label: '2' },
                        { value: 3, label: '3' },
                        { value: 4, label: '4' }
                      ]}
                      size="small"
                      sx={{
                        '& .MuiSlider-markLabel': { fontSize: '0.65rem' }
                      }}
                    />
                  </Box>
                )}

                <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
                  <TextField
                    label="Default Limit"
                    type="number"
                    value={defaultMaxResults}
                    onChange={(e) => setDefaultMaxResults(Math.max(5, parseInt(e.target.value) || 20))}
                    size="small"
                    sx={{ flex: 1, ...inputSx }}
                  />
                  <TextField
                    label="Default Location"
                    value={defaultLocation}
                    onChange={(e) => setDefaultLocation(e.target.value)}
                    size="small"
                    sx={{ flex: 1.2, ...inputSx }}
                  />
                </Box>

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={extractCompanyDetails}
                      onChange={(e) => setExtractCompanyDetails(e.target.checked)}
                      size="small"
                      sx={{ color: '#64748b' }}
                    />
                  }
                  label={
                    <Box>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                        Deep Scraping (Extract Company Details)
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.1 }}>
                        Extract email, socials, and site details (Takes much longer)
                      </Typography>
                    </Box>
                  }
                  sx={{ mt: 0.5 }}
                />
              </Box>
            </Paper>

            <Paper sx={{ ...paperSx, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, mb: 1 }}>
                Quick Add Queries
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Enter queries one per line. Formats: <br />
                • <code>keyword, location</code> (e.g. <code>plumber, New York</code>)<br />
                • <code>keyword in location</code> (e.g. <code>dentist in London</code>)
              </Typography>

              <TextField
                multiline
                rows={6}
                placeholder="restaurant, Dubai&#10;cafe, Abu Dhabi&#10;gym near Tokyo"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                fullWidth
                size="small"
                sx={{
                  ...inputSx,
                  flexGrow: 1,
                  '& .MuiInputBase-root': { height: '100%', alignItems: 'flex-start' }
                }}
              />

              <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
                <Button
                  component="label"
                  variant="outlined"
                  size="small"
                  sx={{ fontWeight: 600 }}
                >
                  Import file
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    hidden
                    onChange={handleImportQueries}
                  />
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleParseQueries}
                  disabled={!bulkText.trim()}
                  sx={{ fontWeight: 600 }}
                >
                  Parse & Add queries
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* Right Column: Interactive Queries List & Execution Trigger */}
          <Grid size={{ xs: 12, lg: 7 }} sx={{ display: 'flex', flexDirection: 'column' }}>
            <Paper sx={{ ...paperSx, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700 }}>
                    Configured Search Tasks ({queries.length})
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    You can edit keywords, locations, or limits inline.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" color="inherit" onClick={handleClearQueriesList} disabled={queries.length === 0} sx={{ fontWeight: 600 }}>
                    Clear All
                  </Button>
                  <Button size="small" color="inherit" startIcon={<AddIcon />} onClick={handleAddEmptyQuery} sx={{ fontWeight: 600 }}>
                    Add Row
                  </Button>
                </Box>
              </Box>

              <TableContainer sx={{ flexGrow: 1, border: `1px solid ${tokens.border}`, borderRadius: '8px', maxHeight: 350, overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell width={40} align="center">#</TableCell>
                      <TableCell>Keyword / Niche</TableCell>
                      <TableCell>City / Location</TableCell>
                      <TableCell width={100}>Max Results</TableCell>
                      <TableCell width={50} align="center">Delete</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {queries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                          No queries configured. Type some queries on the left panel or import a file.
                        </TableCell>
                      </TableRow>
                    ) : (
                      queries.map((query, index) => (
                        <TableRow key={index} sx={{ '& td': { py: 0.5 } }}>
                          <TableCell align="center">{index + 1}</TableCell>
                          <TableCell>
                            <TextField
                              value={query.keyword}
                              placeholder="e.g. Cafe"
                              onChange={(e) => handleUpdateQueryField(index, 'keyword', e.target.value)}
                              fullWidth
                              size="small"
                              variant="standard"
                              InputProps={{ disableUnderline: true }}
                              sx={{ '& input': { fontSize: '0.8125rem', py: 0.5 } }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              value={query.location}
                              placeholder="e.g. Dubai"
                              onChange={(e) => handleUpdateQueryField(index, 'location', e.target.value)}
                              fullWidth
                              size="small"
                              variant="standard"
                              InputProps={{ disableUnderline: true }}
                              sx={{ '& input': { fontSize: '0.8125rem', py: 0.5 } }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              value={query.maxResults}
                              onChange={(e) => handleUpdateQueryField(index, 'maxResults', Math.max(5, parseInt(e.target.value) || 5))}
                              fullWidth
                              size="small"
                              variant="standard"
                              InputProps={{ disableUnderline: true }}
                              sx={{ '& input': { fontSize: '0.8125rem', py: 0.5 } }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton size="small" onClick={() => handleRemoveQuery(index)} sx={{ color: 'text.secondary', borderRadius: '8px' }}>
                              <DeleteIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ borderTop: `1px solid ${tokens.border}`, pt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Estimated execution time: {queries.length * (extractCompanyDetails ? 20 : 6)} seconds
                </Typography>
                
                <Button
                  variant="contained"
                  disabled={queries.length === 0 || loading}
                  startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <RocketLaunchIcon />}
                  onClick={handleStartBulkScrape}
                  sx={{
                    py: 1.25, px: 3, fontSize: '0.875rem', fontWeight: 600,
                  }}
                >
                  Launch Bulk Scrape
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ── Tab 1: Monitor Task Status, Live Terminal Logs & Final Results ── */}
      {tabIndex === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Select Job Top Bar */}
          <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, minWidth: 120 }}>
              Select Bulk Job:
            </Typography>
            <FormControl size="small" sx={{ minWidth: 260, flex: { xs: 1, sm: '0 1 350px' } }}>
              <InputLabel id="job-select-label">Choose job history...</InputLabel>
              <Select
                labelId="job-select-label"
                value={activeJob ? activeJob.id : ''}
                onChange={(e) => {
                  const job = jobs.find(j => j.id === e.target.value);
                  if (job) handleSelectJob(job);
                }}
                label="Choose job history..."
              >
                {jobs.length === 0 ? (
                  <MenuItem disabled value="">No jobs found</MenuItem>
                ) : (
                  jobs.map(job => (
                    <MenuItem key={job.id} value={job.id}>
                      {job.name} ({new Date(job.createdAt).toLocaleDateString()} · {job.queries?.length || 0} queries)
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
            <IconButton onClick={loadJobsList}>
              <RefreshIcon sx={{ fontSize: 18 }} />
            </IconButton>
            
            {activeJob && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<DeleteIcon />}
                onClick={(e) => handleDeleteJob(activeJob.id, e)}
                sx={{ ml: 'auto', py: 0.75, height: 32 }}
              >
                Delete Job
              </Button>
            )}
          </Paper>

          {activeJob ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Active Task Info Card */}
                <Paper sx={paperSx}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                        <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>
                          {activeJob.name}
                        </Typography>
                        {getStatusChip(activeJob.status)}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Job ID: {activeJob.id} · Created at: {new Date(activeJob.createdAt).toLocaleString()}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                      {['Completed', 'Failed', 'Cancelled'].includes(activeJob.status) && (
                        <>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<DownloadIcon />}
                            onClick={handleDownloadCSV}
                            disabled={activeResults.length === 0}
                            sx={{ fontWeight: 600 }}
                          >
                            Export CSV
                          </Button>
                          <Button
                            variant="contained"
                            size="small"
                            onClick={handleDownloadJSON}
                            disabled={activeResults.length === 0}
                            sx={{ fontWeight: 600 }}
                          >
                            Export JSON
                          </Button>
                        </>
                      )}
                      {['Pending', 'Running'].includes(activeJob.status) && (
                        <Button
                          variant="outlined"
                          size="small"
                          color="error"
                          startIcon={<CancelIcon />}
                          onClick={(e) => handleDeleteJob(activeJob.id, e)}
                          sx={{ fontWeight: 600, border: '1px solid #fecaca', borderRadius: '8px', '&:hover': { bgcolor: '#fdf2f2' } }}
                        >
                          Abort Job
                        </Button>
                      )}
                    </Box>
                  </Box>

                  <Divider sx={{ mb: 2 }} />

                  {/* Progress Status Bar */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                        Overall Job Progress: {getJobProgress()} ({activeJob.queries?.filter(q => ['Completed', 'Failed', 'Cancelled'].includes(q.status)).length || 0}/{activeJob.queries?.length || 0} completed)
                      </Typography>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: tokens.success }}>
                        {getResultsCount()} leads extracted
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={getJobProgress()}
                      sx={{ height: 6, borderRadius: '4px' }}
                    />
                  </Box>
                </Paper>

                {/* Tabbed Console & Sub-Task logs */}
                <Paper sx={{ ...paperSx, p: 2 }}>
                  <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Tabs value={monitorTabIndex} onChange={(_, val) => setMonitorTabIndex(val)}>
                      <Tab label="Live Console Logs" sx={{ py: 1, minHeight: 0 }} />
                      <Tab label="Sub-Queries Execution" sx={{ py: 1, minHeight: 0 }} />
                    </Tabs>
                    <Chip
                      label={activeJob.status === 'Running' ? 'Active' : 'Archived'}
                      size="small"
                      color={activeJob.status === 'Running' ? 'primary' : 'default'}
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
                    />
                  </Box>

                  {monitorTabIndex === 0 ? (
                    /* Console Logs tab */
                    <Paper elevation={0} sx={{ p: 0, bgcolor: '#1a1b26', overflow: 'hidden', borderRadius: '8px' }}>
                      <Box
                        ref={terminalScrollRef}
                        sx={{
                          p: 2,
                          height: 200,
                          overflowY: 'auto',
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          bgcolor: '#1a1b26',
                          color: '#a9b1d6',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0.5,
                          '&::-webkit-scrollbar': {
                            width: '6px',
                          },
                          '&::-webkit-scrollbar-track': {
                            background: '#1a1b26',
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
                      </Box>
                    </Paper>
                  ) : (
                    /* Sub-Queries execution status tab */
                    <TableContainer sx={{ border: `1px solid ${tokens.border}`, borderRadius: '8px', maxHeight: 200, overflow: 'auto' }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Query details</TableCell>
                            <TableCell width={120}>Status</TableCell>
                            <TableCell width={100} align="right">Count</TableCell>
                            <TableCell width={100} align="right">Limit</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {activeJob.queries.map((query) => (
                            <TableRow key={query.id}>
                              <TableCell>
                                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                                  {query.keyword}
                                </Typography>
                                <Typography variant="caption" sx={{ color: tokens.textSecondary }}>
                                  Location: {query.location}
                                </Typography>
                                {query.error && (
                                  <Tooltip title={query.error}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, color: tokens.error }}>
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
                              <TableCell align="right" sx={{ color: tokens.textSecondary }}>{query.maxResults}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Paper>

                {/* Combined Results Table */}
                <Box>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, mb: 1.5 }}>
                    Aggregated Search Results
                  </Typography>
                  {loading ? (
                    <Paper sx={{ ...paperSx, textAlign: 'center', py: 8 }}>
                      <CircularProgress size={32} sx={{ mb: 2 }} />
                      <Typography variant="body2" sx={{ color: tokens.textSecondary }}>Loading job results...</Typography>
                    </Paper>
                  ) : (
                    <JobResultsTable results={activeResults} />
                  )}
                </Box>
              </Box>
            ) : (
              <Paper sx={{ ...paperSx, textAlign: 'center', py: 12 }}>
                <Box sx={{ width: 64, height: 64, borderRadius: '12px', bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', margin: '0 auto 16px', justifyContent: 'center' }}>
                  <AutoAwesomeMotionIcon sx={{ fontSize: 32, color: tokens.textMuted }} />
                </Box>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, mb: 1 }}>
                  No Active Task Monitored
                </Typography>
                <Typography variant="body2" sx={{ color: tokens.textSecondary, mb: 3 }}>
                  Select a past scraping task from the History list, or configure and launch a new bulk scrape job.
                </Typography>
              </Paper>
            )}
        </Box>
      )}
    </Box>
  );
};

export default AdvancedGoogleScraper;
