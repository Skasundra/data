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
    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.5)',
      border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <BookmarkIcon sx={{ fontSize: 16, color: '#a5b4fc' }} />
        <Typography variant="caption" sx={{ fontWeight: 600, color: '#a5b4fc', flex: 1 }}>Saved Collections</Typography>
        {results.length > 0 && (
          <Tooltip title="Save current results">
            <IconButton size="small" onClick={() => setShowInput((v) => !v)}
              sx={{ color: '#a5b4fc', bgcolor: 'rgba(99,102,241,0.12)', p: 0.4 }}>
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
            sx={{ background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', minWidth: 0, px: 1.5 }}>
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
          borderBottom: '1px solid rgba(255,255,255,0.04)', '&:last-child': { borderBottom: 'none' } }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }} noWrap>{name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {col.count} results · {new Date(col.savedAt).toLocaleDateString()}
            </Typography>
          </Box>
          <Chip label={col.count} size="small"
            sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(99,102,241,0.2)', color: '#a5b4fc', '& .MuiChip-label': { px: 0.8 } }} />
          <Tooltip title="Restore">
            <IconButton size="small" onClick={() => onRestore(col.data)} sx={{ color: '#a5b4fc', p: 0.4 }}>
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
