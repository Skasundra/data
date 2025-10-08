const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

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
        "--no-first-run",
        "--window-size=1920,1080",
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

const searchManta = async (req, res) => {
  let page = null;
  const startTime = Date.now();

  try {
    console.log("Manta request received:", JSON.stringify(req.body));
    const { keyword, place, maxResults = 20 } = req.body;
    const userId = req.user?.id || "anonymous";

    if (!keyword || !place) {
      return res.status(400).json({
        status: 400,
        message: "Both 'keyword' and 'place' are required parameters.",
      });
    }

    const allBusinesses = [];
    const processedUrls = new Set();
    let currentPage = 1;
    const maxPages = Math.ceil(maxResults / 15);

    const browser = await getBrowserInstance();

    while (allBusinesses.length < maxResults && currentPage <= maxPages) {
      console.log(`\n=== SCRAPING PAGE ${currentPage} ===`);

      if (page) {
        try {
          await page.close();
        } catch (e) {
          console.log("Error closing page:", e.message);
        }
      }

      page = await browser.newPage();

      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );
      await page.setViewport({ width: 1920, height: 1080 });

      // Parse location
      const locationParts = place.split(",").map((p) => p.trim());
      const city = locationParts[0] || place;
      const state = locationParts[1] || "";

      // Build URL
      const params = new URLSearchParams({
        search: keyword,
        context: "unknown",
        search_source: "nav",
        city: city,
        state: state,
        country: "United States",
        device: "desktop",
        screenResolution: "1280x720",
      });

      if (currentPage > 1) {
        params.append("pg", currentPage.toString());
      }

      const pageUrl = `https://www.manta.com/search?${params.toString()}`;
      console.log(`Navigating to: ${pageUrl}`);

      try {
        await page.goto(pageUrl, {
          waitUntil: "domcontentloaded",
          timeout: 45000,
        });
        console.log("✓ Page loaded");
      } catch (navError) {
        console.log(`✗ Navigation failed: ${navError.message}`);
        break;
      }

      // Wait for content
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Scroll to load lazy content
      await page.evaluate(async () => {
        for (let i = 0; i < 5; i++) {
          window.scrollBy(0, 800);
          await new Promise((r) => setTimeout(r, 500));
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log("Extracting business URLs from search results...");

      // Extract all business profile URLs from the page
      const businessUrls = await page.evaluate(() => {
        const urls = [];
        const links = document.querySelectorAll('a[href*="/company/"]');

        links.forEach((link) => {
          const href = link.href;
          if (
            href &&
            href.includes("/company/") &&
            !href.includes("#") &&
            !urls.includes(href)
          ) {
            urls.push(href);
          }
        });

        return urls;
      });

      console.log(`Found ${businessUrls.length} business URLs on page ${currentPage}`);

      if (businessUrls.length === 0) {
        console.log("⚠️ No business URLs found, saving debug HTML...");
        const fs = require("fs");
        const debugHtml = await page.content();
        fs.writeFileSync(`debug_manta_page_${currentPage}.html`, debugHtml);
        console.log(`Debug HTML saved to: debug_manta_page_${currentPage}.html`);

        // Try to extract any data from search page directly
        const directData = await page.evaluate(() => {
          const results = [];
          const allText = document.body.innerText;

          // Try to find business cards or listings
          const cards = document.querySelectorAll(
            ".card, .search-result, [class*='result'], article, [class*='business'], [class*='company']"
          );

          cards.forEach((card) => {
            const text = card.innerText;
            if (text && text.length > 20) {
              results.push({
                html: card.outerHTML.substring(0, 500),
                text: text.substring(0, 200),
              });
            }
          });

          return {
            cardCount: cards.length,
            samples: results.slice(0, 3),
            bodyLength: allText.length,
            title: document.title,
          };
        });

        console.log("Direct extraction attempt:", JSON.stringify(directData, null, 2));
        break;
      }

      // Visit each business detail page
      let pageResults = 0;
      for (const businessUrl of businessUrls) {
        if (allBusinesses.length >= maxResults) break;
        if (processedUrls.has(businessUrl)) continue;

        processedUrls.add(businessUrl);

        try {
          console.log(`\nVisiting: ${businessUrl}`);

          await page.goto(businessUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });

          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Extract data from detail page
          const businessData = await page.evaluate(() => {
            const getText = (selectors) => {
              for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el && el.innerText.trim()) {
                  return el.innerText.trim();
                }
              }
              return "";
            };

            const getAttr = (selectors, attr) => {
              for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el && el.getAttribute(attr)) {
                  return el.getAttribute(attr);
                }
              }
              return "";
            };

            // Extract business name
            const name =
              getText([
                "h1",
                ".business-name",
                "[class*='business-name']",
                "[class*='company-name']",
              ]) || document.title.split("|")[0].trim();

            // Extract phone
            const phone =
              getText([
                '[class*="phone"]',
                'a[href^="tel:"]',
                '[itemprop="telephone"]',
              ]) ||
              getAttr(['a[href^="tel:"]'], "href").replace("tel:", "");

            // Extract address
            const address = getText([
              '[itemprop="address"]',
              ".address",
              '[class*="address"]',
              '[class*="location"]',
            ]);

            // Extract website
            let website = "";
            const websiteLinks = document.querySelectorAll(
              'a[href*="http"]'
            );
            for (const link of websiteLinks) {
              const href = link.href;
              const text = link.innerText.toLowerCase();
              if (
                (text.includes("website") ||
                  text.includes("visit") ||
                  link.getAttribute("rel") === "nofollow") &&
                !href.includes("manta.com") &&
                !href.includes("facebook") &&
                !href.includes("twitter") &&
                !href.includes("linkedin")
              ) {
                website = href;
                break;
              }
            }

            // Extract category
            const category = getText([
              ".category",
              '[class*="category"]',
              '[class*="industry"]',
            ]);

            // Extract description
            const description = getText([
              '[class*="description"]',
              '[class*="about"]',
              "p",
            ]);

            // Extract email
            const emailMatch = document.body.innerText.match(
              /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
            );
            const email = emailMatch ? emailMatch[0] : "";

            return {
              name,
              phone,
              address,
              website,
              category,
              description: description.substring(0, 300),
              email,
            };
          });

          if (!businessData.name) {
            console.log("⚠️ No business name found, skipping");
            continue;
          }

          const finalData = {
            userId,
            businessId: `manta_${businessData.name
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "_")}`,
            storeName: businessData.name,
            category: businessData.category || "Business",
            address: businessData.address || "",
            phone: businessData.phone || "",
            email: businessData.email || "",
            mantaUrl: businessUrl,
            bizWebsite: businessData.website || "",
            description: businessData.description || "",
            searchKeyword: keyword,
            searchLocation: place,
            scrapedAt: new Date().toISOString(),
            source: "Manta",
            pageNumber: currentPage,
          };

          allBusinesses.push(finalData);
          pageResults++;

          console.log(`✓ Scraped: ${businessData.name} (${pageResults}/${businessUrls.length})`);

          // Small delay between requests
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 + Math.random() * 1000)
          );
        } catch (detailError) {
          console.log(`Error scraping detail page: ${detailError.message}`);
          continue;
        }
      }

      console.log(`✓ Scraped ${pageResults} businesses from page ${currentPage}`);
      console.log(`✓ Total collected: ${allBusinesses.length}`);

      if (pageResults === 0) {
        console.log("No results found, stopping pagination");
        break;
      }

      currentPage++;

      if (currentPage <= maxPages && allBusinesses.length < maxResults) {
        const delayTime = 3000 + Math.random() * 2000;
        console.log(`Waiting ${Math.round(delayTime)}ms before next page...`);
        await new Promise((resolve) => setTimeout(resolve, delayTime));
      }
    }

    console.log(`\n=== SCRAPING COMPLETE ===`);
    console.log(`Total pages: ${currentPage - 1}`);
    console.log(`Total businesses: ${allBusinesses.length}`);

    const endTime = Date.now();
    const executionTime = Math.floor((endTime - startTime) / 1000);

    return res.status(200).json({
      status: 200,
      message: "Manta leads generated successfully.",
      data: allBusinesses,
      metadata: {
        totalResults: allBusinesses.length,
        executionTimeSeconds: executionTime,
        searchKeyword: keyword,
        searchLocation: place,
        source: "Manta",
        pagesScraped: currentPage - 1,
        maxResultsRequested: maxResults,
      },
    });
  } catch (error) {
    console.error("Error in searchManta:", error.message);
    console.error("Stack trace:", error.stack);

    if (error.name === "TimeoutError") {
      return res.status(408).json({
        status: 408,
        message: "Request timeout. Please try again.",
      });
    }

    return res.status(500).json({
      status: 500,
      message: "Service temporarily unavailable.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (e) {
        console.log("Error closing page:", e.message);
      }
    }
  }
};

process.on("SIGTERM", async () => {
  if (browserInstance) await browserInstance.close();
});

process.on("SIGINT", async () => {
  if (browserInstance) await browserInstance.close();
});

module.exports = { searchManta };
