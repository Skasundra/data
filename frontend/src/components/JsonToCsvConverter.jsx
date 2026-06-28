import { useState, useCallback, useEffect } from 'react';
import {
  Box, Paper, Button, Typography, CircularProgress, Alert, Chip,
  Checkbox, FormGroup, LinearProgress,
  Fade, Select, MenuItem, FormControl, InputLabel, IconButton,
  Tooltip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import StorageIcon from '@mui/icons-material/Storage';
import FilterListIcon from '@mui/icons-material/FilterList';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import DeselectIcon from '@mui/icons-material/Deselect';
import PreviewIcon from '@mui/icons-material/Preview';
import TableChartIcon from '@mui/icons-material/TableChart';
import SettingsIcon from '@mui/icons-material/Settings';
import DescriptionIcon from '@mui/icons-material/Description';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import CategoryIcon from '@mui/icons-material/Category';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import GridOnIcon from '@mui/icons-material/GridOn';
import { fetchServerJsonFiles, parseJsonForCsv, convertJsonToCsv } from '../services/api';

// ─── Styles ──────────────────────────────────────────────────────────────────
const paperSx = { p: 4, background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 3 };
const iconBoxSx = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 56, height: 56, borderRadius: 2.5,
  background: '#111111', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', color: '#ffffff',
};

