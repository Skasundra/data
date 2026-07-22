const express = require("express");
const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const { extractMultipleCompanyDetails } = require("./companyDetailsExtractor");

// Setup Stealth Plugin
puppeteerExtra.use(StealthPlugin());

const router = express.Router();

// ─── Logger ──────────────────────────────────────────────────────────────────
const log = {
  info:  (...a) => console.log(`[${new Date().toISOString()}] [ADV-GMAPS] [INFO] `, ...a),
  warn:  (...a) => console.warn(`[${new Date().toISOString()}] [ADV-GMAPS] [WARN] `, ...a),
  error: (...a) => console.error(`[${new Date().toISOString()}] [ADV-GMAPS] [ERROR]`, ...a),
};

// ─── Storage Configurations ──────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const JOBS_FILE_PATH = path.join(UPLOADS_DIR, "advanced_scraping_jobs.json");

const readJobs = () => {
  try {
    if (!fs.existsSync(JOBS_FILE_PATH)) return [];
    const data = fs.readFileSync(JOBS_FILE_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    log.warn(`Could not read jobs file: ${error.message}`);
    return [];
  }
};

const writeJobs = (jobs) => {
  try {
    fs.writeFileSync(JOBS_FILE_PATH, JSON.stringify(jobs, null, 2), "utf8");
    return true;
  } catch (error) {
    log.error(`Failed to write jobs: ${error.message}`);
    return false;
  }
};

const addJobLog = (jobId, message) => {
  const jobs = readJobs();
  const job = jobs.find((j) => j.id === jobId);
  if (job) {
    if (!job.logs) job.logs = [];
    const timestamp = new Date().toLocaleTimeString();
    job.logs.push(`[${timestamp}] ${message}`);
    if (job.logs.length > 150) job.logs.shift();
    writeJobs(jobs);
  }
};

const getResultsFilePath = (jobId) => {
  return path.join(UPLOADS_DIR, `advanced_results_${jobId}.json`);
};

const readResults = (jobId) => {
  const filePath = getResultsFilePath(jobId);
  try {
    if (!fs.existsSync(filePath)) return [];
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    log.warn(`Could not read results file for job ${jobId}: ${error.message}`);
    return [];
  }
};

const writeResults = (jobId, results) => {
  const filePath = getResultsFilePath(jobId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(results, null, 2), "utf8");
    return true;
  } catch (error) {
    log.error(`Failed to write results for job ${jobId}: ${error.message}`);
    return false;
  }
};

// ─── Browser Manager ─────────────────────────────────────────────────────────
let browserInstance = null;
let browserLock = false;
let pageCount = 0;
const MAX_PAGES_BEFORE_RESTART = 50;

const getBrowserInstance = async () => {
  while (browserLock) await new Promise((r) => setTimeout(r, 100));

  if (browserInstance && pageCount >= MAX_PAGES_BEFORE_RESTART) {
    log.info("Restarting browser to prevent memory leaks...");
    await closeBrowserInstance();
  }

  if (browserInstance) return browserInstance;

  browserLock = true;
  try {
    log.info("Launching browser for Advanced Google Scraper...");
    browserInstance = await puppeteerExtra.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-web-security",
        "--disable-features=TranslateUI",
        "--no-first-run",
        "--no-default-browser-check",
        "--window-size=1920,1080",
        "--start-maximized",
      ],
      executablePath:
        process.env.CHROME_EXECUTABLE_PATH ||
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
      timeout: 60000,
      ignoreHTTPSErrors: true,
    });

    browserInstance.on("disconnected", () => {
      log.warn("Browser disconnected");
      browserInstance = null;
      pageCount = 0;
    });

    pageCount = 0;
  } catch (error) {
    log.error("Failed to launch browser:", error);
    throw error;
  } finally {
    browserLock = false;
  }
  return browserInstance;
};

const closeBrowserInstance = async () => {
  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch (err) {
      log.error("Error closing browser:", err);
    }
    browserInstance = null;
    pageCount = 0;
  }
};

