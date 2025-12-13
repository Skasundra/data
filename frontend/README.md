# Lead Generation Dashboard - Frontend

A modern React dashboard for multi-source lead generation scraping with Material-UI design.

## Features

- **Multi-Source Scraping**: Support for 14+ data sources including Google Maps, Yellow Pages, Yelp, JustDial, IndiaMART, and more
- **Dynamic Forms**: Automatically generated forms based on selected scraper
- **Real-time Results**: View scraped data in an interactive table
- **CSV Export**: Download results as CSV files
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Material-UI**: Modern, professional UI with MUI components

## Tech Stack

- React 19
- Material-UI (MUI)
- Axios for API calls
- Vite for build tooling

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- Backend server running on http://localhost:9000

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

The app will be available at http://localhost:5173

### Build for Production

```bash
npm run build
```

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Header.jsx          # Top navigation bar
│   │   ├── Sidebar.jsx         # Scraper selection sidebar
│   │   ├── ScraperForm.jsx     # Dynamic form for scraper inputs
│   │   └── ResultsTable.jsx    # Results display with pagination
│   ├── config/
│   │   └── scrapers.js         # Scraper configurations
│   ├── services/
│   │   └── api.js              # Axios API service
│   ├── App.jsx                 # Main application component
│   ├── main.jsx                # Application entry point
│   └── index.css               # Global styles
├── package.json
└── vite.config.js
```

## Available Scrapers

1. Google Maps
2. Yellow Pages (US)
3. Yelp
4. Better Business Bureau (BBB)
5. Angi
6. JustDial (India)
7. IndiaMART (India B2B)
8. Sulekha (India)
9. TradeIndia (India B2B)
10. ExportersIndia
11. Manta
12. Yellow Pages Canada
13. SuperPages
14. CitySearch

## Usage

1. Select a scraper from the sidebar
2. Fill in the required fields (keyword, location, max results)
3. Click "Start Scraping"
4. View results in the table
5. Download results as CSV if needed

## API Integration

The frontend connects to the backend API at `http://localhost:9000`. Each scraper has its own endpoint:

- Google Maps: `POST /search`
- Yellow Pages: `POST /search-yellowpages`
- Yelp: `POST /search-yelp`
- And more...

## Customization

To add a new scraper:

1. Add configuration to `src/config/scrapers.js`
2. Ensure backend endpoint exists
3. The UI will automatically update
