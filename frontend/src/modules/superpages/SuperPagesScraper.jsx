import BoltIcon from '@mui/icons-material/Bolt';
import DirectoryScraper from '../directory-scraper/DirectoryScraper';

const SuperPagesScraper = () => (
  <DirectoryScraper
    moduleId="superpages"
    title="SuperPages"
    description="Scrape business leads from the SuperPages US directory"
    icon={BoltIcon}
    accentColor="#8b5cf6"
    endpoint="/search-superpages"
    keywordPlaceholder="e.g., Lawyer, Auto Repair"
    locationPlaceholder="e.g., Seattle, Chicago"
  />
);

export default SuperPagesScraper;
