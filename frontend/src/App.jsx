import { useState } from 'react';
import { Box, CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme/theme';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ScraperForm from './components/ScraperForm';
import ResultsTable from './components/ResultsTable';
import LinkedInScraper from './components/LinkedInScraper';
import MainLayout from './layouts/MainLayout';
import { scraperConfigs } from './config/scrapers';


function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedScraper, setSelectedScraper] = useState(scraperConfigs[0]);
  const [results, setResults] = useState([]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleScraperSelect = (scraper) => {
    setSelectedScraper(scraper);
    setResults([]);
    setMobileOpen(false);
  };

  const handleResultsReceived = (data) => {
    setResults(data);
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />
        <Header onMenuClick={handleDrawerToggle} />
        <Sidebar
          mobileOpen={mobileOpen}
          onDrawerToggle={handleDrawerToggle}
          selectedScraper={selectedScraper}
          onScraperSelect={handleScraperSelect}
        />
        <MainLayout>
          {selectedScraper.id === 'linkedin-scraper' ? (
            <LinkedInScraper />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box sx={{ flexShrink: 0 }}>
                <ScraperForm
                  scraper={selectedScraper}
                  onResultsReceived={handleResultsReceived}
                />
              </Box>
              <Box>
                <ResultsTable results={results} scraperId={selectedScraper.id} />
              </Box>
            </Box>
          )}
        </MainLayout>
      </Box>
    </ThemeProvider>
  );
}

export default App;
