require("dotenv").config();

// Must be set before requiring scraper modules (they register process listeners at load time)
process.setMaxListeners(30);

const express    = require("express");
const bodyParser = require("body-parser");
const cors       = require("cors");
const multer     = require("multer");
const path       = require("path");
const rateLimit  = require("express-rate-limit");

const { searchGoogleMaps }                                                    = require("./googleMaps");
const { searchGoogleMapsWithCompanyDetails, extractCompanyDetailsForExistingResults } = require("./enhancedGoogleMaps");
const { searchYellowPages }    = require("./yellowPages");
const { searchYelp }           = require("./yelp");
const { searchBBB }            = require("./bbb");
const { searchAngi }           = require("./angi");
const { searchJustDial }       = require("./justdial");
const { searchIndiaMart }      = require("./indiamart");
const { searchSulekha }        = require("./sulekha");
const { searchTradeIndia }     = require("./tradeindia");
const { searchExportersIndia } = require("./exportersindia");
const { searchManta }          = require("./manta");
const { searchYellowPagesCanada } = require("./yellowPagesCanada");
const { searchSuperPages }     = require("./superPages");
const { searchCitySearch }     = require("./citysearch");
const { processExcelAndScrapeLinkedIn } = require("./linkedinScraper");
const { searchByRadius }       = require("./radiusSearch");
const { getIdbfStates, getIdbfCategories, searchIdbf } = require("./idbf");
const { parseJsonFile, convertJsonToCsv, listServerJsonFiles } = require("./jsonToCsv");
const { advancedGoogleRouter } = require("./advancedGoogleScraper");

const app  = express();
const PORT = process.env.PORT || 9000;

// ─── Logger ───────────────────────────────────────────────────────────────────
const log = {
  info:  (...a) => console.log(`[${new Date().toISOString()}] [INFO] `, ...a),
  error: (...a) => console.error(`[${new Date().toISOString()}] [ERROR]`, ...a),
};

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow server-to-server / curl (no origin) in dev; block in prod
      if (!origin) {
        return process.env.NODE_ENV === "production"
          ? cb(new Error("CORS: no origin"))
          : cb(null, true);
      }
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(bodyParser.json({ limit: "1mb" }));

// ─── Rate limiting ────────────────────────────────────────────────────────────
// General API limiter — 60 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 429, message: "Too many requests — please slow down" },
});

// Scrape limiter — scraping is expensive; 10 scrape requests per minute per IP
const scrapeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 429, message: "Scrape rate limit exceeded — please wait before retrying" },
});

app.use(apiLimiter);

// ─── Request timeout middleware (2 min for scrape routes) ─────────────────────
const withTimeout = (ms) => (_req, res, next) => {
  res.setTimeout(ms, () => {
    if (!res.headersSent) {
      res.status(503).json({ status: 503, message: "Request timed out" });
    }
  });
  next();
};

// ─── File upload (LinkedIn) ───────────────────────────────────────────────────
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    [".xlsx", ".xls"].includes(ext)
      ? cb(null, true)
      : cb(new Error("Only Excel files (.xlsx, .xls) are allowed"));
  },
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ─── Info route ───────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    status: "running",
    message: "Lead Generation API",
    endpoints: {
      googleMaps:           "POST /search",
      googleMapsEnhanced:   "POST /search-enhanced",
      extractCompanyDetails:"POST /extract-company-details",
      yellowPages:          "POST /search-yellowpages",
      yelp:                 "POST /search-yelp",
      bbb:                  "POST /search-bbb",
      angi:                 "POST /search-angi",
      justdial:             "POST /search-justdial",
      indiamart:            "POST /search-indiamart",
      sulekha:              "POST /search-sulekha",
      tradeindia:           "POST /search-tradeindia",
      exportersindia:       "POST /search-exportersindia",
      manta:                "POST /search-manta",
      yellowPagesCanada:    "POST /search-yellowpages-ca",
      superpages:           "POST /search-superpages",
      citysearch:           "POST /search-citysearch",
      linkedinEnrichment:   "POST /linkedin-enrich",
      radiusSearch:         "POST /search-radius",
      idbfStates:            "GET  /idbf-states",
      idbfCategories:        "GET  /idbf-categories",
      idbfSearch:            "POST /search-idbf",
    },
  });
});

