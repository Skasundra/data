// frontend/src/components/mapRadius/SavedCollections.jsx
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
    <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#fafafa',
      border: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <BookmarkIcon sx={{ fontSize: 16, color: '#111111' }} />
        <Typography variant="caption" sx={{ fontWeight: 600, color: '#111111', flex: 1 }}>Saved Collections</Typography>
        {results.length > 0 && (
          <Tooltip title="Save current results">
            <IconButton size="small" onClick={() => setShowInput((v) => !v)}
              sx={{ color: '#111111', bgcolor: '#f0f0f0', p: 0.4 }}>
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
            sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.7 } }} />
          <Button size="small" variant="contained" onClick={handleSave} disabled={!saveName.trim()}
            sx={{ background: '#111111', color: '#ffffff', minWidth: 0, px: 1.5, '&:hover': { background: '#333333' } }}>
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
          borderBottom: '1px solid #f0f0f0', '&:last-child': { borderBottom: 'none' } }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }} noWrap>{name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {col.count} results · {new Date(col.savedAt).toLocaleDateString()}
            </Typography>
          </Box>
          <Chip label={col.count} size="small"
            sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#f0f0f0', color: '#111111', '& .MuiChip-label': { px: 0.8 } }} />
          <Tooltip title="Restore">
            <IconButton size="small" onClick={() => onRestore(col.data)} sx={{ color: '#111111', p: 0.4 }}>
              <RestoreIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" onClick={() => { deleteCollection(name); refresh(); }} sx={{ color: '#ef4444', p: 0.4 }}>
              <DeleteIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Box>
      ))}
    </Box>
  );
};

export default SavedCollections;
