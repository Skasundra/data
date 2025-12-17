# Dashboard Usage Guide

## Getting Started

### 1. Start the Backend Server

```bash
# From project root
npm start
```

The backend API will run on http://localhost:9000

### 2. Start the Frontend Dashboard

```bash
# From project root
cd frontend
npm run dev
```

The dashboard will open at http://localhost:5173

## Using the Dashboard

### Step 1: Select a Scraper

On the left sidebar, you'll see a list of available scrapers:

- **Google Maps** - US business listings
- **Yellow Pages** - US business directory
- **Yelp** - US restaurant and service reviews
- **BBB** - Better Business Bureau listings
- **Angi** - Home service providers
- **JustDial** - India business directory
- **IndiaMART** - India B2B marketplace
- **Sulekha** - India classified services
- **TradeIndia** - India B2B trade portal
- **ExportersIndia** - India export directory
- **Manta** - US small business directory
- **Yellow Pages Canada** - Canadian business directory
- **SuperPages** - US business listings
- **CitySearch** - US local business search

Click on any scraper to select it.

### Step 2: Fill in the Form

After selecting a scraper, you'll see a form with fields:

- **Keyword** (Required): The type of business you're looking for
  - Examples: "Restaurant", "Plumber", "Clinic", "Lawyer"
  
- **Location** (Required): The city or area to search
  - Examples: "Los Angeles", "New York", "Mumbai", "Toronto"
  
- **Max Results** (Optional): Number of results to scrape
  - Default: 20
  - Range: 1-500 (depending on availability)

### Step 3: Start Scraping

Click the **"Start Scraping"** button. The button will show a loading spinner while scraping is in progress.

### Step 4: View Results

Results will appear in the table on the right side:

- **Sortable columns**: Click column headers to sort
- **Pagination**: Navigate through results using Previous/Next buttons
- **Clickable links**: Website URLs are clickable
- **Result count**: Shows total number of records found

### Step 5: Export Data

Click the **"Download CSV"** button to export all results to a CSV file. The file will include:

- All scraped data fields
- Timestamp in filename
- Ready for Excel or Google Sheets

## Tips for Best Results

### Keyword Selection

- **Be specific**: "Italian Restaurant" vs "Restaurant"
- **Use common terms**: "Plumber" vs "Plumbing Services"
- **Try variations**: "Dentist" vs "Dental Clinic"

### Location Selection

- **City names work best**: "Los Angeles" vs "LA"
- **Include state for US**: "Austin, TX" vs "Austin"
- **Use major cities**: Better data availability

### Max Results

- **Start small**: Test with 20-50 results first
- **Increase gradually**: Some sources have limits
- **Be patient**: Large scrapes take time

## Troubleshooting

### No Results Found

- Check if keyword/location combination is valid
- Try different keyword variations
- Verify backend server is running
- Check browser console for errors

### Slow Scraping

- Normal for large result sets
- Each source has different speeds
- Detail page scrapers (Yelp, Angi) are slower
- Wait times prevent blocking

### Connection Errors

- Ensure backend is running on port 9000
- Check CORS is enabled in backend
- Verify no firewall blocking
- Check browser console for details

## Data Fields

Different scrapers return different fields. Common fields include:

- **storeName**: Business name
- **address**: Full address
- **phone**: Contact number
- **website**: Business website
- **email**: Email address (when available)
- **category**: Business category
- **rating**: Star rating
- **reviews**: Number of reviews
- **description**: Business description

## Performance Expectations

| Scraper | Results/Page | Time/Page | Detail Pages |
|---------|--------------|-----------|--------------|
| Google Maps | 20-30 | 3-5 sec | No |
| Yellow Pages | 20-30 | 5-8 sec | No |
| Yelp | 10 | 20-30 sec | Yes |
| BBB | 10 | 5-8 sec | No |
| Angi | 10 | 20-30 sec | Yes |
| JustDial | 15-20 | 5-8 sec | No |
| IndiaMART | 20-30 | 5-8 sec | No |

**Note**: Scrapers with detail pages take longer but provide more complete data.

## Best Practices

1. **Test first**: Start with small result sets
2. **Save regularly**: Download CSV after each scrape
3. **Vary searches**: Don't repeat same search too quickly
4. **Be patient**: Quality data takes time
5. **Check results**: Verify data accuracy before using

## Support

For issues or questions:

1. Check backend logs in terminal
2. Check browser console (F12)
3. Verify all dependencies installed
4. Ensure ports 9000 and 5173 are available
