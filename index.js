// Load environment variables
require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors"); // ✅ Import CORS
const multer = require("multer"); // For file uploads
const path = require("path");
const { searchGoogleMaps } = require("./googleMaps");
const { searchGoogleMapsWithCompanyDetails, extractCompanyDetailsForExistingResults } = require("./enhancedGoogleMaps");
const { searchYellowPages } = require("./yellowPages");
const { searchYelp } = require("./yelp");
const { searchBBB } = require("./bbb");
const { searchAngi } = require("./angi");
const { searchJustDial } = require("./justdial");
const { searchIndiaMart } = require("./indiamart");
const { searchSulekha } = require("./sulekha");
const { searchTradeIndia } = require("./tradeindia");
const { searchExportersIndia } = require("./exportersindia");
const { searchManta } = require("./manta");
const { searchYellowPagesCanada } = require("./yellowPagesCanada");
const { searchSuperPages } = require("./superPages");
const { searchCitySearch } = require("./citysearch");
const { scrapeLinkedInCompanies } = require("./linkedinScraper");

const app = express();
const PORT = process.env.PORT || 9000;

// ✅ Enable CORS for all routes
app.use(cors());

app.use(bodyParser.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/') // Make sure this directory exists
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept only CSV and Excel files
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Create uploads directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Test route
app.get("/", (req, res) => {
  res.json({
    status: "running",
    message: "Lead Generation API",
    endpoints: {
      googleMaps: "POST /search",
      googleMapsEnhanced: "POST /search-enhanced (with company details)",
      extractCompanyDetails: "POST /extract-company-details",
      yellowPages: "POST /search-yellowpages",
      yelp: "POST /search-yelp",
      bbb: "POST /search-bbb",
      angi: "POST /search-angi",
      justdial: "POST /search-justdial (India)",
      indiamart: "POST /search-indiamart (India B2B)",
      sulekha: "POST /search-sulekha (India Services)",
      tradeindia: "POST /search-tradeindia (India B2B)",
      exportersindia: "POST /search-exportersindia (India Export)",
      manta: "POST /search-manta (US Business Directory)",
      superpages: "POST /search-superpages (US Business Directory)",
      linkedinScraper: "POST /scrape-linkedin (Upload CSV/Excel with LinkedIn URLs)",
    },
    requiredParams: {
      keyword: "string (e.g., 'Clinic')",
      place: "string (e.g., 'Los Angeles')",
      maxResults: "number (optional, default: 20)",
      extractCompanyDetails: "boolean (optional, for enhanced search)",
      maxCompanyDetails: "number (optional, default: 10)",
      linkedinFile: "file (CSV/Excel with LinkedIn company URLs)",
    },
  });
});

// Google Maps scraping route
app.post("/search", searchGoogleMaps);

// Enhanced Google Maps scraping route with company details
app.post("/search-enhanced", searchGoogleMapsWithCompanyDetails);

// Extract company details for existing results
app.post("/extract-company-details", extractCompanyDetailsForExistingResults);

// Yellow Pages scraping route
app.post("/search-yellowpages", searchYellowPages);

// Yelp scraping route
app.post("/search-yelp", searchYelp);

// BBB scraping route
app.post("/search-bbb", searchBBB);

// Angi scraping route
app.post("/search-angi", searchAngi);

// JustDial scraping route (India)
app.post("/search-justdial", searchJustDial);

// IndiaMART scraping route (India B2B)
app.post("/search-indiamart", searchIndiaMart);

// Sulekha scraping route (India Services)
app.post("/search-sulekha", searchSulekha);

// TradeIndia scraping route (India B2B)
app.post("/search-tradeindia", searchTradeIndia);

// ExportersIndia scraping route (India Export)
app.post("/search-exportersindia", searchExportersIndia);

// Manta scraping route (US Business Directory)
app.post("/search-manta", searchManta);

app.post("/search-yellowpages-ca", searchYellowPagesCanada);

// SuperPages scraping route (US Business Directory)
app.post("/search-superpages", searchSuperPages);

app.post("/search-citysearch", searchCitySearch);

// LinkedIn scraper route (file upload)
app.post("/scrape-linkedin", upload.single('file'), scrapeLinkedInCompanies);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
