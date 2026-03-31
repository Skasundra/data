import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box, Paper, TextField, Button, Typography, CircularProgress,
  Alert, IconButton, Tooltip, Slider, Card, CardContent,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Chip, Stack, Avatar, Link, Snackbar,
  Select, MenuItem, FormControl, InputLabel,
  useMediaQuery, useTheme, Tabs, Tab,
  LinearProgress, Fade,
} from '@mui/material';
import SearchIcon        from '@mui/icons-material/Search';
import MyLocationIcon    from '@mui/icons-material/MyLocation';
import ClearIcon         from '@mui/icons-material/Clear';
import MapIcon           from '@mui/icons-material/Map';
import CloseIcon         from '@mui/icons-material/Close';
import PhoneIcon         from '@mui/icons-material/Phone';
import LanguageIcon      from '@mui/icons-material/Language';
import LocationOnIcon    from '@mui/icons-material/LocationOn';
import StarIcon          from '@mui/icons-material/Star';
import ReviewsIcon       from '@mui/icons-material/Reviews';
import CategoryIcon      from '@mui/icons-material/Category';
import StraightenIcon    from '@mui/icons-material/Straighten';
import OpenInNewIcon     from '@mui/icons-material/OpenInNew';
import ContentCopyIcon   from '@mui/icons-material/ContentCopy';
import DownloadIcon      from '@mui/icons-material/Download';
import SortIcon          from '@mui/icons-material/Sort';
import HistoryIcon       from '@mui/icons-material/History';
import BusinessIcon      from '@mui/icons-material/Business';
import KeyboardArrowUpIcon   from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { searchByRadius } from '../services/api';

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_CENTER = { lat: 34.0522, lng: -118.2437 };
const HISTORY_KEY    = 'radius_search_history';
const MAX_HISTORY    = 8;

const KEYWORD_SUGGESTIONS = [
  'Restaurant', 'Clinic', 'Hotel', 'Gym', 'Pharmacy', 'School',
  'Bank', 'Supermarket', 'Coffee Shop', 'IT Company', 'Hospital',
  'Dentist', 'Lawyer', 'Plumber', 'Electrician', 'Real Estate',
];

const SORT_OPTIONS = [
  { value: 'distance', label: 'Distance (nearest)' },
  { value: 'rating',   label: 'Rating (highest)'   },
  { value: 'reviews',  label: 'Most reviewed'       },
  { value: 'name',     label: 'Name (A–Z)'          },
];

// ─── Google Maps singleton loader ─────────────────────────────────────────────
let mapsScriptPromise = null;
const loadGoogleMapsScript = (apiKey) => {
  if (window.google?.maps) return Promise.resolve();
  if (mapsScriptPromise) return mapsScriptPromise;
  mapsScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,drawing,geometry`;
    script.async = true;
    script.defer = true;
    script.onload  = resolve;
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
  return mapsScriptPromise;
};

// ─── localStorage helpers ─────────────────────────────────────────────────────
const loadHistory = () => {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
};
const saveHistory = (entry) => {
  const prev = loadHistory().filter(
    (h) => !(h.keyword === entry.keyword && h.radius === entry.radius)
  );
  localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...prev].slice(0, MAX_HISTORY)));
};

// ─── CSV / Excel export ───────────────────────────────────────────────────────
const exportCSV = (data, filename = 'radius_search_results.csv') => {
  const headers = ['Name','Category','Phone','Address','Website','Rating','Reviews','Distance (km)','Latitude','Longitude','Source','Scraped At'];
  const rows = data.map((r) => [
    r.storeName, r.category, r.phone, r.address, r.bizWebsite,
    r.stars, r.numberOfReviews, r.distanceKm,
    r.latitude, r.longitude, r.source, r.scrapedAt,
  ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`));
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// ─── Sort helper ──────────────────────────────────────────────────────────────
const sortResults = (data, sortBy) => {
  const arr = [...data];
  switch (sortBy) {
    case 'distance': return arr.sort((a, b) => parseFloat(a.distanceKm || 999) - parseFloat(b.distanceKm || 999));
    case 'rating':   return arr.sort((a, b) => parseFloat(b.stars || 0) - parseFloat(a.stars || 0));
    case 'reviews':  return arr.sort((a, b) => parseInt(b.numberOfReviews || 0) - parseInt(a.numberOfReviews || 0));
    case 'name':     return arr.sort((a, b) => (a.storeName || '').localeCompare(b.storeName || ''));
    default:         return arr;
  }
};