// ─── Scraper routes (rate-limited + timeout) ──────────────────────────────────
const SCRAPE_TIMEOUT = 3 * 60 * 1000; // 3 minutes

app.post("/search",                  scrapeLimiter, withTimeout(SCRAPE_TIMEOUT), searchGoogleMaps);
app.post("/search-enhanced",         scrapeLimiter, withTimeout(SCRAPE_TIMEOUT), searchGoogleMapsWithCompanyDetails);
app.post("/extract-company-details", scrapeLimiter, withTimeout(SCRAPE_TIMEOUT), extractCompanyDetailsForExistingResults);
app.post("/search-yellowpages",      scrapeLimiter, withTimeout(SCRAPE_TIMEOUT), searchYellowPages);
app.post("/search-yelp",             scrapeLimiter, withTimeout(SCRAPE_TIMEOUT), searchYelp);
app.post("/search-bbb",              scrapeLimiter, withTimeout(SCRAPE_TIMEOUT), searchBBB);
app.post("/search-angi",             scrapeLimiter, withTimeout(SCRAPE_TIMEOUT), searchAngi);
app.post("/search-justdial",         scrapeLimiter, withTimeout(SCRAPE_TIMEOUT), searchJustDial);
app.post("/search-indiamart",        scrapeLimiter, withTimeout(SCRAPE_TIMEOUT), searchIndiaMart);
app.post("/search-sulekha",          scrapeLimiter, withTimeout(SCRAPE_TIMEOUT), searchSulekha);
app.post("/search-tradeindia",       scrapeLimiter, withTimeout(SCRAPE_TIMEOUT), searchTradeIndia);
app.post("/search-exportersindia",   scrapeLimiter, withTimeout(SCRAPE_TIMEOUT), searchExportersIndia);
app.post("/search-manta",            scrapeLimiter, withTimeout(SCRAPE_TIMEOUT), searchManta);
app.post("/search-yellowpages-ca",   scrapeLimiter, withTimeout(SCRAPE_TIMEOUT), searchYellowPagesCanada);
app.post("/search-superpages",       scrapeLimiter, withTimeout(SCRAPE_TIMEOUT), searchSuperPages);
app.post("/search-citysearch",       scrapeLimiter, withTimeout(SCRAPE_TIMEOUT), searchCitySearch);
app.post("/search-radius",           scrapeLimiter, withTimeout(SCRAPE_TIMEOUT), searchByRadius);
app.post("/search-idbf",             scrapeLimiter, withTimeout(SCRAPE_TIMEOUT), searchIdbf);
app.get("/idbf-states",              apiLimiter,    getIdbfStates);
app.get("/idbf-categories",          apiLimiter,    getIdbfCategories);
app.post("/linkedin-enrich",         scrapeLimiter, withTimeout(10 * 60 * 1000), upload.single("excelFile"), processExcelAndScrapeLinkedIn);

// ─── Advanced Google Scraper routes ──────────────────────────────────────────
app.use("/advanced-google", advancedGoogleRouter);

// ─── JSON to CSV converter routes ────────────────────────────────────────────
const csvUpload = multer({ dest: "uploads/", limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB
app.get("/json-to-csv/server-files",  apiLimiter, listServerJsonFiles);
app.post("/json-to-csv/parse",        apiLimiter, csvUpload.single("jsonFile"), parseJsonFile);
app.post("/json-to-csv/convert",      apiLimiter, convertJsonToCsv);

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // CORS errors
  if (err.message?.startsWith("CORS")) {
    return res.status(403).json({ status: 403, message: err.message });
  }
  log.error("Unhandled error:", err.message);
  if (!res.headersSent) {
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ status: 404, message: "Route not found" });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  log.info(`Server running on http://localhost:${PORT} [${process.env.NODE_ENV || "development"}]`);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
const shutdown = (signal) => {
  log.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    log.info("HTTP server closed");
    process.exit(0);
  });
  // Force exit after 10s if connections hang
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("uncaughtException",  (err) => { log.error("Uncaught exception:",  err); shutdown("uncaughtException"); });
process.on("unhandledRejection", (err) => { log.error("Unhandled rejection:", err); });
