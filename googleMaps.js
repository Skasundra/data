const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

// Add stealth plugin to evade detection
puppeteerExtra.use(StealthPlugin());

// ─── Logger ──────────────────────────────────────────────────────────────────
const log = {
  info: (...a) => console.log(`[${new Date().toISOString()}] [GMAPS] [INFO] `, ...a),
  warn: (...a) => console.warn(`[${new Date().toISOString()}] [GMAPS] [WARN] `, ...a),
  error: (...a) => console.error(`[${new Date().toISOString()}] [GMAPS] [ERROR]`, ...a),
};

// ─── Browser singleton ───────────────────────────────────────────────────────
let browserInstance = null;
let browserLock = false;

const getBrowserInstance = async () => {
  while (browserLock) await new Promise((r) => setTimeout(r, 100));
  if (browserInstance) return browserInstance;

  browserLock = true;
  try {
    log.info("Launching browser...");
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
      timeout: 30000,
      ignoreHTTPSErrors: true,
    });

    browserInstance.on("disconnected", () => {
      log.warn("Browser disconnected, resetting instance");
      browserInstance = null;
    });
  } finally {
    browserLock = false;
  }
  return browserInstance;
};

// ─── Data Persistence (IDBF-style) ──────────────────────────────────────────
const GMAPS_DATA_FILE_PATH = path.join(__dirname, "googlemaps_scraped_data.json");

const readGmapsStoredData = () => {
  try {
    if (!fs.existsSync(GMAPS_DATA_FILE_PATH)) return {};
    const data = fs.readFileSync(GMAPS_DATA_FILE_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    log.warn(`Could not read data file (starting fresh): ${error.message}`);
    return {};
  }
};

const writeGmapsStoredData = (data) => {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    JSON.parse(jsonString); // integrity check
    fs.writeFileSync(GMAPS_DATA_FILE_PATH, jsonString, "utf8");
    log.info(`Data written to ${GMAPS_DATA_FILE_PATH}`);
    return true;
  } catch (error) {
    log.error(`Failed to write data: ${error.message}`);
    return false;
  }
};

const gmapsBusinessExists = (list, storeName, phone) => {
  return list.some(
    (b) => (phone && phone !== "" && b.phone === phone) || b.storeName === storeName
  );
};

