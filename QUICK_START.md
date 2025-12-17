# Quick Start Guide

## 🚀 Get Running in 2 Minutes

### Step 1: Install Dependencies

```bash
# Backend dependencies (from project root)
npm install

# Frontend dependencies
cd frontend
npm install
cd ..
```

### Step 2: Start Backend

```bash
# From project root
npm start
```

✅ Backend running at: http://localhost:9000

### Step 3: Start Frontend

```bash
# Open new terminal, from project root
cd frontend
npm run dev
```

✅ Frontend running at: http://localhost:5173

### Step 4: Use the Dashboard

1. Open http://localhost:5173 in your browser
2. Select a scraper from the left sidebar (e.g., "Google Maps")
3. Fill in the form:
   - **Keyword**: "Restaurant"
   - **Location**: "Los Angeles"
   - **Max Results**: 20
4. Click "Start Scraping"
5. Wait for results to appear
6. Click "Download CSV" to export

## 📋 Available Scrapers

### United States
- Google Maps
- Yellow Pages
- Yelp
- Better Business Bureau (BBB)
- Angi
- Manta
- SuperPages
- CitySearch

### Canada
- Yellow Pages Canada

### India
- JustDial
- IndiaMART (B2B)
- Sulekha
- TradeIndia (B2B)
- ExportersIndia

## 🎯 Example Searches

### Restaurants
- Keyword: "Italian Restaurant"
- Location: "New York"

### Healthcare
- Keyword: "Dentist"
- Location: "Los Angeles"

### Home Services
- Keyword: "Plumber"
- Location: "Chicago"

### B2B (India)
- Keyword: "Textile Manufacturer"
- Location: "Mumbai"

## 🔧 Troubleshooting

### Backend won't start
```bash
# Check if port 9000 is in use
netstat -ano | findstr :9000

# Kill process if needed
taskkill /PID <process_id> /F
```

### Frontend won't start
```bash
# Check if port 5173 is in use
netstat -ano | findstr :5173

# Kill process if needed
taskkill /PID <process_id> /F
```

### No results appearing
- Check backend terminal for errors
- Open browser console (F12) for errors
- Verify backend is running on port 9000
- Try a different scraper

### Slow scraping
- Normal for large result sets
- Each scraper has different speeds
- Be patient, quality data takes time

## 📦 Tech Stack

**Backend:**
- Node.js + Express
- Puppeteer (web scraping)
- Cheerio (HTML parsing)

**Frontend:**
- React 19
- Material-UI (MUI)
- Axios (API calls)
- Vite (build tool)

## 📁 Project Structure

```
data/
├── index.js              # Backend server
├── googleMaps.js         # Scraper modules
├── yellowPages.js
├── ...
├── package.json          # Backend deps
└── frontend/
    ├── src/
    │   ├── components/   # React components
    │   ├── config/       # Scraper configs
    │   └── services/     # API service
    └── package.json      # Frontend deps
```

## 🌐 API Endpoints

All endpoints accept POST requests with:
```json
{
  "keyword": "Business Type",
  "place": "Location",
  "maxResults": 20
}
```

| Endpoint | Scraper |
|----------|---------|
| /search | Google Maps |
| /search-yellowpages | Yellow Pages |
| /search-yelp | Yelp |
| /search-bbb | BBB |
| /search-angi | Angi |
| /search-justdial | JustDial |
| /search-indiamart | IndiaMART |
| /search-sulekha | Sulekha |
| /search-tradeindia | TradeIndia |
| /search-exportersindia | ExportersIndia |
| /search-manta | Manta |
| /search-yellowpages-ca | Yellow Pages CA |
| /search-superpages | SuperPages |
| /search-citysearch | CitySearch |

## 💡 Tips

1. **Start small**: Test with 20 results first
2. **Be specific**: "Italian Restaurant" > "Restaurant"
3. **Save often**: Download CSV after each scrape
4. **Vary searches**: Don't repeat same search immediately
5. **Check quality**: Verify data before using

## 📚 More Documentation

- `README.md` - Full project documentation
- `frontend/README.md` - Frontend specific docs
- `frontend/USAGE_GUIDE.md` - Detailed usage instructions
- `PROJECT_STRUCTURE.md` - Architecture overview

## 🆘 Need Help?

1. Check terminal logs (backend and frontend)
2. Check browser console (F12)
3. Verify all dependencies installed
4. Ensure ports 9000 and 5173 are available
5. Try restarting both servers

## ✨ Features

- ✅ 14+ data sources
- ✅ Real-time scraping
- ✅ CSV export
- ✅ Responsive design
- ✅ Pagination
- ✅ Error handling
- ✅ Mobile friendly

---

**Ready to scrape? Start the servers and open http://localhost:5173!** 🎉
