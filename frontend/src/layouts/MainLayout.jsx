import { Box, Container, Toolbar } from '@mui/material';
import PropTypes from 'prop-types';

const MainLayout = ({ children }) => {
  return (
    <Box
      component="main"
      sx={{
        flexGrow: 1,
        p: 3,
        width: { sm: `calc(100% - 280px)` },
        minHeight: '100vh',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <Toolbar />
      <Container maxWidth={false} sx={{ mt: 2, px: { xs: 2, md: 3 } }}>
        {children}
      </Container>
    </Box>
  );
};

MainLayout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default MainLayout;
