import MenuBookIcon from '@mui/icons-material/MenuBook';
import DirectoryScraper from '../directory-scraper/DirectoryScraper';

const YellowPagesScraper = () => (
  <DirectoryScraper
    moduleId="yellow-pages"
    title="Yellow Pages"
    description="Scrape business leads from the US Yellow Pages directory"
    icon={MenuBookIcon}
    accentColor="#f59e0b"
    endpoint="/search-yellowpages"
    keywordPlaceholder="e.g., Plumber, Restaurant"
    locationPlaceholder="e.g., New York, Los Angeles"
  />
);

export default YellowPagesScraper;