// ─── Location & Parsing Helpers ──────────────────────────────────────────────
const parseLocationInput = (loc) => {
  if (!loc) return null;
  const match = loc.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (match) {
    return {
      type: "coordinates",
      lat: parseFloat(match[1]),
      lng: parseFloat(match[2]),
    };
  }
  return {
    type: "text",
    value: loc.trim(),
  };
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const setupPage = async (browser) => {
  const page = await browser.newPage();
  pageCount++;
  await page.setUserAgent(USER_AGENT);
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
  });

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const type = req.resourceType();
    const url = req.url();
    if (type === "image" || type === "font" || type === "media") {
      req.abort();
    } else if (type === "script" && url.includes("adservice")) {
      req.abort();
    } else {
      req.continue();
    }
  });

  return page;
};

// ─── Scroll & Scrape Engine ──────────────────────────────────────────────────
const scrollFeed = async (page, targetCount) => {
  return page.evaluate(async (target) => {
    const feed = document.querySelector('div[role="feed"]');
    if (!feed) return 0;

    let lastCount = 0;
    let stale = 0;
    const maxScrolls = Math.min(Math.ceil(target / 6) + 10, 50);

    for (let i = 0; i < maxScrolls; i++) {
      feed.scrollTop = feed.scrollHeight;
      await new Promise((r) => setTimeout(r, 1200 + Math.random() * 600));

      const count = feed.querySelectorAll('a[href*="/maps/place/"]').length;
      if (count >= target) break;

      const feedText = feed.innerHTML || "";
      if (feedText.includes("You've reached the end of the list")) break;

      if (count === lastCount) {
        stale++;
        if (stale <= 3) await new Promise((r) => setTimeout(r, 1500));
        if (stale >= 5) break;
      } else {
        stale = 0;
        lastCount = count;
      }
    }
    return feed.querySelectorAll('a[href*="/maps/place/"]').length;
  }, targetCount);
};

const scrapeListings = async (page, keyword, locationText, maxResults) => {
  return page.evaluate((opts) => {
    const { keyword, locationText, maxResults } = opts;
    const results = [];
    const seen = new Set();
    const links = document.querySelectorAll('a[href*="/maps/place/"]');

    for (const link of links) {
      if (results.length >= maxResults) break;

      const href = link.getAttribute("href") || "";
      if (seen.has(href)) continue;
      seen.add(href);

      const container =
        link.closest('[jsaction*="mouseover"]') ||
        link.closest('div[jsaction]') ||
        link.parentElement?.parentElement?.parentElement;

      if (!container) continue;

      const storeName =
        link.getAttribute("aria-label") ||
        container.querySelector(".fontHeadlineSmall")?.textContent?.trim() ||
        "";

      if (!storeName) continue;

      let stars = null;
      let numberOfReviews = null;
      const ratingEl = container.querySelector('span[role="img"][aria-label*="star"]');
      if (ratingEl) {
        const ratingText = ratingEl.getAttribute("aria-label") || "";
        const match = ratingText.match(/([\d.]+)/);
        if (match) stars = parseFloat(match[1]);
      }

      const allText = container.textContent || "";
      const reviewMatch = allText.match(/\((\d[\d,]*)\)/);
      if (reviewMatch) {
        numberOfReviews = parseInt(reviewMatch[1].replace(/,/g, ""));
      }

      let category = "";
      let address = "";
      let phone = "";
      let priceLevel = "";
      let hours = "";

      const bodyEl = container.querySelector(".fontBodyMedium");
      if (bodyEl) {
        const parts = bodyEl.textContent.split("·").map((p) => p.trim()).filter(Boolean);
        parts.forEach((part, idx) => {
          if (idx === 0 && !part.match(/^\d/) && !part.match(/^[\$₹€£]/)) {
            category = part;
          } else if (part.match(/^\$+$/) || part.match(/^[₹€£]/)) {
            priceLevel = part;
          } else if (part.match(/open|closed|opens|closes/i)) {
            hours = part;
          } else if (part.match(/[\d\s\-\(\)\+]{10,}/)) {
            phone = part.trim();
          } else if (part.match(/\d/) && !phone) {
            address = part;
          }
        });

        // Clean up category if it is a concatenated string containing storeName or rating details
        if (category) {
          let cleanedCategory = category.trim();

          // If category contains the storeName at the start, strip it
          if (storeName) {
            const storeNameNormalized = storeName.toLowerCase().trim();
            if (cleanedCategory.toLowerCase().startsWith(storeNameNormalized)) {
              cleanedCategory = cleanedCategory.slice(storeNameNormalized.length).trim();
            }
          }

          // If the category contains a rating pattern (e.g., "4.9" or " 4.9"), strip everything up to and including the rating
          const ratingRegex = /(?:^|.*\s)([1-5]\.[0-9])(?:\s*\(\d[\d,]*\))?\s*(.*)/i;
          const match = cleanedCategory.match(ratingRegex);
          if (match) {
            cleanedCategory = match[2].trim();
          }

          // Strip any leading rating that wasn't matched (e.g. starts with digits/dot)
          cleanedCategory = cleanedCategory.replace(/^[\d.]+\s*(?:\(\d[\d,]*\))?\s*/, "").trim();

          // Strip any leading separators
          if (cleanedCategory.startsWith("·")) {
            cleanedCategory = cleanedCategory.slice(1).trim();
          }

          category = cleanedCategory;
        }
      }

      const websiteEl =
        container.querySelector('a[data-value="Website"]') ||
        container.querySelector('a[aria-label*="Website"]');
      const bizWebsite = websiteEl ? websiteEl.href : "";

      let placeId = "";
      const placeIdMatch = href.match(/0x[\da-f]+:0x[\da-f]+/i);
      if (placeIdMatch) placeId = placeIdMatch[0];

      let latitude = null;
      let longitude = null;
      const coordMatch = href.match(/!3d(-?[\d.]+)!4d(-?[\d.]+)/);
      if (coordMatch) {
        latitude = parseFloat(coordMatch[1]);
        longitude = parseFloat(coordMatch[2]);
      } else {
        const atMatch = href.match(/@(-?[\d.]+),(-?[\d.]+)/);
        if (atMatch) {
          latitude = parseFloat(atMatch[1]);
          longitude = parseFloat(atMatch[2]);
        }
      }

      results.push({
        placeId,
        storeName,
        category: category || "N/A",
        address: address || "N/A",
        phone: phone || "N/A",
        googleUrl: href.startsWith("http") ? href : `https://www.google.com${href}`,
        bizWebsite: bizWebsite || "N/A",
        stars: stars ?? "N/A",
        numberOfReviews: numberOfReviews ?? "N/A",
        priceLevel: priceLevel || "N/A",
        hours: hours || "N/A",
        latitude,
        longitude,
        searchKeyword: keyword,
        searchLocation: locationText,
        scrapedAt: new Date().toISOString(),
        source: "AdvancedGoogleMaps",
      });
    }

    return results;
  }, { keyword, locationText, maxResults });
};

