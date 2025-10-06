const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");   // ✅ Import CORS
const { searchGoogleMaps } = require("./googleMaps");
const { searchYellowPages } = require("./yellowPages");
const { searchYelp } = require("./yelp");
const { searchBBB } = require("./bbb");
const { searchAngi } = require("./angi");
const { searchJustDial } = require("./justdial");
const { searchIndiaMart } = require("./indiamart");
const { searchSulekha } = require("./sulekha");
const { searchTradeIndia } = require("./tradeindia");
const { searchExportersIndia } = require("./exportersindia");

const app = express();
const PORT = process.env.PORT || 9000;

// ✅ Enable CORS for all routes
app.use(cors());

app.use(bodyParser.json());

// Test route
app.get("/", (req, res) => {
    res.json({
        status: "running",
        message: "Lead Generation API",
        endpoints: {
            googleMaps: "POST /search",
            yellowPages: "POST /search-yellowpages",
            yelp: "POST /search-yelp",
            bbb: "POST /search-bbb",
            angi: "POST /search-angi",
            justdial: "POST /search-justdial (India)",
            indiamart: "POST /search-indiamart (India B2B)",
            sulekha: "POST /search-sulekha (India Services)",
            tradeindia: "POST /search-tradeindia (India B2B)",
            exportersindia: "POST /search-exportersindia (India Export)"
        },
        requiredParams: {
            keyword: "string (e.g., 'Clinic')",
            place: "string (e.g., 'Los Angeles')",
            maxResults: "number (optional, default: 20)"
        }
    });
});

// Google Maps scraping route
app.post("/search", searchGoogleMaps);

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

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
