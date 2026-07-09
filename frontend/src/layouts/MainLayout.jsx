import { Box, Toolbar } from '@mui/material';
import PropTypes from 'prop-types';
import { SIDEBAR_WIDTH } from './Sidebar';

const MainLayout = ({ children }) => {
  return (
    <Box
      component="main"
      sx={{
        flexGrow: 1,
        width: { sm: `calc(100% - ${SIDEBAR_WIDTH}px)` },
        minHeight: '100vh',
        bgcolor: '#f9fafb',
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 56, sm: 60 } }} />
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1400, mx: 'auto' }}>
        {children}
      </Box>
    </Box>
  );
};

MainLayout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default MainLayout;
