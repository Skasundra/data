const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { randomUUID } = require("crypto");

puppeteerExtra.use(StealthPlugin());

// ─── Logger ──────────────────────────────────────────────────────────────────
const log = {
  info:  (...a) => console.log(`[${new Date().toISOString()}] [RADIUS] [INFO] `, ...a),
  warn:  (...a) => console.warn(`[${new Date().toISOString()}] [RADIUS] [WARN] `, ...a),
  error: (...a) => console.error(`[${new Date().toISOString()}] [RADIUS] [ERROR]`, ...a),
};

// ─── Browser singleton ────────────────────────────────────────────────────────
let browserInstance = null;
let browserLock = false;

const getBrowserInstance = async () => {
  while (browserLock) await new Promise((r) => setTimeout(r, 100));
  if (browserInstance) return browserInstance;

  browserLock = true;
  try {
    log.info("Launching browser for radius search...");
    browserInstance = await puppeteerExtra.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1920,1080",
      ],
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

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Open a new page with realistic config + resource blocking for speed */
const newFastPage = async (browser) => {
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    const type = r.resourceType();
    if (type === "image" || type === "font" || type === "media") r.abort();
    else r.continue();
  });
  return page;
};

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

const isValidCoord = (lat, lng) =>
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

/**
 * Pick a Google Maps zoom level that fits the search radius.
 * Smaller radius → higher zoom (more detail). Larger → lower zoom.
 */
const getZoomForRadius = (radiusMeters) => {
  const km = radiusMeters / 1000;
  if (km <= 1) return 16;
  if (km <= 2) return 15;
  if (km <= 5) return 14;
  if (km <= 10) return 13;
  if (km <= 20) return 12;
  if (km <= 40) return 11;
  return 10;
};

/**
 * Generate a grid of search points covering the circle.
 * This is the key to getting MANY more results — Google caps each
 * single search, so we search multiple sub-tiles and merge.
 */
const generateSearchPoints = (lat, lng, radius) => {
  const points = [{ lat, lng }];
  if (radius <= 2500) return points; // small radius — one search is enough

  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);

  // Decide ring radii based on overall radius
  let ringRadii;
  if (radius <= 8000) {
    ringRadii = [radius * 0.65];                 // 1 ring  → 7 points total
  } else if (radius <= 20000) {
    ringRadii = [radius * 0.45, radius * 0.8];   // 2 rings → 13 points total
  } else {
    ringRadii = [radius * 0.33, radius * 0.62, radius * 0.88]; // 3 rings → 19 points
  }

  const perRing = 6;
  for (const r of ringRadii) {
    for (let i = 0; i < perRing; i++) {
      const angle = (2 * Math.PI * i) / perRing + (r / radius); // slight rotation per ring
      const dLat = (r * Math.cos(angle)) / metersPerDegLat;
      const dLng = (r * Math.sin(angle)) / metersPerDegLng;
      points.push({ lat: lat + dLat, lng: lng + dLng });
    }
  }
  return points;
};

/**
 * Scroll the results feed aggressively, counting actual place links.
 */
const scrollFeed = async (page, targetCount) => {
  return page.evaluate(async (target) => {
    const feed = document.querySelector('div[role="feed"]');
    if (!feed) return 0;

    let lastCount = 0;
    let stale = 0;
    const maxScrolls = Math.min(Math.ceil(target / 6) + 12, 40);

    for (let i = 0; i < maxScrolls; i++) {
      feed.scrollTop = feed.scrollHeight;
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 500));

      const count = feed.querySelectorAll('a[href*="/maps/place/"]').length;

      // End-of-list detection
      if (feed.innerHTML.includes("You've reached the end of the list")) break;
      if (count >= target) break;

      if (count === lastCount) {
        stale++;
        if (stale <= 3) await new Promise((r) => setTimeout(r, 1200)); // wait extra
        if (stale >= 5) break;
      } else {
        stale = 0;
        lastCount = count;
      }
    }
    return feed.querySelectorAll('a[href*="/maps/place/"]').length;
  }, targetCount);
};

/**
 * Extract rich business data directly from the feed DOM —
 * no per-business navigation needed for name/rating/reviews/category/address/coords.
 */
