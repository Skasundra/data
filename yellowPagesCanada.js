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

const searchYellowPagesCanada = async (req, res) => {
  let page = null;
  const startTime = Date.now();

  try {
    console.log(
      "Yellow Pages Canada request received:",
      JSON.stringify(req.body)
    );
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

    console.log("Starting multi-page scraping...");
    const allBusinesses = [];
    const processedNames = new Set();
    let currentPage = 1;
    const maxPages = Math.ceil(maxResults / 20);

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
        "Accept-Language": "en-CA,en-US;q=0.9,en;q=0.8",
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

      // Build URL for yellowpages.ca
      // Format: https://www.yellowpages.ca/search/si/1/Restaurants/Toronto+ON
      // Replace spaces with + and remove commas
      const formattedKeyword = keyword.replace(/\s+/g, "+");
      const formattedPlace = place.replace(/,/g, "").replace(/\s+/g, "+");
      const pageUrl = `https://www.yellowpages.ca/search/si/${currentPage}/${formattedKeyword}/${formattedPlace}`;

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

      // Wait for content to load
      const waitTime = currentPage === 1 ? 5000 : 8000;
      console.log(`Waiting ${waitTime}ms for results to load...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      // Check for Cloudflare or blocks
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
        console.log("⚠️ Cloudflare challenge detected, waiting...");
        await new Promise((resolve) => setTimeout(resolve, 15000));
      }

      // Debug page state
      const pageDebug = await page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          bodyLength: document.body.innerText.length,
        };
      });
      console.log("Page debug:", JSON.stringify(pageDebug));

      // Scroll to load lazy content
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

      // Yellow Pages Canada uses .listing__container for each business
      const businessElements = $(".listing__container");
      console.log(
        `Found ${businessElements.length} business listings on page ${currentPage}`
      );

      businessElements.each((index, el) => {
        if (allBusinesses.length >= maxResults) return false;

        const $el = $(el);

        try {
          // Extract business name - yellowpages.ca uses .listing__name--link
          let storeName = $el
            .find(".listing__name--link")
            .first()
            .text()
            .trim();

          // Fallback selectors
          if (!storeName) {
            storeName =
              $el.find(".mlr__item__title a").first().text().trim() ||
              $el.find("h3.listing__name a").first().text().trim() ||
              $el.find("[itemprop='name']").first().text().trim();
          }

          if (!storeName || processedNames.has(storeName)) return;
          processedNames.add(storeName);

          // Extract phone number - yellowpages.ca uses .mlr__item__cta a with tel: href
          let phone = "";
          const phoneLink = $el.find(".mlr__item__cta a[href^='tel:']").first();
          if (phoneLink.length > 0) {
            phone = phoneLink.attr("href").replace("tel:", "").trim();
          }

          // Fallback to text content
          if (!phone) {
            const phoneText = $el.find(".mlr__item__cta").first().text().trim();
            if (phoneText && phoneText.match(/[\d\s\-\(\)\+]{10,}/)) {
              phone = phoneText;
            }
          }

          // Extract address - yellowpages.ca uses .listing__address or .mlr__item__address
          let address = $el.find(".listing__address").first().text().trim();
          if (!address) {
            address =
              $el.find(".mlr__item__address").first().text().trim() ||
              $el.find("[itemprop='address']").first().text().trim();
          }

          // Clean up address (remove extra whitespace)
          address = address.replace(/\s+/g, " ").trim();

          // Extract website - look for external links
          let website = "";
          const websiteLink = $el
            .find(".mlr__item__actions a[href*='http']")
            .first();
          if (websiteLink.length > 0) {
            const href = websiteLink.attr("href");
            if (href && !href.includes("yellowpages.ca")) {
              website = href;
            }
          }

          // Fallback to any external link
          if (!website) {
            $el.find('a[href*="http"]').each((i, link) => {
              const href = $(link).attr("href");
              if (
                href &&
                !href.includes("yellowpages.ca") &&
                !href.includes("javascript")
              ) {
                website = href;
                return false; // break
              }
            });
          }

          // Extract category/business type
          let category = $el.find(".listing__category").first().text().trim();
          if (!category) {
            category =
              $el.find(".mlr__item__category").first().text().trim() ||
              $el.find("[itemprop='description']").first().text().trim() ||
              keyword; // Use search keyword as fallback
          }

          // Extract rating information
          let stars = null;
          let numberOfReviews = null;
          let ratingText = "";

          // Look for rating in various formats
          const ratingContainer = $el.find(
            ".mlr__item__reviews, .listing__rating, [class*='rating']"
          );
          if (ratingContainer.length > 0) {
            const ratingTextContent = ratingContainer.text();

            // Try to extract star rating (e.g., "4.5" or "4.5 stars")
            const starsMatch = ratingTextContent.match(
              /(\d+(?:\.\d+)?)\s*(?:star|étoile)/i
            );
            if (starsMatch) {
              stars = parseFloat(starsMatch[1]);
            }

            // Try to extract review count (e.g., "(123 reviews)" or "123 avis")
            const reviewMatch = ratingTextContent.match(
              /(\d+)\s*(?:review|avis)/i
            );
            if (reviewMatch) {
              numberOfReviews = parseInt(reviewMatch[1]);
            }

            if (stars || numberOfReviews) {
              ratingText = `${stars || 0} stars with ${
                numberOfReviews || 0
              } reviews`;
            }
          }

          // Extract Yellow Pages Canada URL - the business detail page
          let yellowPagesUrl =
            $el.find(".listing__name--link").first().attr("href") || "";

          // Ensure full URL
          const fullYellowPagesUrl = yellowPagesUrl.startsWith("http")
            ? yellowPagesUrl
            : yellowPagesUrl.startsWith("/")
            ? `https://www.yellowpages.ca${yellowPagesUrl}`
            : yellowPagesUrl
            ? `https://www.yellowpages.ca/${yellowPagesUrl}`
            : "";

          // Generate business ID
          const businessId = `ypca_${storeName
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
            source: "YellowPagesCanada",
            pageNumber: currentPage,
          };

          allBusinesses.push(businessData);
          pageResults++;
        } catch (parseError) {
          console.log("Error parsing business data:", parseError.message);
        }
      });

      console.log(`✓ Found ${pageResults} results on page ${currentPage}`);
      console.log(`✓ Total businesses collected: ${allBusinesses.length}`);

      // If no results found, debug and stop
      if (pageResults === 0) {
        console.log(`⚠️ No results found on page ${currentPage}`);

        // Save debug HTML
        const debugHtml = await page.content();
        const fs = require("fs");
        const debugPath = `debug_ypca_page_${currentPage}.html`;
        fs.writeFileSync(debugPath, debugHtml);
        console.log(`Debug HTML saved to: ${debugPath}`);
        break;
      }

      // Move to next page
      currentPage++;

      // Delay between pages
      if (currentPage <= maxPages && allBusinesses.length < maxResults) {
        const delayTime = 5000 + Math.random() * 3000;
        console.log(`Waiting ${Math.round(delayTime)}ms before next page...`);
        await new Promise((resolve) => setTimeout(resolve, delayTime));
      }
    }

    console.log(`\n=== PAGINATION COMPLETE ===`);
    console.log(`Total pages scraped: ${currentPage - 1}`);
    console.log(`Total businesses found: ${allBusinesses.length}`);

    const endTime = Date.now();
    const executionTime = Math.floor((endTime - startTime) / 1000);

    console.log(
      `Yellow Pages Canada scraping completed in ${executionTime} seconds`
    );

    // Sort results by page number
    allBusinesses.sort((a, b) => {
      if (a.pageNumber !== b.pageNumber) {
        return a.pageNumber - b.pageNumber;
      }
      return 0;
    });

    return res.status(200).json({
      status: 200,
      message: "Yellow Pages Canada leads generated successfully.",
      data: allBusinesses,
      metadata: {
        totalResults: allBusinesses.length,
        executionTimeSeconds: executionTime,
        searchKeyword: keyword,
        searchLocation: place,
        source: "YellowPagesCanada",
        pagesScraped: currentPage - 1,
        maxResultsRequested: maxResults,
        resultsByPage: allBusinesses.reduce((acc, business) => {
          acc[business.pageNumber] = (acc[business.pageNumber] || 0) + 1;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error("Error in searchYellowPagesCanada:", error.message);
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

module.exports = { searchYellowPagesCanada };
