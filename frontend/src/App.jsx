import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Box, CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme/theme';
import Header from './layouts/Header';
import Sidebar from './layouts/Sidebar';
import MainLayout from './layouts/MainLayout';

// Module imports
import Dashboard from './modules/dashboard/Dashboard';
import GoogleMapsScraper from './modules/google-maps-scraper/GoogleMapsScraper';
import GoogleMapsEnhancedScraper from './modules/google-maps-enhanced/GoogleMapsEnhancedScraper';
import AdvancedGoogleScraper from './modules/advanced-google-scraper/AdvancedGoogleScraper';
import YellowPagesScraper from './modules/yellow-pages/YellowPagesScraper';
import SuperPagesScraper from './modules/superpages/SuperPagesScraper';
import CitySearchScraper from './modules/citysearch/CitySearchScraper';
import YellowPagesCanadaScraper from './modules/yellowpages-ca/YellowPagesCanadaScraper';
import JustDialScraper from './modules/justdial/JustDialScraper';
import IdbfScraper from './modules/idbf-scraper/IdbfScraper';
import LinkedInScraper from './modules/linkedin-scraper/LinkedInScraper';
import HiringPostScraper from './modules/hiring-post-scraper/HiringPostScraper';
import MapRadiusSearch from './modules/map-radius-search/MapRadiusSearch';
import JsonToCsvConverter from './modules/json-to-csv/JsonToCsvConverter';

function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <Box sx={{ display: 'flex' }}>
          <CssBaseline />
          <Sidebar mobileOpen={mobileOpen} onDrawerToggle={handleDrawerToggle} />
          <Header onMenuClick={handleDrawerToggle} />
          <MainLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />

              {/* Google Sources */}
              <Route path="/scrapers/google-maps" element={<GoogleMapsScraper />} />
              <Route path="/scrapers/google-maps-enhanced" element={<GoogleMapsEnhancedScraper />} />
              <Route path="/scrapers/advanced-google" element={<AdvancedGoogleScraper />} />

              {/* Directory Sources */}
              <Route path="/scrapers/yellow-pages" element={<YellowPagesScraper />} />
              <Route path="/scrapers/superpages" element={<SuperPagesScraper />} />
              <Route path="/scrapers/citysearch" element={<CitySearchScraper />} />
              <Route path="/scrapers/yellowpages-ca" element={<YellowPagesCanadaScraper />} />

              {/* India Sources */}
              <Route path="/scrapers/justdial" element={<JustDialScraper />} />
              <Route path="/scrapers/idbf" element={<IdbfScraper />} />

              {/* Enrichment */}
              <Route path="/scrapers/linkedin" element={<LinkedInScraper />} />

              {/* Hiring Tools */}
              <Route path="/scrapers/hiring-posts" element={<HiringPostScraper />} />

              {/* Location Tools */}
              <Route path="/scrapers/map-radius" element={<MapRadiusSearch />} />

              {/* Utilities */}
              <Route path="/tools/json-to-csv" element={<JsonToCsvConverter />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </MainLayout>
        </Box>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
