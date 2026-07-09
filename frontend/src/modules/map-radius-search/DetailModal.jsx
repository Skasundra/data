import { useState } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions,
  Typography, Avatar, Chip, Stack, Link, IconButton, Tooltip,
  Button, Select, MenuItem, TextField,
} from '@mui/material';
import CloseIcon             from '@mui/icons-material/Close';
import PhoneIcon             from '@mui/icons-material/Phone';
import LanguageIcon          from '@mui/icons-material/Language';
import LocationOnIcon        from '@mui/icons-material/LocationOn';
import StarIcon              from '@mui/icons-material/Star';
import ReviewsIcon           from '@mui/icons-material/Reviews';
import CategoryIcon          from '@mui/icons-material/Category';
import StraightenIcon        from '@mui/icons-material/Straighten';
import OpenInNewIcon         from '@mui/icons-material/OpenInNew';
import ContentCopyIcon       from '@mui/icons-material/ContentCopy';
import MapIcon               from '@mui/icons-material/Map';
import KeyboardArrowUpIcon   from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { hasValue, saveContactStatus, saveNote, loadNotes } from './utils';
import { CONTACT_STATUS_CONFIG } from './constants';

const InfoRow = ({ icon, label, value, copyKey, href, copied, onCopy }) => {
  if (!hasValue(value)) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 1.2,
      borderBottom: '1px solid #f1f5f9', '&:last-child': { borderBottom: 'none' } }}>
      <Box sx={{ mt: 0.3, color: '#475569', flexShrink: 0 }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2, mb: 0.3 }}>
          {label}
        </Typography>
        {href ? (
          <Link href={href} target="_blank" rel="noopener noreferrer"
            sx={{ color: '#2563eb', fontSize: '0.875rem', wordBreak: 'break-all',
              display: 'flex', alignItems: 'center', gap: 0.5, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
            {value} <OpenInNewIcon sx={{ fontSize: 14 }} />
          </Link>
        ) : (
          <Typography variant="body2" sx={{ wordBreak: 'break-word', color: '#0f172a' }}>{value}</Typography>
        )}
      </Box>
      {copyKey && (
        <Tooltip title={copied === copyKey ? 'Copied!' : `Copy ${label}`}>
          <IconButton size="small" onClick={() => onCopy(value, copyKey)}
            sx={{ color: copied === copyKey ? '#0f172a' : 'text.secondary', flexShrink: 0, borderRadius: '8px' }}>
            <ContentCopyIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

const DetailModal = ({ location, onClose, onNext, onPrev, currentIndex, total, apiKey, onStatusChange }) => {
  const [copied, setCopied] = useState('');
  const [status, setStatus] = useState(() =>
    location ? (JSON.parse(localStorage.getItem('radius_contact_status') || '{}')[location.businessId] || 'none') : 'none'
  );
  const [note, setNote] = useState(() => location ? (loadNotes()[location.businessId] || '') : '');

  if (!location) return null;

  const copy = (text, label) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(label); setTimeout(() => setCopied(''), 2000); });
  };

  const handleStatusChange = (e) => {
    setStatus(e.target.value);
    saveContactStatus(location.businessId, e.target.value);
    onStatusChange?.();
  };

  const streetViewUrl = location.latitude && location.longitude && apiKey
    ? `https://maps.googleapis.com/maps/api/streetview?size=400x200&location=${location.latitude},${location.longitude}&key=${apiKey}`
    : null;

  return (
    <Dialog open={!!location} onClose={onClose} maxWidth="sm" fullWidth
      slotProps={{ paper: { sx: {
        background: '#ffffff',
        border: '1px solid #e2e8f0', borderRadius: '12px', color: '#0f172a',
      }}}}>
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ p: 3, pb: 2,
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Avatar variant="rounded" sx={{ width: 52, height: 52, flexShrink: 0, fontSize: '1.4rem', fontWeight: 700,
              background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', borderRadius: '10px', color: '#ffffff' }}>
              {location.storeName?.[0]?.toUpperCase() ?? '?'}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3, mb: 0.5, color: '#0f172a' }}>{location.storeName}</Typography>
              {hasValue(location.category) && (
                <Chip label={location.category} size="small"
                  icon={<CategoryIcon sx={{ fontSize: '12px !important' }} />}
                  sx={{ bgcolor: '#f1f5f9', color: '#475569', borderRadius: '16px',
                    border: '1px solid #e2e8f0', height: 22, '& .MuiChip-icon': { color: '#475569' } }} />
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {total > 1 && (
                <>
                  <Tooltip title="Previous"><span>
                    <IconButton size="small" onClick={onPrev} disabled={currentIndex === 0} sx={{ color: 'text.secondary', borderRadius: '8px' }}>
                      <KeyboardArrowUpIcon />
                    </IconButton>
                  </span></Tooltip>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36, textAlign: 'center', fontWeight: 600 }}>
                    {currentIndex + 1}/{total}
                  </Typography>
                  <Tooltip title="Next"><span>
                    <IconButton size="small" onClick={onNext} disabled={currentIndex === total - 1} sx={{ color: 'text.secondary', borderRadius: '8px' }}>
                      <KeyboardArrowDownIcon />
                    </IconButton>
                  </span></Tooltip>
                </>
              )}
              <IconButton onClick={onClose} size="small"
                sx={{ color: 'text.secondary', borderRadius: '8px', '&:hover': { color: '#0f172a', bgcolor: '#f1f5f9' } }}>
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
          <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 0.8 }}>
            {hasValue(location.stars) && (
              <Chip icon={<StarIcon sx={{ fontSize: '13px !important', color: '#fbbf24 !important' }} />}
                label={location.stars} size="small"
                sx={{ bgcolor: '#fefce8', color: '#a16207', border: '1px solid #fde68a', borderRadius: '16px', fontWeight: 600 }} />
            )}
            {hasValue(location.numberOfReviews) && (
              <Chip icon={<ReviewsIcon sx={{ fontSize: '13px !important' }} />}
                label={`${location.numberOfReviews} reviews`} size="small"
                sx={{ bgcolor: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '16px' }} />
            )}
            {location.distanceKm && (
              <Chip icon={<StraightenIcon sx={{ fontSize: '13px !important' }} />}
                label={`${location.distanceKm} km away`} size="small"
                sx={{ bgcolor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '16px' }} />
            )}
          </Stack>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {streetViewUrl && (
          <Box sx={{ mb: 2, borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <img src={streetViewUrl} alt="Street View" style={{ width: '100%', display: 'block' }} />
          </Box>
        )}
        <InfoRow icon={<PhoneIcon fontSize="small" />}      label="Phone"   value={location.phone}   copyKey="phone"   copied={copied} onCopy={copy} />
        <InfoRow icon={<LocationOnIcon fontSize="small" />} label="Address" value={location.address} copyKey="address" copied={copied} onCopy={copy} />
        <InfoRow icon={<LanguageIcon fontSize="small" />}   label="Website"
          value={hasValue(location.bizWebsite) ? location.bizWebsite : null}
          href={hasValue(location.bizWebsite) ? location.bizWebsite : null} copied={copied} onCopy={copy} />
        <InfoRow icon={<MapIcon fontSize="small" />} label="Google Maps"
          value={hasValue(location.googleUrl) ? 'Open in Google Maps' : null}
          href={hasValue(location.googleUrl) ? location.googleUrl : null} copied={copied} onCopy={copy} />

        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.8, fontWeight: 600 }}>Contact Status</Typography>
          <Select value={status} onChange={handleStatusChange} size="small" fullWidth
            sx={{ fontSize: '0.85rem', color: CONTACT_STATUS_CONFIG[status]?.color, borderRadius: '8px' }}>
            {Object.entries(CONTACT_STATUS_CONFIG).map(([val, cfg]) => (
              <MenuItem key={val} value={val} sx={{ color: cfg.color, fontSize: '0.85rem', borderRadius: '6px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: cfg.color, flexShrink: 0 }} />
                  {cfg.label}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.8, fontWeight: 600 }}>Notes</Typography>
          <TextField multiline rows={3} fullWidth size="small" placeholder="Add notes about this business…"
            value={note} onChange={(e) => setNote(e.target.value)}
            onBlur={() => saveNote(location.businessId, note)}
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.85rem', borderRadius: '8px' } }} />
        </Box>

        {location.latitude && location.longitude && (
          <Box sx={{ mt: 3, p: 2, borderRadius: '8px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.8, fontWeight: 600 }}>Coordinates</Typography>
            <Stack direction="row" spacing={3}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#475569' }}>Lat: {location.latitude.toFixed(6)}</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#475569' }}>Lng: {location.longitude.toFixed(6)}</Typography>
            </Stack>
          </Box>
        )}
        <Box sx={{ mt: 3, pt: 1.5, borderTop: '1px solid #e2e8f0' }}>
          <Typography variant="caption" color="text.secondary">
            Source: {location.source} · {new Date(location.scrapedAt).toLocaleString()}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexWrap: 'wrap' }}>
        {hasValue(location.phone) && (
          <Button variant="outlined" size="small" startIcon={<PhoneIcon />} component="a" href={`tel:${location.phone}`}
            sx={{ borderRadius: '8px', borderColor: '#e2e8f0', color: '#0f172a', '&:hover': { borderColor: '#0f172a', bgcolor: '#f8fafc' } }}>
            Call
          </Button>
        )}
        {hasValue(location.bizWebsite) && (
          <Button variant="outlined" size="small" startIcon={<LanguageIcon />}
            component="a" href={location.bizWebsite} target="_blank" rel="noopener noreferrer"
            sx={{ borderRadius: '8px', borderColor: '#e2e8f0', color: '#0f172a', '&:hover': { borderColor: '#0f172a', bgcolor: '#f8fafc' } }}>
            Website
          </Button>
        )}
        {hasValue(location.googleUrl) && (
          <Button variant="contained" size="small" startIcon={<MapIcon />}
            component="a" href={location.googleUrl} target="_blank" rel="noopener noreferrer"
            sx={{ borderRadius: '8px', background: '#0f172a', color: '#ffffff', ml: 'auto !important', '&:hover': { background: '#1e293b' } }}>
            View on Maps
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DetailModal;
