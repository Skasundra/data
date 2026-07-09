import { useState } from 'react';
import { Box, Typography, IconButton, Button, TextField, Tooltip, Chip } from '@mui/material';
import DeleteIcon   from '@mui/icons-material/Delete';
import RestoreIcon  from '@mui/icons-material/Restore';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import AddIcon      from '@mui/icons-material/Add';
import { saveCollection, deleteCollection, loadCollections } from './utils';

const SavedCollections = ({ results, onRestore }) => {
  const [collections, setCollections] = useState(loadCollections);
  const [saveName,    setSaveName]    = useState('');
  const [showInput,   setShowInput]   = useState(false);
  const refresh = () => setCollections(loadCollections());

  const handleSave = () => {
    const name = saveName.trim();
    if (!name || !results.length) return;
    saveCollection(name, results);
    setSaveName(''); setShowInput(false); refresh();
  };

  return (
    <Box sx={{ p: 2, borderRadius: '8px', bgcolor: '#f8fafc',
      border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <BookmarkIcon sx={{ fontSize: 16, color: '#0f172a' }} />
        <Typography variant="caption" sx={{ fontWeight: 700, color: '#0f172a', flex: 1 }}>Saved Collections</Typography>
        {results.length > 0 && (
          <Tooltip title="Save current results">
            <IconButton size="small" onClick={() => setShowInput((v) => !v)}
              sx={{ color: '#0f172a', bgcolor: '#e2e8f0', p: 0.4, borderRadius: '6px', '&:hover': { bgcolor: '#cbd5e1' } }}>
              <AddIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      {showInput && (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField size="small" placeholder="Collection name…" value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.7 }, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
          <Button size="small" variant="contained" onClick={handleSave} disabled={!saveName.trim()}
            sx={{ borderRadius: '8px', background: '#0f172a', color: '#ffffff', minWidth: 0, px: 2, '&:hover': { background: '#1e293b' } }}>
            Save
          </Button>
        </Box>
      )}
      {Object.entries(collections).length === 0 ? (
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
          No saved collections yet
        </Typography>
      ) : Object.entries(collections).map(([name, col]) => (
        <Box key={name} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5,
          borderBottom: '1px solid #f1f5f9', '&:last-child': { borderBottom: 'none' } }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem', color: '#0f172a' }} noWrap>{name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {col.count} results · {new Date(col.savedAt).toLocaleDateString()}
            </Typography>
          </Box>
          <Chip label={col.count} size="small"
            sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#f1f5f9', color: '#475569', borderRadius: '16px', '& .MuiChip-label': { px: 0.8 } }} />
          <Tooltip title="Restore">
            <IconButton size="small" onClick={() => onRestore(col.data)} sx={{ color: '#0f172a', p: 0.4, borderRadius: '6px', '&:hover': { bgcolor: '#f1f5f9' } }}>
              <RestoreIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" onClick={() => { deleteCollection(name); refresh(); }} sx={{ color: '#ef4444', p: 0.4, borderRadius: '6px', '&:hover': { bgcolor: '#fdf2f2' } }}>
              <DeleteIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Box>
      ))}
    </Box>
  );
};

export default SavedCollections;