// ─── Single Query Scraping Orchestration ──────────────────────────────────────
const runSingleScrapeQuery = async (jobId, keyword, location, maxResults = 20) => {
  const browser = await getBrowserInstance();
  const page = await setupPage(browser);

  try {
    const locInfo = parseLocationInput(location);
    let searchUrl = "";

    if (locInfo.type === "coordinates") {
      searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(keyword)}/@${locInfo.lat},${locInfo.lng},14z`;
    } else {
      searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(keyword)}+in+${encodeURIComponent(locInfo.value)}`;
    }

    addJobLog(jobId, `Query [${keyword} @ ${location}] - Navigating to Maps...`);
    log.info(`Navigating query [${keyword} @ ${location}] to URL: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 45000 });

    // Handle Consent Modal
    try {
      const consentBtn = await page.$('button[aria-label="Accept all"], form[action*="consent"] button, button[jsname="b3VHJd"]');
      if (consentBtn) {
        addJobLog(jobId, `Query [${keyword} @ ${location}] - Accepting Google Maps cookie consent...`);
        log.info("Accepting Google Consent dialog...");
        await consentBtn.click();
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (e) {
      // ignore
    }

    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));

    // Wait for selector
    addJobLog(jobId, `Query [${keyword} @ ${location}] - Waiting for search results feed...`);
    let hasFeed = false;
    try {
      await page.waitForSelector('div[role="feed"]', { timeout: 10000 });
      hasFeed = true;
    } catch (e) {
      // Check if place links exist anyway
      const linkCount = await page.evaluate(() => document.querySelectorAll('a[href*="/maps/place/"]').length);
      if (linkCount > 0) hasFeed = true;
    }

    if (!hasFeed) {
      addJobLog(jobId, `Query [${keyword} @ ${location}] - No results found.`);
      log.warn(`No results container found for [${keyword} @ ${location}]`);
      return [];
    }

    addJobLog(jobId, `Query [${keyword} @ ${location}] - Scrolling feed (Target: ${maxResults})...`);
    await scrollFeed(page, maxResults);
    
    addJobLog(jobId, `Query [${keyword} @ ${location}] - Extracting business details...`);
    const results = await scrapeListings(page, keyword, location, maxResults);

    // Deduplicate internally
    const unique = results.filter(
      (biz, idx, self) => idx === self.findIndex((b) => b.storeName === biz.storeName)
    );

    addJobLog(jobId, `Query [${keyword} @ ${location}] - Completed. Extracted ${unique.length} leads.`);
    log.info(`Query [${keyword} @ ${location}] completed: found ${unique.length} records.`);
    return unique;
  } finally {
    await page.close().catch(() => {});
  }
};

// ─── Job Execution Queue ─────────────────────────────────────────────────────
const activeJobs = new Map(); // jobId -> abortController

const executeJob = async (jobId, { isResume = false } = {}) => {
  const abortController = new AbortController();
  activeJobs.set(jobId, abortController);

  const jobs = readJobs();
  const job = jobs.find((j) => j.id === jobId);
  if (!job) {
    activeJobs.delete(jobId);
    return;
  }

  job.status = "Running";
  if (!isResume) {
    job.startedAt = new Date().toISOString();
    job.logs = [];
  } else {
    job.resumedAt = new Date().toISOString();
  }
  writeJobs(jobs);

  if (isResume) {
    addJobLog(jobId, `Job "${job.name}" RESUMED — re-running incomplete queries in ${job.executionMode} mode.`);
  } else {
    addJobLog(jobId, `Job "${job.name}" started in ${job.executionMode} execution mode.`);
  }

  const results = isResume ? readResults(jobId) : [];
  const MAX_RETRIES = 2;

  const runQueryWithRetry = async (queryObj) => {
    let retries = 0;
    while (retries <= MAX_RETRIES) {
      if (abortController.signal.aborted) {
        throw new Error("Job Cancelled");
      }

      // Reload jobs array to get latest status if modified externally
      const currentJobs = readJobs();
      const currentJob = currentJobs.find((j) => j.id === jobId);
      if (currentJob && (currentJob.status === "Cancelled" || currentJob.status === "Paused")) {
        throw new Error("Job Cancelled");
      }

      const currentQuery = currentJob?.queries.find(q => q.id === queryObj.id);

      try {
        log.info(`Executing Query [${queryObj.keyword} in ${queryObj.location}] - Attempt ${retries + 1}`);
        addJobLog(jobId, `Starting query [${queryObj.keyword} @ ${queryObj.location}] (Attempt ${retries + 1})...`);
        
        // Update query status to Running
        if (currentQuery) currentQuery.status = "Running";
        writeJobs(currentJobs);

        let queryResults = await runSingleScrapeQuery(jobId, queryObj.keyword, queryObj.location, queryObj.maxResults);
        
        if (currentJob?.extractCompanyDetails && queryResults.length > 0) {
          addJobLog(jobId, `Query [${queryObj.keyword} @ ${queryObj.location}] - Starting website details extraction (emails, social links)...`);
          
          const candidates = queryResults.filter(b => 
            b.bizWebsite && 
            b.bizWebsite.trim() !== '' && 
            b.bizWebsite.startsWith('http')
          );
          
          if (candidates.length > 0) {
            try {
              const detailedInfo = await extractMultipleCompanyDetails(candidates, 3);
              
              const detailsMap = new Map();
              detailedInfo.forEach(info => {
                if (info.website) detailsMap.set(info.website, info);
                if (info.companyName) detailsMap.set(info.companyName, info);
              });
              
              queryResults = queryResults.map(biz => {
                let enhancement = detailsMap.get(biz.bizWebsite);
                if (!enhancement) enhancement = detailsMap.get(biz.storeName);
                
                if (enhancement && enhancement.success) {
                  return {
                    ...biz,
                    companyDetails: enhancement
                  };
                }
                return biz;
              });
              addJobLog(jobId, `Query [${queryObj.keyword} @ ${queryObj.location}] - Website details enriched for ${detailedInfo.filter(d => d.success).length} listings.`);
            } catch (err) {
              log.error(`Enrichment failed: ${err.message}`);
              addJobLog(jobId, `Query [${queryObj.keyword} @ ${queryObj.location}] - Website details enrichment warning: ${err.message}`);
            }
          } else {
            addJobLog(jobId, `Query [${queryObj.keyword} @ ${queryObj.location}] - No candidate websites for details extraction.`);
          }
        }

        const saveJobs = readJobs();
        const saveJob = saveJobs.find((j) => j.id === jobId);
        const saveQuery = saveJob?.queries.find(q => q.id === queryObj.id);
        if (saveQuery) {
          saveQuery.status = "Completed";
          saveQuery.resultCount = queryResults.length;
          saveQuery.completedAt = new Date().toISOString();
        }
        
        results.push(...queryResults);
        writeResults(jobId, results);
        writeJobs(saveJobs);

        addJobLog(jobId, `Query [${queryObj.keyword} @ ${queryObj.location}] completed with ${queryResults.length} leads.`);

        queryObj.status = "Completed";
        queryObj.resultCount = queryResults.length;
        return;
      } catch (err) {
        log.error(`Query failed [${queryObj.keyword} in ${queryObj.location}]: ${err.message}`);
        addJobLog(jobId, `Query failed [${queryObj.keyword} @ ${queryObj.location}]: ${err.message}`);
        retries++;
        if (retries > MAX_RETRIES) {
          const failJobs = readJobs();
          const failJob = failJobs.find((j) => j.id === jobId);
          const failQuery = failJob?.queries.find(q => q.id === queryObj.id);
          if (failQuery) {
            failQuery.status = "Failed";
            failQuery.error = err.message;
          }
          writeJobs(failJobs);

          queryObj.status = "Failed";
          queryObj.error = err.message;
        } else {
          // Back-off delay before retry
          await new Promise((r) => setTimeout(r, 3000 * retries));
        }
      }
    }
  };

  try {
    const queries = isResume
      ? job.queries.filter(q => q.status !== "Completed")
      : job.queries;

    if (isResume && queries.length === 0) {
      addJobLog(jobId, "All queries already completed — nothing to resume.");
      const earlyJobs = readJobs();
      const earlyJob = earlyJobs.find((j) => j.id === jobId);
      if (earlyJob) {
        earlyJob.status = "Completed";
        earlyJob.completedAt = new Date().toISOString();
        writeJobs(earlyJobs);
      }
      activeJobs.delete(jobId);
      return;
    }

    if (job.executionMode === "parallel") {
      const concurrencyLimit = Math.min(Math.max(parseInt(job.concurrency, 10) || 2, 1), 5);
      addJobLog(jobId, `Launching parallel workers with concurrency limit of ${concurrencyLimit} active tabs...`);
      
      const queue = [...queries];
      const workers = Array(concurrencyLimit).fill(null).map(async () => {
        while (queue.length > 0) {
          if (abortController.signal.aborted) break;
          const queryObj = queue.shift();
          if (!queryObj) break;
          await runQueryWithRetry(queryObj);
        }
      });

      await Promise.all(workers);
    } else {
      addJobLog(jobId, "Starting sequential worker processing queries one-by-one...");
      for (const queryObj of queries) {
        if (abortController.signal.aborted) break;
        await runQueryWithRetry(queryObj);
      }
    }

    // Refresh jobs references
    const currentJobs = readJobs();
    const finalJob = currentJobs.find((j) => j.id === jobId);
    if (finalJob) {
      if (abortController.signal.aborted || finalJob.status === "Cancelled" || finalJob.status === "Paused") {
        if (finalJob.status !== "Paused") {
          finalJob.status = "Cancelled";
        }
        const statusLabel = finalJob.status === "Paused" ? "paused" : "cancelled";
        addJobLog(jobId, `Scraping task was ${statusLabel} by user.`);
        log.info(`Job ${jobId} was ${statusLabel}.`);
      } else {
        const hasFailed = finalJob.queries.every((q) => q.status === "Failed");
        finalJob.status = hasFailed ? "Failed" : "Completed";
        addJobLog(jobId, `Scraping task finished with overall status: ${finalJob.status}.`);
        log.info(`Job ${jobId} finished with status: ${finalJob.status}`);
      }
      finalJob.completedAt = new Date().toISOString();
      writeJobs(currentJobs);
    }
  } catch (error) {
    log.error(`Critical error executing job ${jobId}: ${error.message}`);
    const currentJobs = readJobs();
    const finalJob = currentJobs.find((j) => j.id === jobId);
    if (finalJob) {
      if (finalJob.status === "Paused") {
        addJobLog(jobId, "Scraping task paused by user.");
      } else {
        finalJob.status = error.message === "Job Cancelled" ? "Cancelled" : "Failed";
        finalJob.error = error.message;
        addJobLog(jobId, `Scraping task critical failure: ${error.message}`);
      }
      finalJob.completedAt = new Date().toISOString();
      writeJobs(currentJobs);
    }
  } finally {
    activeJobs.delete(jobId);
  }
};

// ─── API Routes ──────────────────────────────────────────────────────────────

router.post("/jobs", async (req, res) => {
  try {
    const { name, queries, executionMode = "sequential", concurrency = 2, extractCompanyDetails = false } = req.body;

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({ status: 400, message: "A list of queries is required." });
    }

    // Parse and sanitize queries
    const sanitizedQueries = queries.map((q, idx) => {
      if (!q.keyword || !q.location) {
        throw new Error(`Query index ${idx} is missing keyword or location.`);
      }
      return {
        id: `q_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
        keyword: String(q.keyword).trim().slice(0, 100),
        location: String(q.location).trim().slice(0, 100),
        maxResults: Math.min(Math.max(parseInt(q.maxResults, 10) || 20, 5), 200),
        status: "Pending",
        resultCount: 0,
        error: null,
      };
    });

    const newJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: (name || `Job ${new Date().toLocaleDateString()}`).trim().slice(0, 100),
      status: "Pending",
      executionMode: ["sequential", "parallel"].includes(executionMode) ? executionMode : "sequential",
      concurrency: Math.min(Math.max(parseInt(concurrency, 10) || 2, 1), 5),
      extractCompanyDetails: !!extractCompanyDetails,
      queries: sanitizedQueries,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      error: null,
    };

    const jobs = readJobs();
    jobs.unshift(newJob);
    writeJobs(jobs);

    // Run job in background
    executeJob(newJob.id);

    return res.status(201).json({
      status: 201,
      message: "Scraping job started successfully.",
      data: newJob,
    });
  } catch (error) {
    log.error("Failed to create scraping job:", error.message);
    return res.status(400).json({ status: 400, message: error.message });
  }
});

