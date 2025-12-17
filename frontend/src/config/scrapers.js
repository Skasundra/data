// Scraper configurations with their API endpoints and required fields
export const scraperConfigs = [
  {
    id: 'google-maps',
    name: 'Google Maps',
    endpoint: '/search',
    icon: 'Map',
    fields: [
      { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'e.g., Restaurant, Clinic' },
      { name: 'place', label: 'Location', type: 'text', required: true, placeholder: 'e.g., Los Angeles, CA' },
      { name: 'maxResults', label: 'Max Results', type: 'number', required: false, placeholder: '20', default: 20 }
    ]
  },
  {
    id: 'google-maps-enhanced',
    name: 'Google Maps Enhanced',
    endpoint: '/search-enhanced',
    icon: 'AutoAwesome',
    fields: [
      { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'e.g., IT Company' },
      { name: 'place', label: 'Location', type: 'text', required: true, placeholder: 'e.g., Shivranjni' },
      { name: 'maxResults', label: 'Max Results', type: 'number', required: false, placeholder: '10', default: 10 },
      { name: 'detailedScrape', label: 'Detailed Scrape', type: 'checkbox', required: false, default: true },
      { name: 'extractCompanyDetails', label: 'Extract Company Details', type: 'checkbox', required: false, default: true },
      { name: 'includeCareerPageDetails', label: 'Include Career Details', type: 'checkbox', required: false, default: true },
      { name: 'delayBetweenRequests', label: 'Delay (ms)', type: 'number', required: false, placeholder: '2000', default: 2000 }
    ]
  },
  {
    id: 'yellow-pages',
    name: 'Yellow Pages',
    endpoint: '/search-yellowpages',
    icon: 'MenuBook',
    fields: [
      { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'e.g., Plumber' },
      { name: 'place', label: 'Location', type: 'text', required: true, placeholder: 'e.g., New York' },
      { name: 'maxResults', label: 'Max Results', type: 'number', required: false, placeholder: '20', default: 20 }
    ]
  },
  {
    id: 'yelp',
    name: 'Yelp',
    endpoint: '/search-yelp',
    icon: 'Restaurant',
    fields: [
      { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'e.g., Coffee Shop' },
      { name: 'place', label: 'Location', type: 'text', required: true, placeholder: 'e.g., San Francisco' },
      { name: 'maxResults', label: 'Max Results', type: 'number', required: false, placeholder: '20', default: 20 }
    ]
  },
  {
    id: 'bbb',
    name: 'Better Business Bureau',
    endpoint: '/search-bbb',
    icon: 'VerifiedUser',
    fields: [
      { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'e.g., Contractor' },
      { name: 'place', label: 'Location', type: 'text', required: true, placeholder: 'e.g., Chicago' },
      { name: 'maxResults', label: 'Max Results', type: 'number', required: false, placeholder: '20', default: 20 }
    ]
  },
  {
    id: 'angi',
    name: 'Angi',
    endpoint: '/search-angi',
    icon: 'HomeRepairService',
    fields: [
      { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'e.g., Electrician' },
      { name: 'place', label: 'Location', type: 'text', required: true, placeholder: 'e.g., Boston' },
      { name: 'maxResults', label: 'Max Results', type: 'number', required: false, placeholder: '20', default: 20 }
    ]
  },
  {
    id: 'justdial',
    name: 'JustDial (India)',
    endpoint: '/search-justdial',
    icon: 'Phone',
    fields: [
      { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'e.g., Hospital' },
      { name: 'place', label: 'Location', type: 'text', required: true, placeholder: 'e.g., Mumbai' },
      { name: 'maxResults', label: 'Max Results', type: 'number', required: false, placeholder: '20', default: 20 }
    ]
  },
  {
    id: 'indiamart',
    name: 'IndiaMART (B2B)',
    endpoint: '/search-indiamart',
    icon: 'Business',
    fields: [
      { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'e.g., Textile Manufacturer' },
      { name: 'place', label: 'Location', type: 'text', required: true, placeholder: 'e.g., Delhi' },
      { name: 'maxResults', label: 'Max Results', type: 'number', required: false, placeholder: '20', default: 20 }
    ]
  },
  {
    id: 'sulekha',
    name: 'Sulekha (India)',
    endpoint: '/search-sulekha',
    icon: 'LocalOffer',
    fields: [
      { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'e.g., Tutor' },
      { name: 'place', label: 'Location', type: 'text', required: true, placeholder: 'e.g., Bangalore' },
      { name: 'maxResults', label: 'Max Results', type: 'number', required: false, placeholder: '20', default: 20 }
    ]
  },
  {
    id: 'tradeindia',
    name: 'TradeIndia (B2B)',
    endpoint: '/search-tradeindia',
    icon: 'Store',
    fields: [
      { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'e.g., Electronics Supplier' },
      { name: 'place', label: 'Location', type: 'text', required: true, placeholder: 'e.g., Chennai' },
      { name: 'maxResults', label: 'Max Results', type: 'number', required: false, placeholder: '20', default: 20 }
    ]
  },
  {
    id: 'exportersindia',
    name: 'ExportersIndia',
    endpoint: '/search-exportersindia',
    icon: 'LocalShipping',
    fields: [
      { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'e.g., Spices Exporter' },
      { name: 'place', label: 'Location', type: 'text', required: true, placeholder: 'e.g., Kolkata' },
      { name: 'maxResults', label: 'Max Results', type: 'number', required: false, placeholder: '20', default: 20 }
    ]
  },
  {
    id: 'manta',
    name: 'Manta',
    endpoint: '/search-manta',
    icon: 'BusinessCenter',
    fields: [
      { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'e.g., Marketing Agency' },
      { name: 'place', label: 'Location', type: 'text', required: true, placeholder: 'e.g., Miami' },
      { name: 'maxResults', label: 'Max Results', type: 'number', required: false, placeholder: '20', default: 20 }
    ]
  },
  {
    id: 'yellowpages-ca',
    name: 'Yellow Pages Canada',
    endpoint: '/search-yellowpages-ca',
    icon: 'Public',
    fields: [
      { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'e.g., Dentist' },
      { name: 'place', label: 'Location', type: 'text', required: true, placeholder: 'e.g., Toronto' },
      { name: 'maxResults', label: 'Max Results', type: 'number', required: false, placeholder: '20', default: 20 }
    ]
  },
  {
    id: 'superpages',
    name: 'SuperPages',
    endpoint: '/search-superpages',
    icon: 'Pages',
    fields: [
      { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'e.g., Lawyer' },
      { name: 'place', label: 'Location', type: 'text', required: true, placeholder: 'e.g., Seattle' },
      { name: 'maxResults', label: 'Max Results', type: 'number', required: false, placeholder: '20', default: 20 }
    ]
  },
  {
    id: 'citysearch',
    name: 'CitySearch',
    endpoint: '/search-citysearch',
    icon: 'LocationCity',
    fields: [
      { name: 'keyword', label: 'Keyword', type: 'text', required: true, placeholder: 'e.g., Salon' },
      { name: 'place', label: 'Location', type: 'text', required: true, placeholder: 'e.g., Austin' },
      { name: 'maxResults', label: 'Max Results', type: 'number', required: false, placeholder: '20', default: 20 }
    ]
  }
];
