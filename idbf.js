const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");
const { randomUUID } = require("crypto");
const fs = require("fs");
const path = require("path");

puppeteerExtra.use(StealthPlugin());

// ─── Logger ──────────────────────────────────────────────────────────────────
const log = {
  info: (...a) => console.log(`[${new Date().toISOString()}] [IDBF] [INFO] `, ...a),
  warn: (...a) => console.warn(`[${new Date().toISOString()}] [IDBF] [WARN] `, ...a),
  error: (...a) => console.error(`[${new Date().toISOString()}] [IDBF] [ERROR]`, ...a),
};

// ─── Browser singleton ──────────────────────────────────────────────────────
let browserInstance = null;
let browserLock = false;

const getBrowserInstance = async () => {
  while (browserLock) await new Promise((r) => setTimeout(r, 100));
  if (browserInstance) return browserInstance;

  browserLock = true;
  try {
    log.info("Launching browser for IDBF.in...");
    browserInstance = await puppeteerExtra.launch({
      headless: true,
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

// ─── Constants ───────────────────────────────────────────────────────────────
const BASE_URL = "https://www.idbf.in";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const NAV_TIMEOUT = 30000;
const CONCURRENCY = 3; // parallel detail-page scrapes
const INTER_BATCH_DELAY_MS = 600;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Open a fresh page with realistic headers */
const newPage = async (browser) => {
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  });
  return page;
};

/** Sanitise a slug string — lowercase, spaces to hyphens, strip special chars */
const toSlug = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

// ─── GET /idbf-states ────────────────────────────────────────────────────────
/**
 * Returns a flat list of all cities grouped by state.
 * Response: { status, data: [{ state, cities: [{ name, slug, url }] }] }
 */
const getIdbfStates = async (_req, res) => {
  let page = null;
  try {
    log.info("Fetching states & cities from IDBF.in homepage...");
    const browser = await getBrowserInstance();
    page = await newPage(browser);

    await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT });
    await new Promise((r) => setTimeout(r, 3000));

    const html = await page.content();
    // Save HTML for debugging
    fs.writeFileSync(path.join(__dirname, "debug_states.html"), html, "utf8");
    const $ = cheerio.load(html);

    const states = [];
    const seen = new Set();

    // Strategy 1: look for links matching {city}.idbf.in pattern
    $("a[href]").each((_i, el) => {
      const href = $(el).attr("href") || "";
      const match = href.match(/https?:\/\/([a-z0-9-]+)\.idbf\.in/i);
      if (!match) return;

      const citySlug = match[1];
      if (citySlug === "www" || seen.has(citySlug)) return;
      seen.add(citySlug);

      // Attempt to determine the state from surrounding DOM or link text
      const linkText = $(el).text().trim();
      const cityName = linkText || citySlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      // We don't have explicit state grouping on the homepage easily,
      // so we group all under a generic "India" bucket, and let the frontend
      // just use city search.  The cities array is the real value here.
      let stateObj = states.find((s) => s.state === "India");
      if (!stateObj) {
        stateObj = { state: "India", cities: [] };
        states.push(stateObj);
      }

      stateObj.cities.push({
        name: cityName,
        slug: citySlug,
        url: `https://${citySlug}.idbf.in`,
      });
    });

    // Strategy 2: try to parse state headings if present
    // Some versions of idbf.in group cities under state headings
    $("h2, h3, h4, h5").each((_i, heading) => {
      const stateName = $(heading).text().trim();
      if (!stateName || stateName.length > 50) return;
      // Check if next siblings contain city links
      const nextBlock = $(heading).next();
      if (!nextBlock.length) return;
      nextBlock.find("a[href]").each((_j, el) => {
        const href = $(el).attr("href") || "";
        const match = href.match(/https?:\/\/([a-z0-9-]+)\.idbf\.in/i);
        if (!match) return;
        const citySlug = match[1];
        if (citySlug === "www") return;

        // Move from "India" bucket to the proper state
        const indiaBucket = states.find((s) => s.state === "India");
        if (indiaBucket) {
          const idx = indiaBucket.cities.findIndex((c) => c.slug === citySlug);
          if (idx !== -1) {
            const city = indiaBucket.cities.splice(idx, 1)[0];
            let stateObj = states.find((s) => s.state === stateName);
            if (!stateObj) {
              stateObj = { state: stateName, cities: [] };
              states.push(stateObj);
            }
            stateObj.cities.push(city);
          }
        }
      });
    });

    // Remove empty India bucket if all cities moved
    const indiaBucket = states.find((s) => s.state === "India");
    if (indiaBucket && indiaBucket.cities.length === 0) {
      const idx = states.indexOf(indiaBucket);
      states.splice(idx, 1);
    }

    // Sort cities within each state
    states.forEach((s) => s.cities.sort((a, b) => a.name.localeCompare(b.name)));

    // Sort states
    states.sort((a, b) => a.state.localeCompare(b.state));

    log.info(`Found ${states.length} states with cities. Total cities: ${states.reduce((sum, s) => sum + s.cities.length, 0)}`);

    await page.close().catch(() => {});
    page = null;

    return res.json({
      status: 200,
      message: "States and cities fetched",
      data: states,
    });
  } catch (error) {
    log.error("getIdbfStates failed:", error.message);
    if (page) await page.close().catch(() => {});
    return res.status(500).json({
      status: 500,
      message: "Failed to fetch states from IDBF.in",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ─── GET /idbf-categories?city=indore ────────────────────────────────────────
/**
 * Returns all categories for a given city.
 * Response: { status, data: [{ name, slug, count, url }] }
 */
const getIdbfCategories = async (req, res) => {
  let page = null;
  try {
    const { city } = req.query;
    if (!city) {
      return res.status(400).json({ status: 400, message: "city query parameter is required" });
    }

    const citySlug = toSlug(String(city));
    const cityUrl = `https://${citySlug}.idbf.in/`;
    log.info(`Fetching categories for city: ${citySlug} from ${cityUrl}`);

    const browser = await getBrowserInstance();
    page = await newPage(browser);

    await page.goto(cityUrl, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT });
    await new Promise((r) => setTimeout(r, 3000));

    const html = await page.content();
    // Save HTML for debugging
    fs.writeFileSync(path.join(__dirname, `debug_categories_${citySlug}.html`), html, "utf8");
    const $ = cheerio.load(html);

    const categories = [];
    const seen = new Set();

    // Look for category links — pattern: /{category-slug} on the city subdomain
    $("a[href]").each((_i, el) => {
      const href = $(el).attr("href") || "";
      // Match relative links like /dentist or full links like https://indore.idbf.in/dentist
      let catSlug = null;

      const relMatch = href.match(/^\/([a-z0-9-]+)$/i);
      const fullMatch = href.match(new RegExp(`https?:\\/\\/${citySlug}\\.idbf\\.in\\/([a-z0-9-]+)$`, "i"));

      if (fullMatch) catSlug = fullMatch[1];
      else if (relMatch) catSlug = relMatch[1];

      if (!catSlug) return;

      // Skip single-letter index pages, about, contact, etc.
      if (/^[a-z]$/.test(catSlug)) return;
      if (["about", "contact", "privacy", "terms", "sitemap", "about-us", "privacy-policy"].includes(catSlug)) return;

      if (seen.has(catSlug)) return;
      seen.add(catSlug);

      const name = $(el).text().trim();
      if (!name || name.length > 80) return;

      // Try to extract count from text like "Dentist (131)"
      const countMatch = name.match(/\((\d+)\)/);
      const count = countMatch ? parseInt(countMatch[1], 10) : null;
      const cleanName = name.replace(/\s*\(\d+\)\s*$/, "").trim();

      categories.push({
        name: cleanName,
        slug: catSlug,
        count,
        url: `https://${citySlug}.idbf.in/${catSlug}`,
      });
    });

    categories.sort((a, b) => a.name.localeCompare(b.name));

    log.info(`Found ${categories.length} categories for ${citySlug}`);

    await page.close().catch(() => {});
    page = null;

    return res.json({
      status: 200,
      message: `Categories for ${citySlug}`,
      data: categories,
    });
  } catch (error) {
    log.error("getIdbfCategories failed:", error.message);
    if (page) await page.close().catch(() => {});
    return res.status(500).json({
      status: 500,
      message: "Failed to fetch categories from IDBF.in",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ─── POST /search-idbf ───────────────────────────────────────────────────────
/**
 * Scrape business listings from IDBF.in for a city + category.
 * Body: { city, category, maxResults }
 * Response: { status, data: [{ storeName, phone, address, pincode, state, ... }], metadata }
 */
// Path to the JSON file where we'll store all scraped data
const DATA_FILE_PATH = path.join(__dirname, "idbf_scraped_data.json");

/**
 * Helper to read existing data from JSON file with validation
 */
const readStoredData = () => {
  try {
    if (!fs.existsSync(DATA_FILE_PATH)) {
      return {};
    }
    const data = fs.readFileSync(DATA_FILE_PATH, "utf8");
    const parsed = JSON.parse(data);
    return parsed;
  } catch (error) {
    log.warn(`Could not read existing data file (will start fresh): ${error.message}`);
    return {};
  }
};

/**
 * Helper to write data to JSON file with validation
 */
const writeStoredData = (data) => {
  try {
    // Validate the data can be stringified
    const jsonString = JSON.stringify(data, null, 2);
    // Verify it can be parsed back (integrity check)
    JSON.parse(jsonString);
    fs.writeFileSync(DATA_FILE_PATH, jsonString, "utf8");
    log.info(`Data successfully written to ${DATA_FILE_PATH}`);
    return true;
  } catch (error) {
    log.error(`Failed to write data to JSON: ${error.message}`);
    return false;
  }
};

/**
 * Check if a business with given phone already exists in the category
 */
const businessExists = (categoryList, phone) => {
  if (!phone || phone === "N/A") return false;
  return categoryList.some(b => b.phone === phone);
};

const searchIdbf = async (req, res) => {
  const startTime = Date.now();
  let searchPage = null;

  try {
    const { city: rawCity, category: rawCategory, maxResults: rawMax, storeData } = req.body;

    // ── Validation ──
    if (!rawCity || !rawCategory) {
      return res.status(400).json({
        status: 400,
        message: "Both 'city' and 'category' are required.",
      });
    }

    const citySlug = toSlug(String(rawCity));
    const categorySlug = toSlug(String(rawCategory));
    const maxResults = Math.min(Math.max(parseInt(rawMax, 10) || 20, 1), 200);

    log.info(`IDBF Search — city="${citySlug}" category="${categorySlug}" max=${maxResults}`);

    const browser = await getBrowserInstance();
    searchPage = await newPage(browser);

    // ── Navigate to category page ──
    const categoryUrl = `https://${citySlug}.idbf.in/${categorySlug}`;
    log.info(`Navigating to: ${categoryUrl}`);

    await searchPage.goto(categoryUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await new Promise((r) => setTimeout(r, 2500));

    const html = await searchPage.content();
    const $ = cheerio.load(html);

    // ── Extract listing links ──
    const listingLinks = [];
    const seenLinks = new Set();

    $("a[href]").each((_i, el) => {
      const href = $(el).attr("href") || "";
      // Pattern: /{numeric_id}/{slug}  or  full URL with same pattern
      const relMatch = href.match(/^\/(\d+)\/([a-z0-9-]+)$/i);
      const fullMatch = href.match(/idbf\.in\/(\d+)\/([a-z0-9-]+)/i);

      let id, slug;
      if (fullMatch) {
        id = fullMatch[1];
        slug = fullMatch[2];
      } else if (relMatch) {
        id = relMatch[1];
        slug = relMatch[2];
      } else {
        return;
      }

      const fullUrl = href.startsWith("http") ? href : `https://${citySlug}.idbf.in/${id}/${slug}`;
      if (seenLinks.has(fullUrl)) return;
      seenLinks.add(fullUrl);

      listingLinks.push({ id, slug, url: fullUrl });
    });

    log.info(`Found ${listingLinks.length} listing links on category page`);

    // Close search page — we'll open fresh pages for details
    await searchPage.close().catch(() => {});
    searchPage = null;

    if (listingLinks.length === 0) {
      return res.json({
        status: 200,
        message: "No listings found for this city/category combination.",
        data: [],
        metadata: {
          totalResults: 0,
          city: citySlug,
          category: categorySlug,
          source: "IDBF.in",
          timestamp: new Date().toISOString(),
        },
      });
    }

    // ── Scrape detail pages (with concurrency control) ──
    const toScrape = listingLinks.slice(0, maxResults);
    const businesses = [];

    for (let i = 0; i < toScrape.length; i += CONCURRENCY) {
      const batch = toScrape.slice(i, i + CONCURRENCY);

      const batchResults = await Promise.allSettled(
        batch.map(async (listing) => {
          const detailPage = await newPage(browser);
          try {
            await detailPage.goto(listing.url, {
              waitUntil: "domcontentloaded",
              timeout: 20000,
            });
            await new Promise((r) => setTimeout(r, 1500));

            const detailHtml = await detailPage.content();
            const $d = cheerio.load(detailHtml);

            // ── Strategy 1: Parse JSON-LD (most reliable) ──
            let jsonData = null;
            $d('script[type="application/ld+json"]').each((_j, script) => {
              try {
                const parsed = JSON.parse($d(script).html());
                if (parsed["@type"] === "LocalBusiness" || parsed["@type"]?.includes?.("LocalBusiness")) {
                  jsonData = parsed;
                }
              } catch { /* ignore parse errors */ }
            });

            let storeName = "N/A";
            let phone = "N/A";
            let address = "N/A";
            let pincode = "N/A";
            let state = "N/A";
            let city = citySlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
            let category = categorySlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
            let description = "N/A";

            if (jsonData) {
              storeName = jsonData.name || storeName;
              phone = jsonData.telephone || phone;
              description = jsonData.description || description;

              if (jsonData.address) {
                const addr = jsonData.address;
                address = addr.streetAddress || addr.address || address;
                pincode = addr.postalCode || pincode;
                state = addr.addressRegion || state;
                city = addr.addressLocality || city;
              }
            }

            // ── Strategy 2: Fallback HTML scraping ──
            if (storeName === "N/A") {
              const h1 = $d("h1").first().text().trim();
              const title = $d("title").text().trim();
              storeName = h1 || title.split("-")[0].trim() || storeName;
            }

            if (phone === "N/A") {
              // Look for phone in tel: links or text
              $d('a[href^="tel:"]').each((_k, el) => {
                const tel = $d(el).attr("href")?.replace("tel:", "").trim();
                if (tel && phone === "N/A") phone = tel;
              });
              if (phone === "N/A") {
                const phoneMatch = $d("body").text().match(/(\+?\d{10,13})/);
                if (phoneMatch) phone = phoneMatch[1];
              }
            }

            if (address === "N/A") {
              const addrEl = $d('[class*="address"], address, [itemprop="address"]').first();
              if (addrEl.length) address = addrEl.text().trim().replace(/\s+/g, " ") || "N/A";
            }

            // Try meta tags for pincode/state
            if (pincode === "N/A") {
              const metaDesc = $d('meta[name="description"]').attr("content") || "";
              const pinMatch = metaDesc.match(/\b(\d{6})\b/);
              if (pinMatch) pincode = pinMatch[1];
            }

            // Skip if no valid phone number
            if (!phone || phone === "N/A") {
              return null;
            }

            const business = {
              userId: "anonymous",
              businessId: randomUUID(),
              storeName,
              category,
              phone,
              address,
              pincode,
              state,
              city,
              description: description !== "N/A" ? description.slice(0, 300) : "N/A",
              idbfUrl: listing.url,
              searchCity: citySlug,
              searchCategory: categorySlug,
              scrapedAt: new Date().toISOString(),
              source: "IDBF.in",
            };

            return business;
          } finally {
            await detailPage.close().catch(() => {});
          }
        })
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled" && result.value) {
          businesses.push(result.value);
        } else if (result.status === "rejected") {
          log.warn(`Detail scrape failed: ${result.reason?.message || "unknown"}`);
        }
      }

      log.info(`Batch ${Math.floor(i / CONCURRENCY) + 1} done — ${businesses.length}/${toScrape.length} collected`);

      // Inter-batch delay
      if (i + CONCURRENCY < toScrape.length) {
        await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS));
      }
    }

    // All scraping complete — now save data if enabled
    if (storeData && businesses.length > 0) {
      log.info(`All scraping complete. Saving ${businesses.length} businesses to JSON...`);
      try {
        const storedData = readStoredData();
        let addedCount = 0;

        for (const business of businesses) {
          const stateKey = business.state || "Unknown State";
          const cityKey = business.city || "Unknown City";
          const categoryKey = business.category || "Unknown Category";

          // Initialize hierarchy if not exists
          if (!storedData[stateKey]) storedData[stateKey] = {};
          if (!storedData[stateKey][cityKey]) storedData[stateKey][cityKey] = {};
          if (!storedData[stateKey][cityKey][categoryKey]) storedData[stateKey][cityKey][categoryKey] = [];

          // Avoid duplicates
          if (!businessExists(storedData[stateKey][cityKey][categoryKey], business.phone)) {
            storedData[stateKey][cityKey][categoryKey].push(business);
            addedCount++;
          }
        }

        const success = writeStoredData(storedData);
        if (success) {
          log.info(`Successfully added ${addedCount} new businesses to ${DATA_FILE_PATH}`);
        }
      } catch (err) {
        log.error(`Failed to save data to JSON: ${err.message}`);
      }
    }

    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
    log.info(`IDBF Search complete — ${businesses.length} results in ${executionTime}s`);

    return res.status(200).json({
      status: 200,
      message: "IDBF.in leads generated successfully.",
      data: businesses,
      metadata: {
        totalResults: businesses.length,
        totalListings: toScrape.length,
        executionTimeSeconds: parseFloat(executionTime),
        city: citySlug,
        category: categorySlug,
        maxResultsRequested: maxResults,
        source: "IDBF.in",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    log.error("searchIdbf failed:", error.message, error.stack);
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

module.exports = { getIdbfStates, getIdbfCategories, searchIdbf };
