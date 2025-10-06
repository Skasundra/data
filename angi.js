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

const searchAngi = async (req, res) => {
  let page = null;
  const startTime = Date.now();

  try {
    console.log("Angi request received:", JSON.stringify(req.body));
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
    const maxPages = Math.ceil(maxResults / 10);

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
      const pageUrl =
        currentPage === 1
          ? `https://www.angi.com/search/results?searchTerm=${encodeURIComponent(
              keyword
            )}&location=${encodeURIComponent(place)}`
          : `https://www.angi.com/search/results?searchTerm=${encodeURIComponent(
              keyword
            )}&location=${encodeURIComponent(place)}&page=${currentPage}`;

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

      // Collect business URLs
      const businessUrls = [];
      $('a[href*="/companylist/"]').each((i, el) => {
        const href = $(el).attr("href");
        if (href) {
          let cleanUrl = href.split("?")[0];
          if (!cleanUrl.startsWith("http")) {
            cleanUrl = `https://www.angi.com${cleanUrl}`;
          }
          if (!businessUrls.includes(cleanUrl) && businessUrls.length < maxResults - allBusinesses.length) {
            businessUrls.push(cleanUrl);
          }
        }
      });

      console.log(`Found ${businessUrls.length} business URLs to scrape`);

      // Scrape each business detail page
      for (const businessUrl of businessUrls) {
        if (allBusinesses.length >= maxResults) break;

        try {
          console.log(`Scraping detail page: ${businessUrl}`);

          await page.goto(businessUrl, {
            waitUntil: "networkidle2",
            timeout: 30000,
          });

          await new Promise((resolve) => setTimeout(resolve, 2000));

          const detailHtml = await page.content();
          const $detail = cheerio.load(detailHtml);

          // Extract business name
          const storeName =
            $detail("h1").first().text().trim() ||
            $detail('[class*="company-name"]').first().text().trim() ||
            $detail('[class*="CompanyName"]').first().text().trim();

          if (!storeName || processedNames.has(storeName)) {
            console.log(`Skipping duplicate or empty: ${storeName}`);
            continue;
          }
          processedNames.add(storeName);

          // Extract rating
          let stars = null;
          const ratingText = $detail('[class*="rating"]').first().text();
          const starsMatch = ratingText.match(/([0-9.]+)/);
          stars = starsMatch ? parseFloat(starsMatch[1]) : null;

          // Extract review count
          let numberOfReviews = null;
          const reviewText = $detail("body").text();
          const reviewMatch = reviewText.match(/(\d+)\s*reviews?/i);
          numberOfReviews = reviewMatch ? parseInt(reviewMatch[1]) : null;

          // Extract category
          const category =
            $detail('[class*="category"]').first().text().trim() ||
            $detail('[class*="service"]').first().text().trim() ||
            "";

          // Extract address
          const address =
            $detail('[itemprop="address"]').text().trim() ||
            $detail('address').text().trim() ||
            $detail('[class*="address"]').first().text().trim() ||
            "";

          // Extract phone
          const phone =
            $detail('[itemprop="telephone"]').text().trim() ||
            $detail('a[href^="tel:"]').text().trim() ||
            $detail('[class*="phone"]').first().text().trim() ||
            "";

          // Extract website
          let website = "";
          const websiteElement = $detail('a[href*="website"], a[class*="website"]');
          if (websiteElement.length > 0) {
            website = websiteElement.attr("href") || "";
          }

          // Extract years in business
          const yearsText = $detail("body").text();
          const yearsMatch = yearsText.match(/(\d+)\s*years?\s*in\s*business/i);
          const yearsInBusiness = yearsMatch ? parseInt(yearsMatch[1]) : null;

          // Extract services
          const services = [];
          $detail('[class*="service"]').each((i, el) => {
            const serviceText = $detail(el).text().trim();
            if (serviceText && serviceText.length < 100 && !services.includes(serviceText)) {
              services.push(serviceText);
            }
          });

          const businessId = businessUrl.includes("/companylist/")
            ? `angi_${businessUrl.split("/companylist/")[1]?.split("/")[0] || ""}`
            : "";

          const businessData = {
            userId,
            businessId,
            storeName,
            category: category || "Business",
            address: address || "",
            phone: phone || "",
            angiUrl: businessUrl,
            bizWebsite: website,
            stars,
            numberOfReviews,
            ratingText: stars
              ? `${stars} stars with ${numberOfReviews || 0} reviews`
              : "",
            yearsInBusiness,
            services: services.join(", "),
            searchKeyword: keyword,
            searchLocation: place,
            scrapedAt: new Date().toISOString(),
            source: "Angi",
            pageNumber: currentPage,
          };

          allBusinesses.push(businessData);
          pageResults++;

          console.log(`✓ Scraped: ${storeName} (${pageResults}/${businessUrls.length})`);

          await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));

        } catch (detailError) {
          console.log(`Error scraping detail page: ${detailError.message}`);
          continue;
        }
      }

      console.log(`✓ Found ${pageResults} results on page ${currentPage}`);
      console.log(`✓ Total businesses collected so far: ${allBusinesses.length}`);

      if (pageResults === 0) {
        console.log(`No results found on page ${currentPage}, stopping pagination`);
        break;
      }

      currentPage++;

      if (currentPage <= maxPages && allBusinesses.length < maxResults) {
        const delayTime = 5000 + Math.random() * 3000;
        console.log(`Waiting ${Math.round(delayTime)}ms before scraping page ${currentPage}...`);
        await new Promise((resolve) => setTimeout(resolve, delayTime));
      }
    }

    console.log(`\n=== PAGINATION COMPLETE ===`);
    console.log(`Total pages scraped: ${currentPage - 1}`);
    console.log(`Total businesses found: ${allBusinesses.length}`);

    const endTime = Date.now();
    const executionTime = Math.floor((endTime - startTime) / 1000);

    console.log(`Angi scraping completed in ${executionTime} seconds`);

    return res.status(200).json({
      status: 200,
      message: "Angi leads generated successfully.",
      data: allBusinesses,
      metadata: {
        totalResults: allBusinesses.length,
        executionTimeSeconds: executionTime,
        searchKeyword: keyword,
        searchLocation: place,
        source: "Angi",
        pagesScraped: currentPage - 1,
        maxResultsRequested: maxResults,
      },
    });
  } catch (error) {
    console.error("Error in searchAngi:", error.message);
    console.error("Stack trace:", error.stack);

    if (error.name === "TimeoutError") {
      return res.status(408).json({
        status: 408,
        message: "Request timeout. Please try again with a more specific search term.",
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

module.exports = { searchAngi };