const extractFeedItems = async (page) => {
  return page.evaluate(() => {
    const out = [];
    const links = document.querySelectorAll('div[role="feed"] a[href*="/maps/place/"]');

    links.forEach((a) => {
      const href = a.getAttribute("href");
      if (!href) return;

      const container =
        a.closest('[jsaction*="mouseover"]') ||
        a.closest('div[jsaction]') ||
        a.parentElement?.parentElement;
      if (!container) return;

      // Name
      const name =
        a.getAttribute("aria-label") ||
        container.querySelector(".fontHeadlineSmall")?.textContent?.trim() ||
        container.querySelector("[class*='fontHeadline']")?.textContent?.trim() ||
        "";
      if (!name) return;

      // Coordinates from URL
      let coords = null;
      const m1 = href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
      const m2 = href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (m1) coords = { latitude: parseFloat(m1[1]), longitude: parseFloat(m1[2]) };
      else if (m2) coords = { latitude: parseFloat(m2[1]), longitude: parseFloat(m2[2]) };

      // Place ID for dedup
      let placeId = "";
      const pidMatch = href.match(/0x[\da-f]+:0x[\da-f]+/i);
      if (pidMatch) placeId = pidMatch[0];

      // Rating + reviews
      let stars = null;
      let reviews = null;
      const ratingEl = container.querySelector('span[role="img"][aria-label*="star"]');
      if (ratingEl) {
        const t = ratingEl.getAttribute("aria-label") || "";
        const sm = t.match(/([\d.]+)/);
        if (sm) stars = parseFloat(sm[1]);
      }
      const allText = container.textContent || "";
      const rm = allText.match(/\((\d[\d,]*)\)/);
      if (rm) reviews = parseInt(rm[1].replace(/,/g, ""));

      // Category / address from .fontBodyMedium "·"-separated parts
      let category = "";
      let address = "";
      const bodyEl = container.querySelector(".fontBodyMedium");
      if (bodyEl) {
        const parts = bodyEl.textContent.split("·").map((p) => p.trim()).filter(Boolean);
        parts.forEach((part, idx) => {
          if (idx === 0 && !part.match(/^\d/) && !part.match(/^[₹$€£]/)) category = part;
          else if (part.match(/\d/) && !part.match(/open|closed|opens|closes/i) && !address) address = part;
        });
      }

      // Website (rarely present in list)
      const websiteEl = container.querySelector('a[data-value="Website"]');

      out.push({
        name,
        url: href.startsWith("http") ? href : `https://www.google.com${href}`,
        coords,
        placeId,
        stars,
        reviews,
        category,
        address,
        website: websiteEl ? websiteEl.href : "",
      });
    });

    return out;
  });
};

/**
 * Extract phone + website by navigating to the place page (optional detail pass).
 */
