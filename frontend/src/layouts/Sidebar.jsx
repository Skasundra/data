import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Drawer, Box, Typography, IconButton, Collapse, Tooltip } from '@mui/material';
import * as Icons from '@mui/icons-material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import SearchIcon from '@mui/icons-material/Search';
import { scraperCategories } from '../config/scrapers';
import { tokens } from '../theme/theme';

const SIDEBAR_WIDTH = 260;

const Sidebar = ({ mobileOpen, onDrawerToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState({});

  const toggleGroup = (id) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  const getIcon = (iconName, size = 18) => {
    const IconComponent = Icons[iconName];
    return IconComponent ? <IconComponent sx={{ fontSize: size }} /> : <Icons.Circle sx={{ fontSize: size }} />;
  };

  const isActive = (route) => {
    if (route === '/') return location.pathname === '/';
    return location.pathname.startsWith(route);
  };

  const handleNav = (route) => {
    navigate(route);
    if (mobileOpen) onDrawerToggle();
  };

  const content = (
    <Box sx={{
      height: '100%', display: 'flex', flexDirection: 'column',
      bgcolor: tokens.sidebar, color: tokens.sidebarText, overflow: 'hidden',
    }}>
      {/* ── Logo ── */}
      <Box sx={{ px: 2.5, pt: 2.5, pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 34, height: 34, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(135deg, ${tokens.primary} 0%, ${tokens.primaryLight} 100%)`,
            boxShadow: `0 4px 12px rgba(79, 70, 229, 0.35)`,
          }}>
            <Icons.TravelExplore sx={{ fontSize: 18, color: '#fff' }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#fff', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
              LeadGen <Box component="span" sx={{ fontWeight: 400, color: tokens.sidebarText }}>Pro</Box>
            </Typography>
            <Typography sx={{ fontSize: '0.625rem', color: 'rgba(148,163,184,0.6)', letterSpacing: '0.04em' }}>
              Lead Generation Suite
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ── Search trigger ── */}
      <Box sx={{ px: 2, pb: 2 }}>
        <Box
          onClick={() => {}}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1,
            borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer', transition: 'all 0.15s',
            '&:hover': { border: '1px solid rgba(255,255,255,0.15)', bgcolor: 'rgba(255,255,255,0.03)' },
          }}
        >
          <SearchIcon sx={{ fontSize: 15, color: 'rgba(148,163,184,0.5)' }} />
          <Typography sx={{ fontSize: '0.75rem', color: 'rgba(148,163,184,0.5)', flex: 1 }}>Search modules...</Typography>
          <Typography sx={{
            fontSize: '0.625rem', color: 'rgba(148,163,184,0.35)', bgcolor: 'rgba(255,255,255,0.06)',
            px: 0.8, py: 0.15, borderRadius: '4px', fontFamily: 'monospace',
          }}>⌘K</Typography>
        </Box>
      </Box>

      {/* ── Nav groups ── */}
      <Box className="dark-scrollbar" sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', px: 1.5, pb: 2 }}>
        {scraperCategories.map((cat) => {
          const isOpen = collapsed[cat.id] !== true; // default open

          // Dashboard item renders differently
          if (cat.id === 'dashboard') {
            const item = cat.items[0];
            const active = isActive(item.route);
            return (
              <Box key={cat.id} sx={{ mb: 1 }}>
                <Box
                  onClick={() => handleNav(item.route)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1,
                    borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s',
                    bgcolor: active ? tokens.sidebarActive : 'transparent',
                    borderLeft: active ? `2px solid ${tokens.primary}` : '2px solid transparent',
                    '&:hover': { bgcolor: active ? tokens.sidebarActive : tokens.sidebarHover },
                  }}
                >
                  <Box sx={{ color: active ? tokens.primary : tokens.sidebarText, display: 'flex' }}>
                    {getIcon(item.icon)}
                  </Box>
                  <Typography sx={{
                    fontSize: '0.8125rem', fontWeight: active ? 600 : 500,
                    color: active ? '#fff' : tokens.sidebarText,
                  }}>
                    {item.name}
                  </Typography>
                </Box>
              </Box>
            );
          }

          return (
            <Box key={cat.id} sx={{ mb: 0.5 }}>
              {/* Group header */}
              <Box
                onClick={() => toggleGroup(cat.id)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.8,
                  cursor: 'pointer', userSelect: 'none',
                  '&:hover': { '& .group-label': { color: 'rgba(148,163,184,0.8)' } },
                }}
              >
                {isOpen
                  ? <KeyboardArrowDownIcon sx={{ fontSize: 14, color: 'rgba(148,163,184,0.4)' }} />
                  : <KeyboardArrowRightIcon sx={{ fontSize: 14, color: 'rgba(148,163,184,0.4)' }} />
                }
                <Typography className="group-label" sx={{
                  fontSize: '0.6875rem', fontWeight: 600, color: 'rgba(148,163,184,0.5)',
                  letterSpacing: '0.06em', textTransform: 'uppercase', transition: 'color 0.15s',
                }}>
                  {cat.label}
                </Typography>
              </Box>

              {/* Group items */}
              <Collapse in={isOpen} timeout={200}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, mt: 0.3 }}>
                  {cat.items.map((item) => {
                    const active = isActive(item.route);
                    return (
                      <Tooltip key={item.id} title={item.description} placement="right" arrow enterDelay={600}>
                        <Box
                          onClick={() => handleNav(item.route)}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 0.85,
                            borderRadius: '7px', cursor: 'pointer', transition: 'all 0.12s',
                            bgcolor: active ? tokens.sidebarActive : 'transparent',
                            borderLeft: active ? `2px solid ${tokens.primary}` : '2px solid transparent',
                            '&:hover': { bgcolor: active ? tokens.sidebarActive : tokens.sidebarHover },
                          }}
                        >
                          <Box sx={{
                            width: 28, height: 28, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            bgcolor: active ? `${tokens.primary}20` : 'rgba(255,255,255,0.04)',
                            color: active ? tokens.primary : tokens.sidebarText,
                            transition: 'all 0.12s',
                          }}>
                            {getIcon(item.icon, 16)}
                          </Box>
                          <Typography sx={{
                            fontSize: '0.8125rem', fontWeight: active ? 600 : 400,
                            color: active ? '#fff' : tokens.sidebarText, flex: 1,
                            transition: 'color 0.12s',
                          }}>
                            {item.name}
                          </Typography>
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Box>

      {/* ── Bottom card ── */}
      <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Box sx={{
          p: 2, borderRadius: '8px',
          background: 'linear-gradient(135deg, rgba(79,70,229,0.12) 0%, rgba(99,102,241,0.06) 100%)',
          border: '1px solid rgba(79,70,229,0.15)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Icons.AutoAwesome sx={{ fontSize: 14, color: tokens.primary }} />
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: tokens.primaryLight }}>
              Quick Tip
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.6875rem', color: 'rgba(148,163,184,0.7)', lineHeight: 1.5 }}>
            Start with 10-20 results to test, then scale up for larger datasets.
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.625rem', color: 'rgba(148,163,184,0.3)', textAlign: 'center', mt: 1.5 }}>
          LeadGen Pro v2.0
        </Typography>
      </Box>
    </Box>
  );

  const drawerPaperSx = {
    boxSizing: 'border-box', width: SIDEBAR_WIDTH,
    bgcolor: tokens.sidebar, borderRight: 'none',
    boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
  };

  return (
    <Box component="nav" sx={{ width: { sm: SIDEBAR_WIDTH }, flexShrink: { sm: 0 } }}>
      <Drawer variant="temporary" open={mobileOpen} onClose={onDrawerToggle} ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': drawerPaperSx }}>
        {content}
      </Drawer>
      <Drawer variant="permanent" open
        sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': drawerPaperSx }}>
        {content}
      </Drawer>
    </Box>
  );
};

export { SIDEBAR_WIDTH };
export default Sidebar;
