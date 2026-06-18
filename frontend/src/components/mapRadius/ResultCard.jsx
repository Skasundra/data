// frontend/src/components/mapRadius/ResultCard.jsx
import { useState } from 'react';
import { Box, Typography, Avatar, Chip, Stack, Checkbox, IconButton, Tooltip } from '@mui/material';
import StarIcon        from '@mui/icons-material/Star';
import PhoneIcon       from '@mui/icons-material/Phone';
import LanguageIcon    from '@mui/icons-material/Language';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { hasValue } from './utils';
import { CONTACT_STATUS_CONFIG } from './constants';

const ResultCard = ({ location, selected, checked, onCheck, onClick, onHover, onLeave, index, contactStatus }) => {
  const [hovered, setHovered] = useState(false);
  const [copied,  setCopied]  = useState(false);
  const statusCfg = CONTACT_STATUS_CONFIG[contactStatus || 'none'];

  const handleCopyPhone = (e) => {
    e.stopPropagation();
    if (!hasValue(location.phone)) return;
    navigator.clipboard.writeText(location.phone).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Box
      onClick={onClick}
      onMouseEnter={() => { setHovered(true); onHover?.(location); }}
      onMouseLeave={() => { setHovered(false); onLeave?.(); }}
      tabIndex={0} role="button"
      aria-label={`View details for ${location.storeName}`}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      sx={{
        p: 1.5, cursor: 'pointer', borderRadius: 2, position: 'relative',
        border: selected ? '1px solid #111111' : '1px solid #e5e5e5',
        bgcolor: selected ? '#f5f5f5' : '#ffffff',
        transition: 'all 0.15s ease', outline: 'none',
        '&:hover, &:focus-visible': { bgcolor: '#fafafa', border: '1px solid #d1d5db' },
      }}
    >
      {/* Contact status dot */}
      {contactStatus && contactStatus !== 'none' && (
        <Tooltip title={statusCfg.label}>
          <Box sx={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8,
            borderRadius: '50%', bgcolor: statusCfg.color, zIndex: 1 }} />
        </Tooltip>
      )}

      {/* Checkbox */}
      {(hovered || checked) && (
        <Box sx={{ position: 'absolute', top: 4, left: 4, zIndex: 2 }}
          onClick={(e) => { e.stopPropagation(); onCheck?.(!checked); }}>
          <Checkbox checked={!!checked} size="small"
            sx={{ p: 0.3, color: '#d1d5db', '&.Mui-checked': { color: '#111111' } }} />
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Avatar sx={{ width: 36, height: 36, flexShrink: 0, fontSize: '0.9rem', fontWeight: 700,
          background: selected ? '#111111' : '#f0f0f0', color: selected ? '#ffffff' : '#111111' }}>
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
                sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#f0f0f0',
                  color: '#111111', '& .MuiChip-label': { px: 0.8 } }} />
            )}
            {hasValue(location.stars) && (
              <Chip icon={<StarIcon sx={{ fontSize: '10px !important', color: '#fbbf24 !important' }} />}
                label={location.stars} size="small"
                sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#fefce8',
                  color: '#a16207', '& .MuiChip-label': { px: 0.8 } }} />
            )}
            {hasValue(location.phone) && (
              <Chip label={location.phone} size="small"
                sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#f5f5f5',
                  color: '#6b7280', '& .MuiChip-label': { px: 0.8 } }} />
            )}
          </Stack>
        </Box>
      </Box>

      {/* Inline quick-actions on hover */}
      {hovered && (
        <Stack direction="row" spacing={0.5} sx={{ mt: 1, justifyContent: 'flex-end' }}
          onClick={(e) => e.stopPropagation()}>
          {hasValue(location.phone) && (
            <Tooltip title="Call">
              <IconButton size="small" component="a" href={`tel:${location.phone}`}
                sx={{ color: '#111111', bgcolor: '#f5f5f5', p: 0.5 }}>
                <PhoneIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          )}
          {hasValue(location.bizWebsite) && (
            <Tooltip title="Website">
              <IconButton size="small" component="a" href={location.bizWebsite} target="_blank" rel="noopener noreferrer"
                sx={{ color: '#111111', bgcolor: '#f5f5f5', p: 0.5 }}>
                <LanguageIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          )}
          {hasValue(location.phone) && (
            <Tooltip title={copied ? 'Copied!' : 'Copy phone'}>
              <IconButton size="small" onClick={handleCopyPhone}
                sx={{ color: copied ? '#16a34a' : '#111111', bgcolor: '#f5f5f5', p: 0.5 }}>
                <ContentCopyIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      )}
    </Box>
  );
};

export default ResultCard;
