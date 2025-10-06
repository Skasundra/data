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

const searchGoogleMaps = async (req, res) => {
  let page = null;
  const startTime = Date.now();

  try {
    console.log("Request received:", JSON.stringify(req.body));
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

    console.log("Getting browser instance...");
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

    // Don't block resources - may trigger detection

    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(
      keyword
    )}+in+${encodeURIComponent(place)}`;
    console.log("Navigating to:", searchUrl);

    // Navigate with retry mechanism
    let navigationSuccess = false;
    let retryCount = 0;
    const maxRetries = 3;

    while (!navigationSuccess && retryCount < maxRetries) {
      try {
        console.log(`Navigation attempt ${retryCount + 1}/${maxRetries}`);
        await page.goto(searchUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        navigationSuccess = true;
      } catch (navError) {
        retryCount++;
        console.log(
          `Navigation failed (attempt ${retryCount}): ${navError.message}`
        );
        if (retryCount < maxRetries) {
          console.log("Retrying navigation...");
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } else {
          throw navError;
        }
      }
    }

    // Enhanced selector detection with multiple fallbacks
    console.log("Waiting for Google Maps results to load...");
    const selectors = [
      'div[role="feed"]',
      '[data-value="Directions"]',
      'a[href*="/maps/place/"]',
      "[data-result-index]",
      ".section-result",
      '[jsaction*="pane"]',
      "[data-feature-id]",
      ".section-listbox",
      '[role="main"] div[jsaction]',
      'div[data-value="Website"]',
    ];

    let selectorFound = false;
    let foundSelector = null;

    for (const selector of selectors) {
      try {
        console.log(`Trying Google Maps selector: ${selector}`);
        await page.waitForSelector(selector, { timeout: 8000 });
        console.log(`✓ Found Google Maps results with selector: ${selector}`);
        foundSelector = selector;
        selectorFound = true;
        break;
      } catch (error) {
        console.log(
          `✗ Google Maps selector ${selector} not found, trying next...`
        );
        continue;
      }
    }

    if (!selectorFound) {
      console.log(
        "No valid Google Maps selectors found, checking page content..."
      );

      // Final check - look for any maps-related content
      const hasContent = await page.evaluate(() => {
        const indicators = [
          document.querySelector('a[href*="/maps/place/"]'),
          document.querySelector('[data-value="Directions"]'),
          document.querySelector('[data-value="Website"]'),
          document.querySelector(".fontHeadlineSmall"),
          document.querySelector('[role="feed"]'),
          document.querySelector("[data-result-index]"),
          document.querySelector(".section-result"),
        ];
        return indicators.some((el) => el !== null);
      });

      if (!hasContent) {
        console.log("No Google Maps content found on page");
        return res.status(404).json({
          status: 404,
          message: "No results found for the given search criteria.",
          data: [],
        });
      } else {
        console.log(
          "Found some Google Maps content, proceeding with scraping..."
        );
      }
    }

    // Additional page verification with Cloudflare check
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);

    // Check for Cloudflare or other blocks
    const hasCloudflare = await page.evaluate(() => {
      const title = document.title.toLowerCase();
      const bodyText = document.body.innerText.toLowerCase();
      return (
        title.includes("cloudflare") ||
        title.includes("attention required") ||
        title.includes("just a moment") ||
        title.includes("blocked") ||
        title.includes("captcha") ||
        bodyText.includes("checking your browser") ||
        bodyText.includes("cloudflare")
      );
    });

    if (hasCloudflare) {
      console.log("⚠️ Cloudflare/block detected, waiting for it to resolve...");
      await new Promise((resolve) => setTimeout(resolve, 15000));

      const stillBlocked = await page.evaluate(() => {
        const title = document.title.toLowerCase();
        return (
          title.includes("cloudflare") ||
          title.includes("attention required") ||
          title.includes("blocked")
        );
      });

      if (stillBlocked) {
        console.log("❌ Page appears to be blocked");
        return res.status(429).json({
          status: 429,
          message: "Request blocked. Please try again later.",
          data: [],
        });
      } else {
        console.log("✓ Block resolved, continuing...");
      }
    }

    // Enhanced scrolling to load more results with better pagination handling
    console.log("Scrolling to load results...");
    await page.evaluate(async (maxResults) => {
      // Try multiple wrapper selectors
      const wrapperSelectors = [
        'div[role="feed"]',
        ".section-listbox",
        "[data-result-index]",
        ".section-result",
        '[role="main"]',
      ];

      let wrapper = null;
      for (const selector of wrapperSelectors) {
        wrapper = document.querySelector(selector);
        if (wrapper) {
          console.log(`Using wrapper selector: ${selector}`);
          break;
        }
      }

      if (wrapper) {
        let scrollCount = 0;
        let lastResultCount = 0;
        const maxScrolls = Math.ceil(maxResults / 8); // Google Maps loads ~8-12 results per scroll
        let noNewResultsCount = 0;

        while (scrollCount < maxScrolls && noNewResultsCount < 5) {
          const scrollHeightBefore = wrapper.scrollHeight;

          // Smooth scroll with random delays to appear more human
          wrapper.scrollBy(0, 1000 + Math.random() * 400);
          await new Promise((resolve) =>
            setTimeout(resolve, 2000 + Math.random() * 1000)
          );

          const scrollHeightAfter = wrapper.scrollHeight;
          const currentResults = document.querySelectorAll(
            'a[href*="/maps/place/"]'
          ).length;

          console.log(
            `Scroll ${scrollCount + 1}: Found ${currentResults} results`
          );

          // Check if we got new results
          if (currentResults === lastResultCount) {
            noNewResultsCount++;
            console.log(`No new results (${noNewResultsCount}/5)`);
          } else {
            noNewResultsCount = 0;
            lastResultCount = currentResults;
          }

          scrollCount++;

          // Break if we have enough results or no new content is loading
          if (
            currentResults >= maxResults ||
            (scrollHeightAfter === scrollHeightBefore && noNewResultsCount >= 3)
          ) {
            console.log(
              `Breaking: currentResults=${currentResults}, maxResults=${maxResults}, noNewResultsCount=${noNewResultsCount}`
            );
            break;
          }

          // Look for "Load more" or "Show more results" buttons and click them
          const loadMoreButton = document.querySelector(
            '[data-value="Load more results"], [jsaction*="loadMore"], button[aria-label*="more"]'
          );
          if (loadMoreButton && loadMoreButton.offsetParent !== null) {
            console.log("Clicking load more button...");
            loadMoreButton.click();
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }

          // Additional wait if we're still getting results
          if (currentResults > lastResultCount) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }

        console.log(
          `Final scroll completed. Total results found: ${lastResultCount}`
        );
      }
    }, maxResults);

    await new Promise((resolve) => setTimeout(resolve, 4000));

    console.log("Extracting data with enhanced collection...");

    // Multiple extraction attempts to get all loaded results
    const allBusinesses = [];
    const processedUrls = new Set();
    let extractionAttempt = 1;
    const maxExtractionAttempts = 3;

    while (extractionAttempt <= maxExtractionAttempts) {
      console.log(`\n=== EXTRACTION ATTEMPT ${extractionAttempt} ===`);

      const html = await page.content();
      const $ = cheerio.load(html);

      let attemptResults = 0;

      $("a[href*='/maps/place/']").each((i, el) => {
        if (allBusinesses.length >= maxResults) return false;

        const $el = $(el);
        const href = $el.attr("href");

        if (!href || processedUrls.has(href)) return;
        processedUrls.add(href);

        const $parent = $el.closest("div").parent();

        try {
          const storeName =
            $parent.find("div.fontHeadlineSmall").first().text().trim() ||
            $parent
              .find('[data-value="Directions"]')
              .closest("div")
              .find("div")
              .first()
              .text()
              .trim();

          if (!storeName) return;

          const ratingElement = $parent.find(
            "span.fontBodyMedium > span[aria-label*='stars']"
          );
          const ratingText = ratingElement.attr("aria-label") || "";

          let stars = null;
          let numberOfReviews = null;

          if (ratingText) {
            const starsMatch = ratingText.match(/([0-9.]+)\s*stars/);
            const reviewsMatch = ratingText.match(/([0-9,]+)\s*reviews?/);

            stars = starsMatch ? parseFloat(starsMatch[1]) : null;
            numberOfReviews = reviewsMatch
              ? parseInt(reviewsMatch[1].replace(/,/g, ""))
              : null;
          }

          const bodyDiv = $parent.find("div.fontBodyMedium").first();
          const infoText = bodyDiv.text();
          const infoParts = infoText.split("·").map((part) => part.trim());

          let category = "";
          let address = "";
          let phone = "";

          if (infoParts.length >= 2) {
            category = infoParts[0];
            address = infoParts[1];

            for (let i = 2; i < infoParts.length; i++) {
              if (
                infoParts[i].match(/[\d\s\-\(\)\+]+/) &&
                infoParts[i].length >= 10
              ) {
                phone = infoParts[i];
                break;
              }
            }
          }

          const website =
            $parent.find('a[data-value="Website"]').attr("href") || "";

          const placeIdMatch = href.match(
            /\/maps\/place\/[^\/]+\/data=.*?:([^!]+)/
          );
          const placeId = placeIdMatch
            ? `ChI${placeIdMatch[1]}`
            : href.includes("ChI")
            ? `ChI${href.split("ChI")[1].split("?")[0]}`
            : "";

          const businessData = {
            userId,
            placeId,
            storeName,
            category,
            address,
            phone,
            googleUrl: href.startsWith("http")
              ? href
              : `https://www.google.com${href}`,
            bizWebsite: website,
            stars,
            numberOfReviews,
            ratingText,
            searchKeyword: keyword,
            searchLocation: place,
            scrapedAt: new Date().toISOString(),
            extractionAttempt: extractionAttempt,
          };

          allBusinesses.push(businessData);
          attemptResults++;
        } catch (parseError) {
          console.log("Error parsing business data:", parseError.message);
        }
      });

      console.log(
        `✓ Extraction attempt ${extractionAttempt}: Found ${attemptResults} new results`
      );
      console.log(`✓ Total businesses collected: ${allBusinesses.length}`);

      // If we got new results and haven't reached max, try scrolling more and extract again
      if (
        attemptResults > 0 &&
        allBusinesses.length < maxResults &&
        extractionAttempt < maxExtractionAttempts
      ) {
        console.log("Scrolling more to load additional results...");

        await page.evaluate(async () => {
          const wrapper =
            document.querySelector('div[role="feed"]') ||
            document.querySelector('[role="main"]');
          if (wrapper) {
            // Multiple scrolls with human-like delays
            for (let i = 0; i < 3; i++) {
              wrapper.scrollBy(0, 1200 + Math.random() * 400);
              await new Promise((resolve) =>
                setTimeout(resolve, 2000 + Math.random() * 1000)
              );
            }
          }
        });

        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      extractionAttempt++;

      // If no new results in this attempt, break
      if (attemptResults === 0) {
        console.log("No new results found, stopping extraction attempts");
        break;
      }
    }

    console.log(`\n=== EXTRACTION COMPLETE ===`);
    console.log(`Total extraction attempts: ${extractionAttempt - 1}`);
    console.log(`Final business count: ${allBusinesses.length}`);

    const endTime = Date.now();
    const executionTime = Math.floor((endTime - startTime) / 1000);

    console.log(`Google Maps scraping completed in ${executionTime} seconds`);
    console.log(`Found ${allBusinesses.length} businesses`);

    // Remove duplicates and sort by extraction order
    const uniqueBusinesses = allBusinesses.filter(
      (business, index, self) =>
        index ===
        self.findIndex(
          (b) =>
            b.placeId === business.placeId || b.storeName === business.storeName
        )
    );

    console.log(
      `After deduplication: ${uniqueBusinesses.length} unique businesses`
    );

    return res.status(200).json({
      status: 200,
      message: "Google Maps leads generated successfully.",
      data: uniqueBusinesses,
      metadata: {
        totalResults: uniqueBusinesses.length,
        totalResultsBeforeDedup: allBusinesses.length,
        executionTimeSeconds: executionTime,
        searchKeyword: keyword,
        searchLocation: place,
        source: "GoogleMaps",
        maxResultsRequested: maxResults,
        extractionAttempts: extractionAttempt - 1,
      },
    });
  } catch (error) {
    console.error("Error in searchGoogleMaps:", error.message);
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

module.exports = { searchGoogleMaps };
