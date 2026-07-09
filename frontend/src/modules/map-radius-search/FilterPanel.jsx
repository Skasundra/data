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
          sx={{ '& .MuiBadge-badge': { bgcolor: '#0f172a', fontSize: '0.65rem', minWidth: 16, height: 16 } }}>
          <IconButton size="small" onClick={() => setOpen((v) => !v)}
            sx={{ color: activeCount > 0 ? '#0f172a' : 'text.secondary',
              bgcolor: activeCount > 0 ? '#f1f5f9' : 'transparent',
              border: activeCount > 0 ? '1px solid #e2e8f0' : '1px solid transparent',
              borderRadius: '8px', gap: 0.5, px: 1.5, py: 0.8 }}>
            <FilterListIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>Filters</Typography>
            {open ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </Badge>
        {activeCount > 0 && (
          <Button size="small" onClick={clearAll}
            sx={{ borderRadius: '8px', color: '#ef4444', textTransform: 'none', fontSize: '0.75rem', p: 0.5, minWidth: 0,
              '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' } }}>
            Clear filters
          </Button>
        )}
      </Box>
      <Collapse in={open}>
        <Box sx={{ mt: 1.5, p: 2, borderRadius: '8px', bgcolor: '#f8fafc',
          border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {[['hasPhone', 'Has Phone'], ['hasWebsite', 'Has Website']].map(([key, label]) => (
              <Chip key={key} label={label} size="small" clickable onClick={() => set(key, !filters[key])}
                sx={{ bgcolor: filters[key] ? '#f1f5f9' : '#ffffff',
                  color: filters[key] ? '#0f172a' : 'text.secondary',
                  borderRadius: '16px',
                  fontWeight: filters[key] ? 600 : 500,
                  border: filters[key] ? '1px solid #cbd5e1' : '1px solid #e2e8f0' }} />
            ))}
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
              Min Rating: {filters.minRating > 0 ? filters.minRating : 'Any'}
            </Typography>
            <Slider value={filters.minRating} onChange={(_, v) => set('minRating', v)}
              min={0} max={5} step={0.5}
              marks={[{ value: 0, label: '0' }, { value: 2.5, label: '2.5' }, { value: 5, label: '5' }]}
              sx={{ color: '#0f172a', '& .MuiSlider-thumb': { backgroundColor: '#0f172a' },
                '& .MuiSlider-markLabel': { fontSize: '0.65rem' } }} />
          </Box>
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.8, fontWeight: 600 }}>Min Reviews</Typography>
            <TextField type="number" size="small" value={filters.minReviews || ''}
              onChange={(e) => set('minReviews', Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="0" slotProps={{ input: { inputProps: { min: 0 } } }}
              sx={{ width: 100, '& .MuiInputBase-input': { fontSize: '0.85rem', py: 0.8 }, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};

export default FilterPanel;
