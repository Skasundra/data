import LocationCityIcon from '@mui/icons-material/LocationCity';
import DirectoryScraper from '../directory-scraper/DirectoryScraper';

const CitySearchScraper = () => (
  <DirectoryScraper
    moduleId="citysearch"
    title="CitySearch"
    description="Scrape business leads from CitySearch local directory"
    icon={LocationCityIcon}
    accentColor="#06b6d4"
    endpoint="/search-citysearch"
    keywordPlaceholder="e.g., Salon, Gym"
    locationPlaceholder="e.g., Austin, Miami"
  />
);

export default CitySearchScraper;
