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

const searchYelp = async (req, res) => {
  let page = null;
  const startTime = Date.now();

  try {
    console.log("Yelp request received:", JSON.stringify(req.body));
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
    let currentPage = 0; // Yelp uses 0-based pagination (0, 10, 20, 30...)
    const maxPages = Math.ceil(maxResults / 10); // Yelp shows 10 results per page
    const resultsPerPage = 10;

    const browser = await getBrowserInstance();

    while (
      allBusinesses.length < maxResults &&
      currentPage / resultsPerPage < maxPages
    ) {
      const pageNumber = currentPage / resultsPerPage + 1;
      console.log(`\n=== SCRAPING PAGE ${pageNumber} ===`);

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
        "Sec-Fetch-Site": pageNumber === 1 ? "none" : "same-origin",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
      });

      // Add referer for page 2+
      if (pageNumber > 1) {
        const refererUrl = `https://www.yelp.com/search?find_desc=${encodeURIComponent(
          keyword
        )}&find_loc=${encodeURIComponent(place)}&start=${
          currentPage - resultsPerPage
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

      // Build URL for current page with proper Yelp format
      const pageUrl =
        currentPage === 0
          ? `https://www.yelp.com/search?find_desc=${encodeURIComponent(
              keyword
            )}&find_loc=${encodeURIComponent(place)}`
          : `https://www.yelp.com/search?find_desc=${encodeURIComponent(
              keyword
            )}&find_loc=${encodeURIComponent(place)}&start=${currentPage}`;

      console.log(`Navigating to: ${pageUrl}`);

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

      // Wait for content to load - longer wait for page 2+
      const waitTime = pageNumber === 1 ? 5000 : 8000;
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
        await new Promise((resolve) => setTimeout(resolve, 15000));

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
          bodyLength: document.body.innerText.length,
        };
      });
      console.log("Page debug:", JSON.stringify(pageDebug));

      // Simple scroll to load lazy content
      console.log(`Scrolling page ${pageNumber}...`);
      await page.evaluate(async () => {
        for (let i = 0; i < 3; i++) {
          window.scrollBy(0, 1000);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        window.scrollTo(0, 0);
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log(`✓ Starting data extraction from page ${pageNumber}...`);
      const html = await page.content();
      const $ = cheerio.load(html);

      let pageResults = 0;

      // First, collect all business URLs from the search results
      const businessUrls = [];

      $('a[href*="/biz/"]').each((i, el) => {
        const href = $(el).attr("href");
        if (href && href.includes("/biz/") && !href.includes("/biz_photos/")) {
          let cleanUrl = href;

          // Handle redirect URLs
          if (href.includes("redirect_url=")) {
            const match = href.match(/redirect_url=([^&]+)/);
            if (match) {
              cleanUrl = decodeURIComponent(match[1]);
            }
          }

          cleanUrl = cleanUrl.split("?")[0];

          if (!cleanUrl.startsWith("http")) {
            cleanUrl = `https://www.yelp.com${cleanUrl}`;
          }

          if (
            !businessUrls.includes(cleanUrl) &&
            businessUrls.length < maxResults - allBusinesses.length
          ) {
            businessUrls.push(cleanUrl);
          }
        }
      });

      console.log(
        `Found ${businessUrls.length} business URLs to scrape details from`
      );

      // Now scrape each business detail page
      for (const businessUrl of businessUrls) {
        if (allBusinesses.length >= maxResults) break;

        try {
          console.log(`Scraping detail page: ${businessUrl}`);

          // Navigate to business detail page
          await page.goto(businessUrl, {
            waitUntil: "networkidle2",
            timeout: 30000,
          });

          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Get detail page HTML
          const detailHtml = await page.content();
          const $detail = cheerio.load(detailHtml);

          // Extract business name
          const storeName =
            $detail("h1").first().text().trim() ||
            $detail('[data-testid="business-name"]').text().trim() ||
            $detail('[class*="businessName"]').first().text().trim();

          if (!storeName || processedNames.has(storeName)) {
            console.log(`Skipping duplicate or empty: ${storeName}`);
            continue;
          }
          processedNames.add(storeName);

          // Extract rating
          let stars = null;
          const ratingElement = $detail('[aria-label*="star rating"]');
          if (ratingElement.length > 0) {
            const ratingText = ratingElement.attr("aria-label") || "";
            const starsMatch = ratingText.match(/([0-9.]+)\s*star/);
            stars = starsMatch ? parseFloat(starsMatch[1]) : null;
          }

          // Extract review count
          let numberOfReviews = null;
          const reviewText = $detail("body").text();
          const reviewMatch = reviewText.match(/(\d+)\s*reviews?/i);
          numberOfReviews = reviewMatch ? parseInt(reviewMatch[1]) : null;

          // Extract category
          const category =
            $detail('[class*="category"]').first().text().trim() ||
            $detail('a[href*="/c/"]').first().text().trim() ||
            "";

          // Extract address
          const address =
            $detail('[itemprop="streetAddress"]').text().trim() ||
            $detail("address").text().trim() ||
            $detail('[class*="address"]').first().text().trim() ||
            "";

          // Extract phone
          const phone =
            $detail('[itemprop="telephone"]').text().trim() ||
            $detail('a[href^="tel:"]').text().trim() ||
            $detail('[class*="phone"]').first().text().trim() ||
            "";

          // Extract website
          const websiteElement = $detail('a[href*="biz_redir"]');
          let website = "";
          if (websiteElement.length > 0) {
            const websiteHref = websiteElement.attr("href") || "";
            if (websiteHref.includes("url=")) {
              const match = websiteHref.match(/url=([^&]+)/);
              if (match) {
                website = decodeURIComponent(match[1]);
              }
            }
          }

          // Extract hours
          const hours = [];
          $detail('[class*="hours"]')
            .find("tr, p")
            .each((i, el) => {
              const hourText = $detail(el).text().trim();
              if (hourText && hourText.length < 100) {
                hours.push(hourText);
              }
            });

          // Extract price range
          const priceRange =
            $detail('[class*="priceRange"]').text().trim() || "";

          // Extract business ID from URL
          const businessId = businessUrl.includes("/biz/")
            ? `yelp_${businessUrl.split("/biz/")[1]?.split("?")[0] || ""}`
            : "";

          const businessData = {
            userId,
            businessId,
            storeName,
            category: category || "Business",
            address: address || "",
            phone: phone || "",
            yelpUrl: businessUrl,
            bizWebsite: website,
            stars,
            numberOfReviews,
            ratingText: stars
              ? `${stars} stars with ${numberOfReviews || 0} reviews`
              : "",
            priceRange,
            hours: hours.join(", "),
            searchKeyword: keyword,
            searchLocation: place,
            scrapedAt: new Date().toISOString(),
            source: "Yelp",
            pageNumber,
          };

          allBusinesses.push(businessData);
          pageResults++;

          console.log(
            `✓ Scraped: ${storeName} (${pageResults}/${businessUrls.length})`
          );

          // Small delay between detail page scrapes
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 + Math.random() * 1000)
          );
        } catch (detailError) {
          console.log(`Error scraping detail page: ${detailError.message}`);
          continue;
        }
      }

      console.log(`✓ Found ${pageResults} results on page ${pageNumber}`);
      console.log(
        `✓ Total businesses collected so far: ${allBusinesses.length}`
      );

      // If no results found on current page, stop
      if (pageResults === 0) {
        console.log(
          `No results found on page ${pageNumber}, stopping pagination`
        );
        break;
      }

      // Move to next page
      currentPage += resultsPerPage;

      // Add longer delay between pages
      if (
        currentPage / resultsPerPage < maxPages &&
        allBusinesses.length < maxResults
      ) {
        const delayTime = 5000 + Math.random() * 3000;
        console.log(
          `Waiting ${Math.round(delayTime)}ms before scraping page ${
            currentPage / resultsPerPage + 1
          }...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayTime));
      }
    }

    console.log(`\n=== PAGINATION COMPLETE ===`);
    console.log(`Total pages scraped: ${currentPage / resultsPerPage}`);
    console.log(`Total businesses found: ${allBusinesses.length}`);

    const endTime = Date.now();
    const executionTime = Math.floor((endTime - startTime) / 1000);

    console.log(`Yelp scraping completed in ${executionTime} seconds`);
    console.log(
      `Found ${allBusinesses.length} businesses across ${
        currentPage / resultsPerPage
      } pages`
    );

    return res.status(200).json({
      status: 200,
      message: "Yelp leads generated successfully.",
      data: allBusinesses,
      metadata: {
        totalResults: allBusinesses.length,
        executionTimeSeconds: executionTime,
        searchKeyword: keyword,
        searchLocation: place,
        source: "Yelp",
        pagesScraped: currentPage / resultsPerPage,
        maxResultsRequested: maxResults,
        resultsByPage: allBusinesses.reduce((acc, business) => {
          acc[business.pageNumber] = (acc[business.pageNumber] || 0) + 1;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error("Error in searchYelp:", error.message);
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

module.exports = { searchYelp };
