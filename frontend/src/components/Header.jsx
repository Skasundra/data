import { AppBar, Toolbar, Typography, IconButton, Box, Chip } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

const Header = ({ onMenuClick }) => {
  return (
    <AppBar 
      position="fixed" 
      elevation={0}
      sx={{ 
        zIndex: (theme) => theme.zIndex.drawer + 1,
        background: '#ffffff',
        borderBottom: '1px solid #e5e5e5',
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 64, sm: 70 }, px: { xs: 2, sm: 3 } }}>
        <IconButton
          color="inherit"
          edge="start"
          onClick={onMenuClick}
          sx={{ 
            mr: 2, 
            display: { sm: 'none' },
            color: '#111111',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
            }
          }}
        >
          <MenuIcon />
        </IconButton>
        
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, gap: 1.5 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 42,
              height: 42,
              borderRadius: 2.5,
              background: '#111111',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            <TravelExploreIcon sx={{ fontSize: 24, color: 'white' }} />
          </Box>
          
          <Box>
            <Typography 
              variant="h6" 
              noWrap 
              component="div"
              sx={{ 
                fontWeight: 700,
                fontSize: { xs: '1.1rem', sm: '1.3rem' },
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
                color: '#111111',
              }}
            >
              LeadGen <Box component="span" sx={{ fontWeight: 300, color: '#666666' }}>Pro</Box>
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                display: { xs: 'none', md: 'block' },
                color: '#6b7280',
                fontSize: '0.75rem',
                lineHeight: 1,
              }}
            >
              Advanced Multi-Source Data Extraction
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Chip
            icon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
            label="15 Sources"
            size="small"
            sx={{
              display: { xs: 'none', sm: 'flex' },
              background: '#f5f5f5',
              border: '1px solid #e5e5e5',
              color: '#111111',
              fontWeight: 600,
              fontSize: '0.75rem',
              height: 28,
              '& .MuiChip-icon': {
                color: '#111111',
              }
            }}
          />
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
