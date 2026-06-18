// frontend/src/components/MapRadiusSearch.jsx
// Run in frontend/: npm install @googlemaps/markerclusterer xlsx
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box, Paper, TextField, Button, Typography, CircularProgress,
  Alert, IconButton, Tooltip, Slider, Card, CardContent,
  Chip, Stack, Snackbar, Select, MenuItem, FormControl, InputLabel,
  useMediaQuery, useTheme, Tabs, Tab, LinearProgress, Fade,
} from '@mui/material';
import SearchIcon      from '@mui/icons-material/Search';
import MyLocationIcon  from '@mui/icons-material/MyLocation';
import ClearIcon       from '@mui/icons-material/Clear';
import MapIcon         from '@mui/icons-material/Map';
import PhoneIcon       from '@mui/icons-material/Phone';
import DownloadIcon    from '@mui/icons-material/Download';
import SortIcon        from '@mui/icons-material/Sort';
import HistoryIcon     from '@mui/icons-material/History';
import BusinessIcon    from '@mui/icons-material/Business';
import AddIcon         from '@mui/icons-material/Add';
import ShareIcon       from '@mui/icons-material/Share';
import BookmarkIcon    from '@mui/icons-material/Bookmark';
import WbSunnyIcon     from '@mui/icons-material/WbSunny';
import NightlightIcon  from '@mui/icons-material/Nightlight';
import LayersIcon      from '@mui/icons-material/Layers';
import HexagonIcon     from '@mui/icons-material/Hexagon';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckBoxIcon    from '@mui/icons-material/CheckBox';
import UndoIcon        from '@mui/icons-material/Undo';
import { searchByRadius } from '../services/api';
import {
  loadGoogleMapsScript, loadHistory, saveHistory,
  loadContactStatus, saveContactStatus,
  exportCSV, exportXLSX, sortResults, filterResults, hasValue,
  encodeSearchParams, decodeSearchParams,
} from './mapRadius/utils';
import {
  DEFAULT_CENTER, KEYWORD_SUGGESTIONS, SORT_OPTIONS,
  CONTACT_STATUS_CONFIG, MAP_STYLES, PROGRESS_MESSAGES,
} from './mapRadius/constants';
import DetailModal      from './mapRadius/DetailModal';
import ResultCard       from './mapRadius/ResultCard';
import FilterPanel      from './mapRadius/FilterPanel';
import SavedCollections from './mapRadius/SavedCollections';

// ─── Animated count hook ──────────────────────────────────────────────────────
const useCountUp = (target, duration = 800) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    let cur = 0;
    const step = Math.ceil(target / (duration / 30));
    const t = setInterval(() => {
      cur = Math.min(cur + step, target);
      setCount(cur);
      if (cur >= target) clearInterval(t);
    }, 30);
    return () => clearInterval(t);
  }, [target, duration]);
  return count;
};

// ─── Empty state ──────────────────────────────────────────────────────────────
const EmptyState = ({ searched }) => (
  <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
    <BusinessIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 1.5 }} />
    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
      {searched ? 'No results found' : 'Ready to search'}
    </Typography>
    <Typography variant="caption" color="text.secondary">
      {searched
        ? 'Try a larger radius, different keyword, or move the circle to another area'
        : 'Enter a keyword, position the circle on the map, then hit Search'}
    </Typography>
  </Box>
);