const JsonToCsvConverter = () => {
  // ── State ──
  const [serverFiles, setServerFiles] = useState([]);
  const [selectedServerFile, setSelectedServerFile] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [selectedFields, setSelectedFields] = useState(new Set());
  const [allowEmpty, setAllowEmpty] = useState(new Set());
  const [exportMode, setExportMode] = useState('single');
  const [outputFormat, setOutputFormat] = useState('csv');
  const [filterCity, setFilterCity] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // ── Load server files on mount ──
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchServerJsonFiles();
        if (res?.data) setServerFiles(res.data);
      } catch { /* ignore */ }
    };
    load();
  }, []);

  // ── Parse JSON ──
  const handleParse = useCallback(async () => {
    setError(null);
    setSuccess(null);
    setParsedData(null);
    setParsing(true);

    try {
      let payload = {};
      if (selectedServerFile) {
        payload = { filePath: selectedServerFile };
      } else if (uploadedFile) {
        // For uploaded files, read as text and send as jsonContent
        const text = await uploadedFile.text();
        payload = { jsonContent: text };
      } else {
        setError('Please select a server file or upload a JSON file');
        setParsing(false);
        return;
      }

      const res = await parseJsonForCsv(payload);
      if (res?.data) {
        setParsedData(res.data);
        setSelectedFields(new Set(res.data.fields));
        setSuccess(`Parsed ${res.data.totalRecords} records with ${res.data.fields.length} fields`);
      }
    } catch (err) {
      setError(err.message || 'Failed to parse JSON');
    } finally {
      setParsing(false);
    }
  }, [selectedServerFile, uploadedFile]);

  // ── Export CSV ──
  const handleExport = useCallback(async () => {
    setError(null);
    setExporting(true);

    try {
      let payload = {
        selectedFields: [...selectedFields],
        allowEmpty: [...allowEmpty],
        exportMode,
        outputFormat,
      };

      if (filterCity) payload.filterCity = filterCity;
      if (filterCategory) payload.filterCategory = filterCategory;

      if (selectedServerFile) {
        payload.filePath = selectedServerFile;
      } else if (uploadedFile) {
        const text = await uploadedFile.text();
        payload.jsonContent = text;
      }

      const response = await convertJsonToCsv(payload);

      // Determine file extension based on output format and mode
      let ext = 'csv';
      if (outputFormat === 'excel') {
        ext = 'xlsx';
      } else if (exportMode !== 'single' && parsedData?.isGmapsFormat) {
        ext = 'zip'; // multiple CSV files bundled
      }

      // Download the blob
      const blob = new Blob([response.data], {
        type: outputFormat === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : ext === 'zip' ? 'application/zip' : 'text/csv;charset=utf-8;',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `export_${exportMode}_${Date.now()}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSuccess(`Export complete! Downloaded as .${ext} file`);
    } catch (err) {
      setError(err.message || 'Failed to export');
    } finally {
      setExporting(false);
    }
  }, [selectedFields, allowEmpty, exportMode, outputFormat, filterCity, filterCategory, selectedServerFile, uploadedFile, parsedData]);

  // ── Field selection helpers ──
  const toggleField = (field) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
        // Also remove from allowEmpty if deselected
        setAllowEmpty((r) => { const n = new Set(r); n.delete(field); return n; });
      } else {
        next.add(field);
      }
      return next;
    });
  };

  const toggleAllowEmpty = (field) => {
    setAllowEmpty((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const selectAll = () => {
    if (parsedData) setSelectedFields(new Set(parsedData.fields));
  };

  const deselectAll = () => { setSelectedFields(new Set()); setAllowEmpty(new Set()); };

  // ── File upload handler ──
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith('.json')) {
        setError('Please upload a valid JSON file');
        return;
      }
      setUploadedFile(file);
      setSelectedServerFile('');
      setError(null);
    }
  };

  // ── Filtered record count ──
  const getFilteredCount = () => {
    if (!parsedData) return 0;
    let count = parsedData.totalRecords;
    if (parsedData.isGmapsFormat && (filterCity || filterCategory)) {
      // Approximate — actual count determined at export
      return `~${count} (filtered)`;
    }
    return count;
  };

  // ── Render ──
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ── Header ── */}
      <Paper elevation={0} sx={paperSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Box sx={iconBoxSx}><TableChartIcon /></Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#111111' }}>
              JSON to CSV Converter
            </Typography>
            <Typography variant="body2" sx={{ color: '#6b7280' }}>
              Upload or select a JSON file, choose fields, filter data, and export as CSV
            </Typography>
          </Box>
          <Chip label="Tool" size="small" sx={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontWeight: 600 }} />
        </Box>

        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2, borderRadius: 2 }}>{success}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* ── Source Selection ── */}
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#111111' }}>1. Select JSON Source</Typography>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Server files dropdown */}
            <FormControl sx={{ minWidth: 280, flex: 1 }}>
              <InputLabel>Server JSON Files</InputLabel>
              <Select
                value={selectedServerFile}
                label="Server JSON Files"
                onChange={(e) => { setSelectedServerFile(e.target.value); setUploadedFile(null); setParsedData(null); }}
                startAdornment={<StorageIcon sx={{ mr: 1, color: '#6b7280' }} />}
              >
                <MenuItem value="">— Select a file —</MenuItem>
                {serverFiles.map((f) => (
                  <MenuItem key={f.path} value={f.path}>
                    {f.name} ({f.sizeFormatted})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="body2" sx={{ color: '#9ca3af' }}>or</Typography>

            {/* File upload */}
            <Button
              component="label"
              variant="outlined"
              startIcon={<UploadFileIcon />}
              sx={{ borderColor: '#e5e5e5', color: '#111111', textTransform: 'none', py: 1.5, px: 3 }}
            >
              {uploadedFile ? uploadedFile.name : 'Upload JSON File'}
              <input type="file" accept=".json" hidden onChange={handleFileUpload} />
            </Button>
          </Box>

          {/* Parse button */}
          <Button
            variant="contained"
            onClick={handleParse}
            disabled={parsing || (!selectedServerFile && !uploadedFile)}
            startIcon={parsing ? <CircularProgress size={18} color="inherit" /> : <PreviewIcon />}
            sx={{ alignSelf: 'flex-start', background: '#111111', fontWeight: 600, px: 4, py: 1.5, '&:hover': { background: '#333' } }}
          >
            {parsing ? 'Parsing...' : 'Parse & Detect Fields'}
          </Button>

          {parsing && (
            <Fade in><LinearProgress sx={{ borderRadius: 1, bgcolor: '#f0f0f0', '& .MuiLinearProgress-bar': { bgcolor: '#111111' } }} /></Fade>
          )}
        </Box>
      </Paper>

      {/* ── Parsed Results ── */}
      {parsedData && (
        <>
          {/* Filters (for gmaps format) */}
          {parsedData.isGmapsFormat && (parsedData.cities.length > 0 || parsedData.categories.length > 0) && (
            <Paper elevation={0} sx={paperSx}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <FilterListIcon sx={{ color: '#6b7280' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>2. Filter Data (Google Maps Format Detected)</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <FormControl sx={{ minWidth: 200 }}>
                  <InputLabel>Filter by City</InputLabel>
                  <Select value={filterCity} label="Filter by City" onChange={(e) => setFilterCity(e.target.value)}>
                    <MenuItem value="">All Cities ({parsedData.cities.length})</MenuItem>
                    {parsedData.cities.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl sx={{ minWidth: 200 }}>
                  <InputLabel>Filter by Category</InputLabel>
                  <Select value={filterCategory} label="Filter by Category" onChange={(e) => setFilterCategory(e.target.value)}>
                    <MenuItem value="">All Categories ({parsedData.categories.length})</MenuItem>
                    {parsedData.categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                </FormControl>
                <Chip label={`${getFilteredCount()} records`} sx={{ alignSelf: 'center', bgcolor: '#f5f5f5', fontWeight: 600 }} />
              </Box>
            </Paper>
          )}

          {/* Field Selection */}
          <Paper elevation={0} sx={paperSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {parsedData.isGmapsFormat ? '3' : '2'}. Select Fields to Export
                </Typography>
                <Chip label={`${selectedFields.size}/${parsedData.fields.length}`} size="small"
                  sx={{ bgcolor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', fontWeight: 600 }} />
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Select All">
                  <IconButton size="small" onClick={selectAll} sx={{ bgcolor: '#f5f5f5' }}><SelectAllIcon fontSize="small" /></IconButton>
                </Tooltip>
                <Tooltip title="Deselect All">
                  <IconButton size="small" onClick={deselectAll} sx={{ bgcolor: '#f5f5f5' }}><DeselectIcon fontSize="small" /></IconButton>
                </Tooltip>
              </Box>
            </Box>

            <FormGroup sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 0.5 }}>
              {parsedData.fields.filter((f) => !f.startsWith('_')).map((field) => (
                <Box key={field} sx={{ display: 'flex', alignItems: 'center', gap: 0, m: 0, px: 1, py: 0.3, borderRadius: 1.5,
                  border: '1px solid', borderColor: selectedFields.has(field) ? (allowEmpty.has(field) ? '#f59e0b' : '#16a34a') : '#e5e5e5',
                  bgcolor: selectedFields.has(field) ? (allowEmpty.has(field) ? '#fefce8' : '#f0fdf4') : 'transparent',
                }}>
                  <Checkbox size="small" checked={selectedFields.has(field)} onChange={() => toggleField(field)} sx={{ p: 0.3 }} />
                  <Typography variant="caption" sx={{ fontSize: '0.75rem', cursor: 'pointer' }} onClick={() => toggleField(field)}>
                    {field}
                  </Typography>
                  {selectedFields.has(field) && (
                    <Tooltip title={allowEmpty.has(field) ? 'Currently: includes empty values. Click to require value (skip empty)' : 'Currently: skips empty records. Click to allow empty values'}>
                      <Chip
                        size="small"
                        label={allowEmpty.has(field) ? 'Allow empty' : '✓ Must have value'}
                        onClick={() => toggleAllowEmpty(field)}
                        sx={{
                          ml: 0.5, height: 18, fontSize: '0.6rem', cursor: 'pointer',
                          bgcolor: allowEmpty.has(field) ? '#fef3c7' : '#dcfce7',
                          color: allowEmpty.has(field) ? '#d97706' : '#16a34a',
                          border: '1px solid',
                          borderColor: allowEmpty.has(field) ? '#fde68a' : '#bbf7d0',
                          '&:hover': { bgcolor: allowEmpty.has(field) ? '#fde68a' : '#bbf7d0' },
                        }}
                      />
                    </Tooltip>
                  )}
                </Box>
              ))}
            </FormGroup>

            <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#16a34a' }}>
                ⚡ By default, records with empty values in selected fields are skipped.
                Click "✓ Must have value" on a field to change it to "Allow empty" if you want to include empty records.
              </Typography>
            </Box>
          </Paper>

          {/* Preview */}
          {parsedData.sampleData && parsedData.sampleData.length > 0 && (
            <Paper elevation={0} sx={paperSx}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Data Preview (first 5 records)</Typography>
                <Button size="small" onClick={() => setShowPreview(!showPreview)} sx={{ textTransform: 'none', color: '#111111' }}>
                  {showPreview ? 'Hide' : 'Show'} Preview
                </Button>
              </Box>
              {showPreview && (
                <TableContainer sx={{ maxHeight: 300, border: '1px solid #e5e5e5', borderRadius: 2 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {[...selectedFields].filter((f) => !f.startsWith('_')).slice(0, 8).map((f) => (
                          <TableCell key={f} sx={{ fontWeight: 600, fontSize: '0.7rem', bgcolor: '#f9fafb', whiteSpace: 'nowrap' }}>{f}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {parsedData.sampleData.map((row, i) => (
                        <TableRow key={i}>
                          {[...selectedFields].filter((f) => !f.startsWith('_')).slice(0, 8).map((f) => (
                            <TableCell key={f} sx={{ fontSize: '0.7rem', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row[f] ?? '—'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          )}

          {/* Export Configuration */}
          <Paper elevation={0} sx={paperSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <SettingsIcon sx={{ color: '#6b7280' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Export Configuration</Typography>
            </Box>

            {/* Export Mode */}
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#374151', display: 'block', mb: 1 }}>
              Export Mode
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
              {[
                { value: 'single', label: 'Single Master File', desc: 'All data in one file', icon: <DescriptionIcon sx={{ fontSize: 18 }} /> },
                { value: 'city', label: 'City-wise', desc: 'Separate per city', icon: <LocationCityIcon sx={{ fontSize: 18 }} />, gmapsOnly: true },
                { value: 'category', label: 'Category-wise', desc: 'Separate per category', icon: <CategoryIcon sx={{ fontSize: 18 }} />, gmapsOnly: true },
                { value: 'city-category', label: 'City + Category', desc: 'Grouped by both', icon: <ViewModuleIcon sx={{ fontSize: 18 }} />, gmapsOnly: true },
              ].map((mode) => {
                const disabled = mode.gmapsOnly && !parsedData.isGmapsFormat;
                const active = exportMode === mode.value;
                return (
                  <Box
                    key={mode.value}
                    onClick={() => !disabled && setExportMode(mode.value)}
                    sx={{
                      flex: '1 1 180px', minWidth: 160, p: 1.5, borderRadius: 2, cursor: disabled ? 'not-allowed' : 'pointer',
                      border: '2px solid', borderColor: active ? '#111111' : '#e5e5e5',
                      bgcolor: active ? '#f5f5f5' : disabled ? '#fafafa' : '#ffffff',
                      opacity: disabled ? 0.5 : 1, transition: 'all 0.2s',
                      '&:hover': { borderColor: disabled ? '#e5e5e5' : '#111111' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      {mode.icon}
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{mode.label}</Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: '#6b7280' }}>
                      {mode.desc}{disabled ? ' (Maps data only)' : ''}
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            {/* Output Format */}
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#374151', display: 'block', mb: 1 }}>
              Output Format
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {[
                {
                  value: 'csv',
                  label: exportMode === 'single' ? 'Single CSV File' : 'Multiple CSV Files (ZIP)',
                  desc: exportMode === 'single' ? 'One .csv file' : 'One .csv per group, bundled in a .zip',
                  icon: <TableChartIcon sx={{ fontSize: 18 }} />,
                },
                {
                  value: 'excel',
                  label: 'Single Excel Workbook',
                  desc: exportMode === 'single' ? 'One .xlsx with one sheet' : 'One .xlsx, separate tab per group',
                  icon: <GridOnIcon sx={{ fontSize: 18 }} />,
                },
              ].map((fmt) => {
                const active = outputFormat === fmt.value;
                return (
                  <Box
                    key={fmt.value}
                    onClick={() => setOutputFormat(fmt.value)}
                    sx={{
                      flex: '1 1 240px', minWidth: 220, p: 1.5, borderRadius: 2, cursor: 'pointer',
                      border: '2px solid', borderColor: active ? '#16a34a' : '#e5e5e5',
                      bgcolor: active ? '#f0fdf4' : '#ffffff', transition: 'all 0.2s',
                      '&:hover': { borderColor: '#16a34a' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      {fmt.icon}
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{fmt.label}</Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: '#6b7280' }}>{fmt.desc}</Typography>
                  </Box>
                );
              })}
            </Box>

            {/* Summary */}
            <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: '#fafafa', border: '1px solid #e5e5e5' }}>
              <Typography variant="caption" sx={{ color: '#374151' }}>
                <strong>Output:</strong>{' '}
                {outputFormat === 'excel'
                  ? (exportMode === 'single'
                      ? 'One Excel file (.xlsx) with a single worksheet'
                      : `One Excel file (.xlsx) with separate worksheets per ${exportMode.replace('-', ' + ')}`)
                  : (exportMode === 'single'
                      ? 'One CSV file (.csv)'
                      : `A ZIP file (.zip) containing one CSV per ${exportMode.replace('-', ' + ')}`)}
              </Typography>
            </Box>
          </Paper>

          {/* Export Button */}
          <Paper elevation={0} sx={paperSx}>
            <Button
              variant="contained"
              size="large"
              onClick={handleExport}
              disabled={exporting || selectedFields.size === 0}
              startIcon={exporting ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
              sx={{
                background: selectedFields.size === 0 ? '#d1d5db' : '#111111',
                fontWeight: 600, fontSize: '1rem', py: 1.75, px: 4, borderRadius: 2,
                '&:hover': { background: '#333333' },
              }}
            >
              {exporting
                ? 'Generating export...'
                : `Export ${outputFormat === 'excel' ? 'Excel' : (exportMode === 'single' ? 'CSV' : 'ZIP')} (${selectedFields.size} fields, ${selectedFields.size - allowEmpty.size} required)`}
            </Button>
            {exporting && (
              <Fade in>
                <LinearProgress sx={{ mt: 2, borderRadius: 1, bgcolor: '#f0f0f0', '& .MuiLinearProgress-bar': { bgcolor: '#111111' } }} />
              </Fade>
            )}
          </Paper>
        </>
      )}
    </Box>
  );
};

export default JsonToCsvConverter;