// 2. List all jobs
router.get("/jobs", (req, res) => {
  const jobs = readJobs();
  return res.json({ status: 200, data: jobs });
});

// 3. Get status of a job
router.get("/jobs/:jobId", (req, res) => {
  const { jobId } = req.params;
  const jobs = readJobs();
  const job = jobs.find((j) => j.id === jobId);
  if (!job) {
    return res.status(404).json({ status: 404, message: "Job not found." });
  }
  return res.json({ status: 200, data: job });
});

// 4. Get combined results of a job
router.get("/jobs/:jobId/results", (req, res) => {
  const { jobId } = req.params;
  const jobs = readJobs();
  const job = jobs.find((j) => j.id === jobId);
  if (!job) {
    return res.status(404).json({ status: 404, message: "Job not found." });
  }

  const results = readResults(jobId);
  return res.json({
    status: 200,
    metadata: {
      jobId: job.id,
      name: job.name,
      status: job.status,
      totalQueries: job.queries.length,
      totalResults: results.length,
    },
    data: results,
  });
});

// 5. Cancel / Delete a job
router.delete("/jobs/:jobId", (req, res) => {
  const { jobId } = req.params;
  const jobs = readJobs();
  const jobIndex = jobs.findIndex((j) => j.id === jobId);
  if (jobIndex === -1) {
    return res.status(404).json({ status: 404, message: "Job not found." });
  }

  const job = jobs[jobIndex];
  
  // Abort running execution if any
  const controller = activeJobs.get(jobId);
  if (controller) {
    controller.abort();
    activeJobs.delete(jobId);
  }

  // Update status to Cancelled
  if (["Pending", "Running", "Paused"].includes(job.status)) {
    job.status = "Cancelled";
    job.completedAt = new Date().toISOString();
    job.queries.forEach((q) => {
      if (["Pending", "Running", "Paused"].includes(q.status)) {
        q.status = "Cancelled";
      }
    });
    writeJobs(jobs);
    return res.json({ status: 200, message: "Job cancellation requested.", data: job });
  }

  // If already finished/cancelled, delete job and its result files
  jobs.splice(jobIndex, 1);
  writeJobs(jobs);

  const resultsPath = getResultsFilePath(jobId);
  if (fs.existsSync(resultsPath)) {
    try {
      fs.unlinkSync(resultsPath);
    } catch (e) {
      log.error(`Failed to delete results file: ${e.message}`);
    }
  }

  return res.json({ status: 200, message: "Job deleted successfully." });
});

