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
        p: 1.8, cursor: 'pointer', borderRadius: '8px', position: 'relative',
        border: selected ? '1px solid #0f172a' : '1px solid #e2e8f0',
        bgcolor: selected ? '#f1f5f9' : '#ffffff',
        transition: 'all 0.15s ease', outline: 'none',
        '&:hover, &:focus-visible': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' },
      }}
    >
      {/* Contact status circular dot */}
      {contactStatus && contactStatus !== 'none' && (
        <Tooltip title={statusCfg.label}>
          <Box sx={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8,
            borderRadius: '50%', bgcolor: statusCfg.color, zIndex: 1 }} />
        </Tooltip>
      )}

      {/* Checkbox */}
      {(hovered || checked) && (
        <Box sx={{ position: 'absolute', top: 6, left: 6, zIndex: 2 }}
          onClick={(e) => { e.stopPropagation(); onCheck?.(!checked); }}>
          <Checkbox checked={!!checked} size="small"
            sx={{ p: 0.3, color: '#cbd5e1', '&.Mui-checked': { color: '#0f172a' } }} />
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Avatar variant="rounded" sx={{ width: 34, height: 34, flexShrink: 0, fontSize: '0.85rem', fontWeight: 700,
          background: selected ? '#0f172a' : '#f1f5f9', color: selected ? '#ffffff' : '#475569', borderRadius: '6px' }}>
          {index + 1}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3, mb: 0.3, color: '#0f172a' }} noWrap>
            {location.storeName}
          </Typography>
          {hasValue(location.category) && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mb: 0.2 }}>
              {location.category}
            </Typography>
          )}
          <Stack direction="row" sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
            {location.distanceKm && (
              <Chip label={`${location.distanceKm} km`} size="small"
                sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#f1f5f9', borderRadius: '16px',
                  color: '#475569', '& .MuiChip-label': { px: 0.8 } }} />
            )}
            {hasValue(location.stars) && (
              <Chip icon={<StarIcon sx={{ fontSize: '10px !important', color: '#fbbf24 !important' }} />}
                label={location.stars} size="small"
                sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#fefce8', borderRadius: '16px',
                  color: '#a16207', '& .MuiChip-label': { px: 0.8 } }} />
            )}
            {hasValue(location.phone) && (
              <Chip label={location.phone} size="small"
                sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '16px',
                  color: '#64748b', '& .MuiChip-label': { px: 0.8 } }} />
            )}
          </Stack>
        </Box>
      </Box>

      {/* Inline quick-actions on hover */}
      {hovered && (
        <Stack direction="row" spacing={0.5} sx={{ mt: 1.2, justifyContent: 'flex-end' }}
          onClick={(e) => e.stopPropagation()}>
          {hasValue(location.phone) && (
            <Tooltip title="Call">
              <IconButton size="small" component="a" href={`tel:${location.phone}`}
                sx={{ color: '#0f172a', bgcolor: '#f1f5f9', p: 0.5, borderRadius: '6px', '&:hover': { bgcolor: '#e2e8f0' } }}>
                <PhoneIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          )}
          {hasValue(location.bizWebsite) && (
            <Tooltip title="Website">
              <IconButton size="small" component="a" href={location.bizWebsite} target="_blank" rel="noopener noreferrer"
                sx={{ color: '#0f172a', bgcolor: '#f1f5f9', p: 0.5, borderRadius: '6px', '&:hover': { bgcolor: '#e2e8f0' } }}>
                <LanguageIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          )}
          {hasValue(location.phone) && (
            <Tooltip title={copied ? 'Copied!' : 'Copy phone'}>
              <IconButton size="small" onClick={handleCopyPhone}
                sx={{ color: copied ? '#16a34a' : '#0f172a', bgcolor: '#f1f5f9', p: 0.5, borderRadius: '6px', '&:hover': { bgcolor: '#e2e8f0' } }}>
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
