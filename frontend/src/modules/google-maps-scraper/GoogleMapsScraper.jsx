import MapIcon from '@mui/icons-material/Map';
import DirectoryScraper from '../directory-scraper/DirectoryScraper';

const GoogleMapsScraper = () => (
  <DirectoryScraper
    moduleId="google-maps"
    title="Google Maps"
    description="Scrape business leads from Google Maps — enter keyword and location"
    icon={MapIcon}
    accentColor="#4285F4"
    endpoint="/search"
    keywordPlaceholder="e.g., Restaurant, Clinic"
    locationPlaceholder="e.g., New York, London"
    columns={['storeName', 'category', 'phone', 'googleUrl', 'bizWebsite', 'address']}
    columnLabels={{ googleUrl: 'Google Maps', bizWebsite: 'Website' }}
  />
);

export default GoogleMapsScraper;
