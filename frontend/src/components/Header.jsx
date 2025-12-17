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
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
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
            '&:hover': {
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
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
              background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
              boxShadow: '0 8px 20px -4px rgba(99, 102, 241, 0.6)',
            }}
          >
            <TravelExploreIcon sx={{ fontSize: 26, color: 'white' }} />
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
              }}
            >
              LeadGen <Box component="span" sx={{ 
                background: 'linear-gradient(45deg, #6366f1 30%, #ec4899 90%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>Pro</Box>
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                display: { xs: 'none', md: 'block' },
                color: 'text.secondary',
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
            label="14 Sources"
            size="small"
            sx={{
              display: { xs: 'none', sm: 'flex' },
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: '#818cf8',
              fontWeight: 600,
              fontSize: '0.75rem',
              height: 28,
              '& .MuiChip-icon': {
                color: '#818cf8',
              }
            }}
          />
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