const hasValue = (v) => v && v !== 'N/A';

// ─── Detail Modal ─────────────────────────────────────────────────────────────
const DetailModal = ({ location, onClose, onNext, onPrev, currentIndex, total }) => {
  const [copied, setCopied] = useState('');
  if (!location) return null;

  const copy = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  const InfoRow = ({ icon, label, value, copyKey, href }) => {
    if (!hasValue(value)) return null;
    return (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 1.2,
        borderBottom: '1px solid rgba(255,255,255,0.05)', '&:last-child': { borderBottom: 'none' } }}>
        <Box sx={{ mt: 0.3, color: '#6366f1', flexShrink: 0 }}>{icon}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2, mb: 0.3 }}>
            {label}
          </Typography>
          {href ? (
            <Link href={href} target="_blank" rel="noopener noreferrer"
              sx={{ color: '#a5b4fc', fontSize: '0.875rem', wordBreak: 'break-all',
                    display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {value} <OpenInNewIcon sx={{ fontSize: 14 }} />
            </Link>
          ) : (
            <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{value}</Typography>
          )}
        </Box>
        {copyKey && (
          <Tooltip title={copied === copyKey ? 'Copied!' : `Copy ${label}`}>
            <IconButton size="small" onClick={() => copy(value, copyKey)}
              sx={{ color: copied === copyKey ? '#6366f1' : 'text.secondary', flexShrink: 0 }}>
              <ContentCopyIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    );
  };

  return (
    <Dialog open={!!location} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: {
        background: 'rgba(10,15,30,0.98)', backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, color: '#e2e8f0',
      }}}>

      {/* Header */}
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ p: 3, pb: 2,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(236,72,153,0.18) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Avatar sx={{ width: 54, height: 54, flexShrink: 0, fontSize: '1.5rem', fontWeight: 700,
              background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)' }}>
              {location.storeName?.[0]?.toUpperCase() ?? '?'}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3, mb: 0.5 }}>
                {location.storeName}
              </Typography>
              {hasValue(location.category) && (
                <Chip label={location.category} size="small"
                  icon={<CategoryIcon sx={{ fontSize: '13px !important' }} />}
                  sx={{ bgcolor: 'rgba(99,102,241,0.2)', color: '#a5b4fc',
                    border: '1px solid rgba(99,102,241,0.3)', height: 22,
                    '& .MuiChip-icon': { color: '#a5b4fc' } }} />
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {/* Prev / Next navigation */}
              {total > 1 && (
                <>
                  <Tooltip title="Previous">
                    <span><IconButton size="small" onClick={onPrev} disabled={currentIndex === 0}
                      sx={{ color: 'text.secondary' }}><KeyboardArrowUpIcon /></IconButton></span>
                  </Tooltip>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36, textAlign: 'center' }}>
                    {currentIndex + 1}/{total}
                  </Typography>
                  <Tooltip title="Next">
                    <span><IconButton size="small" onClick={onNext} disabled={currentIndex === total - 1}
                      sx={{ color: 'text.secondary' }}><KeyboardArrowDownIcon /></IconButton></span>
                  </Tooltip>
                </>
              )}
              <IconButton onClick={onClose} size="small"
                sx={{ color: 'text.secondary', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}>
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>

          {/* Badges */}
          <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 0.8 }}>
            {hasValue(location.stars) && (
              <Chip icon={<StarIcon sx={{ fontSize: '13px !important', color: '#fbbf24 !important' }} />}
                label={location.stars} size="small"
                sx={{ bgcolor: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }} />
            )}
            {hasValue(location.numberOfReviews) && (
              <Chip icon={<ReviewsIcon sx={{ fontSize: '13px !important' }} />}
                label={`${location.numberOfReviews} reviews`} size="small"
                sx={{ bgcolor: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' }} />
            )}
            {location.distanceKm && (
              <Chip icon={<StraightenIcon sx={{ fontSize: '13px !important' }} />}
                label={`${location.distanceKm} km away`} size="small"
                sx={{ bgcolor: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }} />
            )}
          </Stack>
        </Box>
      </DialogTitle>

      {/* Body */}
      <DialogContent sx={{ p: 3 }}>
        <InfoRow icon={<PhoneIcon fontSize="small" />}      label="Phone"   value={location.phone}   copyKey="phone" />
        <InfoRow icon={<LocationOnIcon fontSize="small" />} label="Address" value={location.address} copyKey="address" />
        <InfoRow icon={<LanguageIcon fontSize="small" />}   label="Website"
          value={hasValue(location.bizWebsite) ? location.bizWebsite : null}
          href={hasValue(location.bizWebsite) ? location.bizWebsite : null} />
        <InfoRow icon={<MapIcon fontSize="small" />} label="Google Maps"
          value={hasValue(location.googleUrl) ? 'Open in Google Maps' : null}
          href={hasValue(location.googleUrl) ? location.googleUrl : null} />

        {location.latitude && location.longitude && (
          <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.2)' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.8 }}>
              Coordinates
            </Typography>
            <Stack direction="row" spacing={3}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                Lat: {location.latitude.toFixed(6)}
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                Lng: {location.longitude.toFixed(6)}
              </Typography>
            </Stack>
          </Box>
        )}

        <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Typography variant="caption" color="text.secondary">
            Source: {location.source} · {new Date(location.scrapedAt).toLocaleString()}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexWrap: 'wrap' }}>
        {hasValue(location.phone) && (
          <Button variant="outlined" size="small" startIcon={<PhoneIcon />}
            component="a" href={`tel:${location.phone}`}
            sx={{ borderColor: 'rgba(99,102,241,0.4)', color: '#a5b4fc',
              '&:hover': { borderColor: '#6366f1', bgcolor: 'rgba(99,102,241,0.1)' } }}>
            Call
          </Button>
        )}
        {hasValue(location.bizWebsite) && (
          <Button variant="outlined" size="small" startIcon={<LanguageIcon />}
            component="a" href={location.bizWebsite} target="_blank" rel="noopener noreferrer"
            sx={{ borderColor: 'rgba(99,102,241,0.4)', color: '#a5b4fc',
              '&:hover': { borderColor: '#6366f1', bgcolor: 'rgba(99,102,241,0.1)' } }}>
            Website
          </Button>
        )}
        {hasValue(location.googleUrl) && (
          <Button variant="contained" size="small" startIcon={<MapIcon />}
            component="a" href={location.googleUrl} target="_blank" rel="noopener noreferrer"
            sx={{ background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', ml: 'auto !important' }}>
            View on Maps
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

// ─── Result Card ──────────────────────────────────────────────────────────────
const ResultCard = ({ location, selected, onClick, onHover, onLeave, index }) => (
  <Box
    onClick={onClick}
    onMouseEnter={() => onHover?.(location)}
    onMouseLeave={() => onLeave?.()}
    tabIndex={0}
    role="button"
    aria-label={`View details for ${location.storeName}`}
    onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    sx={{
      p: 1.5, cursor: 'pointer', borderRadius: 2,
      border: selected ? '1px solid rgba(99,102,241,0.55)' : '1px solid rgba(255,255,255,0.05)',
      bgcolor: selected ? 'rgba(99,102,241,0.13)' : 'rgba(15,23,42,0.45)',
      transition: 'all 0.15s ease',
      outline: 'none',
      '&:hover, &:focus-visible': { bgcolor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.4)' },
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
      <Avatar sx={{ width: 36, height: 36, flexShrink: 0, fontSize: '0.9rem', fontWeight: 700,
        background: selected
          ? 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)'
          : 'rgba(99,102,241,0.25)' }}>
        {index + 1}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3, mb: 0.3 }} noWrap>
          {location.storeName}
        </Typography>
        {hasValue(location.category) && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {location.category}
          </Typography>
        )}
        <Stack direction="row" sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
          {location.distanceKm && (
            <Chip label={`${location.distanceKm} km`} size="small"
              sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(99,102,241,0.2)',
                color: '#a5b4fc', '& .MuiChip-label': { px: 0.8 } }} />
          )}
          {hasValue(location.stars) && (
            <Chip icon={<StarIcon sx={{ fontSize: '10px !important', color: '#fbbf24 !important' }} />}
              label={location.stars} size="small"
              sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(251,191,36,0.15)',
                color: '#fbbf24', '& .MuiChip-label': { px: 0.8 } }} />
          )}
          {hasValue(location.phone) && (
            <Chip label={location.phone} size="small"
              sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(148,163,184,0.1)',
                color: '#94a3b8', '& .MuiChip-label': { px: 0.8 } }} />
          )}
        </Stack>
      </Box>
    </Box>
  </Box>
);

