const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { randomUUID } = require("crypto");

puppeteerExtra.use(StealthPlugin());

// ─── Logger ──────────────────────────────────────────────────────────────────
const log = {
  info:  (...a) => console.log(`[${new Date().toISOString()}] [INFO] `, ...a),
  warn:  (...a) => console.warn(`[${new Date().toISOString()}] [WARN] `, ...a),
  error: (...a) => console.error(`[${new Date().toISOString()}] [ERROR]`, ...a),
};

// ─── Browser singleton ────────────────────────────────────────────────────────
let browserInstance = null;
let browserLock = false;

const getBrowserInstance = async () => {
  // Simple mutex to avoid race-condition double-launch
  while (browserLock) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (browserInstance) return browserInstance;

  browserLock = true;
  try {
    log.info("Launching browser for radius search...");
    browserInstance = await puppeteerExtra.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1920,1080",
      ],
      // Cross-platform: prefer env var, fall back to puppeteer's own bundled binary
      executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined,
      timeout: 60000,
    });

    browserInstance.on("disconnected", () => {
      log.warn("Browser disconnected — will relaunch on next request");
      browserInstance = null;
    });
  } finally {
    browserLock = false;
  }
  return browserInstance;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve a human-readable location label from coordinates.
 * Uses the Geocoding API when a key is available; otherwise falls back
 * to a coordinate string (no extra page navigation needed).
 */
const getLocationName = async (latitude, longitude) => {
  if (process.env.GOOGLE_MAPS_API_KEY) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.status === "OK" && json.results?.[0]) {
        return json.results[0].formatted_address;
      }
    } catch (err) {
      log.warn("Geocoding API failed:", err.message);
    }
  }
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
};

/** Haversine great-circle distance — returns metres */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** Validate coordinate ranges */
const isValidCoord = (lat, lng) =>
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

/**
 * Extract coordinates from a Google Maps business URL or page.
 * Uses a dedicated page so the caller's page state is never polluted.
 */
const extractCoordinates = async (browser, businessUrl) => {
  // Strategy 1 & 2: parse from URL string — no navigation needed
  const patterns = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];
  for (const re of patterns) {
    const m = businessUrl.match(re);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (isValidCoord(lat, lng)) return { latitude: lat, longitude: lng };
    }
  }

  // Strategy 3 & 4: navigate with a fresh page
  const page = await browser.newPage();
  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.goto(businessUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1000));

    // Check final URL after redirects
    const finalUrl = page.url();
    for (const re of patterns) {
      const m = finalUrl.match(re);
      if (m) {
        const lat = parseFloat(m[1]);
        const lng = parseFloat(m[2]);
        if (isValidCoord(lat, lng)) return { latitude: lat, longitude: lng };
      }
    }

    // Strategy 4: page content
    return await page.evaluate(() => {
      const validate = (lat, lng) =>
        !isNaN(lat) && !isNaN(lng) &&
        lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

      // Script data patterns
      for (const script of document.querySelectorAll("script")) {
        const t = script.textContent;
        const m1 = t.match(/null,\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
        if (m1) {
          const lat = parseFloat(m1[1]), lng = parseFloat(m1[2]);
          if (validate(lat, lng)) return { latitude: lat, longitude: lng };
        }
        const m2 = t.match(/\[(-?\d+\.\d{4,}),(-?\d+\.\d{4,})\]/);
        if (m2) {
          const lat = parseFloat(m2[1]), lng = parseFloat(m2[2]);
          if (validate(lat, lng)) return { latitude: lat, longitude: lng };
        }
      }
      // Meta tags
      const latMeta = document.querySelector('meta[itemprop="latitude"]');
      const lngMeta = document.querySelector('meta[itemprop="longitude"]');
      if (latMeta && lngMeta) {
        const lat = parseFloat(latMeta.content);
        const lng = parseFloat(lngMeta.content);
        if (validate(lat, lng)) return { latitude: lat, longitude: lng };
      }
      // Data attributes
      const el = document.querySelector("[data-latitude][data-longitude]");
      if (el) {
        const lat = parseFloat(el.dataset.latitude);
        const lng = parseFloat(el.dataset.longitude);
        if (validate(lat, lng)) return { latitude: lat, longitude: lng };
      }
      return null;
    });
  } catch (err) {
    log.warn(`extractCoordinates failed for ${businessUrl}: ${err.message}`);
    return null;
  } finally {
    await page.close().catch(() => {});
  }
};

