# Project Structure

## Overview

This is a full-stack lead generation application with a Node.js/Express backend and React frontend.

```
data/
├── backend (root level)
│   ├── index.js                    # Express server & API routes
│   ├── googleMaps.js               # Google Maps scraper
│   ├── yellowPages.js              # Yellow Pages scraper
│   ├── yelp.js                     # Yelp scraper
│   ├── bbb.js                      # BBB scraper
│   ├── angi.js                     # Angi scraper
│   ├── justdial.js                 # JustDial scraper (India)
│   ├── indiamart.js                # IndiaMART scraper (India)
│   ├── sulekha.js                  # Sulekha scraper (India)
│   ├── tradeindia.js               # TradeIndia scraper (India)
│   ├── exportersindia.js           # ExportersIndia scraper
│   ├── manta.js                    # Manta scraper
│   ├── yellowPagesCanada.js        # Yellow Pages Canada scraper
│   ├── superPages.js               # SuperPages scraper
│   ├── citysearch.js               # CitySearch scraper
│   ├── package.json                # Backend dependencies
│   └── node_modules/               # Backend packages
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Header.jsx          # Top navigation bar
    │   │   ├── Sidebar.jsx         # Scraper selection menu
    │   │   ├── ScraperForm.jsx     # Dynamic input form
    │   │   └── ResultsTable.jsx    # Data display table
    │   ├── config/
    │   │   └── scrapers.js         # Scraper configurations
    │   ├── services/
    │   │   └── api.js              # Axios API client
    │   ├── App.jsx                 # Main app component
    │   ├── main.jsx                # React entry point
    │   └── index.css               # Global styles
    ├── public/                     # Static assets
    ├── package.json                # Frontend dependencies
    ├── vite.config.js              # Vite configuration
    └── node_modules/               # Frontend packages
```

## Backend Architecture

### API Server (index.js)

- Express.js server on port 9000
- CORS enabled for frontend communication
- 14 POST endpoints for different scrapers
- Centralized error handling

### Scraper Modules

Each scraper file exports a function that:
1. Accepts `{ keyword, place, maxResults }`
2. Uses Puppeteer to scrape data
3. Returns standardized JSON response
4. Includes metadata (execution time, pages scraped, etc.)

### Key Technologies

- **Express**: Web server framework
- **Puppeteer**: Headless browser automation
- **Cheerio**: HTML parsing
- **Puppeteer-Extra**: Stealth plugin for Cloudflare bypass
- **CORS**: Cross-origin resource sharing

## Frontend Architecture

### Component Structure

#### App.jsx (Main Container)
- Manages global state (selected scraper, results)
- Coordinates Header, Sidebar, Form, and Table
- Implements Material-UI theme

#### Header.jsx
- Fixed top navigation bar
- Mobile menu toggle
- Branding and title

#### Sidebar.jsx
- Scraper selection menu
- Icon-based navigation
- Responsive drawer (mobile/desktop)
- Highlights selected scraper

#### ScraperForm.jsx
- Dynamic form generation based on scraper config
- Form validation
- API call handling
- Loading states and error handling

#### ResultsTable.jsx
- Paginated data display
- CSV export functionality
- Sortable columns
- Responsive design

### Configuration System

#### scrapers.js
Centralized configuration for all scrapers:
```javascript
{
  id: 'google-maps',
  name: 'Google Maps',
  endpoint: '/search',
  icon: 'Map',
  fields: [...]
}
```

Benefits:
- Easy to add new scrapers
- Consistent UI generation
- Single source of truth
- Type-safe field definitions

### API Service

#### api.js
- Axios instance with base URL
- Centralized error handling
- Environment variable support
- Reusable API methods

### Key Technologies

- **React 19**: UI framework
- **Material-UI**: Component library
- **Axios**: HTTP client
- **Vite**: Build tool and dev server
- **Emotion**: CSS-in-JS styling

## Data Flow

```
User Action (Select Scraper)
    ↓
Sidebar → App.jsx (Update State)
    ↓
ScraperForm (Render Fields)
    ↓
User Input (Fill Form)
    ↓
Form Submit
    ↓
api.js (POST Request)
    ↓
Backend API (Process Request)
    ↓
Puppeteer Scraper (Scrape Data)
    ↓
Backend Response (JSON)
    ↓
api.js (Return Data)
    ↓
App.jsx (Update Results State)
    ↓
ResultsTable (Display Data)
```

## API Endpoints

| Endpoint | Scraper | Region |
|----------|---------|--------|
| POST /search | Google Maps | Global |
| POST /search-yellowpages | Yellow Pages | US |
| POST /search-yelp | Yelp | US |
| POST /search-bbb | BBB | US |
| POST /search-angi | Angi | US |
| POST /search-justdial | JustDial | India |
| POST /search-indiamart | IndiaMART | India |
| POST /search-sulekha | Sulekha | India |
| POST /search-tradeindia | TradeIndia | India |
| POST /search-exportersindia | ExportersIndia | India |
| POST /search-manta | Manta | US |
| POST /search-yellowpages-ca | Yellow Pages | Canada |
| POST /search-superpages | SuperPages | US |
| POST /search-citysearch | CitySearch | US |

## Environment Configuration

### Backend
- PORT: 9000 (default)
- NODE_ENV: development/production
- CHROME_EXECUTABLE_PATH: Custom Chrome path (optional)

### Frontend
- VITE_API_BASE_URL: Backend API URL (default: http://localhost:9000)

## Development Workflow

### Starting Development

```bash
# Terminal 1 - Backend
npm start

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Adding a New Scraper

1. **Backend**: Create `newScraper.js` with scraping logic
2. **Backend**: Add route in `index.js`
3. **Frontend**: Add config to `src/config/scrapers.js`
4. **Test**: Select scraper in UI and test

### Building for Production

```bash
# Backend (no build needed)
npm start

# Frontend
cd frontend
npm run build
# Output in frontend/dist/
```

## Security Considerations

- CORS configured for specific origins
- Input validation on backend
- Rate limiting recommended for production
- Environment variables for sensitive data
- No API keys exposed in frontend

## Performance Optimization

### Backend
- Browser instance reuse
- Page-level isolation
- Memory management (close pages after use)
- Configurable timeouts
- Random delays to avoid blocking

### Frontend
- Lazy loading components
- Pagination for large datasets
- Memoization where needed
- Optimized re-renders
- Code splitting with Vite

## Scalability

### Current Limitations
- Single server instance
- No request queuing
- No result caching
- Sequential scraping

### Future Improvements
- Redis for caching
- Bull queue for job management
- Multiple worker processes
- Database for result storage
- WebSocket for real-time updates

## Testing

### Backend Testing
```bash
# Test individual scraper
curl -X POST http://localhost:9000/search \
  -H "Content-Type: application/json" \
  -d '{"keyword":"test","place":"test","maxResults":5}'
```

### Frontend Testing
- Manual testing in browser
- Check browser console for errors
- Test responsive design
- Verify CSV export

## Deployment

### Backend Deployment
- Node.js hosting (Heroku, DigitalOcean, AWS)
- Set environment variables
- Configure port binding
- Install Chrome/Chromium

### Frontend Deployment
- Static hosting (Vercel, Netlify, S3)
- Build with `npm run build`
- Configure API URL
- Set up CORS on backend

## Maintenance

### Regular Tasks
- Update dependencies
- Monitor scraper functionality
- Check for website structure changes
- Review error logs
- Optimize performance

### Common Issues
- Cloudflare blocking: Update stealth plugin
- No results: Check website HTML structure
- Slow performance: Adjust timeouts and delays
- Memory leaks: Ensure proper page cleanup
