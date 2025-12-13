# Lead Generation API

Multi-source business lead scraper with Cloudflare bypass, pagination support, and modern React dashboard.

## Features

- **10 Data Sources**: 
  - **US**: Google Maps, Yellow Pages, Yelp, BBB, Angi
  - **India**: JustDial, IndiaMART, Sulekha, TradeIndia, ExportersIndia
- **Detail Page Scraping**: Yelp & Angi scrape individual business pages for complete data
- **Indian B2B Data**: IndiaMART provides GST numbers, trust seals, response rates
- **Cloudflare Bypass**: Stealth plugin + realistic browser behavior
- **Pagination**: Automatically scrapes multiple pages
- **Fresh Page Strategy**: Each page gets a new browser instance for reliability
- **Human-like Behavior**: Random delays, realistic scrolling, proper headers

## Quick Start

### Backend Setup

```bash
# Install backend dependencies
npm install

# Start backend server
npm start
```

Backend runs on http://localhost:9000

### Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install frontend dependencies
npm install

# Start development server
npm run dev
```

Frontend runs on http://localhost:5173

## Dashboard Features

- **Modern UI**: Material-UI design with responsive layout
- **14+ Scrapers**: Easy selection from sidebar
- **Dynamic Forms**: Auto-generated based on selected scraper
- **Real-time Results**: View data in interactive tables
- **CSV Export**: Download results instantly
- **Mobile Friendly**: Works on all devices

## API Endpoints

### 1. Google Maps
```
POST /search
```

### 2. Yellow Pages
```
POST /search-yellowpages
```

### 3. Yelp
```
POST /search-yelp
```

### 4. BBB (Better Business Bureau)
```
POST /search-bbb
```

### 5. Angi (formerly Angie's List)
```
POST /search-angi
```

### 6. JustDial (India)
```
POST /search-justdial
```

### 7. IndiaMART (India B2B)
```
POST /search-indiamart
```

### 8. Sulekha (India Services)
```
POST /search-sulekha
```

### 9. TradeIndia (India B2B)
```
POST /search-tradeindia
```

### 10. ExportersIndia (India Export)
```
POST /search-exportersindia
```

## Request Body

```json
{
  "keyword": "Clinic",
  "place": "Los Angeles",
  "maxResults": 100
}
```

**Parameters:**
- `keyword` (required): Business type or keyword
- `place` (required): City, state, or location
- `maxResults` (optional): Max results to scrape (default: 20)

## Response Format

```json
{
  "status": 200,
  "message": "Leads generated successfully",
  "data": [
    {
      "userId": "anonymous",
      "businessId": "unique_id",
      "storeName": "Business Name",
      "category": "Healthcare",
      "address": "123 Main St, Los Angeles, CA",
      "phone": "(555) 123-4567",
      "googleUrl": "https://...",
      "bizWebsite": "https://...",
      "stars": 4.5,
      "numberOfReviews": 120,
      "ratingText": "4.5 stars with 120 reviews",
      "searchKeyword": "Clinic",
      "searchLocation": "Los Angeles",
      "scrapedAt": "2025-10-06T...",
      "source": "GoogleMaps",
      "pageNumber": 1
    }
  ],
  "metadata": {
    "totalResults": 100,
    "executionTimeSeconds": 45,
    "searchKeyword": "Clinic",
    "searchLocation": "Los Angeles",
    "source": "GoogleMaps",
    "pagesScraped": 5,
    "maxResultsRequested": 100
  }
}
```

## Usage Examples

### cURL
```bash
# Google Maps
curl -X POST http://localhost:9000/search \
  -H "Content-Type: application/json" \
  -d '{"keyword":"Clinic","place":"Los Angeles","maxResults":50}'

# Yellow Pages
curl -X POST http://localhost:9000/search-yellowpages \
  -H "Content-Type: application/json" \
  -d '{"keyword":"Clinic","place":"Los Angeles","maxResults":50}'

# Yelp
curl -X POST http://localhost:9000/search-yelp \
  -H "Content-Type: application/json" \
  -d '{"keyword":"Clinic","place":"Los Angeles","maxResults":50}'

# BBB
curl -X POST http://localhost:9000/search-bbb \
  -H "Content-Type: application/json" \
  -d '{"keyword":"Clinic","place":"Los Angeles","maxResults":50}'

# Angi
curl -X POST http://localhost:9000/search-angi \
  -H "Content-Type: application/json" \
  -d '{"keyword":"Plumber","place":"Los Angeles","maxResults":50}'
```

### JavaScript (Fetch)
```javascript
const response = await fetch('http://localhost:9000/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    keyword: 'Clinic',
    place: 'Los Angeles',
    maxResults: 100
  })
});

const data = await response.json();
console.log(data);
```

## How It Works

### Cloudflare Bypass
1. **Stealth Plugin**: Removes automation signals
2. **Realistic Headers**: Proper Accept, Sec-Fetch, Referer headers
3. **Human Behavior**: Random delays, natural scrolling
4. **Fresh Pages**: New browser page per pagination to avoid state issues

### Pagination Strategy
1. Close previous page
2. Open fresh page
3. Navigate to URL with page parameter
4. Wait for Cloudflare check (if detected)
5. Scroll to load lazy content
6. Extract data with Cheerio
7. Store in array
8. Repeat until maxResults reached

### Data Extraction
- **Google Maps**: Scrolls feed container, extracts from `a[href*="/maps/place/"]`
- **Yellow Pages**: Uses `&page=N` parameter, extracts from `.result`
- **Yelp**: Uses `&start=N` parameter (0, 10, 20...), scrapes individual `/biz/` detail pages
- **BBB**: Uses `&page=N` parameter, extracts from `.result-item`
- **Angi**: Uses `&page=N` parameter, scrapes individual `/companylist/` detail pages

## Performance

- **Google Maps**: ~20-30 results per page, 3-5 seconds per page
- **Yellow Pages**: ~20-30 results per page, 5-8 seconds per page
- **Yelp**: ~10 results per page, 2-3 seconds per detail page (20-30 seconds per page)
- **BBB**: ~10 results per page, 5-8 seconds per page
- **Angi**: ~10 results per page, 2-3 seconds per detail page (20-30 seconds per page)

**Example**: 
- Scraping 100 results from Google Maps takes ~30-45 seconds
- Scraping 20 results from Yelp (with detail pages) takes ~40-60 seconds

## Troubleshooting

### Cloudflare Blocks
If you see "Attention Required! | Cloudflare":
- The code automatically waits 15 seconds for challenge to resolve
- If still blocked, try increasing wait times in code
- Consider using residential proxies

### No Results on Page 2+
- Check `debug_page_N.html` files created when no results found
- Verify pagination URL pattern is correct
- Increase wait times for page load

### Timeout Errors
- Increase `timeout` values in `page.goto()`
- Check your internet connection
- Verify Chrome executable path

## Environment Variables

```bash
# Optional: Custom Chrome path
CHROME_EXECUTABLE_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"

# Optional: Node environment
NODE_ENV=development
```

## Notes

- **Rate Limiting**: Random 5-8 second delays between pages
- **Deduplication**: Businesses tracked by name/ID to avoid duplicates
- **Browser Reuse**: Single browser instance, fresh pages per request
- **Memory**: Browser closes pages after scraping to prevent memory leaks

## License

MIT
