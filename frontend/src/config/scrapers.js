// Scraper configurations with their API endpoints and required fields
// NOTE: The following modules are permanently excluded from the frontend implementation:
// - Yelp
// - Better Business Bureau (BBB)
// - Angi
// - IndiaMart
// - Sulekha
// - Tradeindia
// - exporterIndia (exportersindia)
// - Manta

export const scraperCategories = [
  {
    id: 'dashboard',
    label: 'Overview',
    items: [{ id: 'dashboard', name: 'Dashboard', icon: 'SpaceDashboard', route: '/', description: 'Overview & quick access' }],
  },
  {
    id: 'google',
    label: 'Google Sources',
    items: [
      { id: 'google-maps', name: 'Google Maps', icon: 'Map', route: '/scrapers/google-maps', description: 'Business leads from Google Maps', color: '#4285F4' },
      { id: 'google-maps-enhanced', name: 'Maps Enhanced', icon: 'AutoAwesome', route: '/scrapers/google-maps-enhanced', description: 'Deep scrape with company details', color: '#34A853' },
      { id: 'advanced-google-scrape', name: 'Bulk Scraper', icon: 'RocketLaunch', route: '/scrapers/advanced-google', description: 'Multi-query parallel execution', color: '#EA4335' },
    ],
  },
  {
    id: 'directories',
    label: 'Directory Sources',
    items: [
      { id: 'yellow-pages', name: 'Yellow Pages', icon: 'MenuBook', route: '/scrapers/yellow-pages', description: 'US business directory', color: '#f59e0b' },
      { id: 'superpages', name: 'SuperPages', icon: 'Bolt', route: '/scrapers/superpages', description: 'US business listings', color: '#8b5cf6' },
      { id: 'citysearch', name: 'CitySearch', icon: 'LocationCity', route: '/scrapers/citysearch', description: 'City-based business search', color: '#06b6d4' },
      { id: 'yellowpages-ca', name: 'YP Canada', icon: 'Flag', route: '/scrapers/yellowpages-ca', description: 'Canadian business directory', color: '#ef4444' },
    ],
  },
  {
    id: 'india',
    label: 'India Sources',
    items: [
      { id: 'justdial', name: 'JustDial', icon: 'Phone', route: '/scrapers/justdial', description: 'India local business search', color: '#2563eb' },
      { id: 'idbf', name: 'IDBF.in', icon: 'Storefront', route: '/scrapers/idbf', description: 'India business directory', color: '#059669' },
    ],
  },
  {
    id: 'enrichment',
    label: 'Enrichment',
    items: [
      { id: 'linkedin-scraper', name: 'LinkedIn Scraper', icon: 'LinkedIn', route: '/scrapers/linkedin', description: 'Extract websites from LinkedIn URLs', color: '#0A66C2' },
    ],
  },
  {
    id: 'location',
    label: 'Location Tools',
    items: [
      { id: 'map-radius-search', name: 'Radius Search', icon: 'MyLocation', route: '/scrapers/map-radius', description: 'Search within a map radius', color: '#4F46E5' },
    ],
  },
  {
    id: 'utilities',
    label: 'Utilities',
    items: [
      { id: 'json-to-csv', name: 'JSON → CSV', icon: 'TableChart', route: '/tools/json-to-csv', description: 'Convert & export data files', color: '#6b7280' },
    ],
  },
];

// Flat list for backward compatibility & lookups
export const scraperConfigs = scraperCategories.flatMap(cat => cat.items).filter(s => s.id !== 'dashboard');

// Endpoint config (separated from UI config for cleanliness)
export const scraperEndpoints = {
  'google-maps': { endpoint: '/search', fields: [
    { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'e.g., Restaurant' },
    { name: 'place', label: 'Location', type: 'text', required: true, placeholder: 'e.g., New York' },
    { name: 'maxResults', label: 'Max Results', type: 'number', required: false, default: 20 },
    { name: 'storeData', label: 'Store Data', type: 'checkbox', required: false, default: false },
  ]},
  'google-maps-enhanced': { endpoint: '/search-enhanced', fields: [
    { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'e.g., IT Company' },
    { name: 'place', label: 'Location', type: 'text', required: true, placeholder: 'e.g., Shivranjni' },
    { name: 'maxResults', label: 'Max Results', type: 'number', required: false, default: 10 },
    { name: 'detailedScrape', label: 'Detailed Scrape', type: 'checkbox', required: false, default: true },
    { name: 'extractCompanyDetails', label: 'Extract Company Details', type: 'checkbox', required: false, default: true },
    { name: 'includeCareerPageDetails', label: 'Include Career Details', type: 'checkbox', required: false, default: true },
    { name: 'delayBetweenRequests', label: 'Delay (ms)', type: 'number', required: false, default: 2000 },
  ]},
  'yellow-pages': { endpoint: '/search-yellowpages', fields: [
    { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'e.g., Plumber' },
    { name: 'place', label: 'Location', type: 'text', required: true, placeholder: 'e.g., New York' },
    { name: 'maxResults', label: 'Max Results', type: 'number', required: false, default: 20 },
  ]},
  'justdial': { endpoint: '/search-justdial', fields: [
    { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'e.g., Hospital' },
    { name: 'place', label: 'Location', type: 'text', required: true, placeholder: 'e.g., Mumbai' },
    { name: 'maxResults', label: 'Max Results', type: 'number', required: false, default: 20 },
  ]},
  'yellowpages-ca': { endpoint: '/search-yellowpages-ca', fields: [
    { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'e.g., Dentist' },
    { name: 'place', label: 'Location', type: 'text', required: true, placeholder: 'e.g., Toronto' },
    { name: 'maxResults', label: 'Max Results', type: 'number', required: false, default: 20 },
  ]},
  'superpages': { endpoint: '/search-superpages', fields: [
    { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'e.g., Lawyer' },
    { name: 'place', label: 'Location', type: 'text', required: true, placeholder: 'e.g., Seattle' },
    { name: 'maxResults', label: 'Max Results', type: 'number', required: false, default: 20 },
  ]},
  'citysearch': { endpoint: '/search-citysearch', fields: [
    { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'e.g., Salon' },
    { name: 'place', label: 'Location', type: 'text', required: true, placeholder: 'e.g., Austin' },
    { name: 'maxResults', label: 'Max Results', type: 'number', required: false, default: 20 },
  ]},
};
