import { useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Typography, IconButton, Box, Chip, Breadcrumbs } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import HomeIcon from '@mui/icons-material/Home';
import { SIDEBAR_WIDTH } from './Sidebar';
import { scraperCategories } from '../config/scrapers';
import { tokens } from '../theme/theme';

const Header = ({ onMenuClick }) => {
  const location = useLocation();

  // Derive breadcrumbs from current route
  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (path === '/') return [{ label: 'Dashboard' }];

    for (const cat of scraperCategories) {
      for (const item of cat.items) {
        if (item.route === path) {
          return [
            { label: cat.label },
            { label: item.name },
          ];
        }
      }
    }
    return [{ label: 'Page' }];
  };

  const crumbs = getBreadcrumbs();

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        width: { sm: `calc(100% - ${SIDEBAR_WIDTH}px)` },
        ml: { sm: `${SIDEBAR_WIDTH}px` },
        background: '#ffffff',
        borderBottom: `1px solid ${tokens.border}`,
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 56, sm: 60 }, px: { xs: 2, sm: 3 } }}>
        <IconButton
          edge="start"
          onClick={onMenuClick}
          sx={{
            mr: 2, display: { sm: 'none' },
            color: tokens.text, borderRadius: '8px',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
          }}
        >
          <MenuIcon sx={{ fontSize: 20 }} />
        </IconButton>

        {/* ── Breadcrumbs ── */}
        <Box sx={{ flex: 1 }}>
          <Breadcrumbs separator={<NavigateNextIcon sx={{ fontSize: 14, color: tokens.textMuted }} />} sx={{ '& .MuiBreadcrumbs-li': { lineHeight: 1 } }}>
            <HomeIcon sx={{ fontSize: 15, color: tokens.textMuted, mt: 0.3 }} />
            {crumbs.map((crumb, i) => (
              <Typography
                key={i}
                sx={{
                  fontSize: '0.8125rem',
                  fontWeight: i === crumbs.length - 1 ? 600 : 400,
                  color: i === crumbs.length - 1 ? tokens.text : tokens.textSecondary,
                }}
              >
                {crumb.label}
              </Typography>
            ))}
          </Breadcrumbs>
        </Box>

        {/* ── Right actions ── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Chip
            label="v2.0"
            size="small"
            sx={{
              display: { xs: 'none', md: 'flex' },
              height: 22, fontSize: '0.6875rem', fontWeight: 600,
              bgcolor: `${tokens.primary}10`, color: tokens.primary,
              border: `1px solid ${tokens.primary}25`,
              mr: 1,
            }}
          />
          <IconButton size="small" sx={{ color: tokens.textMuted, borderRadius: '8px', '&:hover': { bgcolor: '#f3f4f6' } }}>
            <HelpOutlineIcon sx={{ fontSize: 19 }} />
          </IconButton>
          <IconButton size="small" sx={{ color: tokens.textMuted, borderRadius: '8px', position: 'relative', '&:hover': { bgcolor: '#f3f4f6' } }}>
            <NotificationsNoneIcon sx={{ fontSize: 19 }} />
            <Box sx={{
              position: 'absolute', top: 6, right: 6, width: 6, height: 6,
              borderRadius: '50%', bgcolor: tokens.primary,
              border: '1.5px solid #fff',
            }} />
          </IconButton>
          <Box sx={{
            width: 30, height: 30, borderRadius: '8px', ml: 1,
            background: `linear-gradient(135deg, ${tokens.primary} 0%, ${tokens.primaryLight} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.15s',
            '&:hover': { transform: 'scale(1.05)' },
          }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>S</Typography>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
