import FlagIcon from '@mui/icons-material/Flag';
import DirectoryScraper from '../directory-scraper/DirectoryScraper';

const YellowPagesCanadaScraper = () => (
  <DirectoryScraper
    moduleId="yellowpages-ca"
    title="Yellow Pages Canada"
    description="Scrape business leads from the Canadian Yellow Pages directory"
    icon={FlagIcon}
    accentColor="#ef4444"
    endpoint="/search-yellowpages-ca"
    keywordPlaceholder="e.g., Dentist, Mechanic"
    locationPlaceholder="e.g., Toronto, Vancouver"
  />
);

export default YellowPagesCanadaScraper;
