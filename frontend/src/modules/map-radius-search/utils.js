// frontend/src/modules/map-radius-search/utils.js
// Run: npm install @googlemaps/markerclusterer xlsx

import { HISTORY_KEY, MAX_HISTORY } from './constants';

// ─── Google Maps singleton loader ─────────────────────────────────────────────
let mapsScriptPromise = null;
export const loadGoogleMapsScript = (apiKey) => {
  if (window.google?.maps) return Promise.resolve();
  if (mapsScriptPromise) return mapsScriptPromise;
  mapsScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,visualization,drawing,geometry`;
    script.async = true;
    script.defer = true;
    script.onload  = resolve;
    script.onerror = () => { mapsScriptPromise = null; reject(new Error('Failed to load Google Maps')); };
    document.head.appendChild(script);
  });
  return mapsScriptPromise;
};

// ─── Search history ───────────────────────────────────────────────────────────
export const loadHistory = () => {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
};
export const saveHistory = (entry) => {
  try {
    const prev = loadHistory().filter(
      (h) => !(h.keyword === entry.keyword && h.radius === entry.radius)
    );
    localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...prev].slice(0, MAX_HISTORY)));
  } catch { /* ignore */ }
};

// ─── Named collections ────────────────────────────────────────────────────────
const COLLECTIONS_KEY = 'radius_collections';
export const loadCollections = () => {
  try { return JSON.parse(localStorage.getItem(COLLECTIONS_KEY) || '{}'); }
  catch { return {}; }
};
export const saveCollection = (name, data) => {
  try {
    const cols = loadCollections();
    cols[name] = { data, count: data.length, savedAt: Date.now() };
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(cols));
  } catch { /* ignore */ }
};
export const deleteCollection = (name) => {
  try {
    const cols = loadCollections();
    delete cols[name];
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(cols));
  } catch { /* ignore */ }
};

// ─── Contact status ───────────────────────────────────────────────────────────
const CONTACT_STATUS_KEY = 'radius_contact_status';
export const loadContactStatus = () => {
  try { return JSON.parse(localStorage.getItem(CONTACT_STATUS_KEY) || '{}'); }
  catch { return {}; }
};
export const saveContactStatus = (id, status) => {
  try {
    const all = loadContactStatus();
    all[id] = status;
    localStorage.setItem(CONTACT_STATUS_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
};

// ─── Notes ────────────────────────────────────────────────────────────────────
const NOTES_KEY = 'radius_notes';
export const loadNotes = () => {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '{}'); }
  catch { return {}; }
};
export const saveNote = (id, text) => {
  try {
    const all = loadNotes();
    all[id] = text;
    localStorage.setItem(NOTES_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
};

// ─── CSV export ───────────────────────────────────────────────────────────────
export const exportCSV = (data, filename = 'radius_search_results.csv') => {
  const headers = ['Name','Category','Phone','Address','Website','Rating','Reviews','Distance (km)','Latitude','Longitude','Source','Scraped At'];
  const rows = data.map((r) => [
    r.storeName, r.category, r.phone, r.address, r.bizWebsite,
    r.stars, r.numberOfReviews, r.distanceKm,
    r.latitude, r.longitude, r.source, r.scrapedAt,
  ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`));
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// ─── XLSX export ──────────────────────────────────────────────────────────────
export const exportXLSX = async (data, filename = 'radius_search_results.xlsx') => {
  try {
    const XLSX = await import('xlsx');
    const rows = data.map((r) => ({
      Name: r.storeName, Category: r.category, Phone: r.phone,
      Address: r.address, Website: r.bizWebsite, Rating: r.stars,
      Reviews: r.numberOfReviews, 'Distance (km)': r.distanceKm,
      Latitude: r.latitude, Longitude: r.longitude,
      Source: r.source, 'Scraped At': r.scrapedAt,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, filename);
  } catch (e) {
    console.error('XLSX export failed — run: npm install xlsx', e);
    throw new Error('XLSX export failed. Run: npm install xlsx in the frontend folder');
  }
};

// ─── Sort ─────────────────────────────────────────────────────────────────────
export const sortResults = (data, sortBy) => {
  const arr = [...data];
  switch (sortBy) {
    case 'distance': return arr.sort((a, b) => parseFloat(a.distanceKm || 999) - parseFloat(b.distanceKm || 999));
    case 'rating':   return arr.sort((a, b) => parseFloat(b.stars || 0) - parseFloat(a.stars || 0));
    case 'reviews':  return arr.sort((a, b) => parseInt(b.numberOfReviews || 0) - parseInt(a.numberOfReviews || 0));
    case 'name':     return arr.sort((a, b) => (a.storeName || '').localeCompare(b.storeName || ''));
    default:         return arr;
  }
};

// ─── Filter ───────────────────────────────────────────────────────────────────
export const filterResults = (data, filters) =>
  data.filter((r) => {
    if (filters.hasPhone   && !hasValue(r.phone))      return false;
    if (filters.hasWebsite && !hasValue(r.bizWebsite)) return false;
    if (filters.minRating  > 0 && parseFloat(r.stars || 0) < filters.minRating) return false;
    if (filters.minReviews > 0 && parseInt(r.numberOfReviews || 0) < filters.minReviews) return false;
    return true;
  });

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const hasValue = (v) => v && v !== 'N/A';

// ─── URL sharing ──────────────────────────────────────────────────────────────
export const encodeSearchParams = (keyword, lat, lng, radius) => {
  const p = new URLSearchParams();
  if (keyword) p.set('q', keyword);
  if (lat)     p.set('lat', String(lat));
  if (lng)     p.set('lng', String(lng));
  if (radius)  p.set('r', String(radius));
  return p.toString();
};

export const decodeSearchParams = () => {
  try {
    const p = new URLSearchParams(window.location.search);
    return {
      keyword: p.get('q') || '',
      lat:     parseFloat(p.get('lat')) || null,
      lng:     parseFloat(p.get('lng')) || null,
      radius:  parseInt(p.get('r'))    || null,
    };
  } catch { return {}; }
};
