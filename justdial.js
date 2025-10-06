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

const searchJustDial = async (req, res) => {
  let page = null;
  const startTime = Date.now();

  try {
    console.log("JustDial request received:", JSON.stringify(req.body));
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

    // Infinite scroll scraping logic
    console.log("Starting infinite scroll scraping...");
    const allBusinesses = [];
    const processedNames = new Set();

    const browser = await getBrowserInstance();

    console.log(`\n=== SCRAPING JUSTDIAL ===`);

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
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Cache-Control": "max-age=0",
    });

    // Build URL for current page
    // JustDial URL format: https://www.justdial.com/{City}/{Keyword}/nct-{categoryId}
    const cityName =
      place.charAt(0).toUpperCase() + place.slice(1).toLowerCase();
    const keywordFormatted = keyword
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("-");

    const pageUrl = `https://www.justdial.com/${cityName}/${keywordFormatted}`;

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
      return res.status(500).json({
        status: 500,
        message: "Navigation failed",
        error: navError.message,
      });
    }

    // Wait for content
    console.log(`Waiting for initial content to load...`);
    await new Promise((resolve) => setTimeout(resolve, 5000));

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
        return res.status(429).json({
          status: 429,
          message: "Request blocked. Please try again later.",
        });
      } else {
        console.log("✓ Block resolved");
      }
    }

    // Implement infinite scroll to load more results
    console.log(`Starting infinite scroll to load ${maxResults} results...`);
    await page.evaluate(async (targetResults) => {
      let scrollCount = 0;
      const maxScrolls = Math.ceil(targetResults / 10); // ~10 results per scroll
      let lastResultCount = 0;
      let noNewResultsCount = 0;

      while (scrollCount < maxScrolls && noNewResultsCount < 3) {
        // Get current result count
        const currentResults = document.querySelectorAll(
          '.resultbox, .store-details, [class*="listing"], .jcard, [data-jcard]'
        ).length;

        console.log(
          `Scroll ${scrollCount + 1}: Found ${currentResults} results`
        );

        // Scroll to bottom
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Check if we got new results
        if (currentResults === lastResultCount) {
          noNewResultsCount++;
          console.log(`No new results (${noNewResultsCount}/3)`);
        } else {
          noNewResultsCount = 0;
          lastResultCount = currentResults;
        }

        scrollCount++;

        // Break if we have enough results
        if (currentResults >= targetResults) {
          console.log(`Reached target of ${targetResults} results`);
          break;
        }
      }

      console.log(
        `Infinite scroll completed. Total results: ${lastResultCount}`
      );
    }, maxResults);

    // Wait for final content to stabilize
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log(`✓ Starting data extraction...`);
    const html = await page.content();
    const $ = cheerio.load(html);

    let totalResults = 0;

    // JustDial business selectors
    const businessSelectors = [
      ".resultbox",
      ".store-details",
      "[class*='listing']",
      ".jcard",
      "[data-jcard]",
      ".result-box",
      "li[class*='cntanr']",
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
          ".jcn",
          ".store-name",
          "[class*='companyname']",
          "h2 a",
          ".heading",
          "[class*='business-name']",
          "span[class*='lng_cont_name']",
          "a[class*='jcn']",
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

        // Extract rating
        let stars = null;
        const ratingSelectors = [
          ".star-rating",
          "[class*='rating']",
          ".ratings",
          "[class*='star']",
        ];

        for (const selector of ratingSelectors) {
          const ratingEl = $el.find(selector).first();
          if (ratingEl.length > 0) {
            const ratingText =
              ratingEl.text().trim() || ratingEl.attr("title") || "";
            const starsMatch = ratingText.match(/([0-9.]+)/);
            if (starsMatch) {
              stars = parseFloat(starsMatch[1]);
              break;
            }
          }
        }

        // Extract review count
        let numberOfReviews = null;
        const reviewText = $el.text();
        const reviewMatch = reviewText.match(/(\d+)\s*(?:reviews?|ratings?)/i);
        numberOfReviews = reviewMatch ? parseInt(reviewMatch[1]) : null;

        // Extract address
        const addressSelectors = [
          ".address",
          "[class*='address']",
          ".store-address",
          ".loc",
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
          ".contact-info",
          'a[href^="tel:"]',
          ".mobilesv",
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

        // Extract JustDial URL
        const jdPath =
          $el.find("a[href*='/jdurl/']").first().attr("href") ||
          $el.find("a").first().attr("href");

        const jdUrl = jdPath
          ? jdPath.startsWith("http")
            ? jdPath
            : `https://www.justdial.com${jdPath}`
          : "";

        // Extract category
        const categorySelectors = [
          ".category",
          "[class*='category']",
          ".business-type",
        ];

        let category = "";
        for (const selector of categorySelectors) {
          const categoryEl = $el.find(selector).first();
          if (categoryEl.length > 0) {
            category = categoryEl.text().trim();
            if (category) break;
          }
        }

        // Extract years in business
        const yearsText = $el.text();
        const yearsMatch = yearsText.match(/since\s*(\d{4})/i);
        const yearEstablished = yearsMatch ? parseInt(yearsMatch[1]) : null;
        const yearsInBusiness = yearEstablished
          ? new Date().getFullYear() - yearEstablished
          : null;

        const businessData = {
          userId,
          businessId: `justdial_${storeName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "_")}`,
          storeName,
          category: category || "Business",
          address: address || "",
          phone: phones.join(", ") || "",
          justdialUrl: jdUrl,
          bizWebsite: "",
          stars,
          numberOfReviews,
          ratingText: stars
            ? `${stars} stars with ${numberOfReviews || 0} reviews`
            : "",
          yearEstablished,
          yearsInBusiness,
          searchKeyword: keyword,
          searchLocation: place,
          scrapedAt: new Date().toISOString(),
          source: "JustDial",
        };

        allBusinesses.push(businessData);
        totalResults++;
      } catch (parseError) {
        console.log(
          "Error parsing JustDial business data:",
          parseError.message
        );
      }
    });

    console.log(`✓ Found ${totalResults} results`);
    console.log(`✓ Total businesses collected: ${allBusinesses.length}`);

    console.log(`\n=== SCRAPING COMPLETE ===`);
    console.log(`Total businesses found: ${allBusinesses.length}`);

    const endTime = Date.now();
    const executionTime = Math.floor((endTime - startTime) / 1000);

    console.log(`JustDial scraping completed in ${executionTime} seconds`);

    return res.status(200).json({
      status: 200,
      message: "JustDial leads generated successfully.",
      data: allBusinesses,
      metadata: {
        totalResults: allBusinesses.length,
        executionTimeSeconds: executionTime,
        searchKeyword: keyword,
        searchLocation: place,
        source: "JustDial",
        maxResultsRequested: maxResults,
        scrapingMethod: "Infinite Scroll",
      },
    });
  } catch (error) {
    console.error("Error in searchJustDial:", error.message);
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

module.exports = { searchJustDial };
