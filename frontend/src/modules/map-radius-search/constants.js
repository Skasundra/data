// frontend/src/modules/map-radius-search/constants.js

export const DEFAULT_CENTER = { lat: 34.0522, lng: -118.2437 };
export const HISTORY_KEY = 'radius_search_history';
export const MAX_HISTORY = 8;

export const KEYWORD_SUGGESTIONS = [
  'Restaurant', 'Clinic', 'Hotel', 'Gym', 'Pharmacy', 'School',
  'Bank', 'Supermarket', 'Coffee Shop', 'IT Company', 'Hospital',
  'Dentist', 'Lawyer', 'Plumber', 'Electrician', 'Real Estate',
];

export const SORT_OPTIONS = [
  { value: 'distance', label: 'Distance (nearest)' },
  { value: 'rating',   label: 'Rating (highest)'   },
  { value: 'reviews',  label: 'Most reviewed'       },
  { value: 'name',     label: 'Name (A–Z)'          },
];

export const CONTACT_STATUS_CONFIG = {
  none:           { label: 'Not set',        color: '#64748b' },
  contacted:      { label: 'Contacted',      color: '#10b981' },
  follow_up:      { label: 'Follow up',      color: '#f59e0b' },
  not_interested: { label: 'Not interested', color: '#ef4444' },
};

export const MAP_STYLES = {
  light: [],
  dark: [
    { featureType: 'all', elementType: 'geometry',           stylers: [{ color: '#242f3e' }] },
    { featureType: 'all', elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
    { featureType: 'all', elementType: 'labels.text.fill',   stylers: [{ color: '#746855' }] },
    { featureType: 'water', elementType: 'geometry',         stylers: [{ color: '#17263c' }] },
    { featureType: 'road',  elementType: 'geometry',         stylers: [{ color: '#38414e' }] },
  ],
};

export const PROGRESS_MESSAGES = [
  'Opening Google Maps…',
  'Loading search results…',
  'Scrolling for more listings…',
  'Extracting business coordinates…',
  'Fetching contact details…',
  'Filtering by radius…',
  'Almost done…',
];