// ─── Main component ───────────────────────────────────────────────────────────
const MapRadiusSearch = () => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const apiKey   = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const mapRef        = useRef(null);
  const googleMapRef  = useRef(null);
  const circleRef     = useRef(null);
  const markersRef    = useRef([]);
  const markerMapRef  = useRef({});
  const heatmapRef    = useRef(null);
  const clusterRef    = useRef(null);
  const polygonsRef   = useRef([]);
  const drawingMgrRef = useRef(null);
  const undoTimeout   = useRef(null);

  // ── Core state ─────────────────────────────────────────────────────────────
  const [mapLoaded,       setMapLoaded]       = useState(false);
  const [mapError,        setMapError]        = useState(null);
  const [keywords,        setKeywords]        = useState(['']);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [radius,          setRadius]          = useState(5000);
  const [maxResults,      setMaxResults]      = useState(20);
  const [center,          setCenter]          = useState(DEFAULT_CENTER);
  const [results,         setResults]         = useState([]);
  const [sortBy,          setSortBy]          = useState('distance');
  const [loading,         setLoading]         = useState(false);
  const [progressMsg,     setProgressMsg]     = useState('');
  const [hasSearched,     setHasSearched]     = useState(false);
  const [selectedId,      setSelectedId]      = useState(null);
  const [modalIndex,      setModalIndex]      = useState(null);
  const [history,         setHistory]         = useState(loadHistory);
  const [showHistory,     setShowHistory]     = useState(false);
  const [toast,           setToast]           = useState({ open: false, msg: '', severity: 'success', action: null });
  const [mobileTab,       setMobileTab]       = useState(0);

  // ── Feature state ──────────────────────────────────────────────────────────
  const [filters,         setFilters]         = useState({ hasPhone: false, hasWebsite: false, minRating: 0, minReviews: 0 });
  const [mapMode,         setMapMode]         = useState('markers');
  const [mapStyleMode,    setMapStyleMode]    = useState('light');
  const [drawMode,        setDrawMode]        = useState('circle');
  const [selectedIds,     setSelectedIds]     = useState(new Set());
  const [undoData,        setUndoData]        = useState(null);
  const [displayCount,    setDisplayCount]    = useState(10);
  const [showCollections, setShowCollections] = useState(false);
  const [contactStatuses, setContactStatuses] = useState(loadContactStatus);

  const showToast = (msg, severity = 'success', action = null) =>
    setToast({ open: true, msg, severity, action });
  const refreshStatuses = () => setContactStatuses(loadContactStatus());

  // ── Derived ────────────────────────────────────────────────────────────────
  const sortedFiltered = useMemo(
    () => sortResults(filterResults(results, filters), sortBy),
    [results, filters, sortBy]
  );
  const visibleResults = sortedFiltered.slice(0, displayCount);
  const countDisplay   = useCountUp(sortedFiltered.length);
  const activeFilterCount = [filters.hasPhone, filters.hasWebsite, filters.minRating > 0, filters.minReviews > 0].filter(Boolean).length;

  // ── Load Maps ──────────────────────────────────────────────────────────────
  useEffect(() => {
    loadGoogleMapsScript(apiKey)
      .then(() => setMapLoaded(true))
      .catch((err) => setMapError(err.message));
  }, [apiKey]);

  // ── Geolocation on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setCenter({ lat: coords.latitude, lng: coords.longitude }),
      () => {}
    );
  }, []);

  // ── URL params on mount ────────────────────────────────────────────────────
  useEffect(() => {
    const p = decodeSearchParams();
    if (p.keyword) setKeywords([p.keyword]);
    if (p.lat && p.lng) setCenter({ lat: p.lat, lng: p.lng });
    if (p.radius) setRadius(p.radius);
  }, []);

  // ── Init map ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || googleMapRef.current) return;
    const map = new window.google.maps.Map(mapRef.current, {
      center, zoom: 12, mapTypeControl: true, streetViewControl: false, fullscreenControl: true,
      styles: MAP_STYLES.light,
    });
    googleMapRef.current = map;

    const circle = new window.google.maps.Circle({
      map, center, radius,
      fillColor: '#111111', fillOpacity: 0.12,
      strokeColor: '#111111', strokeOpacity: 0.6, strokeWeight: 2,
      editable: true, draggable: true,
    });
    circleRef.current = circle;
    circle.addListener('radius_changed', () => setRadius(Math.round(circle.getRadius())));
    circle.addListener('center_changed', () => {
      const c = circle.getCenter();
      setCenter({ lat: c.lat(), lng: c.lng() });
    });
    map.addListener('click', (e) => {
      const nc = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      setCenter(nc); circleRef.current?.setCenter(e.latLng); map.panTo(e.latLng);
    });
  }, [mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { circleRef.current?.setRadius(radius); }, [radius]);

  // ── Map style toggle ───────────────────────────────────────────────────────
  useEffect(() => {
    googleMapRef.current?.setOptions({ styles: MAP_STYLES[mapStyleMode] });
  }, [mapStyleMode]);

  // ── Draw mode toggle ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps?.drawing) return;
    if (drawMode === 'polygon') {
      circleRef.current?.setMap(null);
      if (!drawingMgrRef.current) {
        const dm = new window.google.maps.drawing.DrawingManager({
          drawingMode: window.google.maps.drawing.OverlayType.POLYGON,
          drawingControl: false,
          polygonOptions: { fillColor: '#111111', fillOpacity: 0.12, strokeColor: '#111111', strokeOpacity: 0.6, strokeWeight: 2, editable: true },
        });
        dm.setMap(googleMapRef.current);
        dm.addListener('polygoncomplete', (polygon) => {
          polygonsRef.current.forEach((p) => p.setMap(null));
          polygonsRef.current = [polygon];
          dm.setDrawingMode(null);
          const bounds = new window.google.maps.LatLngBounds();
          polygon.getPath().forEach((pt) => bounds.extend(pt));
          const c = bounds.getCenter();
          setCenter({ lat: c.lat(), lng: c.lng() });
        });
        drawingMgrRef.current = dm;
      } else {
        drawingMgrRef.current.setMap(googleMapRef.current);
        drawingMgrRef.current.setDrawingMode(window.google.maps.drawing.OverlayType.POLYGON);
      }
    } else {
      drawingMgrRef.current?.setMap(null);
      circleRef.current?.setMap(googleMapRef.current);
    }
  }, [drawMode]);

  // ── Markers ────────────────────────────────────────────────────────────────
  const clearMarkers = useCallback(() => {
    try { clusterRef.current?.clearMarkers?.(); } catch { /* ignore */ }
    clusterRef.current = null;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = []; markerMapRef.current = {};
  }, []);

  const addMarkers = useCallback((locations) => {
    if (!googleMapRef.current) return;
    clearMarkers();
    const bounds = new window.google.maps.LatLngBounds();
    const newMarkers = locations.map((loc, idx) => {
      const marker = new window.google.maps.Marker({
        position: { lat: loc.latitude, lng: loc.longitude },
        map: googleMapRef.current,
        title: loc.storeName,
        label: { text: String(idx + 1), color: '#fff', fontSize: '11px', fontWeight: '700' },
        animation: window.google.maps.Animation.DROP,
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: '#111111', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 },
      });
      marker.addListener('click', () => { setSelectedId(loc.businessId); setModalIndex(idx); if (isMobile) setMobileTab(2); });
      markerMapRef.current[loc.businessId] = marker;
      bounds.extend({ lat: loc.latitude, lng: loc.longitude });
      return marker;
    });
    markersRef.current = newMarkers;
    // Marker clustering — graceful degrade if package not installed
    import('@googlemaps/markerclusterer').then(({ MarkerClusterer }) => {
      clusterRef.current = new MarkerClusterer({ map: googleMapRef.current, markers: newMarkers });
    }).catch(() => {});
    if (locations.length > 0) googleMapRef.current.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
  }, [clearMarkers, isMobile]);

  // ── Heatmap mode ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!googleMapRef.current || !results.length) return;
    if (mapMode === 'heatmap') {
      markersRef.current.forEach((m) => m.setMap(null));
      try { clusterRef.current?.clearMarkers?.(); } catch { /* ignore */ }
      if (window.google?.maps?.visualization) {
        const pts = results.filter((r) => r.latitude && r.longitude)
          .map((r) => new window.google.maps.LatLng(r.latitude, r.longitude));
        if (!heatmapRef.current) {
          heatmapRef.current = new window.google.maps.visualization.HeatmapLayer({ data: pts, map: googleMapRef.current, radius: 30 });
        } else {
          heatmapRef.current.setMap(googleMapRef.current);
        }
      }
    } else {
      heatmapRef.current?.setMap(null);
      markersRef.current.forEach((m) => m.setMap(googleMapRef.current));
      import('@googlemaps/markerclusterer').then(({ MarkerClusterer }) => {
        if (!clusterRef.current && markersRef.current.length) {
          clusterRef.current = new MarkerClusterer({ map: googleMapRef.current, markers: markersRef.current });
        }
      }).catch(() => {});
    }
  }, [mapMode, results]);

  // ── Hover highlight ────────────────────────────────────────────────────────
  const handleCardHover = useCallback((loc) => {
    const m = markerMapRef.current[loc.businessId];
    if (m) { m.setIcon({ path: window.google.maps.SymbolPath.CIRCLE, scale: 16, fillColor: '#333333', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3 }); m.setZIndex(999); }
  }, []);
  const handleCardLeave = useCallback(() => {
    Object.values(markerMapRef.current).forEach((m) => {
      m.setIcon({ path: window.google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: '#111111', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 });
      m.setZIndex(undefined);
    });
  }, []);

  // ── Progress messages ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading) { setProgressMsg(''); return; }
    let i = 0; setProgressMsg(PROGRESS_MESSAGES[0]);
    const t = setInterval(() => { i = Math.min(i + 1, PROGRESS_MESSAGES.length - 1); setProgressMsg(PROGRESS_MESSAGES[i]); }, 8000);
    return () => clearInterval(t);
  }, [loading]);

  // ── Search ─────────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    const trimmedKws = keywords.map((k) => k.trim()).filter(Boolean);
    if (!trimmedKws.length) { showToast('Please enter a keyword', 'error'); return; }
    setLoading(true); setHasSearched(true); setShowSuggestions(false); setShowHistory(false); setDisplayCount(10);
    try {
      const allResults = []; const seen = new Set();
      for (const kw of trimmedKws) {
        const res = await searchByRadius({ keyword: kw, latitude: center.lat, longitude: center.lng, radius, maxResults });
        for (const loc of (res?.data ?? [])) {
          if (!seen.has(loc.storeName)) { seen.add(loc.storeName); allResults.push(loc); }
        }
      }
      setResults(allResults);
      if (allResults.length > 0) {
        addMarkers(allResults);
        saveHistory({ keyword: trimmedKws[0], radius, center, timestamp: Date.now() });
        setHistory(loadHistory());
        showToast(`Found ${allResults.length} business${allResults.length !== 1 ? 'es' : ''}`);
        if (isMobile) setMobileTab(2);
        window.history.pushState({}, '', `?${encodeSearchParams(trimmedKws[0], center.lat, center.lng, radius)}`);
      } else {
        clearMarkers();
        showToast('No results found — try a larger radius or different keyword', 'warning');
      }
    } catch (err) {
      showToast(err.message || 'Search failed', 'error'); clearMarkers();
    } finally { setLoading(false); }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) { showToast('Geolocation not supported', 'error'); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nc = { lat: coords.latitude, lng: coords.longitude };
        setCenter(nc); googleMapRef.current?.panTo(nc); circleRef.current?.setCenter(nc);
        showToast('Location updated');
      },
      () => showToast('Unable to get location — check browser permissions', 'error')
    );
  };

  const handleUndo = useCallback(() => {
    if (!undoData) return;
    setResults(undoData.results); addMarkers(undoData.results);
    setUndoData(null); clearTimeout(undoTimeout.current);
    setToast((t) => ({ ...t, open: false }));
  }, [undoData, addMarkers]);

  const handleClear = () => {
    const snapshot = { results };
    setUndoData(snapshot);
    clearTimeout(undoTimeout.current);
    undoTimeout.current = setTimeout(() => setUndoData(null), 5000);
    showToast('Results cleared', 'info',
      <Button size="small" startIcon={<UndoIcon />} onClick={handleUndo}
        sx={{ color: '#111111', textTransform: 'none', fontSize: '0.75rem' }}>Undo</Button>
    );
    setResults([]); setSelectedId(null); setModalIndex(null);
    clearMarkers(); setHasSearched(false); setSelectedIds(new Set());
    heatmapRef.current?.setMap(null); heatmapRef.current = null;
  };

  const handleCardClick = (loc, idx) => {
    setSelectedId(loc.businessId);
    googleMapRef.current?.panTo({ lat: loc.latitude, lng: loc.longitude });
    googleMapRef.current?.setZoom(15);
    setModalIndex(idx);
    if (isMobile) setMobileTab(1);
  };

  const handleHistorySelect = (entry) => {
    setKeywords([entry.keyword]); setRadius(entry.radius); setCenter(entry.center);
    googleMapRef.current?.panTo(entry.center);
    circleRef.current?.setCenter(entry.center); circleRef.current?.setRadius(entry.radius);
    setShowHistory(false);
  };

  const handleShareUrl = () => {
    const url = `${window.location.origin}${window.location.pathname}?${encodeSearchParams(keywords[0], center.lat, center.lng, radius)}`;
    navigator.clipboard.writeText(url).then(() => showToast('Search URL copied to clipboard'));
  };

  // ── Bulk actions ───────────────────────────────────────────────────────────
  const toggleSelect = (id) => setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectedResults = results.filter((r) => selectedIds.has(r.businessId));

  // ── Keyboard nav ───────────────────────────────────────────────────────────
  const handleListKeyDown = (e, idx) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); document.getElementById(`result-card-${Math.min(idx + 1, visibleResults.length - 1)}`)?.focus(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); document.getElementById(`result-card-${Math.max(idx - 1, 0)}`)?.focus(); }
  };

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (mapError) return <Box sx={{ p: 4 }}><Alert severity="error">{mapError}</Alert></Box>;
  if (!mapLoaded) return (
    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '80vh', gap: 2 }}>
      <CircularProgress sx={{ color: '#111111' }} />
      <Typography variant="body2" color="text.secondary">Loading map…</Typography>
    </Box>
  );

  // ── Controls panel ─────────────────────────────────────────────────────────
  const ControlsPanel = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 2,
          background: '#111111', color: '#ffffff' }}>
          <MapIcon />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Radius Search</Typography>
          <Typography variant="caption" color="text.secondary">Position circle, enter keyword, search</Typography>
        </Box>
      </Box>

      {/* Multi-keyword chips */}
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.8 }}>Keywords</Typography>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.8, mb: 1 }}>
          {keywords.map((kw, i) => (
            <Chip key={i} label={kw || '(empty)'} size="small"
              onDelete={keywords.length > 1 ? () => setKeywords((p) => p.filter((_, j) => j !== i)) : undefined}
              sx={{ bgcolor: kw ? '#f0f0f0' : '#fafafa',
                color: kw ? '#111111' : 'text.secondary', border: '1px solid #e5e5e5' }} />
          ))}
          <Tooltip title="Add keyword">
            <IconButton size="small" onClick={() => setKeywords((p) => [...p, ''])}
              sx={{ color: '#111111', bgcolor: '#f5f5f5', p: 0.4 }}>
              <AddIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Stack>
        <Box sx={{ position: 'relative' }}>
          <TextField fullWidth label="Search Keyword" placeholder="e.g., Restaurant, Clinic"
            value={keywords[keywords.length - 1]}
            onChange={(e) => { const v = e.target.value; setKeywords((p) => { const n = [...p]; n[n.length - 1] = v; return n; }); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) handleSearch();
              if (e.key === 'Escape') setShowSuggestions(false);
              if (e.key === ',' && keywords[keywords.length - 1].trim()) { e.preventDefault(); setKeywords((p) => [...p, '']); }
            }}
            slotProps={{ input: { endAdornment: keywords[keywords.length - 1] && (
              <IconButton size="small" onClick={() => setKeywords((p) => { const n = [...p]; n[n.length - 1] = ''; return n; })}>
                <ClearIcon fontSize="small" />
              </IconButton>
            )}}}
          />
          {showSuggestions && (
            <Paper sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
              bgcolor: '#ffffff', border: '1px solid #e5e5e5',
              borderRadius: 2, mt: 0.5, maxHeight: 200, overflowY: 'auto' }}>
              {KEYWORD_SUGGESTIONS
                .filter((s) => !keywords[keywords.length - 1] || s.toLowerCase().includes(keywords[keywords.length - 1].toLowerCase()))
                .map((s) => (
                  <Box key={s} onMouseDown={() => { setKeywords((p) => { const n = [...p]; n[n.length - 1] = s; return n; }); setShowSuggestions(false); }}
                    sx={{ px: 2, py: 1, cursor: 'pointer', fontSize: '0.875rem', '&:hover': { bgcolor: '#f5f5f5' } }}>
                    {s}
                  </Box>
                ))}
            </Paper>
          )}
        </Box>
      </Box>

      {/* Search history */}
      {history.length > 0 && (
        <Box>
          <Button size="small" startIcon={<HistoryIcon />} onClick={() => setShowHistory((v) => !v)}
            sx={{ color: 'text.secondary', textTransform: 'none', p: 0, minWidth: 0, '&:hover': { color: '#111111', bgcolor: 'transparent' } }}>
            Recent searches
          </Button>
          {showHistory && (
            <Box sx={{ mt: 1, p: 1.5, borderRadius: 2, bgcolor: '#fafafa', border: '1px solid #e5e5e5' }}>
              {history.map((h, i) => (
                <Box key={i} onClick={() => handleHistorySelect(h)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.8, px: 1, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: '#f0f0f0' } }}>
                  <HistoryIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ flex: 1 }}>{h.keyword}</Typography>
                  <Typography variant="caption" color="text.secondary">{(h.radius / 1000).toFixed(0)} km</Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      <TextField fullWidth type="number" label="Max Results" value={maxResults}
        onChange={(e) => setMaxResults(Math.max(1, Math.min(100, parseInt(e.target.value) || 20)))}
        slotProps={{ input: { inputProps: { min: 1, max: 100 } } }} helperText="Maximum: 100 results" />

      <Box>
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>Radius: {(radius / 1000).toFixed(1)} km</Typography>
        <Slider value={radius} onChange={(_, v) => setRadius(v)} min={500} max={50000} step={500}
          marks={[{ value: 500, label: '0.5km' }, { value: 25000, label: '25km' }, { value: 50000, label: '50km' }]}
          sx={{ color: '#111111', '& .MuiSlider-thumb': { backgroundColor: '#111111' } }} />
      </Box>

      <Card sx={{ background: '#fafafa', border: '1px solid #e5e5e5' }}>
        <CardContent sx={{ pb: '12px !important', pt: '12px !important' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.8 }}>Search Parameters</Typography>
          {[`Lat: ${center.lat.toFixed(6)}`, `Lng: ${center.lng.toFixed(6)}`,
            `Radius: ${(radius / 1000).toFixed(1)} km`, `Max: ${maxResults} results`].map((l) => (
            <Typography key={l} variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{l}</Typography>
          ))}
        </CardContent>
      </Card>

      {/* Map mode toggles */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Tooltip title={mapMode === 'markers' ? 'Switch to Heatmap' : 'Switch to Markers'}>
          <Button size="small" variant="outlined" startIcon={<LayersIcon />}
            onClick={() => setMapMode((m) => m === 'markers' ? 'heatmap' : 'markers')}
            sx={{ textTransform: 'none', fontSize: '0.75rem', flex: 1,
              borderColor: mapMode === 'heatmap' ? '#111111' : '#e5e5e5',
              color: mapMode === 'heatmap' ? '#111111' : 'text.secondary' }}>
            {mapMode === 'markers' ? 'Markers' : 'Heatmap'}
          </Button>
        </Tooltip>
        <Tooltip title={drawMode === 'circle' ? 'Switch to Polygon' : 'Switch to Circle'}>
          <Button size="small" variant="outlined" startIcon={drawMode === 'circle' ? <CircleOutlinedIcon /> : <HexagonIcon />}
            onClick={() => setDrawMode((m) => m === 'circle' ? 'polygon' : 'circle')}
            sx={{ textTransform: 'none', fontSize: '0.75rem', flex: 1,
              borderColor: drawMode === 'polygon' ? '#111111' : '#e5e5e5',
              color: drawMode === 'polygon' ? '#111111' : 'text.secondary' }}>
            {drawMode === 'circle' ? 'Circle' : 'Polygon'}
          </Button>
        </Tooltip>
        <Tooltip title={mapStyleMode === 'dark' ? 'Light map' : 'Dark map'}>
          <IconButton size="small" onClick={() => setMapStyleMode((m) => m === 'dark' ? 'light' : 'dark')}
            sx={{ color: '#111111', bgcolor: '#f5f5f5', borderRadius: 1.5 }}>
            {mapStyleMode === 'dark' ? <WbSunnyIcon sx={{ fontSize: 18 }} /> : <NightlightIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        </Tooltip>
      </Box>

      <FilterPanel filters={filters} onChange={setFilters} />

      <Button size="small" variant="outlined" startIcon={<BookmarkIcon />}
        onClick={() => setShowCollections((v) => !v)}
        sx={{ textTransform: 'none', fontSize: '0.75rem', borderColor: '#e5e5e5', color: 'text.secondary' }}>
        Saved Collections
      </Button>
      {showCollections && (
        <SavedCollections results={results} onRestore={(data) => {
          setResults(data); addMarkers(data); setShowCollections(false);
          showToast(`Restored ${data.length} results`);
        }} />
      )}

      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Button fullWidth variant="contained"
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
          onClick={handleSearch} disabled={loading || !keywords.some((k) => k.trim())}
          sx={{ background: '#111111', fontWeight: 600, color: '#ffffff', '&:hover': { background: '#333333' } }}>
          {loading ? 'Searching…' : 'Search'}
        </Button>
        <Tooltip title="Use my current location"><span>
          <IconButton onClick={handleGetCurrentLocation} aria-label="Use current location"
            sx={{ background: '#f5f5f5', '&:hover': { background: '#e5e5e5' } }}>
            <MyLocationIcon />
          </IconButton>
        </span></Tooltip>
        <Tooltip title="Share search URL"><span>
          <IconButton onClick={handleShareUrl} aria-label="Share search URL"
            sx={{ background: '#f5f5f5', '&:hover': { background: '#e5e5e5' } }}>
            <ShareIcon />
          </IconButton>
        </span></Tooltip>
      </Box>

      {loading && (
        <Fade in>
          <Box>
            <LinearProgress sx={{ borderRadius: 1, bgcolor: '#f0f0f0', '& .MuiLinearProgress-bar': { bgcolor: '#111111' } }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.8, textAlign: 'center' }}>{progressMsg}</Typography>
          </Box>
        </Fade>
      )}

      {results.length > 0 && (
        <Button fullWidth variant="outlined" onClick={handleClear}
          sx={{ borderColor: '#fecaca', color: '#ef4444' }}>
          Clear Results
        </Button>
      )}
    </Box>
  );

  // ── Results panel ──────────────────────────────────────────────────────────
  const ResultsPanel = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {results.length > 0 ? (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {countDisplay} result{sortedFiltered.length !== 1 ? 's' : ''}
              {activeFilterCount > 0 && <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>(filtered)</Typography>}
            </Typography>
            {filters.hasPhone && <Chip label="Has Phone" size="small" onDelete={() => setFilters((f) => ({ ...f, hasPhone: false }))}
              sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#f0f0f0', color: '#111111' }} />}
            {filters.hasWebsite && <Chip label="Has Website" size="small" onDelete={() => setFilters((f) => ({ ...f, hasWebsite: false }))}
              sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#f0f0f0', color: '#111111' }} />}
            {filters.minRating > 0 && <Chip label={`≥${filters.minRating}★`} size="small" onDelete={() => setFilters((f) => ({ ...f, minRating: 0 }))}
              sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#fefce8', color: '#a16207' }} />}
            {filters.minReviews > 0 && <Chip label={`≥${filters.minReviews} reviews`} size="small" onDelete={() => setFilters((f) => ({ ...f, minReviews: 0 }))}
              sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#f5f5f5', color: '#6b7280' }} />}
            <Box sx={{ flex: 1 }} />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel sx={{ fontSize: '0.75rem' }}>Sort by</InputLabel>
              <Select value={sortBy} label="Sort by" onChange={(e) => setSortBy(e.target.value)}
                startAdornment={<SortIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />}
                sx={{ fontSize: '0.8rem', '& .MuiSelect-select': { py: 0.8 } }}>
                {SORT_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value} sx={{ fontSize: '0.8rem' }}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
            <Tooltip title="Export CSV">
              <IconButton size="small" onClick={() => { exportCSV(sortedFiltered); showToast('CSV downloaded'); }}
                sx={{ bgcolor: '#f5f5f5', '&:hover': { bgcolor: '#e5e5e5' } }}>
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export Excel (.xlsx)">
              <IconButton size="small" onClick={async () => { try { await exportXLSX(sortedFiltered); showToast('Excel downloaded'); } catch (e) { showToast(e.message, 'error'); } }}
                sx={{ bgcolor: '#f0fdf4', '&:hover': { bgcolor: '#dcfce7' } }}>
                <DownloadIcon fontSize="small" sx={{ color: '#16a34a' }} />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', p: 1.5,
              borderRadius: 2, bgcolor: '#f5f5f5', border: '1px solid #e5e5e5' }}>
              <CheckBoxIcon sx={{ fontSize: 16, color: '#111111' }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#111111' }}>{selectedIds.size} selected</Typography>
              <Button size="small" startIcon={<PhoneIcon sx={{ fontSize: 12 }} />}
                onClick={() => { navigator.clipboard.writeText(selectedResults.map((r) => r.phone).filter(hasValue).join('\n')).then(() => showToast(`Copied ${selectedIds.size} phones`)); }}
                sx={{ textTransform: 'none', fontSize: '0.72rem', color: '#111111', py: 0.3 }}>Copy phones</Button>
              <Button size="small" startIcon={<ContentCopyIcon sx={{ fontSize: 12 }} />}
                onClick={() => { navigator.clipboard.writeText(selectedResults.map((r) => r.storeName).join('\n')).then(() => showToast(`Copied ${selectedIds.size} names`)); }}
                sx={{ textTransform: 'none', fontSize: '0.72rem', color: '#111111', py: 0.3 }}>Copy names</Button>
              <Button size="small"
                onClick={() => { exportCSV(selectedResults, 'selected_results.csv'); showToast('CSV downloaded'); }}
                sx={{ textTransform: 'none', fontSize: '0.72rem', color: '#111111', py: 0.3 }}>Export CSV</Button>
              <Button size="small"
                onClick={() => { selectedResults.forEach((r) => saveContactStatus(r.businessId, 'contacted')); refreshStatuses(); showToast(`Marked ${selectedIds.size} as contacted`); setSelectedIds(new Set()); }}
                sx={{ textTransform: 'none', fontSize: '0.72rem', color: '#16a34a', py: 0.3 }}>Mark contacted</Button>
              <Button size="small" onClick={() => setSelectedIds(new Set())}
                sx={{ textTransform: 'none', fontSize: '0.72rem', color: 'text.secondary', py: 0.3, ml: 'auto' }}>Clear</Button>
            </Box>
          )}

          {/* Cards */}
          <Box sx={{ overflowX: 'auto', overflowY: 'hidden', flex: 1, display: 'flex', gap: 1.5, pb: 0.5,
            '&::-webkit-scrollbar': { height: 4 },
            '&::-webkit-scrollbar-thumb': { bgcolor: '#d1d5db', borderRadius: 2 } }}>
            {visibleResults.map((loc, idx) => (
              <Box key={loc.businessId} id={`result-card-${idx}`} sx={{ flexShrink: 0, width: 240 }}
                onKeyDown={(e) => handleListKeyDown(e, idx)}>
                <ResultCard location={loc} index={idx}
                  selected={selectedId === loc.businessId}
                  checked={selectedIds.has(loc.businessId)}
                  onCheck={() => toggleSelect(loc.businessId)}
                  onClick={() => handleCardClick(loc, idx)}
                  onHover={handleCardHover} onLeave={handleCardLeave}
                  contactStatus={contactStatuses[loc.businessId] || 'none'} />
              </Box>
            ))}
            {displayCount < sortedFiltered.length && (
              <Box sx={{ flexShrink: 0, width: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Button variant="outlined" size="small" onClick={() => setDisplayCount((n) => n + 10)}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', borderColor: '#e5e5e5', color: '#111111',
                    '&:hover': { borderColor: '#111111', bgcolor: '#f5f5f5' } }}>
                  Load {Math.min(10, sortedFiltered.length - displayCount)} more
                </Button>
              </Box>
            )}
          </Box>
        </>
      ) : <EmptyState searched={hasSearched} />}
    </Box>
  );

  // ── Map panel ──────────────────────────────────────────────────────────────
  const MapPanel = (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Box ref={mapRef} sx={{ width: '100%', height: '100%', borderRadius: 3 }} />
      <Box sx={{ position: 'absolute', top: 16, left: 16, background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 2, p: 1.5, maxWidth: 220, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>How to use</Typography>
        {['Click map to move circle', 'Drag circle to reposition', 'Drag edges to resize', 'Click a pin to view details'].map((tip) => (
          <Typography key={tip} variant="caption" display="block" color="text.secondary">• {tip}</Typography>
        ))}
      </Box>
      {results.length > 0 && (
        <Box sx={{ position: 'absolute', top: 16, right: 16, background: '#111111', borderRadius: 2, px: 2, py: 0.8 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#fff' }}>{results.length} results</Typography>
        </Box>
      )}
    </Box>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <DetailModal
        location={modalIndex !== null ? sortedFiltered[modalIndex] : null}
        onClose={() => setModalIndex(null)}
        onNext={() => setModalIndex((i) => Math.min(i + 1, sortedFiltered.length - 1))}
        onPrev={() => setModalIndex((i) => Math.max(i - 1, 0))}
        currentIndex={modalIndex ?? 0} total={sortedFiltered.length}
        apiKey={apiKey} onStatusChange={refreshStatuses}
      />

      <Snackbar open={toast.open} autoHideDuration={5000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={toast.severity} onClose={() => setToast((t) => ({ ...t, open: false }))} action={toast.action}
          sx={{ border: `1px solid rgba(${toast.severity === 'success' ? '16,185,129' : toast.severity === 'warning' ? '245,158,11' : toast.severity === 'info' ? '99,102,241' : '239,68,68'},0.3)` }}>
          {toast.msg}
        </Alert>
      </Snackbar>

      {!isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, height: 'calc(100vh - 100px)' }}>
          <Box sx={{ display: 'flex', gap: 3, flex: 1, minHeight: 0 }}>
            <Paper elevation={0} sx={{ width: 360, flexShrink: 0, p: 3,
              background: '#ffffff',
              border: '1px solid #e5e5e5', borderRadius: 3, overflowY: 'auto',
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-thumb': { bgcolor: '#d1d5db', borderRadius: 2 } }}>
              {ControlsPanel}
            </Paper>
            <Paper elevation={0} sx={{ flex: 1, background: '#ffffff',
              border: '1px solid #e5e5e5', borderRadius: 3, overflow: 'hidden' }}>
              {MapPanel}
            </Paper>
          </Box>
          <Paper elevation={0} sx={{ p: 2, background: '#ffffff',
            border: '1px solid #e5e5e5', borderRadius: 3,
            display: 'flex', flexDirection: 'column', maxHeight: 340, overflow: 'hidden' }}>
            {ResultsPanel}
          </Paper>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
          <Tabs value={mobileTab} onChange={(_, v) => setMobileTab(v)}
            sx={{ borderBottom: '1px solid #e5e5e5', minHeight: 44,
              '& .MuiTab-root': { minHeight: 44, fontSize: '0.8rem', textTransform: 'none' },
              '& .MuiTabs-indicator': { bgcolor: '#111111' } }}>
            <Tab label="Search" />
            <Tab label="Map" />
            <Tab label={`Results${results.length ? ` (${results.length})` : ''}`} />
          </Tabs>
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            {mobileTab === 0 && <Box sx={{ p: 2, height: '100%', overflowY: 'auto' }}>{ControlsPanel}</Box>}
            {mobileTab === 1 && <Box sx={{ height: '100%' }}>{MapPanel}</Box>}
            {mobileTab === 2 && <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>{ResultsPanel}</Box>}
          </Box>
        </Box>
      )}
    </>
  );
};

export default MapRadiusSearch;
