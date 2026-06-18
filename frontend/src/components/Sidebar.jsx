import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Toolbar, Box, Divider, Typography } from '@mui/material';
import * as Icons from '@mui/icons-material';
import { scraperConfigs } from '../config/scrapers';

const drawerWidth = 280;

const Sidebar = ({ mobileOpen, onDrawerToggle, selectedScraper, onScraperSelect }) => {
  const getIcon = (iconName) => {
    const IconComponent = Icons[iconName];
    return IconComponent ? <IconComponent /> : <Icons.Search />;
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#ffffff' }}>
      <Toolbar sx={{ minHeight: { xs: 64, sm: 70 } }} />
      
      <Box sx={{ p: 3, pb: 2 }}>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 700,
            mb: 0.5,
            color: '#111111',
          }}
        >
          Data Sources
        </Typography>
        <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '0.75rem' }}>
          Select a scraper to begin
        </Typography>
      </Box>
      
      <Divider sx={{ borderColor: '#e5e5e5' }} />
      
      <List sx={{ px: 2, py: 1, flexGrow: 1, overflowY: 'auto' }}>
        {scraperConfigs.map((scraper) => {
          const isSelected = selectedScraper?.id === scraper.id;
          return (
            <ListItem key={scraper.id} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={isSelected}
                onClick={() => onScraperSelect(scraper)}
                sx={{
                  borderRadius: 2,
                  py: 1.5,
                  px: 2,
                  transition: 'all 0.2s ease-in-out',
                  '&.Mui-selected': {
                    background: '#f5f5f5',
                    border: '1px solid #d1d5db',
                    '&:hover': {
                      background: '#f0f0f0',
                    },
                  },
                  '&:hover': {
                    backgroundColor: '#fafafa',
                    transform: 'translateX(4px)',
                  },
                }}
              >
                <ListItemIcon 
                  sx={{ 
                    minWidth: 40,
                    color: isSelected ? '#111111' : '#9ca3af',
                    transition: 'color 0.2s',
                  }}
                >
                  {getIcon(scraper.icon)}
                </ListItemIcon>
                <ListItemText 
                  primary={scraper.name}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: isSelected ? 600 : 500,
                    color: isSelected ? '#111111' : '#6b7280',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Box sx={{ p: 2, borderTop: '1px solid #e5e5e5' }}>
        <Box 
          sx={{ 
            p: 2, 
            borderRadius: 2,
            background: '#fafafa',
            border: '1px solid #e5e5e5',
          }}
        >
          <Typography variant="caption" sx={{ color: '#111111', fontWeight: 600, display: 'block', mb: 0.5 }}>
            Pro Tip
          </Typography>
          <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '0.7rem', lineHeight: 1.4 }}>
            Start with 20 results to test, then increase for larger datasets
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box
      component="nav"
      sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
    >
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { 
            boxSizing: 'border-box', 
            width: drawerWidth,
            background: '#ffffff',
            borderRight: '1px solid #e5e5e5',
          },
        }}
      >
        {drawer}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': { 
            boxSizing: 'border-box', 
            width: drawerWidth,
            background: '#ffffff',
            borderRight: '1px solid #e5e5e5',
          },
        }}
        open
      >
        {drawer}
      </Drawer>
    </Box>
  );
};

export default Sidebar;