/**
 * Extract business details from a Google Maps place page.
 * Uses a dedicated page.
 */
const extractBusinessDetails = async (browser, businessUrl) => {
  const page = await browser.newPage();
  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.goto(businessUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1500));

    return await page.evaluate(() => {
      const text = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null;
      const attr = (sel, a) => document.querySelector(sel)?.getAttribute(a) ?? null;
      return {
        phone:
          text('button[data-item-id*="phone"]') ||
          text('a[href^="tel:"]') ||
          attr('a[href^="tel:"]', "href")?.replace("tel:", ""),
        website:
          document.querySelector('a[data-item-id="authority"]')?.href ||
          document.querySelector('a[data-item-id*="website"]')?.href ||
          null,
        address:
          text('button[data-item-id="address"]') ||
          text('[data-item-id="address"]'),
        rating:
          text('span[role="img"][aria-label*="stars"]') ||
          text("div.fontDisplayLarge"),
        reviews:
          text('span[aria-label*="reviews"]') ||
          text('button[aria-label*="reviews"]'),
        category:
          text('button[jsaction*="category"]') ||
          text("button.DkEaL"),
      };
    });
  } catch (err) {
    log.warn(`extractBusinessDetails failed: ${err.message}`);
    return {};
  } finally {
    await page.close().catch(() => {});
  }
};

