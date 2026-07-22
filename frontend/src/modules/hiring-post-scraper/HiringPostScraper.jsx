import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Paper, TextField, Button, Typography, CircularProgress,
  Alert, Chip, Slider, Fade, LinearProgress, Tabs, Tab, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Grid, Card, CardContent, Divider, Tooltip, Collapse,
  InputAdornment, Select, MenuItem, FormControl, InputLabel, Dialog,
  DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import SearchIcon from '@mui/icons-material/Search';
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
import TerminalIcon from '@mui/icons-material/Terminal';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EmailIcon from '@mui/icons-material/Email';
import LinkIcon from '@mui/icons-material/Link';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FilterListIcon from '@mui/icons-material/FilterList';
import DataObjectIcon from '@mui/icons-material/DataObject';
import VisibilityIcon from '@mui/icons-material/Visibility';

import {
  createHiringPostJob,
  fetchHiringPostJobs,
  fetchHiringPostJobStatus,
  fetchHiringPostJobResults,
  deleteHiringPostJob
} from '../../services/api';
import { tokens } from '../../theme/theme';

// ─── Preset keyword chips ─────────────────────────────────────────────────
const PRESET_KEYWORDS = [
  'MERN Stack Developer', 'React Developer', 'Node.js Developer',
  'Full Stack Developer', 'Python Developer', 'Java Developer',
  'DevOps Engineer', 'UI/UX Designer', 'Flutter Developer',
  'Data Scientist', 'Angular Developer', 'PHP Developer',
  'AWS Cloud Engineer', 'Product Manager', 'QA Engineer',
  'Machine Learning Engineer', 'Blockchain Developer', 'iOS Developer',
];

