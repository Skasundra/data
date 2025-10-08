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

// Helper function to extract detailed data from individual listing page
const extractDetailedBusinessData = async (page, businessUrl, basicData) => {
  try {
    console.log(`Extracting detailed data for: ${basicData.storeName}`);

    await page.goto(businessUrl, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const detailedData = await page.evaluate(() => {
      const data = {};

      // Extract phone number
      const phoneSelectors = [
        'button[data-item-id*="phone"]',
        'button[aria-label*="Phone"]',
        '[data-tooltip="Copy phone number"]',
        'button[data-item-id*="phone:tel:"]',
      ];
      for (const selector of phoneSelectors) {
        const phoneEl = document.querySelector(selector);
        if (phoneEl) {
          const phoneText =
            phoneEl.getAttribute("data-item-id") || phoneEl.innerText;
          const phoneMatch = phoneText.match(/[\d\s\-\(\)\+]{10,}/);
          if (phoneMatch) {
            data.phone = phoneMatch[0].trim();
            break;
          }
        }
      }

      // Extract website
      const websiteSelectors = [
        'a[data-item-id="authority"]',
        'a[aria-label*="Website"]',
        'a[data-tooltip="Open website"]',
      ];
      for (const selector of websiteSelectors) {
        const websiteEl = document.querySelector(selector);
        if (websiteEl) {
          data.website = websiteEl.href;
          break;
        }
      }

      // Extract full address
      const addressSelectors = [
        'button[data-item-id="address"]',
        'button[aria-label*="Address"]',
        '[data-tooltip="Copy address"]',
      ];
      for (const selector of addressSelectors) {
        const addressEl = document.querySelector(selector);
        if (addressEl) {
          data.fullAddress =
            addressEl.getAttribute("aria-label") || addressEl.innerText;
          break;
        }
      }

      // Extract hours
      const hoursTable = document.querySelector('table[aria-label*="Hours"]');
      if (hoursTable) {
        const hours = {};
        const rows = hoursTable.querySelectorAll("tr");
        rows.forEach((row) => {
          const day = row.querySelector("td:first-child")?.innerText;
          const time = row.querySelector("td:last-child")?.innerText;
          if (day && time) hours[day] = time;
        });
        data.businessHours = hours;
      }

      // Extract rating details
      const ratingEl = document.querySelector('[aria-label*="stars"]');
      if (ratingEl) {
        const ratingText = ratingEl.getAttribute("aria-label");
        const starsMatch = ratingText.match(/([0-9.]+)\s*stars/);
        const reviewsMatch = ratingText.match(/([0-9,]+)\s*reviews?/);
        if (starsMatch) data.stars = parseFloat(starsMatch[1]);
        if (reviewsMatch)
          data.totalReviews = parseInt(reviewsMatch[1].replace(/,/g, ""));
      }

      // Extract category/type
      const categoryEl = document.querySelector('button[jsaction*="category"]');
      if (categoryEl) {
        data.category = categoryEl.innerText.trim();
      }

      // Extract price level
      const priceEl = document.querySelector('[aria-label*="Price"]');
      if (priceEl) {
        data.priceLevel = priceEl.innerText.trim();
      }

      // Extract plus code
      const plusCodeEl = document.querySelector('[data-item-id="oloc"]');
      if (plusCodeEl) {
        data.plusCode = plusCodeEl.innerText.trim();
      }

      // Extract amenities/features
      const amenities = [];
      const amenityElements = document.querySelectorAll(
        '[aria-label*="Amenities"] button, [aria-label*="Accessibility"] button'
      );
      amenityElements.forEach((el) => {
        const text = el.innerText.trim();
        if (text) amenities.push(text);
      });
      if (amenities.length > 0) data.amenities = amenities;

      // Extract service options
      const serviceOptions = [];
      const serviceElements = document.querySelectorAll(
        '[aria-label*="Service options"] button'
      );
      serviceElements.forEach((el) => {
        const text = el.innerText.trim();
        if (text) serviceOptions.push(text);
      });
      if (serviceOptions.length > 0) data.serviceOptions = serviceOptions;

      // Extract popular times if available
      const popularTimesEl = document.querySelector(
        '[aria-label*="Popular times"]'
      );
      if (popularTimesEl) {
        data.hasPopularTimes = true;
      }

      // Extract description/about
      const aboutEl = document.querySelector('[class*="description"]');
      if (aboutEl) {
        data.description = aboutEl.innerText.trim();
      }

      return data;
    });

    return { ...basicData, ...detailedData, detailedScrape: true };
  } catch (error) {
    console.log(`Error extracting detailed data: ${error.message}`);
    return { ...basicData, detailedScrape: false, detailError: error.message };
  }
};

const searchGoogleMaps = async (req, res) => {
  let page = null;
  const startTime = Date.now();

  try {
    console.log("Request received:", JSON.stringify(req.body));
    const {
      keyword,
      place,
      maxResults = 20,
      detailedScrape = false,
    } = req.body;
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
        const maxScrolls = Math.ceil(maxResults / 5) + 5; // More aggressive scrolling
        let noNewResultsCount = 0;
        let consecutiveNoChange = 0;

        while (scrollCount < maxScrolls && consecutiveNoChange < 4) {
          const scrollHeightBefore = wrapper.scrollHeight;

          // More aggressive scroll distance
          const scrollAmount = 1500 + Math.random() * 500;
          wrapper.scrollBy(0, scrollAmount);

          // Shorter wait times for faster scraping
          await new Promise((resolve) =>
            setTimeout(resolve, 1500 + Math.random() * 800)
          );

          const scrollHeightAfter = wrapper.scrollHeight;
          const currentResults = document.querySelectorAll(
            'a[href*="/maps/place/"]'
          ).length;

          console.log(
            `Scroll ${
              scrollCount + 1
            }: Found ${currentResults} results (target: ${maxResults})`
          );

          // Check if we got new results
          if (currentResults === lastResultCount) {
            noNewResultsCount++;
            consecutiveNoChange++;
            console.log(
              `No new results (${noNewResultsCount} times, consecutive: ${consecutiveNoChange})`
            );
          } else {
            noNewResultsCount = 0;
            consecutiveNoChange = 0;
            lastResultCount = currentResults;
          }

          scrollCount++;

          // Look for "Load more" or "Show more results" buttons and click them
          const loadMoreSelectors = [
            '[data-value="Load more results"]',
            '[jsaction*="loadMore"]',
            'button[aria-label*="more"]',
            'button[aria-label*="More"]',
            ".section-loading-spinner",
          ];

          for (const selector of loadMoreSelectors) {
            const loadMoreButton = document.querySelector(selector);
            if (loadMoreButton && loadMoreButton.offsetParent !== null) {
              console.log(`Clicking load more button: ${selector}`);
              loadMoreButton.click();
              await new Promise((resolve) => setTimeout(resolve, 2000));
              break;
            }
          }

          // Break if we have enough results
          if (currentResults >= maxResults) {
            console.log(`✓ Reached target: ${currentResults} >= ${maxResults}`);
            break;
          }

          // If no new content after multiple attempts, try scrolling to bottom
          if (consecutiveNoChange >= 2) {
            console.log("Trying scroll to bottom...");
            wrapper.scrollTo(0, wrapper.scrollHeight);
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }

        console.log(
          `Final scroll completed. Total results found: ${lastResultCount}`
        );
      }
    }, maxResults);

    await new Promise((resolve) => setTimeout(resolve, 3000));

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

        // Try multiple parent container strategies
        let $parent = $el.closest("div[jsaction]");
        if (!$parent.length) $parent = $el.closest("div").parent();
        if (!$parent.length) $parent = $el.parent().parent();

        try {
          // Enhanced store name extraction with multiple fallbacks
          const storeName =
            $parent.find("div.fontHeadlineSmall").first().text().trim() ||
            $parent.find(".fontHeadlineSmall").first().text().trim() ||
            $parent
              .find('[data-value="Directions"]')
              .closest("div")
              .find("div")
              .first()
              .text()
              .trim() ||
            $el.attr("aria-label") ||
            "";

          if (!storeName) return;

          // Enhanced rating extraction
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

          // Enhanced info extraction with better parsing
          const bodyDiv = $parent.find("div.fontBodyMedium").first();
          const infoText = bodyDiv.text();
          const infoParts = infoText.split("·").map((part) => part.trim());

          let category = "";
          let address = "";
          let phone = "";
          let priceLevel = "";
          let hours = "";

          // Parse all info parts
          infoParts.forEach((part, idx) => {
            // Category is usually first
            if (idx === 0 && !part.match(/[\d\s\-\(\)\+]+/)) {
              category = part;
            }
            // Address usually contains street/location info
            else if (part.match(/\d+/) && !part.match(/^[\d\s\-\(\)\+]+$/)) {
              address = part;
            }
            // Phone number detection
            else if (part.match(/[\d\s\-\(\)\+]+/) && part.length >= 10) {
              phone = part;
            }
            // Price level ($ symbols)
            else if (part.match(/^\$+$/)) {
              priceLevel = part;
            }
            // Hours (Open/Closed)
            else if (part.match(/open|closed|opens|closes/i)) {
              hours = part;
            }
          });

          // Extract website with multiple strategies
          const website =
            $parent.find('a[data-value="Website"]').attr("href") ||
            $parent.find('a[data-tooltip="Open website"]').attr("href") ||
            $parent.find('a[aria-label*="Website"]').attr("href") ||
            "";

          // Enhanced place ID extraction
          const placeIdMatch = href.match(
            /\/maps\/place\/[^\/]+\/data=.*?:([^!]+)/
          );
          const placeId = placeIdMatch
            ? `ChI${placeIdMatch[1]}`
            : href.includes("ChI")
            ? `ChI${href.split("ChI")[1].split("?")[0]}`
            : "";

          // Extract additional data from aria-labels and data attributes
          const ariaLabel = $el.attr("aria-label") || "";
          const dataId = $parent.attr("data-result-index") || "";

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
            priceLevel,
            hours,
            ariaLabel,
            resultIndex: dataId,
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
        allBusinesses.length < maxResults &&
        extractionAttempt < maxExtractionAttempts
      ) {
        console.log(
          `Need ${maxResults - allBusinesses.length} more results, scrolling...`
        );

        await page.evaluate(async (needed) => {
          const wrapper =
            document.querySelector('div[role="feed"]') ||
            document.querySelector('[role="main"]');
          if (wrapper) {
            // More aggressive scrolling based on how many results we need
            const scrollIterations = Math.min(Math.ceil(needed / 5), 8);

            for (let i = 0; i < scrollIterations; i++) {
              // Scroll to bottom first
              wrapper.scrollTo(0, wrapper.scrollHeight);
              await new Promise((resolve) => setTimeout(resolve, 1200));

              // Then scroll by chunks
              wrapper.scrollBy(0, 1500 + Math.random() * 500);
              await new Promise((resolve) =>
                setTimeout(resolve, 1500 + Math.random() * 800)
              );

              // Check for load more buttons
              const loadBtn = document.querySelector('[jsaction*="loadMore"]');
              if (loadBtn) {
                loadBtn.click();
                await new Promise((resolve) => setTimeout(resolve, 2000));
              }
            }
          }
        }, maxResults - allBusinesses.length);

        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      extractionAttempt++;

      // If no new results in this attempt and we have at least some results, break
      if (attemptResults === 0 && allBusinesses.length > 0) {
        console.log("No new results found, stopping extraction attempts");
        break;
      }
    }

    console.log(`\n=== EXTRACTION COMPLETE ===`);
    console.log(`Total extraction attempts: ${extractionAttempt - 1}`);
    console.log(`Final business count: ${allBusinesses.length}`);

    // Remove duplicates and sort by extraction order
    let uniqueBusinesses = allBusinesses.filter(
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

    // If detailed scrape is requested, click into each listing
    if (detailedScrape && uniqueBusinesses.length > 0) {
      console.log(`\n=== STARTING DETAILED SCRAPE ===`);
      console.log(
        `Extracting detailed data for ${uniqueBusinesses.length} businesses...`
      );

      const detailedBusinesses = [];
      const maxDetailedScrapes = Math.min(uniqueBusinesses.length, maxResults);

      for (let i = 0; i < maxDetailedScrapes; i++) {
        const business = uniqueBusinesses[i];
        console.log(
          `[${i + 1}/${maxDetailedScrapes}] Processing: ${business.storeName}`
        );

        try {
          const detailedData = await extractDetailedBusinessData(
            page,
            business.googleUrl,
            business
          );
          detailedBusinesses.push(detailedData);

          // Small delay between requests to avoid detection
          if (i < maxDetailedScrapes - 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, 1500 + Math.random() * 1000)
            );
          }
        } catch (error) {
          console.log(
            `Error processing ${business.storeName}: ${error.message}`
          );
          detailedBusinesses.push({ ...business, detailedScrape: false });
        }
      }

      uniqueBusinesses = detailedBusinesses;
      console.log(
        `✓ Detailed scrape completed for ${detailedBusinesses.length} businesses`
      );
    }

    const endTime = Date.now();
    const executionTime = Math.floor((endTime - startTime) / 1000);

    console.log(`Google Maps scraping completed in ${executionTime} seconds`);
    console.log(`Found ${uniqueBusinesses.length} businesses`);

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
        detailedScrapeEnabled: detailedScrape,
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
