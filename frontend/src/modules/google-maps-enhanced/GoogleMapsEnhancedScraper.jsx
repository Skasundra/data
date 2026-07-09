import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DirectoryScraper from '../directory-scraper/DirectoryScraper';

const GoogleMapsEnhancedScraper = () => (
  <DirectoryScraper
    moduleId="google-maps-enhanced"
    title="Google Maps Enhanced"
    description="Deep scrape with company details, emails, socials, and career pages"
    icon={AutoAwesomeIcon}
    accentColor="#34A853"
    endpoint="/search-enhanced"
    keywordPlaceholder="e.g., IT Company, Digital Agency"
    locationPlaceholder="e.g., Ahmedabad, Bangalore"
    columns={['storeName', 'category', 'phone', 'website', 'address', 'stars', 'numberOfReviews']}
  />
);

export default GoogleMapsEnhancedScraper;
