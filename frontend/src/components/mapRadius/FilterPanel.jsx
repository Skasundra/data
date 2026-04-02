// frontend/src/components/mapRadius/FilterPanel.jsx
import { useState } from 'react';
import { Box, Typography, Chip, Slider, TextField, Button, Collapse, Badge, IconButton } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

const FilterPanel = ({ filters, onChange }) => {
  const [open, setOpen] = useState(false);
  const activeCount = [filters.hasPhone, filters.hasWebsite, filters.minRating > 0, filters.minReviews > 0].filter(Boolean).length;
  const set = (key, val) => onChange({ ...filters, [key]: val });
  const clearAll = () => onChange({ hasPhone: false, hasWebsite: false, minRating: 0, minReviews: 0 });

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Badge badgeContent={activeCount} color="primary"
          sx={{ '& .MuiBadge-badge': { bgcolor: '#6366f1', fontSize: '0.65rem', minWidth: 16, height: 16 } }}>
          <IconButton size="small" onClick={() => setOpen((v) => !v)}
            sx={{ color: activeCount > 0 ? '#a5b4fc' : 'text.secondary',
              bgcolor: activeCount > 0 ? 'rgba(99,102,241,0.15)' : 'transparent',
              border: activeCount > 0 ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
              borderRadius: 1.5, gap: 0.5, px: 1, py: 0.5 }}>
            <FilterListIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>Filters</Typography>
            {open ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </Badge>
        {activeCount > 0 && (
          <Button size="small" onClick={clearAll}
            sx={{ color: '#ef4444', textTransform: 'none', fontSize: '0.75rem', p: 0, minWidth: 0,
              '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' } }}>
            Clear filters
          </Button>
        )}
      </Box>
      <Collapse in={open}>
        <Box sx={{ mt: 1.5, p: 2, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.5)',
          border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {[['hasPhone', 'Has Phone'], ['hasWebsite', 'Has Website']].map(([key, label]) => (
              <Chip key={key} label={label} size="small" clickable onClick={() => set(key, !filters[key])}
                sx={{ bgcolor: filters[key] ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)',
                  color: filters[key] ? '#a5b4fc' : 'text.secondary',
                  border: filters[key] ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.08)' }} />
            ))}
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Min Rating: {filters.minRating > 0 ? filters.minRating : 'Any'}
            </Typography>
            <Slider value={filters.minRating} onChange={(_, v) => set('minRating', v)}
              min={0} max={5} step={0.5}
              marks={[{ value: 0, label: '0' }, { value: 2.5, label: '2.5' }, { value: 5, label: '5' }]}
              sx={{ color: '#6366f1', '& .MuiSlider-thumb': { backgroundColor: '#6366f1' },
                '& .MuiSlider-markLabel': { fontSize: '0.65rem' } }} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.8 }}>Min Reviews</Typography>
            <TextField type="number" size="small" value={filters.minReviews || ''}
              onChange={(e) => set('minReviews', Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="0" slotProps={{ input: { inputProps: { min: 0 } } }}
              sx={{ width: 100, '& .MuiInputBase-input': { fontSize: '0.85rem', py: 0.8 } }} />
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};

export default FilterPanel;