// 6. Pause a running job
router.post("/jobs/:jobId/pause", async (req, res) => {
  try {
    const { jobId } = req.params;
    const jobs = readJobs();
    const job = jobs.find((j) => j.id === jobId);

    if (!job) {
      return res.status(404).json({ status: 404, message: "Job not found." });
    }

    if (job.status !== "Running") {
      return res.status(400).json({
        status: 400,
        message: `Cannot pause job with status "${job.status}". Only Running jobs can be paused.`,
      });
    }

    // Abort the running execution gracefully
    const controller = activeJobs.get(jobId);
    if (controller) {
      controller.abort();
      activeJobs.delete(jobId);
    }

    // Update job status to Paused
    job.status = "Paused";
    job.pausedAt = new Date().toISOString();
    job.queries.forEach((q) => {
      if (q.status === "Running") {
        q.status = "Paused";
      }
    });
    writeJobs(jobs);

    addJobLog(jobId, "Job paused by user.");

    const completedCount = job.queries.filter((q) => q.status === "Completed").length;
    const remainingCount = job.queries.length - completedCount;

    return res.json({
      status: 200,
      message: `Job paused successfully. ${completedCount} queries completed, ${remainingCount} remaining. Use POST /jobs/${jobId}/resume to continue.`,
      data: job,
    });
  } catch (error) {
    log.error("Failed to pause job:", error.message);
    return res.status(500).json({ status: 500, message: error.message });
  }
});