const extractBusinessDetails = async (browser, businessUrl) => {
  const page = await newFastPage(browser);
  try {
    await page.goto(businessUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1200));

    return await page.evaluate(() => {
      const text = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null;
      const attr = (sel, a) => document.querySelector(sel)?.getAttribute(a) ?? null;

      let phone =
        text('button[data-item-id^="phone"]') ||
        attr('button[data-item-id^="phone"]', "data-item-id")?.replace(/^phone:tel:/, "") ||
        attr('a[href^="tel:"]', "href")?.replace("tel:", "");
      if (phone) phone = phone.replace(/^phone:tel:/, "").trim();

      return {
        phone: phone || null,
        website:
          document.querySelector('a[data-item-id="authority"]')?.href ||
          document.querySelector('a[data-item-id*="website"]')?.href ||
          null,
        address:
          text('button[data-item-id="address"]') ||
          text('[data-item-id="address"]'),
        category: text('button[jsaction*="category"]') || text("button.DkEaL"),
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
  const TIME_BUDGET_MS = 165000; // stay under the 3-min server timeout

  const {
    keyword: rawKeyword,
    latitude,
    longitude,
    radius = 5000,
    maxResults = 50,
    detailedScrape = true, // navigate each in-radius place for phone/website
  } = req.body;

  if (!rawKeyword || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ status: 400, message: "keyword, latitude, and longitude are required" });
  }

  const keyword = sanitizeKeyword(rawKeyword);
  if (!keyword) return res.status(400).json({ status: 400, message: "Invalid keyword" });

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  const rad = Math.min(Math.max(parseInt(radius, 10) || 5000, 100), 100000);
  const maxRes = Math.min(Math.max(parseInt(maxResults, 10) || 50, 1), 300);

  if (!isValidCoord(lat, lng)) {
    return res.status(400).json({ status: 400, message: "Invalid coordinates." });
  }

  log.info(`Radius Search — keyword="${keyword}" center=${lat},${lng} radius=${rad}m max=${maxRes}`);

  let searchPage = null;

  try {
    const browser = await getBrowserInstance();
    const locationName = await getLocationName(lat, lng);
    log.info(`Location resolved: ${locationName}`);

    const zoom = getZoomForRadius(rad);
    const searchPoints = generateSearchPoints(lat, lng, rad);
    log.info(`Searching ${searchPoints.length} grid point(s) at zoom ${zoom}`);

    // ── Collect feed items from all grid points (merge + dedupe) ──
    const merged = new Map(); // key: placeId || name → item
    let pointIndex = 0;

    for (const point of searchPoints) {
      // Time budget guard — leave room for the detail pass
      if (Date.now() - startTime > TIME_BUDGET_MS * 0.55) {
        log.warn(`Time budget reached during grid search after ${pointIndex} points`);
        break;
      }
      pointIndex++;

      searchPage = await newFastPage(browser);
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(keyword)}/@${point.lat},${point.lng},${zoom}z`;

      try {
        await searchPage.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await searchPage.waitForSelector('div[role="feed"]', { timeout: 10000 }).catch(() => {});
        await new Promise((r) => setTimeout(r, 1500));

        // Scroll — for grid mode each tile needs fewer results
        const perPointTarget = searchPoints.length > 1 ? Math.min(maxRes, 60) : maxRes;
        const found = await scrollFeed(searchPage, perPointTarget);

        const items = await extractFeedItems(searchPage);
        let added = 0;
        for (const item of items) {
          const key = item.placeId || item.name;
          if (!merged.has(key)) {
            merged.set(key, item);
            added++;
          }
        }
        log.info(`Point ${pointIndex}/${searchPoints.length}: feed=${found} extracted=${items.length} new=${added} total=${merged.size}`);
      } catch (err) {
        log.warn(`Point ${pointIndex} failed: ${err.message}`);
      } finally {
        await searchPage.close().catch(() => {});
        searchPage = null;
      }

      // Early exit if we already have plenty before distance filtering
      if (merged.size >= maxRes * 4) {
        log.info("Collected enough candidates — stopping grid search early");
        break;
      }
    }

    const allItems = [...merged.values()];
    log.info(`Total unique candidates from grid: ${allItems.length}`);

    // ── Distance filter (resolve coords if missing) ──
    const inRadius = [];
    for (const item of allItems) {
      let coords = item.coords;
      if (!coords || !isValidCoord(coords.latitude, coords.longitude)) {
        // Try to parse coords from URL one more time
        const m = item.url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || item.url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (m) coords = { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };
      }
      if (!coords || !isValidCoord(coords.latitude, coords.longitude)) continue;

      const distance = calculateDistance(lat, lng, coords.latitude, coords.longitude);
      if (distance <= rad) {
        inRadius.push({ ...item, coords, distance });
      }
    }

    // Sort by distance, cap at maxRes
    inRadius.sort((a, b) => a.distance - b.distance);
    const selected = inRadius.slice(0, maxRes);
    log.info(`In-radius: ${inRadius.length}, selected: ${selected.length}`);

    // ── Optional detail pass (phone/website) with concurrency ──
    const businesses = [];
    const buildRecord = (item, details = {}) => ({
      userId: "anonymous",
      businessId: randomUUID(),
      storeName: item.name,
      category: details.category || item.category || "N/A",
      address: details.address || item.address || "N/A",
      phone: details.phone || "N/A",
      googleUrl: item.url,
      bizWebsite: details.website || item.website || "N/A",
      stars: item.stars ?? "N/A",
      numberOfReviews: item.reviews ?? "N/A",
      latitude: item.coords.latitude,
      longitude: item.coords.longitude,
      distanceFromCenter: Math.round(item.distance),
      distanceKm: (item.distance / 1000).toFixed(2),
      searchKeyword: keyword,
      searchLocation: locationName,
      searchCenter: { latitude: lat, longitude: lng },
      searchRadius: rad,
      scrapedAt: new Date().toISOString(),
      source: "GoogleMaps-Radius",
    });

    if (detailedScrape) {
      const CONCURRENCY = 5;
      for (let i = 0; i < selected.length; i += CONCURRENCY) {
        // Time budget guard
        if (Date.now() - startTime > TIME_BUDGET_MS) {
          log.warn("Time budget reached during detail pass — returning feed-level data for the rest");
          for (const item of selected.slice(i)) businesses.push(buildRecord(item));
          break;
        }

        const batch = selected.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map(async (item) => {
            const details = await extractBusinessDetails(browser, item.url);
            return buildRecord(item, details);
          })
        );
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) businesses.push(r.value);
        }
        log.info(`Detail pass: ${businesses.length}/${selected.length}`);
      }
    } else {
      for (const item of selected) businesses.push(buildRecord(item));
    }

    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
    log.info(`Radius Search complete — ${businesses.length} results in ${executionTime}s`);

    return res.status(200).json({
      status: 200,
      message: "Radius search completed successfully",
      data: businesses,
      metadata: {
        totalResults: businesses.length,
        totalCandidates: allItems.length,
        totalInRadius: inRadius.length,
        gridPointsSearched: pointIndex,
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

// ─── Graceful shutdown ───────────────────────────────────────────────────────
process.on("SIGTERM", async () => {
  if (browserInstance) await browserInstance.close().catch(() => {});
});
process.on("SIGINT", async () => {
  if (browserInstance) await browserInstance.close().catch(() => {});
});

module.exports = { searchByRadius };
