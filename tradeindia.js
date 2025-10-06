const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");

puppeteerExtra.use(StealthPlugin());

let browserInstance = null;

const getBrowserInstance = async () => {
  if (!browserInstance) {
    console.log("Creating new browser instance...");
    browserInstance = await puppeteerExtra.launch({
      headless: true,
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
      console.log("Browser disconnected, resetting instance");
      browserInstance = null;
    });
  }
  return browserInstance;
};

const searchTradeIndia = async (req, res) => {
  let page = null;
  const startTime = Date.now();

  try {
    console.log("TradeIndia request received:", JSON.stringify(req.body));
    const { keyword, place, maxResults = 20 } = req.body;
    const userId = req.user?.id || "anonymous";

    if (!keyword || !place) {
      return res.status(400).json({
        status: 400,
        message: "Both 'keyword' and 'place' are required parameters.",
      });
    }

    console.log("Starting scraping...");
    const allBusinesses = [];
    const processedNames = new Set();
    let currentPage = 1;
    const maxPages = Math.ceil(maxResults / 20);

    const browser = await getBrowserInstance();

    while (allBusinesses.length < maxResults && currentPage <= maxPages) {
      console.log(`\n=== SCRAPING PAGE ${currentPage} ===`);

      if (page) {
        try {
          await page.close();
          console.log("Previous page closed");
        } catch (e) {
          console.log("Error closing previous page:", e.message);
        }
      }

      console.log("Creating fresh page...");
      page = await browser.newPage();

      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );
      await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

      await page.setExtraHTTPHeaders({
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": currentPage === 1 ? "none" : "same-origin",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
      });

      // TradeIndia URL format: https://www.tradeindia.com/search/{keyword}/?city={city}&page={page}
      const pageUrl =
        currentPage === 1
          ? `https://www.tradeindia.com/search/${encodeURIComponent(keyword)}/?city=${encodeURIComponent(place)}`
          : `https://www.tradeindia.com/search/${encodeURIComponent(keyword)}/?city=${encodeURIComponent(place)}&page=${currentPage}`;

      console.log(`Navigating to: ${pageUrl}`);

      try {
        await page.goto(pageUrl, { waitUntil: "networkidle2", timeout: 45000 });
        console.log(`✓ Navigation successful`);
      } catch (navError) {
        console.log(`✗ Navigation failed: ${navError.message}`);
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Check for blocks
      const hasBlock = await page.evaluate(() => {
        const title = document.title.toLowerCase();
        return title.includes("cloudflare") || title.includes("blocked");
      });

      if (hasBlock) {
        console.log("⚠️ Block detected, waiting...");
        await new Promise((resolve) => setTimeout(resolve, 15000));
      }

      // Scroll
      await page.evaluate(async () => {
        for (let i = 0; i < 3; i++) {
          window.scrollBy(0, 1000);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log(`✓ Starting data extraction from page ${currentPage}...`);
      const html = await page.content();
      const $ = cheerio.load(html);

      let pageResults = 0;

      const businessSelectors = [
        ".company-card",
        ".seller-card",
        "[class*='company']",
        ".search-result",
        "[data-company]",
      ];

      let businessElements = $();
      for (const selector of businessSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          console.log(`Found ${elements.length} businesses with selector: ${selector}`);
          businessElements = elements;
          break;
        }
      }

      businessElements.each((index, el) => {
        if (allBusinesses.length >= maxResults) return false;

        const $el = $(el);

        try {
          const nameSelectors = [
            ".company-name",
            "[class*='company-name']",
            "h2",
            "h3",
            ".seller-name",
          ];

          let storeName = "";
          for (const selector of nameSelectors) {
            const nameEl = $el.find(selector).first();
            if (nameEl.length > 0 && nameEl.text().trim()) {
              storeName = nameEl.text().trim();
              break;
            }
          }

          if (!storeName || processedNames.has(storeName)) return;
          processedNames.add(storeName);

          // Extract trust seal
          const trustSeal = $el.find('[class*="trust"], [class*="verified"]').length > 0;

          // Extract GST
          const gstText = $el.text();
          const gstMatch = gstText.match(/GST[:\s]*([A-Z0-9]{15})/i);
          const gstNumber = gstMatch ? gstMatch[1] : "";

          // Extract address
          let address = "";
          const addressEl = $el.find('[class*="address"], .location').first();
          if (addressEl.length > 0) {
            address = addressEl.text().trim();
          }

          // Extract phone
          const phones = [];
          $el.find('[class*="phone"], a[href^="tel:"]').each((i, phoneEl) => {
            let phoneText = $(phoneEl).text().trim();
            if (!phoneText && $(phoneEl).attr("href")) {
              phoneText = $(phoneEl).attr("href").replace("tel:", "");
            }
            if (phoneText && phoneText.match(/[\d\s\-\(\)\+]{10,}/) && !phones.includes(phoneText)) {
              phones.push(phoneText);
            }
          });

          // Extract TradeIndia URL
          const tiPath = $el.find("a").first().attr("href");
          const tiUrl = tiPath
            ? tiPath.startsWith("http")
              ? tiPath
              : `https://www.tradeindia.com${tiPath}`
            : "";

          // Extract products/categories
          const products = [];
          $el.find('[class*="product"], [class*="category"]').each((i, prodEl) => {
            const prodText = $(prodEl).text().trim();
            if (prodText && prodText.length < 100 && !products.includes(prodText)) {
              products.push(prodText);
            }
          });

          // Extract years in business
          const yearsText = $el.text();
          const yearsMatch = yearsText.match(/since\s*(\d{4})|(\d{4})\s*established/i);
          const yearEstablished = yearsMatch ? parseInt(yearsMatch[1] || yearsMatch[2]) : null;
          const yearsInBusiness = yearEstablished ? new Date().getFullYear() - yearEstablished : null;

          const businessData = {
            userId,
            businessId: `tradeindia_${storeName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
            storeName,
            category: products.join(", ") || "Business",
            address: address || "",
            phone: phones.join(", ") || "",
            tradeindiaUrl: tiUrl,
            bizWebsite: "",
            trustSeal,
            gstNumber,
            yearEstablished,
            yearsInBusiness,
            searchKeyword: keyword,
            searchLocation: place,
            scrapedAt: new Date().toISOString(),
            source: "TradeIndia",
            pageNumber: currentPage,
          };

          allBusinesses.push(businessData);
          pageResults++;
        } catch (parseError) {
          console.log("Error parsing TradeIndia business data:", parseError.message);
        }
      });

      console.log(`✓ Found ${pageResults} results on page ${currentPage}`);
      console.log(`✓ Total businesses collected: ${allBusinesses.length}`);

      if (pageResults === 0) {
        console.log(`No results found on page ${currentPage}, stopping`);
        break;
      }

      currentPage++;

      if (currentPage <= maxPages && allBusinesses.length < maxResults) {
        const delayTime = 5000 + Math.random() * 3000;
        console.log(`Waiting ${Math.round(delayTime)}ms before next page...`);
        await new Promise((resolve) => setTimeout(resolve, delayTime));
      }
    }

    const endTime = Date.now();
    const executionTime = Math.floor((endTime - startTime) / 1000);

    console.log(`TradeIndia scraping completed in ${executionTime} seconds`);

    return res.status(200).json({
      status: 200,
      message: "TradeIndia leads generated successfully.",
      data: allBusinesses,
      metadata: {
        totalResults: allBusinesses.length,
        executionTimeSeconds: executionTime,
        searchKeyword: keyword,
        searchLocation: place,
        source: "TradeIndia",
        pagesScraped: currentPage - 1,
        maxResultsRequested: maxResults,
      },
    });
  } catch (error) {
    console.error("Error in searchTradeIndia:", error.message);

    if (error.name === "TimeoutError") {
      return res.status(408).json({
        status: 408,
        message: "Request timeout. Please try again.",
      });
    }

    return res.status(500).json({
      status: 500,
      message: "Service temporarily unavailable.",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  } finally {
    if (page) {
      try {
        await page.close();
        console.log("Page closed successfully");
      } catch (closeError) {
        console.log("Error closing page:", closeError.message);
      }
    }
  }
};

process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing browser...");
  if (browserInstance) {
    await browserInstance.close();
  }
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, closing browser...");
  if (browserInstance) {
    await browserInstance.close();
  }
});

module.exports = { searchTradeIndia };