// 7. Resume a failed/cancelled/paused job
router.post("/jobs/:jobId/resume", async (req, res) => {
  try {
    const { jobId } = req.params;
    const jobs = readJobs();
    const job = jobs.find((j) => j.id === jobId);

    if (!job) {
      return res.status(404).json({ status: 404, message: "Job not found." });
    }

    // Only allow resuming jobs that are not currently active
    const resumableStatuses = ["Failed", "Cancelled", "Paused"];
    if (!resumableStatuses.includes(job.status)) {
      return res.status(400).json({
        status: 400,
        message: `Cannot resume job with status "${job.status}". Only Failed, Cancelled, or Paused jobs can be resumed.`,
      });
    }

    // Prevent double-start
    if (activeJobs.has(jobId)) {
      return res.status(409).json({
        status: 409,
        message: "Job is already running.",
      });
    }

    // Reset non-completed query statuses back to Pending
    const pendingQueries = [];
    job.queries.forEach((q) => {
      if (q.status !== "Completed") {
        q.status = "Pending";
        q.error = null;
        pendingQueries.push(q);
      }
    });

    if (pendingQueries.length === 0) {
      job.status = "Completed";
      job.completedAt = new Date().toISOString();
      writeJobs(jobs);
      return res.json({
        status: 200,
        message: "All queries already completed. Job marked as Completed.",
        data: job,
      });
    }

    // Clear previous error and update status
    job.error = null;
    writeJobs(jobs);

    // Run job in background with resume flag
    executeJob(job.id, { isResume: true });

    return res.json({
      status: 200,
      message: `Job resumed. ${pendingQueries.length} of ${job.queries.length} queries will be re-processed.`,
      data: {
        ...job,
        pendingQueryCount: pendingQueries.length,
        completedQueryCount: job.queries.length - pendingQueries.length,
      },
    });
  } catch (error) {
    log.error("Failed to resume job:", error.message);
    return res.status(500).json({ status: 500, message: error.message });
  }
});

module.exports = { advancedGoogleRouter: router };
