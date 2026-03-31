import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Paper, TextField, Button, Typography, CircularProgress,
  Alert, IconButton, Tooltip, Slider, Card, CardContent,
  List, ListItemButton, ListItemText, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Chip, Stack, Avatar, Link,
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
import { searchByRadius } from '../services/api';

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
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
  return mapsScriptPromise;
};

const DEFAULT_CENTER = { lat: 34.0522, lng: -118.2437 };

// ─── Detail Modal ─────────────────────────────────────────────────────────────
const DetailModal = ({ location, onClose }) => {
  const [copied, setCopied] = useState('');

  if (!location) return null;

  const copy = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  const hasValue = (v) => v && v !== 'N/A';

  const InfoRow = ({ icon, label, value, copyKey, href }) => {
    if (!hasValue(value)) return null;
    return (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 1 }}>
        <Box sx={{
          mt: 0.3, color: '#6366f1', flexShrink: 0,
          display: 'flex', alignItems: 'center',
        }}>
          {icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
            {label}
          </Typography>
          {href ? (
            <Link
              href={href} target="_blank" rel="noopener noreferrer"
              sx={{ color: '#a5b4fc', fontSize: '0.875rem', wordBreak: 'break-all',
                    display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
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
    <Dialog
      open={!!location}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: 'rgba(15, 23, 42, 0.97)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 3,
          color: '#e2e8f0',
        },
      }}
    >
      {/* ── Header ── */}
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{
          p: 3, pb: 2,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(236,72,153,0.15) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Avatar sx={{
              width: 52, height: 52, flexShrink: 0,
              background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
              fontSize: '1.4rem', fontWeight: 700,
            }}>
              {location.storeName?.[0]?.toUpperCase() ?? '?'}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3, mb: 0.5 }}>
                {location.storeName}
              </Typography>
              {hasValue(location.category) && (
                <Chip
                  label={location.category}
                  size="small"
                  icon={<CategoryIcon sx={{ fontSize: '14px !important' }} />}
                  sx={{
                    bgcolor: 'rgba(99,102,241,0.2)', color: '#a5b4fc',
                    border: '1px solid rgba(99,102,241,0.3)', height: 24,
                    '& .MuiChip-icon': { color: '#a5b4fc' },
                  }}
                />
              )}
            </Box>
            <IconButton onClick={onClose} size="small"
              sx={{ color: 'text.secondary', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Rating + Distance badges */}
          <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
            {hasValue(location.stars) && (
              <Chip
                icon={<StarIcon sx={{ fontSize: '14px !important', color: '#fbbf24 !important' }} />}
                label={location.stars}
                size="small"
                sx={{ bgcolor: 'rgba(251,191,36,0.15)', color: '#fbbf24',
                      border: '1px solid rgba(251,191,36,0.3)' }}
              />
            )}
            {hasValue(location.numberOfReviews) && (
              <Chip
                icon={<ReviewsIcon sx={{ fontSize: '14px !important' }} />}
                label={`${location.numberOfReviews} reviews`}
                size="small"
                sx={{ bgcolor: 'rgba(148,163,184,0.1)', color: '#94a3b8',
                      border: '1px solid rgba(148,163,184,0.2)' }}
              />
            )}
            {location.distanceKm && (
              <Chip
                icon={<StraightenIcon sx={{ fontSize: '14px !important' }} />}
                label={`${location.distanceKm} km away`}
                size="small"
                sx={{ bgcolor: 'rgba(99,102,241,0.15)', color: '#a5b4fc',
                      border: '1px solid rgba(99,102,241,0.3)' }}
              />
            )}
          </Stack>
        </Box>
      </DialogTitle>

      {/* ── Body ── */}
      <DialogContent sx={{ p: 3 }}>
        <Box sx={{ '& > *:not(:last-child)': { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}>
          <InfoRow icon={<PhoneIcon fontSize="small" />}    label="Phone"    value={location.phone}      copyKey="phone" />
          <InfoRow icon={<LocationOnIcon fontSize="small" />} label="Address" value={location.address}   copyKey="address" />
          <InfoRow
            icon={<LanguageIcon fontSize="small" />}
            label="Website"
            value={hasValue(location.bizWebsite) ? location.bizWebsite : null}
            href={hasValue(location.bizWebsite) ? location.bizWebsite : null}
          />
          <InfoRow
            icon={<MapIcon fontSize="small" />}
            label="Google Maps"
            value={hasValue(location.googleUrl) ? 'Open in Google Maps' : null}
            href={hasValue(location.googleUrl) ? location.googleUrl : null}
          />
        </Box>

        {/* Coordinates card */}
        {location.latitude && location.longitude && (
          <Box sx={{
            mt: 2, p: 2, borderRadius: 2,
            bgcolor: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.2)',
          }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Coordinates
            </Typography>
            <Stack direction="row" spacing={2}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                Lat: {location.latitude.toFixed(6)}
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                Lng: {location.longitude.toFixed(6)}
              </Typography>
            </Stack>
          </Box>
        )}

        {/* Scraped meta */}
        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Typography variant="caption" color="text.secondary">
            Source: {location.source} · Scraped {new Date(location.scrapedAt).toLocaleString()}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        {hasValue(location.phone) && (
          <Button
            variant="outlined" size="small"
            startIcon={<PhoneIcon />}
            href={`tel:${location.phone}`}
            sx={{ borderColor: 'rgba(99,102,241,0.4)', color: '#a5b4fc',
                  '&:hover': { borderColor: '#6366f1', bgcolor: 'rgba(99,102,241,0.1)' } }}
          >
            Call
          </Button>
        )}
        {hasValue(location.bizWebsite) && (
          <Button
            variant="outlined" size="small"
            startIcon={<LanguageIcon />}
            href={location.bizWebsite} target="_blank" rel="noopener noreferrer"
            sx={{ borderColor: 'rgba(99,102,241,0.4)', color: '#a5b4fc',
                  '&:hover': { borderColor: '#6366f1', bgcolor: 'rgba(99,102,241,0.1)' } }}
          >
            Website
          </Button>
        )}
        {hasValue(location.googleUrl) && (
          <Button
            variant="contained" size="small"
            startIcon={<MapIcon />}
            href={location.googleUrl} target="_blank" rel="noopener noreferrer"
            sx={{ background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', ml: 'auto !important' }}
          >
            View on Maps
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

// ─── Result Card (sidebar list item) ─────────────────────────────────────────
const ResultCard = ({ location, selected, onClick }) => {
  const hasValue = (v) => v && v !== 'N/A';
  return (
    <Box
      onClick={onClick}
      sx={{
        p: 1.5, cursor: 'pointer', borderRadius: 2, mb: 1,
        border: selected
          ? '1px solid rgba(99,102,241,0.5)'
          : '1px solid rgba(255,255,255,0.05)',
        bgcolor: selected ? 'rgba(99,102,241,0.12)' : 'rgba(15,23,42,0.4)',
        transition: 'all 0.15s ease',
        '&:hover': {
          bgcolor: 'rgba(99,102,241,0.1)',
          border: '1px solid rgba(99,102,241,0.35)',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Avatar sx={{
          width: 36, height: 36, flexShrink: 0, fontSize: '0.9rem', fontWeight: 700,
          background: selected
            ? 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)'
            : 'rgba(99,102,241,0.25)',
        }}>
          {location.storeName?.[0]?.toUpperCase() ?? '?'}
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
          <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
            {location.distanceKm && (
              <Chip label={`${location.distanceKm} km`} size="small"
                sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(99,102,241,0.2)',
                      color: '#a5b4fc', '& .MuiChip-label': { px: 0.8 } }} />
            )}
            {hasValue(location.stars) && (
              <Chip
                icon={<StarIcon sx={{ fontSize: '10px !important', color: '#fbbf24 !important' }} />}
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
};

// ─── Main component ───────────────────────────────────────────────────────────
const MapRadiusSearch = () => {
  const mapRef       = useRef(null);
  const googleMapRef = useRef(null);
  const circleRef    = useRef(null);
  const markersRef   = useRef([]);

  const [mapLoaded,        setMapLoaded]        = useState(false);
  const [mapError,         setMapError]         = useState(null);
  const [keyword,          setKeyword]          = useState('');
  const [radius,           setRadius]           = useState(5000);
  const [maxResults,       setMaxResults]       = useState(20);
  const [center,           setCenter]           = useState(DEFAULT_CENTER);
  const [results,          setResults]          = useState([]);
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null); // sidebar highlight
  const [modalLocation,    setModalLocation]    = useState(null); // detail popup

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
      setCenter(nc);
      circle.setCenter(e.latLng);
      map.panTo(e.latLng);
    });
  }, [mapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { circleRef.current?.setRadius(radius); }, [radius]);

  // ── Markers ────────────────────────────────────────────────────────────────
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
  }, []);

  const addMarkers = useCallback((locations) => {
    if (!googleMapRef.current) return;
    clearMarkers();
    locations.forEach((loc) => {
      const marker = new window.google.maps.Marker({
        position: { lat: loc.latitude, lng: loc.longitude },
        map: googleMapRef.current,
        title: loc.storeName,
        animation: window.google.maps.Animation.DROP,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 9, fillColor: '#ec4899', fillOpacity: 1,
          strokeColor: '#ffffff', strokeWeight: 2,
        },
      });
      // Clicking a map marker opens the detail modal directly
      marker.addListener('click', () => {
        setSelectedLocation(loc);
        setModalLocation(loc);
      });
      markersRef.current.push(marker);
    });
  }, [clearMarkers]);

  // ── Search ─────────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    const trimmed = keyword.trim();
    if (!trimmed) { setError('Please enter a keyword'); return; }
    setLoading(true);
    setError(null);
    try {
      const response = await searchByRadius({
        keyword: trimmed, latitude: center.lat, longitude: center.lng, radius, maxResults,
      });
      const locations = response.data ?? [];
      setResults(locations);
      if (locations.length > 0) {
        addMarkers(locations);
      } else {
        setError('No results found in the selected area');
        clearMarkers();
      }
    } catch (err) {
      setError(err.message || 'Failed to search locations');
      clearMarkers();
    } finally {
      setLoading(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nc = { lat: coords.latitude, lng: coords.longitude };
        setCenter(nc);
        googleMapRef.current?.panTo(nc);
        circleRef.current?.setCenter(nc);
      },
      () => setError('Unable to get your location — check browser permissions')
    );
  };

  const handleClear = () => {
    setKeyword(''); setResults([]); setSelectedLocation(null);
    setModalLocation(null); clearMarkers(); setError(null);
  };

  // ── Click on sidebar card ──────────────────────────────────────────────────
  const handleCardClick = (loc) => {
    setSelectedLocation(loc);
    googleMapRef.current?.panTo({ lat: loc.latitude, lng: loc.longitude });
    googleMapRef.current?.setZoom(15);
    setModalLocation(loc);
  };

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (mapError) return <Box sx={{ p: 4 }}><Alert severity="error">{mapError}</Alert></Box>;
  if (!mapLoaded) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
      <CircularProgress />
    </Box>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <DetailModal location={modalLocation} onClose={() => setModalLocation(null)} />

      <Box sx={{ display: 'flex', gap: 3, height: 'calc(100vh - 100px)' }}>

        {/* ── Left panel ── */}
        <Paper elevation={0} sx={{
          width: 380, p: 3,
          background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3,
          display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto',
        }}>
          {/* Header */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 48, height: 48, borderRadius: 2,
                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
              }}>
                <MapIcon />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Radius Search</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Draw a circle on the map and search for businesses within that area
            </Typography>
          </Box>

          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

          {/* Keyword */}
          <TextField
            fullWidth label="Search Keyword"
            placeholder="e.g., Restaurant, Clinic, Hotel"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleSearch()}
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

          {/* Max results */}
          <TextField
            fullWidth type="number" label="Max Results"
            value={maxResults}
            onChange={(e) => setMaxResults(Math.max(1, Math.min(100, parseInt(e.target.value) || 20)))}
            slotProps={{ input: { inputProps: { min: 1, max: 100 } } }}
            helperText="Maximum: 100 results"
          />

          {/* Radius slider */}
          <Box>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
              Radius: {(radius / 1000).toFixed(1)} km
            </Typography>
            <Slider
              value={radius} onChange={(_, v) => setRadius(v)}
              min={500} max={50000} step={500}
              marks={[{ value: 500, label: '0.5km' }, { value: 25000, label: '25km' }, { value: 50000, label: '50km' }]}
              sx={{ color: '#6366f1', '& .MuiSlider-thumb': { backgroundColor: '#6366f1' } }}
            />
          </Box>

          {/* Coordinate readout */}
          <Card sx={{ background: 'rgba(15,23,42,0.4)' }}>
            <CardContent sx={{ pb: '12px !important' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Search Parameters
              </Typography>
              {[`Lat: ${center.lat.toFixed(6)}`, `Lng: ${center.lng.toFixed(6)}`,
                `Radius: ${(radius / 1000).toFixed(1)} km`, `Max: ${maxResults} results`].map((l) => (
                <Typography key={l} variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{l}</Typography>
              ))}
            </CardContent>
          </Card>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button fullWidth variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
              onClick={handleSearch} disabled={loading || !keyword.trim()}
              sx={{ background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', fontWeight: 600 }}
            >
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

          {results.length > 0 && (
            <Button fullWidth variant="outlined" onClick={handleClear}
              sx={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}>
              Clear Results
            </Button>
          )}

          {/* Results list */}
          {results.length > 0 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {results.length} location{results.length !== 1 ? 's' : ''} found
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Click to view details
                </Typography>
              </Box>
              <Box sx={{ maxHeight: 420, overflowY: 'auto', pr: 0.5,
                '&::-webkit-scrollbar': { width: 4 },
                '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(99,102,241,0.4)', borderRadius: 2 },
              }}>
                {results.map((loc) => (
                  <ResultCard
                    key={loc.businessId}
                    location={loc}
                    selected={selectedLocation?.businessId === loc.businessId}
                    onClick={() => handleCardClick(loc)}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Paper>

        {/* ── Map panel ── */}
        <Paper elevation={0} sx={{
          flex: 1, background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3,
          overflow: 'hidden', position: 'relative',
        }}>
          <Box ref={mapRef} sx={{ width: '100%', height: '100%', borderRadius: 3 }} />

          {/* Instructions overlay */}
          <Box sx={{
            position: 'absolute', top: 16, left: 16,
            background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, p: 2, maxWidth: 260,
          }}>
            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
              How to use
            </Typography>
            {['Click map to move circle', 'Drag circle to reposition',
              'Drag edges to resize', 'Click a pin to view details'].map((tip) => (
              <Typography key={tip} variant="caption" display="block" color="text.secondary">• {tip}</Typography>
            ))}
          </Box>

          {/* Results count badge on map */}
          {results.length > 0 && (
            <Box sx={{
              position: 'absolute', top: 16, right: 16,
              background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
              borderRadius: 2, px: 2, py: 1,
            }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#fff' }}>
                {results.length} results
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </>
  );
};

export default MapRadiusSearch;