// ─── Main Search Handler ─────────────────────────────────────────────────────
const searchGoogleMaps = async (req, res) => {
  let page = null;
  const startTime = Date.now();

  try {
    log.info("Request received:", JSON.stringify(req.body));
    const {
      keyword,
      place,
      maxResults = 20,
      storeData = false,
    } = req.body;
    const userId = req.user?.id || "anonymous";

    // Input validation
    if (!keyword || !place) {
      return res.status(400).json({
        status: 400,
        message: "Both 'keyword' and 'place' are required parameters.",
      });
    }

    if (keyword.length > 100 || place.length > 100) {
      return res.status(400).json({
        status: 400,
        message: "Keyword and place must be less than 100 characters each.",
      });
    }

    const browser = await getBrowserInstance();
    page = await browser.newPage();

    // Set user agent and viewport
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });

    // Block only truly heavy resources (keep stylesheets — Google Maps needs them)
    await page.setRequestInterception(true);
    page.on("request", (interceptedReq) => {
      const type = interceptedReq.resourceType();
      const url = interceptedReq.url();
      // Block images and fonts but keep CSS and JS (Maps needs them to render)
      if (type === "image" || type === "font" || type === "media") {
        interceptedReq.abort();
      } else if (type === "script" && url.includes("adservice")) {
        interceptedReq.abort();
      } else {
        interceptedReq.continue();
      }
    });

    // Navigate
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(keyword)}+in+${encodeURIComponent(place)}`;
    log.info(`Navigating to: ${searchUrl}`);

    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });

    // Handle Google consent/cookie dialog if it appears
    try {
      const consentBtn = await page.$('button[aria-label="Accept all"], form[action*="consent"] button, button[jsname="b3VHJd"]');
      if (consentBtn) {
        log.info("Consent dialog detected, accepting...");
        await consentBtn.click();
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch {
      // No consent dialog, continue
    }

    // Wait for page to fully render
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});

    // Wait for the results feed to appear
    log.info("Waiting for results feed...");
    try {
      await page.waitForSelector('div[role="feed"]', { timeout: 15000 });
    } catch {
      // Fallback: check if there are place links at all
      log.warn("Feed selector not found, trying fallback selectors...");

      // Try waiting a bit more — Google Maps is JS-heavy
      await new Promise((r) => setTimeout(r, 3000));

      // Check for various indicators
      const pageState = await page.evaluate(() => {
        return {
          hasFeed: !!document.querySelector('div[role="feed"]'),
          hasPlaceLinks: document.querySelectorAll('a[href*="/maps/place/"]').length,
          hasResults: !!document.querySelector('.fontHeadlineSmall'),
          title: document.title,
          url: window.location.href,
          bodySnippet: document.body?.innerText?.substring(0, 500) || "",
        };
      });

      log.info("Page state:", JSON.stringify(pageState));

      if (pageState.hasFeed || pageState.hasPlaceLinks > 0 || pageState.hasResults) {
        log.info("Found results via fallback detection, continuing...");
      } else {
        // Save debug HTML
        const debugHtml = await page.content();
        fs.writeFileSync(path.join(__dirname, "debug_gmaps_page.html"), debugHtml, "utf8");
        log.warn("No results found. Debug HTML saved to debug_gmaps_page.html");

        return res.status(404).json({
          status: 404,
          message: "No results found for the given search criteria.",
          data: [],
          debug: process.env.NODE_ENV === "development" ? {
            title: pageState.title,
            url: pageState.url,
            hint: "Check debug_gmaps_page.html for the actual page content"
          } : undefined,
        });
      }
    }

    // Small stabilization wait
    await new Promise((r) => setTimeout(r, 2000));

    // ── Scroll to load results ──
    log.info(`Scrolling to load ~${maxResults} results...`);
    const scrolledCount = await page.evaluate(async (targetCount) => {
      const feed = document.querySelector('div[role="feed"]');
      if (!feed) return 0;

      let lastCount = 0;
      let staleRounds = 0;
      // Google Maps shows ~7-8 results per scroll batch
      const maxScrolls = Math.min(Math.ceil(targetCount / 6) + 10, 60);

      for (let i = 0; i < maxScrolls; i++) {
        feed.scrollTop = feed.scrollHeight;

        // Wait longer to give Google Maps time to fetch the next batch
        await new Promise((r) => setTimeout(r, 1200 + Math.random() * 600));

        const currentCount = feed.querySelectorAll('a[href*="/maps/place/"]').length;

        if (currentCount >= targetCount) break;

        // Check for "end of results" indicator
        const endOfList = feed.querySelector('span.fontBodyMedium span');
        if (endOfList && endOfList.textContent?.includes("You've reached the end")) break;

        // Also check for the "no more results" bottom text
        const noMore = document.querySelector('p[jstcache] span, div.fontBodyMedium > span > span');
        const feedText = feed.innerHTML || "";
        if (feedText.includes("You've reached the end of the list")) break;

        if (currentCount === lastCount) {
          staleRounds++;
          // Wait extra on stale rounds — Google might still be loading
          if (staleRounds <= 3) {
            await new Promise((r) => setTimeout(r, 1500));
          }
          if (staleRounds >= 5) break; // Truly no more results after 5 stale rounds
        } else {
          staleRounds = 0;
          lastCount = currentCount;
        }
      }

      return feed.querySelectorAll('a[href*="/maps/place/"]').length;
    }, maxResults);

    log.info(`Scroll complete. Found ${scrolledCount} place links in feed.`);

    // ── Extract data from page ──
    log.info("Extracting business data...");
    const businesses = await page.evaluate((opts) => {
      const { userId, keyword, place, maxResults } = opts;
      const results = [];
      const seen = new Set();

      // Get all place links
      const links = document.querySelectorAll('a[href*="/maps/place/"]');

      for (const link of links) {
        if (results.length >= maxResults) break;

        const href = link.getAttribute("href") || "";
        if (seen.has(href)) continue;
        seen.add(href);

        // Get the parent container — walk up to find the card
        let container = link.closest('[jsaction*="mouseover"]') ||
          link.closest('div[jsaction]') ||
          link.parentElement?.parentElement?.parentElement;

        if (!container) continue;

        // ── Store Name ──
        const storeName =
          link.getAttribute("aria-label") ||
          container.querySelector(".fontHeadlineSmall")?.textContent?.trim() ||
          container.querySelector("[class*='fontHeadline']")?.textContent?.trim() ||
          "";

        if (!storeName) continue;

        // ── Rating & Reviews ──
        let stars = null;
        let numberOfReviews = null;
        let ratingText = "";

        const ratingEl = container.querySelector('span[role="img"][aria-label*="star"]');
        if (ratingEl) {
          ratingText = ratingEl.getAttribute("aria-label") || "";
          const starsMatch = ratingText.match(/([\d.]+)/);
          if (starsMatch) stars = parseFloat(starsMatch[1]);
        }

        // Reviews count — look for text like "(123)" or "123 reviews"
        const allText = container.textContent || "";
        const reviewMatch = allText.match(/\((\d[\d,]*)\)/);
        if (reviewMatch) {
          numberOfReviews = parseInt(reviewMatch[1].replace(/,/g, ""));
        }

        // ── Category, Address, Status from text nodes ──
        let category = "";
        let address = "";
        let phone = "";
        let hours = "";
        let priceLevel = "";

        // Google Maps uses spans with aria-hidden for separators (·)
        // The card typically has: Category · Address · Status
        const textSpans = container.querySelectorAll(".fontBodyMedium span, .fontBodyMedium");
        const textParts = [];
        textSpans.forEach((sp) => {
          const t = sp.textContent?.trim();
          if (t && t !== "·" && t.length > 1 && t.length < 150 && !t.includes("star")) {
            textParts.push(t);
          }
        });

        // Also try splitting by "·" from a single text block
        const bodyEl = container.querySelector(".fontBodyMedium");
        if (bodyEl) {
          const bodyText = bodyEl.textContent || "";
          const parts = bodyText.split("·").map((p) => p.trim()).filter((p) => p.length > 0);

          parts.forEach((part, idx) => {
            if (idx === 0 && !part.match(/^\d/) && !part.match(/^[\$€£]/)) {
              category = part;
            } else if (part.match(/^\$+$/) || part.match(/^[€£]/)) {
              priceLevel = part;
            } else if (part.match(/open|closed|opens|closes/i)) {
              hours = part;
            } else if (part.match(/[\d\s\-\(\)\+]{10,}/)) {
              phone = part.trim();
            } else if (part.match(/\d/) && !phone) {
              address = part;
            }
          });
        }

        // ── Website ──
        const websiteEl = container.querySelector('a[data-value="Website"]') ||
          container.querySelector('a[aria-label*="Website"]');
        const bizWebsite = websiteEl ? websiteEl.href : "";

        // ── Place ID from URL ──
        let placeId = "";
        const placeIdMatch = href.match(/0x[\da-f]+:0x[\da-f]+/i);
        if (placeIdMatch) placeId = placeIdMatch[0];

        // ── Coordinates from URL ──
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
          userId,
          placeId,
          storeName,
          category,
          address,
          phone,
          googleUrl: href.startsWith("http") ? href : `https://www.google.com${href}`,
          bizWebsite,
          stars,
          numberOfReviews,
          ratingText,
          priceLevel,
          hours,
          latitude,
          longitude,
          searchKeyword: keyword,
          searchLocation: place,
          scrapedAt: new Date().toISOString(),
          source: "GoogleMaps",
        });
      }

      return results;
    }, { userId, keyword, place, maxResults });

    log.info(`Extracted ${businesses.length} businesses`);

    // Deduplicate by storeName
    const uniqueBusinesses = businesses.filter(
      (biz, idx, self) => idx === self.findIndex((b) => b.storeName === biz.storeName)
    );

    log.info(`After dedup: ${uniqueBusinesses.length} unique businesses`);

    // ── Store data if enabled ──
    if (storeData && uniqueBusinesses.length > 0) {
      log.info(`Saving ${uniqueBusinesses.length} businesses to JSON...`);
      try {
        const storedData = readGmapsStoredData();
        let addedCount = 0;

        for (const business of uniqueBusinesses) {
          const locationKey = place || "Unknown Location";
          const keywordKey = keyword || "Unknown Keyword";

          if (!storedData[locationKey]) storedData[locationKey] = {};
          if (!storedData[locationKey][keywordKey]) storedData[locationKey][keywordKey] = [];

          if (!gmapsBusinessExists(storedData[locationKey][keywordKey], business.storeName, business.phone)) {
            storedData[locationKey][keywordKey].push(business);
            addedCount++;
          }
        }

        const success = writeGmapsStoredData(storedData);
        if (success) {
          log.info(`Added ${addedCount} new businesses to storage`);
        }
      } catch (err) {
        log.error(`Failed to save data: ${err.message}`);
      }
    }

    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
    log.info(`Google Maps scraping completed in ${executionTime}s — ${uniqueBusinesses.length} results`);

    return res.status(200).json({
      status: 200,
      message: "Google Maps leads generated successfully.",
      data: uniqueBusinesses,
      metadata: {
        totalResults: uniqueBusinesses.length,
        executionTimeSeconds: parseFloat(executionTime),
        searchKeyword: keyword,
        searchLocation: place,
        source: "GoogleMaps",
        maxResultsRequested: maxResults,
        dataStored: storeData,
      },
    });
  } catch (error) {
    log.error("searchGoogleMaps failed:", error.message);

    if (error.name === "TimeoutError") {
      return res.status(408).json({
        status: 408,
        message: "Request timeout. Try a more specific search term.",
      });
    }

    return res.status(500).json({
      status: 500,
      message: "Service temporarily unavailable. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  } finally {
    if (page) {
      try { await page.close(); } catch {}
    }
  }
};

// ─── Graceful shutdown ───────────────────────────────────────────────────────
process.on("SIGTERM", async () => {
  if (browserInstance) await browserInstance.close().catch(() => {});
});

process.on("SIGINT", async () => {
  if (browserInstance) await browserInstance.close().catch(() => {});
});

module.exports = { searchGoogleMaps };
