import PhoneIcon from '@mui/icons-material/Phone';
import DirectoryScraper from '../directory-scraper/DirectoryScraper';

const JustDialScraper = () => (
  <DirectoryScraper
    moduleId="justdial"
    title="JustDial"
    description="Scrape business leads from India's largest local search engine"
    icon={PhoneIcon}
    accentColor="#2563eb"
    endpoint="/search-justdial"
    keywordPlaceholder="e.g., Hospital, Gym"
    locationPlaceholder="e.g., Mumbai, Delhi"
  />
);

export default JustDialScraper;
