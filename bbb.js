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

const searchBBB = async (req, res) => {
  let page = null;
  const startTime = Date.now();

  try {
    console.log("BBB request received:", JSON.stringify(req.body));
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
    const maxPages = Math.ceil(maxResults / 10); // BBB shows ~10 results per page

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
      const browser = await getBrowserInstance();
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

      // Build URL for current page with proper BBB format
      const pageUrl =
        currentPage === 1
          ? `https://www.bbb.org/search?find_text=${encodeURIComponent(
              keyword
            )}&find_entity=&find_type=&find_loc=${encodeURIComponent(
              place
            )}&find_country=USA`
          : `https://www.bbb.org/search?find_country=USA&find_entity=&find_loc=${encodeURIComponent(
              place
            )}&find_text=${encodeURIComponent(
              keyword
            )}&find_type=&page=${currentPage}`;

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
        for (let i = 0; i < 3; i++) {
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

      // BBB business selectors - try multiple patterns
      const businessSelectors = [
        ".result-item",
        ".search-result-item",
        "[class*='SearchResult']",
        ".bbb-search-result",
        "[data-bbb-id]",
        ".dtm-search-results > div",
        "article",
        "[class*='result']",
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

      console.log(`Total potential business elements: ${businessElements.length}`);

      businessElements.each((index, el) => {
        if (allBusinesses.length >= maxResults) return false;

        const $el = $(el);

        try {
          // Extract business name with multiple fallbacks
          const nameSelectors = [
            "h3 a",
            "h2 a",
            "h4 a",
            ".business-name",
            "[class*='business-name']",
            "[class*='BusinessName']",
            "a[href*='/profile/']",
            ".dtm-business-name",
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

          // Extract BBB rating/accreditation
          const ratingSelectors = [
            '[class*="rating"]',
            ".bbb-rating",
            '[class*="accreditation"]',
            '[class*="grade"]',
            ".dtm-rating",
          ];

          let ratingText = "";
          for (const selector of ratingSelectors) {
            const ratingEl = $el.find(selector).first();
            if (ratingEl.length > 0) {
              ratingText = ratingEl.text().trim();
              if (ratingText) break;
            }
          }

          // Extract address with multiple fallbacks
          const addressSelectors = [
            ".address",
            '[class*="address"]',
            '[class*="Address"]',
            ".dtm-address",
            "address",
            '[itemprop="address"]',
          ];

          let address = "";
          for (const selector of addressSelectors) {
            const addressEl = $el.find(selector).first();
            if (addressEl.length > 0) {
              address = addressEl.text().trim();
              if (address) break;
            }
          }

          // Extract phone with multiple fallbacks
          const phoneSelectors = [
            ".phone",
            '[class*="phone"]',
            '[class*="Phone"]',
            'a[href^="tel:"]',
            ".dtm-phone",
            '[itemprop="telephone"]',
          ];

          let phone = "";
          for (const selector of phoneSelectors) {
            const phoneEl = $el.find(selector).first();
            if (phoneEl.length > 0) {
              let phoneText = phoneEl.text().trim();
              if (!phoneText && phoneEl.attr("href")) {
                phoneText = phoneEl.attr("href").replace("tel:", "");
              }
              if (phoneText && phoneText.match(/[\d\s\-\(\)\+]{10,}/)) {
                phone = phoneText;
                break;
              }
            }
          }

          // Extract BBB URL
          const bbbPath =
            $el.find("h3 a, h2 a, h4 a").first().attr("href") ||
            $el.find('a[href*="/profile/"]').first().attr("href");

          const bbbUrl = bbbPath
            ? bbbPath.startsWith("http")
              ? bbbPath
              : `https://www.bbb.org${bbbPath}`
            : "";

          // Extract category
          const categorySelectors = [
            ".category",
            '[class*="category"]',
            '[class*="Category"]',
            ".dtm-category",
            '[class*="business-type"]',
          ];

          let category = "";
          for (const selector of categorySelectors) {
            const categoryEl = $el.find(selector).first();
            if (categoryEl.length > 0) {
              category = categoryEl.text().trim();
              if (category) break;
            }
          }

          const businessData = {
            userId,
            businessId: `bbb_${storeName
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "_")}`,
            storeName,
            category: category || "Business",
            address: address || "",
            phone: phone || "",
            bbbUrl,
            bizWebsite: "",
            bbbRating: ratingText || "",
            searchKeyword: keyword,
            searchLocation: place,
            scrapedAt: new Date().toISOString(),
            source: "BBB",
            pageNumber: currentPage,
          };

          allBusinesses.push(businessData);
          pageResults++;
        } catch (parseError) {
          console.log("Error parsing BBB business data:", parseError.message);
        }
      });

      console.log(`✓ Found ${pageResults} results on page ${currentPage}`);
      console.log(
        `✓ Total businesses collected so far: ${allBusinesses.length}`
      );

      // If no results, debug and stop
      if (pageResults === 0) {
        console.log(
          `⚠️ No results found on page ${currentPage}, debugging...`
        );

        // Save HTML for debugging
        const debugHtml = await page.content();
        const fs = require("fs");
        const debugPath = `debug_bbb_page_${currentPage}.html`;
        fs.writeFileSync(debugPath, debugHtml);
        console.log(`Debug HTML saved to: ${debugPath}`);

        // Check if we're on a valid page
        const pageInfo = await page.evaluate(() => {
          const bodyText = document.body.innerText.toLowerCase();
          return {
            hasNoResults: bodyText.includes("no results") || bodyText.includes("did not match"),
            hasError: bodyText.includes("error") || bodyText.includes("something went wrong"),
            bodyLength: document.body.innerText.length,
          };
        });

        console.log(`Page info:`, pageInfo);
        console.log(`Stopping pagination`);
        break;
      }

      // Move to next page
      currentPage++;

      // Delay between pages
      if (currentPage <= maxPages && allBusinesses.length < maxResults) {
        const delayTime = 5000 + Math.random() * 3000;
        console.log(
          `Waiting ${Math.round(delayTime)}ms before scraping page ${currentPage}...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayTime));
      }
    }

    console.log(`\n=== PAGINATION COMPLETE ===`);
    console.log(`Total pages scraped: ${currentPage - 1}`);
    console.log(`Total businesses found: ${allBusinesses.length}`);

    const endTime = Date.now();
    const executionTime = Math.floor((endTime - startTime) / 1000);

    console.log(`BBB scraping completed in ${executionTime} seconds`);

    return res.status(200).json({
      status: 200,
      message: "BBB leads generated successfully.",
      data: allBusinesses,
      metadata: {
        totalResults: allBusinesses.length,
        executionTimeSeconds: executionTime,
        searchKeyword: keyword,
        searchLocation: place,
        source: "BBB",
        pagesScraped: currentPage - 1,
        maxResultsRequested: maxResults,
      },
    });
  } catch (error) {
    console.error("Error in searchBBB:", error.message);
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

module.exports = { searchBBB };