// ─── Empty state ──────────────────────────────────────────────────────────────
const EmptyState = ({ searched }) => (
  <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
    <BusinessIcon sx={{ fontSize: 48, color: 'rgba(99,102,241,0.3)', mb: 1.5 }} />
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
  const theme   = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const mapRef       = useRef(null);
  const googleMapRef = useRef(null);
  const circleRef    = useRef(null);
  const markersRef   = useRef([]);
  const markerMapRef = useRef({}); // businessId → marker

  // ── State ──────────────────────────────────────────────────────────────────
  const [mapLoaded,        setMapLoaded]        = useState(false);
  const [mapError,         setMapError]         = useState(null);
  const [keyword,          setKeyword]          = useState('');
  const [showSuggestions,  setShowSuggestions]  = useState(false);
  const [radius,           setRadius]           = useState(5000);
  const [maxResults,       setMaxResults]       = useState(20);
  const [center,           setCenter]           = useState(DEFAULT_CENTER);
  const [results,          setResults]          = useState([]);
  const [sortBy,           setSortBy]           = useState('distance');
  const [loading,          setLoading]          = useState(false);
  const [progressMsg,      setProgressMsg]      = useState('');
  const [hasSearched,      setHasSearched]      = useState(false);
  const [selectedId,       setSelectedId]       = useState(null);
  const [modalIndex,       setModalIndex]       = useState(null);
  const [history,          setHistory]          = useState(loadHistory);
  const [showHistory,      setShowHistory]      = useState(false);
  const [toast,            setToast]            = useState({ open: false, msg: '', severity: 'success' });
  const [mobileTab,        setMobileTab]        = useState(0); // 0=controls, 1=map, 2=results

  const showToast = (msg, severity = 'success') => setToast({ open: true, msg, severity });

  // ── Sorted results ─────────────────────────────────────────────────────────
  const sortedResults = useMemo(() => sortResults(results, sortBy), [results, sortBy]);

  // ── Load Maps ──────────────────────────────────────────────────────────────
  useEffect(() => {
    loadGoogleMapsScript(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
      .then(() => setMapLoaded(true))
      .catch((err) => setMapError(err.message));
  }, []);

  // ── Geolocation on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setCenter({ lat: coords.latitude, lng: coords.longitude }),
      () => {}
    );
  }, []);

  // ── Init map ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || googleMapRef.current) return;
    const map = new window.google.maps.Map(mapRef.current, {
      center, zoom: 12,
      mapTypeControl: true, streetViewControl: false, fullscreenControl: true,
      styles: [
        { featureType: 'all', elementType: 'geometry',           stylers: [{ color: '#242f3e' }] },
        { featureType: 'all', elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
        { featureType: 'all', elementType: 'labels.text.fill',   stylers: [{ color: '#746855' }] },
      ],
    });
    googleMapRef.current = map;

    const circle = new window.google.maps.Circle({
      map, center, radius,
      fillColor: '#6366f1', fillOpacity: 0.2,
      strokeColor: '#6366f1', strokeOpacity: 0.8, strokeWeight: 2,
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
      setCenter(nc); circle.setCenter(e.latLng); map.panTo(e.latLng);
    });
  }, [mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { circleRef.current?.setRadius(radius); }, [radius]);

  // ── Markers ────────────────────────────────────────────────────────────────
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    markerMapRef.current = {};
  }, []);

  const addMarkers = useCallback((locations) => {
    if (!googleMapRef.current) return;
    clearMarkers();
    const bounds = new window.google.maps.LatLngBounds();

    locations.forEach((loc, idx) => {
      const marker = new window.google.maps.Marker({
        position: { lat: loc.latitude, lng: loc.longitude },
        map: googleMapRef.current,
        title: loc.storeName,
        label: { text: String(idx + 1), color: '#fff', fontSize: '11px', fontWeight: '700' },
        animation: window.google.maps.Animation.DROP,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 14, fillColor: '#ec4899', fillOpacity: 1,
          strokeColor: '#ffffff', strokeWeight: 2,
        },
      });
      marker.addListener('click', () => {
        setSelectedId(loc.businessId);
        setModalIndex(idx);
        if (isMobile) setMobileTab(2);
      });
      markersRef.current.push(marker);
      markerMapRef.current[loc.businessId] = marker;
      bounds.extend({ lat: loc.latitude, lng: loc.longitude });
    });

    // Fit map to show all results (#8)
    if (locations.length > 0) {
      googleMapRef.current.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    }
  }, [clearMarkers, isMobile]);

  // ── Highlight marker on hover (#7) ────────────────────────────────────────
  const handleCardHover = useCallback((loc) => {
    const marker = markerMapRef.current[loc.businessId];
    if (marker) {
      marker.setIcon({
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 16, fillColor: '#6366f1', fillOpacity: 1,
        strokeColor: '#ffffff', strokeWeight: 3,
      });
      marker.setZIndex(999);
    }
  }, []);

  const handleCardLeave = useCallback(() => {
    Object.values(markerMapRef.current).forEach((m) => {
      m.setIcon({
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 14, fillColor: '#ec4899', fillOpacity: 1,
        strokeColor: '#ffffff', strokeWeight: 2,
      });
      m.setZIndex(undefined);
    });
  }, []);

  // ── Progress messages during search (#2) ──────────────────────────────────
  const progressMessages = [
    'Opening Google Maps…',
    'Loading search results…',
    'Scrolling for more listings…',
    'Extracting business coordinates…',
    'Fetching contact details…',
    'Filtering by radius…',
    'Almost done…',
  ];
  useEffect(() => {
    if (!loading) { setProgressMsg(''); return; }
    let i = 0;
    setProgressMsg(progressMessages[0]);
    const interval = setInterval(() => {
      i = Math.min(i + 1, progressMessages.length - 1);
      setProgressMsg(progressMessages[i]);
    }, 8000);
    return () => clearInterval(interval);
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Search ─────────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    const trimmed = keyword.trim();
    if (!trimmed) { showToast('Please enter a keyword', 'error'); return; }
    setLoading(true);
    setHasSearched(true);
    setShowSuggestions(false);
    setShowHistory(false);
    try {
      const response = await searchByRadius({
        keyword: trimmed, latitude: center.lat, longitude: center.lng, radius, maxResults,
      });
      const locations = response.data ?? [];
      setResults(locations);
      if (locations.length > 0) {
        addMarkers(locations);
        const entry = { keyword: trimmed, radius, center, timestamp: Date.now() };
        saveHistory(entry);
        setHistory(loadHistory());
        showToast(`Found ${locations.length} business${locations.length !== 1 ? 'es' : ''}`);
        if (isMobile) setMobileTab(2);
      } else {
        clearMarkers();
        showToast('No results found — try a larger radius or different keyword', 'warning');
      }
    } catch (err) {
      showToast(err.message || 'Search failed', 'error');
      clearMarkers();
    } finally {
      setLoading(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) { showToast('Geolocation not supported', 'error'); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nc = { lat: coords.latitude, lng: coords.longitude };
        setCenter(nc);
        googleMapRef.current?.panTo(nc);
        circleRef.current?.setCenter(nc);
        showToast('Location updated');
      },
      () => showToast('Unable to get location — check browser permissions', 'error')
    );
  };

  const handleClear = () => {
    setKeyword(''); setResults([]); setSelectedId(null);
    setModalIndex(null); clearMarkers(); setHasSearched(false);
  };

  const handleCardClick = (loc, idx) => {
    setSelectedId(loc.businessId);
    googleMapRef.current?.panTo({ lat: loc.latitude, lng: loc.longitude });
    googleMapRef.current?.setZoom(15);
    setModalIndex(idx);
    if (isMobile) setMobileTab(1);
  };

  const handleHistorySelect = (entry) => {
    setKeyword(entry.keyword);
    setRadius(entry.radius);
    setCenter(entry.center);
    googleMapRef.current?.panTo(entry.center);
    circleRef.current?.setCenter(entry.center);
    circleRef.current?.setRadius(entry.radius);
    setShowHistory(false);
  };

  // ── Keyboard nav on results list (#11) ────────────────────────────────────
  const handleListKeyDown = (e, idx) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(idx + 1, sortedResults.length - 1);
      document.getElementById(`result-card-${next}`)?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(idx - 1, 0);
      document.getElementById(`result-card-${prev}`)?.focus();
    }
  };

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (mapError) return <Box sx={{ p: 4 }}><Alert severity="error">{mapError}</Alert></Box>;
  if (!mapLoaded) return (
    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '80vh', gap: 2 }}>
      <CircularProgress sx={{ color: '#6366f1' }} />
      <Typography variant="body2" color="text.secondary">Loading map…</Typography>
    </Box>
  );

  // ── Shared left-panel content ──────────────────────────────────────────────
  const ControlsPanel = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Header */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 44, height: 44, borderRadius: 2,
            background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)' }}>
            <MapIcon />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Radius Search</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Position the circle, enter a keyword, and search
        </Typography>
      </Box>

      {/* Keyword + suggestions */}
      <Box sx={{ position: 'relative' }}>
        <TextField fullWidth label="Search Keyword"
          placeholder="e.g., Restaurant, Clinic, Hotel"
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !loading) handleSearch();
            if (e.key === 'Escape') setShowSuggestions(false);
          }}
          slotProps={{
            input: {
              endAdornment: keyword && (
                <IconButton size="small" onClick={() => setKeyword('')} aria-label="Clear keyword">
                  <ClearIcon fontSize="small" />
                </IconButton>
              ),
            },
          }}
        />
        {/* Autocomplete suggestions (#4) */}
        {showSuggestions && (
          <Paper sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
            bgcolor: 'rgba(15,23,42,0.98)', border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: 2, mt: 0.5, maxHeight: 200, overflowY: 'auto' }}>
            {KEYWORD_SUGGESTIONS
              .filter((s) => !keyword || s.toLowerCase().includes(keyword.toLowerCase()))
              .map((s) => (
                <Box key={s} onMouseDown={() => { setKeyword(s); setShowSuggestions(false); }}
                  sx={{ px: 2, py: 1, cursor: 'pointer', fontSize: '0.875rem',
                    '&:hover': { bgcolor: 'rgba(99,102,241,0.15)' } }}>
                  {s}
                </Box>
              ))}
          </Paper>
        )}
      </Box>

      {/* Search history (#6) */}
      {history.length > 0 && (
        <Box>
          <Button size="small" startIcon={<HistoryIcon />}
            onClick={() => setShowHistory((v) => !v)}
            sx={{ color: 'text.secondary', textTransform: 'none', p: 0, minWidth: 0,
              '&:hover': { color: '#a5b4fc', bgcolor: 'transparent' } }}>
            Recent searches
          </Button>
          {showHistory && (
            <Box sx={{ mt: 1, p: 1.5, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.5)',
              border: '1px solid rgba(255,255,255,0.06)' }}>
              {history.map((h, i) => (
                <Box key={i} onClick={() => handleHistorySelect(h)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.8, px: 1,
                    borderRadius: 1, cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(99,102,241,0.12)' } }}>
                  <HistoryIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ flex: 1 }}>{h.keyword}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {(h.radius / 1000).toFixed(0)} km
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Max results */}
      <TextField fullWidth type="number" label="Max Results" value={maxResults}
        onChange={(e) => setMaxResults(Math.max(1, Math.min(100, parseInt(e.target.value) || 20)))}
        slotProps={{ input: { inputProps: { min: 1, max: 100 } } }}
        helperText="Maximum: 100 results" />

      {/* Radius slider */}
      <Box>
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
          Radius: {(radius / 1000).toFixed(1)} km
        </Typography>
        <Slider value={radius} onChange={(_, v) => setRadius(v)}
          min={500} max={50000} step={500}
          marks={[{ value: 500, label: '0.5km' }, { value: 25000, label: '25km' }, { value: 50000, label: '50km' }]}
          sx={{ color: '#6366f1', '& .MuiSlider-thumb': { backgroundColor: '#6366f1' } }} />
      </Box>

      {/* Coordinate readout */}
      <Card sx={{ background: 'rgba(15,23,42,0.4)' }}>
        <CardContent sx={{ pb: '12px !important', pt: '12px !important' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.8 }}>
            Search Parameters
          </Typography>
          {[`Lat: ${center.lat.toFixed(6)}`, `Lng: ${center.lng.toFixed(6)}`,
            `Radius: ${(radius / 1000).toFixed(1)} km`, `Max: ${maxResults} results`].map((l) => (
            <Typography key={l} variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{l}</Typography>
          ))}
        </CardContent>
      </Card>

      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Button fullWidth variant="contained"
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
          onClick={handleSearch} disabled={loading || !keyword.trim()}
          sx={{ background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', fontWeight: 600 }}>
          {loading ? 'Searching…' : 'Search'}
        </Button>
        <Tooltip title="Use my current location">
          <span>
            <IconButton onClick={handleGetCurrentLocation} aria-label="Use current location"
              sx={{ background: 'rgba(99,102,241,0.1)', '&:hover': { background: 'rgba(99,102,241,0.2)' } }}>
              <MyLocationIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Progress bar + message (#2) */}
      {loading && (
        <Fade in>
          <Box>
            <LinearProgress sx={{ borderRadius: 1, bgcolor: 'rgba(99,102,241,0.15)',
              '& .MuiLinearProgress-bar': { bgcolor: '#6366f1' } }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.8, textAlign: 'center' }}>
              {progressMsg}
            </Typography>
          </Box>
        </Fade>
      )}

      {results.length > 0 && (
        <Button fullWidth variant="outlined" onClick={handleClear}
          sx={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}>
          Clear Results
        </Button>
      )}
    </Box>
  );

  // ── Results panel content ──────────────────────────────────────────────────
  const ResultsPanel = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {results.length > 0 ? (
        <>
          {/* Toolbar: count + sort + export */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
              {results.length} result{results.length !== 1 ? 's' : ''}
            </Typography>

            {/* Sort (#5) */}
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel sx={{ fontSize: '0.75rem' }}>Sort by</InputLabel>
              <Select value={sortBy} label="Sort by" onChange={(e) => setSortBy(e.target.value)}
                startAdornment={<SortIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />}
                sx={{ fontSize: '0.8rem', '& .MuiSelect-select': { py: 0.8 } }}>
                {SORT_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value} sx={{ fontSize: '0.8rem' }}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Export (#1) */}
            <Tooltip title="Export as CSV">
              <IconButton size="small" onClick={() => { exportCSV(sortedResults); showToast('CSV downloaded'); }}
                sx={{ bgcolor: 'rgba(99,102,241,0.1)', '&:hover': { bgcolor: 'rgba(99,102,241,0.2)' } }}>
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Cards list — horizontal scroll when in bottom full-width panel */}
          <Box sx={{ overflowX: 'auto', overflowY: 'hidden', flex: 1,
            display: 'flex', gap: 1.5, pb: 0.5,
            '&::-webkit-scrollbar': { height: 4 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(99,102,241,0.4)', borderRadius: 2 } }}>
            {sortedResults.map((loc, idx) => (
              <Box key={loc.businessId} id={`result-card-${idx}`}
                sx={{ flexShrink: 0, width: 240 }}
                onKeyDown={(e) => handleListKeyDown(e, idx)}>
                <ResultCard
                  location={loc} index={idx}
                  selected={selectedId === loc.businessId}
                  onClick={() => handleCardClick(loc, idx)}
                  onHover={handleCardHover}
                  onLeave={handleCardLeave}
                />
              </Box>
            ))}
          </Box>
        </>
      ) : (
        <EmptyState searched={hasSearched} />
      )}
    </Box>
  );

  // ── Map panel ──────────────────────────────────────────────────────────────
  const MapPanel = (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Box ref={mapRef} sx={{ width: '100%', height: '100%', borderRadius: 3 }} />

      {/* Instructions overlay */}
      <Box sx={{ position: 'absolute', top: 16, left: 16,
        background: 'rgba(10,15,30,0.92)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, p: 1.5, maxWidth: 240 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>How to use</Typography>
        {['Click map to move circle', 'Drag circle to reposition',
          'Drag edges to resize', 'Click a pin to view details'].map((tip) => (
          <Typography key={tip} variant="caption" display="block" color="text.secondary">• {tip}</Typography>
        ))}
      </Box>

      {/* Results badge */}
      {results.length > 0 && (
        <Box sx={{ position: 'absolute', top: 16, right: 16,
          background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
          borderRadius: 2, px: 2, py: 0.8 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#fff' }}>
            {results.length} results
          </Typography>
        </Box>
      )}
    </Box>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Detail modal with prev/next (#prev/next nav) */}
      <DetailModal
        location={modalIndex !== null ? sortedResults[modalIndex] : null}
        onClose={() => setModalIndex(null)}
        onNext={() => setModalIndex((i) => Math.min(i + 1, sortedResults.length - 1))}
        onPrev={() => setModalIndex((i) => Math.max(i - 1, 0))}
        currentIndex={modalIndex ?? 0}
        total={sortedResults.length}
      />

      {/* Toast notifications (#14) */}
      <Snackbar open={toast.open} autoHideDuration={3500}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={toast.severity} onClose={() => setToast((t) => ({ ...t, open: false }))}
          sx={{ bgcolor: toast.severity === 'success' ? 'rgba(16,185,129,0.15)' : undefined,
            border: `1px solid rgba(${toast.severity === 'success' ? '16,185,129' : toast.severity === 'warning' ? '245,158,11' : '239,68,68'},0.3)` }}>
          {toast.msg}
        </Alert>
      </Snackbar>

      {/* ── Desktop layout ── */}
      {!isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, height: 'calc(100vh - 100px)' }}>

          {/* Top row: Controls + Map */}
          <Box sx={{ display: 'flex', gap: 3, flex: 1, minHeight: 0 }}>

            {/* Controls */}
            <Paper elevation={0} sx={{ width: 360, flexShrink: 0, p: 3,
              background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3,
              overflowY: 'auto',
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(99,102,241,0.3)', borderRadius: 2 } }}>
              {ControlsPanel}
            </Paper>

            {/* Map */}
            <Paper elevation={0} sx={{ flex: 1,
              background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3,
              overflow: 'hidden' }}>
              {MapPanel}
            </Paper>
          </Box>

          {/* Bottom row: Results — full width */}
          <Paper elevation={0} sx={{ p: 2,
            background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3,
            display: 'flex', flexDirection: 'column',
            maxHeight: 340, overflow: 'hidden' }}>
            {ResultsPanel}
          </Paper>
        </Box>
      ) : (
        /* ── Mobile layout: tabs (#9) ── */
        <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
          <Tabs value={mobileTab} onChange={(_, v) => setMobileTab(v)}
            sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)', minHeight: 44,
              '& .MuiTab-root': { minHeight: 44, fontSize: '0.8rem', textTransform: 'none' },
              '& .MuiTabs-indicator': { bgcolor: '#6366f1' } }}>
            <Tab label="Search" />
            <Tab label="Map" />
            <Tab label={`Results${results.length ? ` (${results.length})` : ''}`} />
          </Tabs>

          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            {mobileTab === 0 && (
              <Box sx={{ p: 2, height: '100%', overflowY: 'auto' }}>{ControlsPanel}</Box>
            )}
            {mobileTab === 1 && (
              <Box sx={{ height: '100%' }}>{MapPanel}</Box>
            )}
            {mobileTab === 2 && (
              <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>{ResultsPanel}</Box>
            )}
          </Box>
        </Box>
      )}
    </>
  );
};

export default MapRadiusSearch;