// ─── Styles ────────────────────────────────────────────────────────────
const paperSx = {
  p: 3,
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
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

const LINKEDIN_BLUE = '#0A66C2';
const LINKEDIN_DARK = '#0F1419';
const LINKEDIN_LIGHT = '#E8F0FE';

// ─── Status helpers ────────────────────────────────────────────────────
const getStatusIcon = (status) => {
  switch (status) {
    case 'Completed': return <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 20 }} />;
    case 'Running': return <AutorenewIcon sx={{ color: LINKEDIN_BLUE, fontSize: 20, animation: 'spin 1.5s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />;
    case 'Failed': return <ErrorIcon sx={{ color: '#dc2626', fontSize: 20 }} />;
    case 'Cancelled': return <CancelIcon sx={{ color: '#9ca3af', fontSize: 20 }} />;
    default: return <HourglassEmptyIcon sx={{ color: '#f59e0b', fontSize: 20 }} />;
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'Completed': return '#16a34a';
    case 'Running': return LINKEDIN_BLUE;
    case 'Failed': return '#dc2626';
    case 'Cancelled': return '#9ca3af';
    default: return '#f59e0b';
  }
};

const getStatusBg = (status) => {
  switch (status) {
    case 'Completed': return '#f0fdf4';
    case 'Running': return LINKEDIN_LIGHT;
    case 'Failed': return '#fef2f2';
    case 'Cancelled': return '#f9fafb';
    default: return '#fffbeb';
  }
};

// ─── Component ─────────────────────────────────────────────────────────
const HiringPostScraper = () => {
  // ── Tab state ──
  const [tabIndex, setTabIndex] = useState(0);

  // ── New Search Form ──
  const [taskName, setTaskName] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [maxPages, setMaxPages] = useState(5);
  const [dateFilter, setDateFilter] = useState('past-week');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // ── Job History ──
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobResults, setJobResults] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const consoleRef = useRef(null);

  // ── Results Filter ──
  const [searchFilter, setSearchFilter] = useState('');
  const [emailFilterOnly, setEmailFilterOnly] = useState(false);

  // ── Post Detail Modal ──
  const [detailPost, setDetailPost] = useState(null);

  // ── Polling refs ──
  const pollingRef = useRef(null);

  // ─── Keyword Management ──────────────────────────────────────────────
  const addKeyword = useCallback(() => {
    const trimmed = keywordInput.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords((prev) => [...prev, trimmed]);
      setKeywordInput('');
    }
  }, [keywordInput, keywords]);

  const removeKeyword = (kw) => {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  };

  const addPreset = (preset) => {
    if (!keywords.includes(preset)) {
      setKeywords((prev) => [...prev, preset]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
  };

  // ─── Submit Job ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (keywords.length === 0) {
      setFormError('Please add at least one keyword.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    setFormSuccess('');

    try {
      const result = await createHiringPostJob({
        name: taskName || `Hiring Search ${new Date().toLocaleDateString()}`,
        keywords,
        maxPages,
        dateFilter,
      });

      setFormSuccess(`Job "${result.data.name}" started successfully! Scraping ${keywords.length} keyword(s).`);
      setKeywords([]);
      setTaskName('');
      setTabIndex(1); // Switch to job history tab
      loadJobs();
    } catch (err) {
      setFormError(err.message || 'Failed to start scraping job.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Load Jobs ───────────────────────────────────────────────────────
  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const result = await fetchHiringPostJobs();
      setJobs(result.data || []);
    } catch (err) {
      console.error('Failed to load jobs:', err);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  // ─── Load Job Status ─────────────────────────────────────────────────
  const loadJobStatus = useCallback(async (jobId) => {
    try {
      const result = await fetchHiringPostJobStatus(jobId);
      setSelectedJob(result.data);

      // Also refresh jobs list to update sidebar
      const allJobs = await fetchHiringPostJobs();
      setJobs(allJobs.data || []);
    } catch (err) {
      console.error('Failed to load job status:', err);
    }
  }, []);

  // ─── Load Job Results ────────────────────────────────────────────────
  const loadJobResults = useCallback(async (jobId) => {
    try {
      const result = await fetchHiringPostJobResults(jobId);
      setJobResults(result.data || []);
    } catch (err) {
      console.error('Failed to load job results:', err);
    }
  }, []);

  // ─── Select a Job ────────────────────────────────────────────────────
  const selectJob = useCallback((jobId) => {
    setSelectedJobId(jobId);
    loadJobStatus(jobId);
    loadJobResults(jobId);
  }, [loadJobStatus, loadJobResults]);

  // ─── Cancel / Delete Job ─────────────────────────────────────────────
  const handleDeleteJob = async (jobId, isRunning = false) => {
    const confirmMsg = isRunning 
      ? 'Are you sure you want to cancel this scraping job?' 
      : 'Are you sure you want to delete this job and all its results?';
    
    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteHiringPostJob(jobId);
      if (isRunning) {
        if (selectedJobId === jobId) {
          // Keep it selected but reload status to show it is Cancelled
          loadJobStatus(jobId);
          loadJobResults(jobId);
        }
      } else {
        if (selectedJobId === jobId) {
          setSelectedJobId(null);
          setSelectedJob(null);
          setJobResults([]);
        }
      }
      loadJobs();
    } catch (err) {
      console.error('Failed to handle job delete/cancel:', err);
    }
  };

  // ─── Export CSV ──────────────────────────────────────────────────────
  const exportCSV = () => {
    if (jobResults.length === 0) return;

    const headers = [
      'Job Position', 'Company Name', 'Hiring Email', 'Post Content',
      'Post URL', 'Posted Date', 'Poster Name', 'Poster Headline',
      'Matched Keywords', 'Search Keyword', 'Scraped At'
    ];

    const escapeCSV = (val) => `"${String(val || '').replace(/"/g, '""')}"`;

    const csvContent = [
      headers.join(','),
      ...filteredResults.map((r) =>
        [
          escapeCSV(r.jobPosition),
          escapeCSV(r.companyName),
          escapeCSV(r.hiringEmail),
          escapeCSV(r.postContent?.slice(0, 500)),
          escapeCSV(r.postUrl),
          escapeCSV(r.postedDate),
          escapeCSV(r.posterName),
          escapeCSV(r.posterHeadline),
          escapeCSV(r.matchedKeywords?.join('; ')),
          escapeCSV(r.searchKeyword),
          escapeCSV(r.scrapedAt),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `hiring_posts_${selectedJob?.name?.replace(/\s+/g, '_') || 'export'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // ─── Export JSON ─────────────────────────────────────────────────────
  const exportJSON = () => {
    if (jobResults.length === 0) return;

    const blob = new Blob([JSON.stringify(filteredResults, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `hiring_posts_${selectedJob?.name?.replace(/\s+/g, '_') || 'export'}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  // ─── Copy to Clipboard ──────────────────────────────────────────────
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  // ─── Filtered Results ────────────────────────────────────────────────
  const filteredResults = jobResults.filter((r) => {
    const matchesSearch = !searchFilter ||
      Object.values(r).some((v) =>
        String(v).toLowerCase().includes(searchFilter.toLowerCase())
      );
    const matchesEmail = !emailFilterOnly ||
      (r.hiringEmail && r.hiringEmail !== 'Not found in post');
    return matchesSearch && matchesEmail;
  });

  // ─── Polling for active jobs ─────────────────────────────────────────
  useEffect(() => {
    if (tabIndex === 1) {
      loadJobs();
    }
  }, [tabIndex, loadJobs]);

  useEffect(() => {
    if (selectedJobId && selectedJob?.status === 'Running') {
      pollingRef.current = setInterval(() => {
        loadJobStatus(selectedJobId);
        loadJobResults(selectedJobId);
      }, 3000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [selectedJobId, selectedJob?.status, loadJobStatus, loadJobResults]);

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: 1 }}>
      {/* Header */}
      <Paper elevation={0} sx={{ ...paperSx, mb: 2, background: `linear-gradient(135deg, ${LINKEDIN_DARK} 0%, #1B2838 100%)`, border: 'none' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 52, height: 52, borderRadius: '14px',
            background: `linear-gradient(135deg, ${LINKEDIN_BLUE} 0%, #004182 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(10, 102, 194, 0.4)'
          }}>
            <WorkOutlineIcon sx={{ fontSize: 28, color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
              LinkedIn Hiring Post Scraper
            </Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.3 }}>
              Find hiring posts on LinkedIn by keyword — extract job positions, company names, emails & more
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Tabs */}
      <Paper elevation={0} sx={{ ...paperSx, mb: 2, p: 0 }}>
        <Tabs
          value={tabIndex}
          onChange={(_, v) => setTabIndex(v)}
          sx={{
            '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', fontSize: '0.9rem', minHeight: 52 },
            '& .Mui-selected': { color: `${LINKEDIN_BLUE} !important` },
            '& .MuiTabs-indicator': { backgroundColor: LINKEDIN_BLUE, height: 3, borderRadius: '3px 3px 0 0' },
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <Tab icon={<SearchIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="New Search" />
          <Tab icon={<WorkOutlineIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Job History${jobs.length > 0 ? ` (${jobs.length})` : ''}`} />
        </Tabs>
      </Paper>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 0: NEW SEARCH                                                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {tabIndex === 0 && (
        <Fade in timeout={300}>
          <Box>
            {/* Task Name */}
            <Paper elevation={0} sx={{ ...paperSx, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', mb: 1.5, fontSize: '0.95rem' }}>
                Task Name (optional)
              </Typography>
              <TextField
                fullWidth size="small" sx={inputSx}
                placeholder="e.g., Weekly MERN Hiring Search"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
              />
            </Paper>

            {/* Keyword Input */}
            <Paper elevation={0} sx={{ ...paperSx, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', mb: 0.5, fontSize: '0.95rem' }}>
                Search Keywords
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1.5 }}>
                Add job titles or keywords to search for hiring posts on LinkedIn
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  fullWidth size="small" sx={inputSx}
                  placeholder="e.g., React Developer, Node.js Developer"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                />
                <Button
                  variant="contained"
                  onClick={addKeyword}
                  disabled={!keywordInput.trim()}
                  sx={{
                    minWidth: 100, borderRadius: '8px', textTransform: 'none', fontWeight: 600,
                    bgcolor: LINKEDIN_BLUE, '&:hover': { bgcolor: '#004182' },
                  }}
                  startIcon={<AddIcon />}
                >
                  Add
                </Button>
              </Box>

              {/* Active Keywords */}
              {keywords.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, mb: 0.5, display: 'block' }}>
                    Active Keywords ({keywords.length})
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {keywords.map((kw) => (
                      <Chip
                        key={kw}
                        label={kw}
                        onDelete={() => removeKeyword(kw)}
                        sx={{
                          bgcolor: LINKEDIN_LIGHT, color: LINKEDIN_BLUE,
                          fontWeight: 600, fontSize: '0.8rem', borderRadius: '8px',
                          border: `1px solid ${LINKEDIN_BLUE}20`,
                          '& .MuiChip-deleteIcon': { color: LINKEDIN_BLUE, '&:hover': { color: '#dc2626' } },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Preset Keyword Chips */}
              <Divider sx={{ my: 1.5, borderColor: '#f1f5f9' }} />
              <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, mb: 0.75, display: 'block' }}>
                Quick Add Presets
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {PRESET_KEYWORDS.map((preset) => (
                  <Chip
                    key={preset}
                    label={preset}
                    size="small"
                    onClick={() => addPreset(preset)}
                    disabled={keywords.includes(preset)}
                    sx={{
                      cursor: 'pointer', borderRadius: '6px', fontSize: '0.75rem',
                      bgcolor: keywords.includes(preset) ? '#e2e8f0' : '#f8fafc',
                      border: '1px solid #e2e8f0',
                      '&:hover': { bgcolor: LINKEDIN_LIGHT, borderColor: LINKEDIN_BLUE },
                      transition: 'all 0.15s ease',
                    }}
                  />
                ))}
              </Box>
            </Paper>

            {/* Configuration */}
            <Paper elevation={0} sx={{ ...paperSx, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', mb: 1.5, fontSize: '0.95rem' }}>
                Scraping Configuration
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#475569', display: 'block', mb: 1 }}>
                    Max Pages to Scan: {maxPages}
                  </Typography>
                  <Slider
                    value={maxPages}
                    onChange={(_, v) => setMaxPages(v)}
                    min={1} max={20} step={1}
                    marks={[
                      { value: 1, label: '1' },
                      { value: 5, label: '5' },
                      { value: 10, label: '10' },
                      { value: 15, label: '15' },
                      { value: 20, label: '20' },
                    ]}
                    sx={{
                      color: LINKEDIN_BLUE,
                      '& .MuiSlider-markLabel': { fontSize: '0.7rem', color: '#94a3b8' },
                    }}
                  />
                  <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                    Each page loads ~10 posts. Higher = more results but slower.
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ fontWeight: 600, fontSize: '0.875rem' }}>Date Filter</InputLabel>
                    <Select
                      value={dateFilter}
                      label="Date Filter"
                      onChange={(e) => setDateFilter(e.target.value)}
                      sx={{ borderRadius: '8px', bgcolor: '#fafafa' }}
                    >
                      <MenuItem value="any">Any Time</MenuItem>
                      <MenuItem value="past-24h">Past 24 Hours</MenuItem>
                      <MenuItem value="past-week">Past Week</MenuItem>
                      <MenuItem value="past-month">Past Month</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Paper>

            {/* Alerts */}
            {formError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }} onClose={() => setFormError('')}>
                {formError}
              </Alert>
            )}
            {formSuccess && (
              <Alert severity="success" sx={{ mb: 2, borderRadius: '8px' }} onClose={() => setFormSuccess('')}>
                {formSuccess}
              </Alert>
            )}

            {/* Submit Button */}
            <Paper elevation={0} sx={{ ...paperSx }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ color: '#64748b' }}>
                    {keywords.length === 0
                      ? 'Add keywords above to start scraping'
                      : `Ready to search ${keywords.length} keyword(s) × ${maxPages} pages`}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleSubmit}
                  disabled={keywords.length === 0 || submitting}
                  startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
                  sx={{
                    minWidth: 200, borderRadius: '10px', textTransform: 'none',
                    fontWeight: 700, fontSize: '0.95rem', py: 1.2,
                    bgcolor: LINKEDIN_BLUE,
                    background: `linear-gradient(135deg, ${LINKEDIN_BLUE} 0%, #004182 100%)`,
                    boxShadow: '0 4px 15px rgba(10, 102, 194, 0.3)',
                    '&:hover': { background: `linear-gradient(135deg, #004182 0%, ${LINKEDIN_BLUE} 100%)`, boxShadow: '0 6px 20px rgba(10, 102, 194, 0.4)' },
                    '&.Mui-disabled': { bgcolor: '#94a3b8' },
                  }}
                >
                  {submitting ? 'Starting...' : 'Start Scraping'}
                </Button>
              </Box>

              {/* Info Alert */}
              <Alert severity="info" icon={false} sx={{ mt: 2, borderRadius: '8px', border: '1px solid #bfdbfe', bgcolor: '#eff6ff' }}>
                <Typography variant="caption" sx={{ lineHeight: 1.6, color: '#1e40af' }}>
                  <strong>How it works:</strong> The scraper searches LinkedIn posts using your keywords, scans each post for hiring-related content
                  (e.g., "We're Hiring", "Apply Now", "Send Resume"), and extracts company names, job positions, contact emails, and post details.
                  Only genuine hiring posts are kept — non-hiring content is automatically filtered out.
                </Typography>
              </Alert>
            </Paper>
          </Box>
        </Fade>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: JOB HISTORY & RESULTS                                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {tabIndex === 1 && (
        <Fade in timeout={300}>
          <Box>
            <Grid container spacing={2}>
              {/* Left: Job List */}
              <Grid item xs={12} md={4}>
                <Paper elevation={0} sx={{ ...paperSx }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                      Scraping Jobs
                    </Typography>
                    <IconButton size="small" onClick={loadJobs} disabled={loadingJobs}>
                      <RefreshIcon sx={{ fontSize: 18, animation: loadingJobs ? 'spin 1s linear infinite' : 'none', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />
                    </IconButton>
                  </Box>

                  {jobs.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <WorkOutlineIcon sx={{ fontSize: 48, color: '#e2e8f0', mb: 1 }} />
                      <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                        No scraping jobs yet. Start a new search!
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 500, overflowY: 'auto' }}>
                      {jobs.map((job) => (
                        <Card
                          key={job.id}
                          variant="outlined"
                          onClick={() => selectJob(job.id)}
                          sx={{
                            cursor: 'pointer',
                            borderRadius: '10px',
                            border: selectedJobId === job.id ? `2px solid ${LINKEDIN_BLUE}` : '1px solid #e2e8f0',
                            bgcolor: selectedJobId === job.id ? LINKEDIN_LIGHT : getStatusBg(job.status),
                            transition: 'all 0.2s ease',
                            '&:hover': { borderColor: LINKEDIN_BLUE, transform: 'translateY(-1px)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
                          }}
                        >
                          <CardContent sx={{ p: '12px !important' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              {getStatusIcon(job.status)}
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.82rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {job.name}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  handleDeleteJob(job.id, ['Pending', 'Running'].includes(job.status)); 
                                }}
                                sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: '#dc2626' } }}
                              >
                                {['Pending', 'Running'].includes(job.status) ? (
                                  <CancelIcon sx={{ fontSize: 15 }} />
                                ) : (
                                  <DeleteIcon sx={{ fontSize: 15 }} />
                                )}
                              </IconButton>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              <Chip
                                size="small"
                                label={job.status}
                                sx={{
                                  fontSize: '0.65rem', fontWeight: 700, height: 20,
                                  bgcolor: `${getStatusColor(job.status)}15`,
                                  color: getStatusColor(job.status),
                                  border: `1px solid ${getStatusColor(job.status)}30`,
                                }}
                              />
                              <Chip size="small" label={`${job.keywords?.length || 0} keywords`} sx={{ fontSize: '0.65rem', height: 20 }} />
                              <Chip size="small" label={`${job.totalResults || 0} results`} sx={{ fontSize: '0.65rem', height: 20 }} />
                            </Box>
                            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5, fontSize: '0.65rem' }}>
                              {new Date(job.createdAt).toLocaleString()}
                            </Typography>
                          </CardContent>
                        </Card>
                      ))}
                    </Box>
                  )}
                </Paper>
              </Grid>

              {/* Right: Selected Job Details & Results */}
              <Grid item xs={12} md={8}>
                {!selectedJob ? (
                  <Paper elevation={0} sx={{ ...paperSx, textAlign: 'center', py: 6 }}>
                    <WorkOutlineIcon sx={{ fontSize: 56, color: '#e2e8f0', mb: 1 }} />
                    <Typography variant="body1" sx={{ color: '#94a3b8', fontWeight: 500 }}>
                      Select a job from the left panel to view details & results
                    </Typography>
                  </Paper>
                ) : (
                  <Box>
                    {/* Job Summary */}
                    <Paper elevation={0} sx={{ ...paperSx, mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          {getStatusIcon(selectedJob.status)}
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
                              {selectedJob.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              {selectedJob.keywords?.length} keyword(s) • {selectedJob.totalResults || 0} results found
                            </Typography>
                          </Box>
                        </Box>
                        {selectedJob.status === 'Running' && (
                          <Button
                            size="small" color="error" variant="outlined"
                            startIcon={<CancelIcon />}
                            onClick={() => handleDeleteJob(selectedJob.id, true)}
                            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
                          >
                            Cancel
                          </Button>
                        )}
                      </Box>

                      {/* Progress for running jobs */}
                      {selectedJob.status === 'Running' && (
                        <LinearProgress
                          sx={{
                            mb: 2, borderRadius: '4px', height: 5,
                            bgcolor: `${LINKEDIN_BLUE}15`,
                            '& .MuiLinearProgress-bar': { bgcolor: LINKEDIN_BLUE },
                          }}
                        />
                      )}

                      {/* Keyword Status Chips */}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selectedJob.keywordStatuses?.map((ks, idx) => (
                          <Chip
                            key={idx}
                            icon={getStatusIcon(ks.status)}
                            label={`${ks.keyword} (${ks.resultCount || 0})`}
                            size="small"
                            sx={{
                              fontSize: '0.72rem', fontWeight: 600, borderRadius: '6px',
                              bgcolor: getStatusBg(ks.status),
                              border: `1px solid ${getStatusColor(ks.status)}25`,
                            }}
                          />
                        ))}
                      </Box>
                    </Paper>

                    {/* Console Log Viewer */}
                    <Paper elevation={0} sx={{ ...paperSx, mb: 2, p: 0 }}>
                      <Box
                        onClick={() => setShowConsole(!showConsole)}
                        sx={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          px: 2, py: 1.5, cursor: 'pointer',
                          '&:hover': { bgcolor: '#f8fafc' },
                          borderRadius: showConsole ? '12px 12px 0 0' : '12px',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TerminalIcon sx={{ fontSize: 18, color: '#64748b' }} />
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#475569', fontSize: '0.82rem' }}>
                            Live Console Log
                          </Typography>
                          {selectedJob.logs?.length > 0 && (
                            <Chip label={selectedJob.logs.length} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }} />
                          )}
                        </Box>
                        {showConsole ? <ExpandLessIcon sx={{ fontSize: 20, color: '#94a3b8' }} /> : <ExpandMoreIcon sx={{ fontSize: 20, color: '#94a3b8' }} />}
                      </Box>

                      <Collapse in={showConsole}>
                        <Box
                          ref={consoleRef}
                          sx={{
                            bgcolor: '#1a1b26', borderRadius: '0 0 12px 12px',
                            p: 2, maxHeight: 300, overflowY: 'auto',
                            fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
                            fontSize: '0.72rem', lineHeight: 1.7,
                          }}
                        >
                          {selectedJob.logs?.length > 0 ? (
                            selectedJob.logs.map((line, i) => (
                              <Box key={i} sx={{
                                color: line.includes('✅') ? '#9ece6a' : line.includes('❌') ? '#f7768e' : line.includes('⚠️') ? '#e0af68' : line.includes('───') ? '#7aa2f7' : '#a9b1d6',
                                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                              }}>
                                {line}
                              </Box>
                            ))
                          ) : (
                            <Typography sx={{ color: '#565f89', fontFamily: 'inherit', fontSize: 'inherit' }}>
                              No logs yet...
                            </Typography>
                          )}
                        </Box>
                      </Collapse>
                    </Paper>

                    {/* Results Table */}
                    {jobResults.length > 0 && (
                      <Paper elevation={0} sx={{ ...paperSx }}>
                        {/* Results Header + Filters */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                            Hiring Posts ({filteredResults.length} of {jobResults.length})
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <TextField
                              size="small"
                              placeholder="Search results..."
                              value={searchFilter}
                              onChange={(e) => setSearchFilter(e.target.value)}
                              sx={{ ...inputSx, width: 200 }}
                              InputProps={{
                                startAdornment: (
                                  <InputAdornment position="start">
                                    <FilterListIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
                                  </InputAdornment>
                                ),
                              }}
                            />
                            <Chip
                              icon={<EmailIcon sx={{ fontSize: 14 }} />}
                              label="With Email"
                              size="small"
                              onClick={() => setEmailFilterOnly(!emailFilterOnly)}
                              sx={{
                                cursor: 'pointer', fontWeight: 600, fontSize: '0.7rem',
                                bgcolor: emailFilterOnly ? `${LINKEDIN_BLUE}15` : 'transparent',
                                border: `1px solid ${emailFilterOnly ? LINKEDIN_BLUE : '#e2e8f0'}`,
                                color: emailFilterOnly ? LINKEDIN_BLUE : '#64748b',
                              }}
                            />
                            <Tooltip title="Download CSV">
                              <IconButton size="small" onClick={exportCSV} sx={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                <DownloadIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Download JSON">
                              <IconButton size="small" onClick={exportJSON} sx={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                <DataObjectIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>

                        {/* Results Table */}
                        <TableContainer sx={{ maxHeight: 500, borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <Table stickyHeader size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc', fontSize: '0.75rem', color: '#475569' }}>#</TableCell>
                                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc', fontSize: '0.75rem', color: '#475569' }}>Job Position</TableCell>
                                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc', fontSize: '0.75rem', color: '#475569' }}>Company</TableCell>
                                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc', fontSize: '0.75rem', color: '#475569' }}>Email</TableCell>
                                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc', fontSize: '0.75rem', color: '#475569' }}>Poster</TableCell>
                                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc', fontSize: '0.75rem', color: '#475569' }}>Date</TableCell>
                                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc', fontSize: '0.75rem', color: '#475569' }} align="center">Actions</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {filteredResults.map((post, idx) => (
                                <TableRow
                                  key={post.id || idx}
                                  hover
                                  sx={{
                                    '&:hover': { bgcolor: '#f8fafc' },
                                    transition: 'background-color 0.15s',
                                  }}
                                >
                                  <TableCell sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>{idx + 1}</TableCell>
                                  <TableCell sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#0f172a', maxWidth: 180 }}>
                                    <Typography variant="body2" sx={{ fontSize: '0.78rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {post.jobPosition}
                                    </Typography>
                                  </TableCell>
                                  <TableCell sx={{ fontSize: '0.75rem', color: '#475569', maxWidth: 150 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      <BusinessIcon sx={{ fontSize: 14, color: '#94a3b8' }} />
                                      <Typography variant="body2" sx={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {post.companyName}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell sx={{ fontSize: '0.75rem', maxWidth: 180 }}>
                                    {post.hiringEmail !== 'Not found in post' ? (
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <EmailIcon sx={{ fontSize: 14, color: '#16a34a' }} />
                                        <Typography variant="body2" sx={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {post.hiringEmail}
                                        </Typography>
                                        <IconButton size="small" onClick={() => copyToClipboard(post.hiringEmail)} sx={{ p: 0.25 }}>
                                          <ContentCopyIcon sx={{ fontSize: 12, color: '#94a3b8' }} />
                                        </IconButton>
                                      </Box>
                                    ) : (
                                      <Typography variant="body2" sx={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                        No email found
                                      </Typography>
                                    )}
                                  </TableCell>
                                  <TableCell sx={{ fontSize: '0.75rem', color: '#475569', maxWidth: 120 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      <PersonIcon sx={{ fontSize: 14, color: '#94a3b8' }} />
                                      <Typography variant="body2" sx={{ fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {post.posterName}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell sx={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                    {post.postedDate}
                                  </TableCell>
                                  <TableCell align="center">
                                    <Box sx={{ display: 'flex', gap: 0.25, justifyContent: 'center' }}>
                                      <Tooltip title="View Post Details">
                                        <IconButton size="small" onClick={() => setDetailPost(post)}>
                                          <VisibilityIcon sx={{ fontSize: 16, color: LINKEDIN_BLUE }} />
                                        </IconButton>
                                      </Tooltip>
                                      {post.postUrl && post.postUrl !== 'URL not available' && (
                                        <Tooltip title="Open on LinkedIn">
                                          <IconButton size="small" component="a" href={post.postUrl} target="_blank" rel="noopener noreferrer">
                                            <LinkIcon sx={{ fontSize: 16, color: '#64748b' }} />
                                          </IconButton>
                                        </Tooltip>
                                      )}
                                    </Box>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Paper>
                    )}

                    {/* No results message */}
                    {selectedJob.status === 'Completed' && jobResults.length === 0 && (
                      <Paper elevation={0} sx={{ ...paperSx, textAlign: 'center', py: 4 }}>
                        <Typography variant="body1" sx={{ color: '#94a3b8' }}>
                          No hiring posts were found for this search.
                        </Typography>
                      </Paper>
                    )}
                  </Box>
                )}
              </Grid>
            </Grid>
          </Box>
        </Fade>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* POST DETAIL MODAL                                                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={!!detailPost}
        onClose={() => setDetailPost(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px', maxHeight: '85vh' } }}
      >
        {detailPost && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                  width: 40, height: 40, borderRadius: '10px',
                  bgcolor: LINKEDIN_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <WorkOutlineIcon sx={{ color: LINKEDIN_BLUE, fontSize: 22 }} />
                </Box>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
                    {detailPost.jobPosition}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Posted by {detailPost.posterName} • {detailPost.postedDate}
                  </Typography>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent dividers sx={{ py: 2 }}>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <BusinessIcon sx={{ color: LINKEDIN_BLUE, fontSize: 20 }} />
                    <Box>
                      <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, display: 'block' }}>Company</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>{detailPost.companyName}</Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: detailPost.hiringEmail !== 'Not found in post' ? '#f0fdf4' : '#f8fafc', borderRadius: '8px', border: `1px solid ${detailPost.hiringEmail !== 'Not found in post' ? '#bbf7d0' : '#e2e8f0'}` }}>
                    <EmailIcon sx={{ color: detailPost.hiringEmail !== 'Not found in post' ? '#16a34a' : '#94a3b8', fontSize: 20 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, display: 'block' }}>Hiring Email</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: detailPost.hiringEmail !== 'Not found in post' ? '#16a34a' : '#94a3b8' }}>
                        {detailPost.hiringEmail}
                      </Typography>
                    </Box>
                    {detailPost.hiringEmail !== 'Not found in post' && (
                      <IconButton size="small" onClick={() => copyToClipboard(detailPost.hiringEmail)}>
                        <ContentCopyIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    )}
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <PersonIcon sx={{ color: '#64748b', fontSize: 20 }} />
                    <Box>
                      <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, display: 'block' }}>Poster</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>{detailPost.posterName}</Typography>
                      {detailPost.posterHeadline && (
                        <Typography variant="caption" sx={{ color: '#64748b' }}>{detailPost.posterHeadline}</Typography>
                      )}
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <LinkIcon sx={{ color: '#64748b', fontSize: 20 }} />
                    <Box sx={{ flex: 1, overflow: 'hidden' }}>
                      <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, display: 'block' }}>Post URL</Typography>
                      {detailPost.postUrl && detailPost.postUrl !== 'URL not available' ? (
                        <Typography
                          component="a" href={detailPost.postUrl} target="_blank" rel="noopener noreferrer"
                          variant="body2"
                          sx={{ fontWeight: 500, color: LINKEDIN_BLUE, textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' } }}
                        >
                          {detailPost.postUrl}
                        </Typography>
                      ) : (
                        <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>Not available</Typography>
                      )}
                    </Box>
                  </Box>
                </Grid>
              </Grid>

              {/* Matched Keywords */}
              {detailPost.matchedKeywords?.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748b', display: 'block', mb: 0.5 }}>
                    Matched Hiring Keywords
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {detailPost.matchedKeywords.map((kw, i) => (
                      <Chip key={i} label={kw} size="small" sx={{ fontSize: '0.7rem', fontWeight: 600, bgcolor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }} />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Post Content */}
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748b', display: 'block', mb: 0.5 }}>
                Full Post Content
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: '8px', bgcolor: '#fafafa', border: '1px solid #e2e8f0', maxHeight: 300, overflowY: 'auto' }}>
                <Typography variant="body2" sx={{ color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {detailPost.postContent}
                </Typography>
              </Paper>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              {detailPost.postUrl && detailPost.postUrl !== 'URL not available' && (
                <Button
                  variant="outlined"
                  component="a" href={detailPost.postUrl} target="_blank" rel="noopener noreferrer"
                  startIcon={<LinkIcon />}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, borderColor: LINKEDIN_BLUE, color: LINKEDIN_BLUE }}
                >
                  Open on LinkedIn
                </Button>
              )}
              <Button
                variant="contained"
                onClick={() => setDetailPost(null)}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, bgcolor: LINKEDIN_BLUE }}
              >
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default HiringPostScraper;