// ─── Input sanitisation ───────────────────────────────────────────────────────
const sanitizeKeyword = (kw) =>
  String(kw).replace(/[<>"'`;]/g, "").trim().slice(0, 200);

// ─── Main handler ─────────────────────────────────────────────────────────────
const searchByRadius = async (req, res) => {
  const startTime = Date.now();

  // ── Validation ──
  const {
    keyword: rawKeyword,
    latitude,
    longitude,
    radius = 5000,
    maxResults = 50,
  } = req.body;

  if (!rawKeyword || latitude === undefined || longitude === undefined) {
    return res.status(400).json({
      status: 400,
      message: "keyword, latitude, and longitude are required",
    });
  }

  const keyword = sanitizeKeyword(rawKeyword);
  if (!keyword) {
    return res.status(400).json({ status: 400, message: "Invalid keyword" });
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  const rad = Math.min(Math.max(parseInt(radius, 10) || 5000, 100), 100000);
  const maxRes = Math.min(Math.max(parseInt(maxResults, 10) || 50, 1), 100);

  if (!isValidCoord(lat, lng)) {
    return res.status(400).json({
      status: 400,
      message: "Invalid coordinates. Latitude −90…90, longitude −180…180",
    });
  }

  log.info(`Radius Search — keyword="${keyword}" center=${lat},${lng} radius=${rad}m max=${maxRes}`);

  let searchPage = null;

  try {
    const browser = await getBrowserInstance();

    // Resolve location label (no page needed when API key present)
    const locationName = await getLocationName(lat, lng);
    log.info(`Location resolved: ${locationName}`);

    // ── Open search page ──
    searchPage = await browser.newPage();
    await searchPage.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await searchPage.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    });

    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(keyword)}/@${lat},${lng},14z`;
    log.info(`Navigating to: ${searchUrl}`);
    await searchPage.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 3000));

    // ── Scroll feed ──
    const feedSelector = 'div[role="feed"]';
    const maxScrolls = Math.min(Math.ceil(maxRes / 7), 15); // ~7 results/scroll, cap 15
    try {
      await searchPage.waitForSelector(feedSelector, { timeout: 10000 });
      log.info(`Scrolling feed (up to ${maxScrolls} scrolls)...`);
      let staleCount = 0;
      for (let i = 0; i < maxScrolls; i++) {
        const before = await searchPage.evaluate(
          (s) => document.querySelector(s)?.scrollHeight ?? 0,
          feedSelector
        );
        await searchPage.evaluate(
          (s) => { const f = document.querySelector(s); if (f) f.scrollTop = f.scrollHeight; },
          feedSelector
        );
        await new Promise((r) => setTimeout(r, 2000));
        const after = await searchPage.evaluate(
          (s) => document.querySelector(s)?.scrollHeight ?? 0,
          feedSelector
        );
        if (after === before) { if (++staleCount >= 2) break; } else staleCount = 0;
      }
    } catch {
      log.warn("Feed selector not found — proceeding with available DOM");
    }

    // ── Extract feed items ──
    const feedItems = await searchPage.evaluate(() => {
      const out = [];
      document.querySelectorAll('div[role="feed"] a[href*="/maps/place/"]').forEach((a) => {
        const href = a.getAttribute("href");
        if (!href) return;
        const cm = href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        const coords = cm
          ? { latitude: parseFloat(cm[1]), longitude: parseFloat(cm[2]) }
          : null;
        const name =
          a.getAttribute("aria-label") ||
          (() => {
            const p = a.closest('div[role="article"]') || a.closest("div");
            return p?.querySelector('[class*="fontHeadline"],[class*="fontBody"]')?.textContent?.trim();
          })() ||
          (() => {
            const m = href.match(/\/maps\/place\/([^/]+)/);
            return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
          })();
        if (name && href) {
          out.push({
            name,
            url: href.startsWith("http") ? href : `https://www.google.com${href}`,
            coords,
          });
        }
      });
      return out;
    });

    log.info(`Feed extracted ${feedItems.length} items`);
    await searchPage.close().catch(() => {});
    searchPage = null;

    // ── Process businesses with concurrency ──
    const CONCURRENCY = 3;
    const businesses = [];
    const seenNames = new Set();
    let processedCount = 0;

    // Deduplicate feed first
    const uniqueItems = feedItems.filter(({ name }) => {
      if (seenNames.has(name)) return false;
      seenNames.add(name);
      return true;
    });

    // Process in batches of CONCURRENCY
    for (let i = 0; i < uniqueItems.length && businesses.length < maxRes; i += CONCURRENCY) {
      const batch = uniqueItems.slice(i, i + CONCURRENCY);

      const batchResults = await Promise.allSettled(
        batch.map(async (item) => {
          // Coordinate resolution
          let coords = item.coords;
          if (!coords || !isValidCoord(coords.latitude, coords.longitude)) {
            coords = await extractCoordinates(browser, item.url);
          }
          if (!coords || !isValidCoord(coords.latitude, coords.longitude)) {
            log.warn(`No valid coords: ${item.name}`);
            return null;
          }

          const distance = calculateDistance(lat, lng, coords.latitude, coords.longitude);
          processedCount++;

          if (distance > rad) {
            log.info(`✗ ${item.name} — ${(distance / 1000).toFixed(2)}km (outside radius)`);
            return null;
          }

          // Detail extraction
          const details = await extractBusinessDetails(browser, item.url);

          log.info(`✓ ${item.name} — ${(distance / 1000).toFixed(2)}km`);
          return {
            userId: "anonymous",
            businessId: randomUUID(),
            storeName: item.name,
            category: details.category || "N/A",
            address: details.address || "N/A",
            phone: details.phone || "N/A",
            googleUrl: item.url,
            bizWebsite: details.website || "N/A",
            stars: details.rating || "N/A",
            numberOfReviews: details.reviews || "N/A",
            latitude: coords.latitude,
            longitude: coords.longitude,
            distanceFromCenter: Math.round(distance),
            distanceKm: (distance / 1000).toFixed(2),
            searchKeyword: keyword,
            searchLocation: locationName,
            searchCenter: { latitude: lat, longitude: lng },
            searchRadius: rad,
            scrapedAt: new Date().toISOString(),
            source: "GoogleMaps-Radius",
          };
        })
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled" && result.value) {
          businesses.push(result.value);
          if (businesses.length >= maxRes) break;
        }
      }

      // Small inter-batch delay to be polite
      if (i + CONCURRENCY < uniqueItems.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
    log.info(`Radius Search complete — ${businesses.length} results in ${executionTime}s`);

    return res.status(200).json({
      status: 200,
      message: "Radius search completed successfully",
      data: businesses,
      metadata: {
        totalResults: businesses.length,
        totalProcessed: processedCount,
        executionTimeSeconds: parseFloat(executionTime),
        searchKeyword: keyword,
        searchLocation: locationName,
        searchCenter: { latitude: lat, longitude: lng },
        searchRadius: rad,
        radiusKm: (rad / 1000).toFixed(1),
        maxResultsRequested: maxRes,
        source: "GoogleMaps-Radius",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    log.error("Radius Search failed:", error.message, error.stack);
    if (searchPage) await searchPage.close().catch(() => {});
    return res.status(500).json({
      status: 500,
      message: "Service temporarily unavailable",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
};

module.exports = { searchByRadius };
