const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");

// Add stealth plugin to evade detection
puppeteerExtra.use(StealthPlugin());

// Browser instance management
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

const searchIndiaMart = async (req, res) => {
  let page = null;
  const startTime = Date.now();

  try {
    console.log("IndiaMART request received:", JSON.stringify(req.body));
    const { keyword, place, maxResults = 20 } = req.body;
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

    // Multi-page scraping logic
    console.log("Starting multi-page scraping...");
    const allBusinesses = [];
    const processedNames = new Set();
    let currentPage = 1;
    const maxPages = Math.ceil(maxResults / 20);

    const browser = await getBrowserInstance();

    while (allBusinesses.length < maxResults && currentPage <= maxPages) {
      console.log(`\n=== SCRAPING PAGE ${currentPage} ===`);

      // Close previous page if exists
      if (page) {
        try {
          await page.close();
          console.log("Previous page closed");
        } catch (e) {
          console.log("Error closing previous page:", e.message);
        }
      }

      // Create fresh page
      console.log("Creating fresh page...");
      page = await browser.newPage();

      // Set realistic user agent and viewport
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );
      await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      });

      // Set extra headers
      await page.setExtraHTTPHeaders({
        "Accept-Language": "en-US,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": currentPage === 1 ? "none" : "same-origin",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
      });

      // Build URL for current page
      // IndiaMART URL format: https://dir.indiamart.com/search.mp?ss={keyword}&mcatid=&cityname={city}&page={page}
      const pageUrl =
        currentPage === 1
          ? `https://dir.indiamart.com/search.mp?ss=${encodeURIComponent(
              keyword
            )}&mcatid=&cityname=${encodeURIComponent(place)}`
          : `https://dir.indiamart.com/search.mp?ss=${encodeURIComponent(
              keyword
            )}&mcatid=&cityname=${encodeURIComponent(
              place
            )}&page=${currentPage}`;

      console.log(`Navigating to: ${pageUrl}`);

      // Navigate
      try {
        await page.goto(pageUrl, {
          waitUntil: "networkidle2",
          timeout: 45000,
        });
        console.log(`✓ Navigation successful`);
      } catch (navError) {
        console.log(`✗ Navigation failed: ${navError.message}`);
        break;
      }

      // Wait for content
      const waitTime = currentPage === 1 ? 5000 : 8000;
      console.log(`Waiting ${waitTime}ms for results to load...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      // Check for blocks
      const hasBlock = await page.evaluate(() => {
        const title = document.title.toLowerCase();
        const bodyText = document.body.innerText.toLowerCase();
        return (
          title.includes("cloudflare") ||
          title.includes("attention required") ||
          title.includes("blocked") ||
          bodyText.includes("checking your browser")
        );
      });

      if (hasBlock) {
        console.log("⚠️ Block detected, waiting...");
        await new Promise((resolve) => setTimeout(resolve, 15000));

        const stillBlocked = await page.evaluate(() => {
          const title = document.title.toLowerCase();
          return title.includes("cloudflare") || title.includes("blocked");
        });

        if (stillBlocked) {
          console.log("❌ Block failed to resolve");
          break;
        } else {
          console.log("✓ Block resolved");
        }
      }

      // Scroll
      console.log(`Scrolling page ${currentPage}...`);
      await page.evaluate(async () => {
        for (let i = 0; i < 5; i++) {
          window.scrollBy(0, 1000);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        window.scrollTo(0, 0);
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log(`✓ Starting data extraction from page ${currentPage}...`);
      const html = await page.content();
      const $ = cheerio.load(html);

      let pageResults = 0;

      // IndiaMART business selectors
      const businessSelectors = [
        ".company-card",
        ".listing",
        "[class*='company']",
        ".dir-card",
        "[data-company]",
        ".search-card",
      ];

      let businessElements = $();
      for (const selector of businessSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          console.log(
            `Found ${elements.length} businesses with selector: ${selector}`
          );
          businessElements = elements;
          break;
        }
      }

      console.log(
        `Total potential business elements: ${businessElements.length}`
      );

      businessElements.each((index, el) => {
        if (allBusinesses.length >= maxResults) return false;

        const $el = $(el);

        try {
          // Extract business name
          const nameSelectors = [
            ".company-name",
            "[class*='companyname']",
            "h2",
            ".title",
            "[class*='business-name']",
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

          // Extract trust seal/verification
          const trustSeal =
            $el.find('[class*="trust"], [class*="verified"]').length > 0;

          // Extract GST number
          const gstText = $el.text();
          const gstMatch = gstText.match(/GST[:\s]*([A-Z0-9]{15})/i);
          const gstNumber = gstMatch ? gstMatch[1] : "";

          // Extract address
          const addressSelectors = [
            ".address",
            "[class*='address']",
            ".location",
            "[class*='location']",
          ];

          let address = "";
          for (const selector of addressSelectors) {
            const addressEl = $el.find(selector).first();
            if (addressEl.length > 0) {
              address = addressEl.text().trim();
              if (address) break;
            }
          }

          // Extract phone numbers
          const phoneSelectors = [
            ".phone",
            "[class*='phone']",
            ".mobile",
            'a[href^="tel:"]',
            "[class*='contact']",
          ];

          const phones = [];
          for (const selector of phoneSelectors) {
            $el.find(selector).each((i, phoneEl) => {
              let phoneText = $(phoneEl).text().trim();
              if (!phoneText && $(phoneEl).attr("href")) {
                phoneText = $(phoneEl).attr("href").replace("tel:", "");
              }
              if (
                phoneText &&
                phoneText.match(/[\d\s\-\(\)\+]{10,}/) &&
                !phones.includes(phoneText)
              ) {
                phones.push(phoneText);
              }
            });
          }

          // Extract IndiaMART URL
          const imPath =
            $el.find("a[href*='indiamart.com']").first().attr("href") ||
            $el.find("a").first().attr("href");

          const imUrl = imPath
            ? imPath.startsWith("http")
              ? imPath
              : `https://dir.indiamart.com${imPath}`
            : "";

          // Extract category/products
          const categorySelectors = [
            ".category",
            "[class*='category']",
            ".products",
            "[class*='product']",
          ];

          const categories = [];
          for (const selector of categorySelectors) {
            $el.find(selector).each((i, catEl) => {
              const catText = $(catEl).text().trim();
              if (
                catText &&
                catText.length < 100 &&
                !categories.includes(catText)
              ) {
                categories.push(catText);
              }
            });
          }

          // Extract years in business
          const yearsText = $el.text();
          const yearsMatch = yearsText.match(
            /since\s*(\d{4})|(\d{4})\s*established/i
          );
          const yearEstablished = yearsMatch
            ? parseInt(yearsMatch[1] || yearsMatch[2])
            : null;
          const yearsInBusiness = yearEstablished
            ? new Date().getFullYear() - yearEstablished
            : null;

          // Extract response rate
          const responseText = $el.text();
          const responseMatch = responseText.match(/(\d+)%\s*response/i);
          const responseRate = responseMatch
            ? parseInt(responseMatch[1])
            : null;

          const businessData = {
            userId,
            businessId: `indiamart_${storeName
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "_")}`,
            storeName,
            category: categories.join(", ") || "Business",
            address: address || "",
            phone: phones.join(", ") || "",
            indiamartUrl: imUrl,
            bizWebsite: "",
            trustSeal,
            gstNumber,
            yearEstablished,
            yearsInBusiness,
            responseRate,
            searchKeyword: keyword,
            searchLocation: place,
            scrapedAt: new Date().toISOString(),
            source: "IndiaMART",
            pageNumber: currentPage,
          };

          allBusinesses.push(businessData);
          pageResults++;
        } catch (parseError) {
          console.log(
            "Error parsing IndiaMART business data:",
            parseError.message
          );
        }
      });

      console.log(`✓ Found ${pageResults} results on page ${currentPage}`);
      console.log(
        `✓ Total businesses collected so far: ${allBusinesses.length}`
      );

      if (pageResults === 0) {
        console.log(
          `No results found on page ${currentPage}, stopping pagination`
        );
        break;
      }

      currentPage++;

      if (currentPage <= maxPages && allBusinesses.length < maxResults) {
        const delayTime = 5000 + Math.random() * 3000;
        console.log(
          `Waiting ${Math.round(
            delayTime
          )}ms before scraping page ${currentPage}...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayTime));
      }
    }

    console.log(`\n=== PAGINATION COMPLETE ===`);
    console.log(`Total pages scraped: ${currentPage - 1}`);
    console.log(`Total businesses found: ${allBusinesses.length}`);

    const endTime = Date.now();
    const executionTime = Math.floor((endTime - startTime) / 1000);

    console.log(`IndiaMART scraping completed in ${executionTime} seconds`);

    return res.status(200).json({
      status: 200,
      message: "IndiaMART leads generated successfully.",
      data: allBusinesses,
      metadata: {
        totalResults: allBusinesses.length,
        executionTimeSeconds: executionTime,
        searchKeyword: keyword,
        searchLocation: place,
        source: "IndiaMART",
        pagesScraped: currentPage - 1,
        maxResultsRequested: maxResults,
      },
    });
  } catch (error) {
    console.error("Error in searchIndiaMart:", error.message);
    console.error("Stack trace:", error.stack);

    if (error.name === "TimeoutError") {
      return res.status(408).json({
        status: 408,
        message:
          "Request timeout. Please try again with a more specific search term.",
      });
    }

    return res.status(500).json({
      status: 500,
      message: "Service temporarily unavailable. Please try again later.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
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

// Graceful shutdown
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

module.exports = { searchIndiaMart };
