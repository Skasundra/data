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

const searchYellowPages = async (req, res) => {
  let page = null;
  const startTime = Date.now();

  try {
    console.log("Yellow Pages request received:", JSON.stringify(req.body));
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

    // Multi-page scraping logic with fresh page for each iteration
    console.log("Starting multi-page scraping...");
    const allBusinesses = [];
    const processedNames = new Set();
    let currentPage = 1;
    const maxPages = Math.ceil(maxResults / 20); // Yellow Pages typically shows ~20 results per page

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

      // Create fresh page for this iteration
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

      // Set extra headers to look more like a real browser
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

      // Don't block resources - Cloudflare may detect this
      // Just let everything load naturally to appear more human-like

      // Build URL for current page
      const pageUrl =
        currentPage === 1
          ? `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(
              keyword
            )}&geo_location_terms=${encodeURIComponent(place)}`
          : `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(
              keyword
            )}&geo_location_terms=${encodeURIComponent(
              place
            )}&page=${currentPage}`;

      console.log(`Navigating to: ${pageUrl}`);

      // Add referer header for page 2+ to look like natural navigation
      if (currentPage > 1) {
        const refererUrl = `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(
          keyword
        )}&geo_location_terms=${encodeURIComponent(place)}&page=${
          currentPage - 1
        }`;

        await page.setExtraHTTPHeaders({
          "Accept-Language": "en-US,en;q=0.9",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "same-origin",
          "Sec-Fetch-User": "?1",
          "Cache-Control": "max-age=0",
          Referer: refererUrl,
        });
      }

      // Navigate to the page URL
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

      // Wait for content to load - longer wait for page 2+ to pass Cloudflare check
      const waitTime = currentPage === 1 ? 5000 : 10000;
      console.log(
        `Waiting ${waitTime}ms for results to load (including Cloudflare check)...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      // Check if Cloudflare challenge appeared
      const hasCloudflare = await page.evaluate(() => {
        const title = document.title.toLowerCase();
        const bodyText = document.body.innerText.toLowerCase();
        return (
          title.includes("cloudflare") ||
          title.includes("attention required") ||
          title.includes("just a moment") ||
          bodyText.includes("checking your browser") ||
          bodyText.includes("cloudflare")
        );
      });

      if (hasCloudflare) {
        console.log(
          "⚠️ Cloudflare challenge detected, waiting for it to resolve..."
        );
        // Wait longer for Cloudflare to complete
        await new Promise((resolve) => setTimeout(resolve, 15000));

        // Check again
        const stillBlocked = await page.evaluate(() => {
          const title = document.title.toLowerCase();
          return (
            title.includes("cloudflare") || title.includes("attention required")
          );
        });

        if (stillBlocked) {
          console.log("❌ Cloudflare challenge failed to resolve");
          break;
        } else {
          console.log("✓ Cloudflare challenge passed");
        }
      }

      // Debug: Check page state
      const pageDebug = await page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          resultCount: document.querySelectorAll(".result").length,
          searchResultsCount:
            document.querySelectorAll(".search-results").length,
          bodyLength: document.body.innerText.length,
        };
      });
      console.log("Page debug:", JSON.stringify(pageDebug));

      // Check for blocks/captcha
      if (
        pageDebug.title.toLowerCase().includes("blocked") ||
        pageDebug.title.toLowerCase().includes("captcha") ||
        pageDebug.title.toLowerCase().includes("access denied")
      ) {
        console.log("⚠️ Page appears to be blocked or has captcha");
        break;
      }

      // Simple scroll to load lazy content
      console.log(`Scrolling page ${currentPage}...`);
      await page.evaluate(async () => {
        for (let i = 0; i < 5; i++) {
          window.scrollBy(0, 800);
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        window.scrollTo(0, 0);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      });

      await new Promise((resolve) => setTimeout(resolve, 3000));

      console.log(`✓ Starting data extraction from page ${currentPage}...`);
      const html = await page.content();
      const $ = cheerio.load(html);

      let pageResults = 0;
      const pageBusinesses = [];

      // Try multiple selectors for business listings
      const businessSelectors = [
        ".result",
        ".search-results .result",
        ".organic",
        ".listing",
        "[data-listing-id]",
        ".business-card",
        ".srp-listing",
        ".info",
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

      businessElements.each((index, el) => {
        if (allBusinesses.length >= maxResults) return false;

        const $el = $(el);

        try {
          // Extract business name with multiple fallbacks
          const nameSelectors = [
            ".business-name",
            "h3 a",
            "h2 a",
            ".n",
            'a[class*="business"]',
            ".listing-name",
            ".business-title",
            "[data-business-name]",
            ".name",
            "a[href*='/mip/']",
            ".organic-title a",
            ".info h3 a",
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

          // Extract phone number with multiple fallbacks
          const phoneSelectors = [
            ".phones",
            ".phone",
            '[class*="phone"]',
            'a[href^="tel:"]',
            ".contact-phone",
            ".business-phone",
            "[data-phone]",
            ".tel",
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

          // Extract address
          const address =
            $el
              .find('.adr, .street-address, [class*="address"]')
              .first()
              .text()
              .trim() || $el.find(".locality").parent().text().trim();

          // Extract website
          const websiteElement = $el
            .find('a[href*="http"]:not([href*="yellowpages.com"])')
            .first();
          const website = websiteElement.attr("href") || "";

          // Extract category/business type
          const category =
            $el
              .find('.categories, .business-categories, [class*="category"]')
              .first()
              .text()
              .trim() || $el.find(".breadcrumbs").last().text().trim();

          // Extract rating information
          let stars = null;
          let numberOfReviews = null;
          let ratingText = "";

          const ratingElement = $el.find(
            '[class*="rating"], .stars, [class*="star"]'
          );
          if (ratingElement.length > 0) {
            const ratingAttr =
              ratingElement.attr("class") || ratingElement.attr("title") || "";
            const starsMatch = ratingAttr.match(/(\d+(?:\.\d+)?)/);
            stars = starsMatch ? parseFloat(starsMatch[1]) : null;

            const reviewElement = $el.find(
              '[class*="review"], [class*="count"]'
            );
            const reviewText = reviewElement.text();
            const reviewMatch = reviewText.match(/(\d+)/);
            numberOfReviews = reviewMatch ? parseInt(reviewMatch[1]) : null;

            ratingText = `${stars || 0} stars with ${
              numberOfReviews || 0
            } reviews`;
          }

          // Extract Yellow Pages URL
          const yellowPagesUrl =
            $el.find('a[href*="/mip/"]').first().attr("href") ||
            $el.find("h3 a, h2 a").first().attr("href") ||
            "";

          const fullYellowPagesUrl = yellowPagesUrl.startsWith("http")
            ? yellowPagesUrl
            : yellowPagesUrl
            ? `https://www.yellowpages.com${yellowPagesUrl}`
            : "";

          // Generate a simple ID based on business name and location
          const businessId = `yp_${storeName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "_")}_${place
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "_")}`;

          const businessData = {
            userId,
            businessId,
            storeName,
            category: category || "Business",
            address: address || "",
            phone: phone || "",
            yellowPagesUrl: fullYellowPagesUrl,
            bizWebsite: website,
            stars,
            numberOfReviews,
            ratingText,
            searchKeyword: keyword,
            searchLocation: place,
            scrapedAt: new Date().toISOString(),
            source: "YellowPages",
            pageNumber: currentPage,
          };

          pageBusinesses.push(businessData);
          allBusinesses.push(businessData);

          pageResults++;
        } catch (parseError) {
          console.log(
            "Error parsing Yellow Pages business data:",
            parseError.message
          );
        }
      });

      console.log(`✓ Found ${pageResults} results on page ${currentPage}`);
      console.log(
        `✓ Total businesses collected so far: ${allBusinesses.length}`
      );

      // If no results found on current page, debug and stop
      if (pageResults === 0) {
        console.log(`⚠️ No results found on page ${currentPage}, debugging...`);

        // Save HTML for debugging
        const debugHtml = await page.content();
        const fs = require("fs");
        const debugPath = `debug_page_${currentPage}.html`;
        fs.writeFileSync(debugPath, debugHtml);
        console.log(`Debug HTML saved to: ${debugPath}`);

        // Check if we're on a valid page
        const isValidPage = await page.evaluate(() => {
          const bodyText = document.body.innerText.toLowerCase();
          return (
            !bodyText.includes("no results") &&
            !bodyText.includes("did not match") &&
            !bodyText.includes("try again")
          );
        });

        console.log(`Is valid page: ${isValidPage}`);
        console.log(`Stopping pagination`);
        break;
      }

      // Move to next page
      currentPage++;

      // Add longer delay between pages to avoid rate limiting
      if (currentPage <= maxPages && allBusinesses.length < maxResults) {
        const delayTime = 5000 + Math.random() * 3000; // Random 5-8 seconds
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

    console.log(`Yellow Pages scraping completed in ${executionTime} seconds`);
    console.log(
      `Found ${allBusinesses.length} businesses across ${currentPage - 1} pages`
    );

    // Sort results by page number and then by order found
    allBusinesses.sort((a, b) => {
      if (a.pageNumber !== b.pageNumber) {
        return a.pageNumber - b.pageNumber;
      }
      return 0;
    });

    return res.status(200).json({
      status: 200,
      message: "Yellow Pages leads generated successfully.",
      data: allBusinesses,
      metadata: {
        totalResults: allBusinesses.length,
        executionTimeSeconds: executionTime,
        searchKeyword: keyword,
        searchLocation: place,
        source: "YellowPages",
        pagesScraped: currentPage - 1,
        maxResultsRequested: maxResults,
        resultsByPage: allBusinesses.reduce((acc, business) => {
          acc[business.pageNumber] = (acc[business.pageNumber] || 0) + 1;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error("Error in searchYellowPages:", error.message);
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

module.exports = { searchYellowPages };
