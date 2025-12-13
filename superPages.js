const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");

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

const searchSuperPages = async (req, res) => {
  let page = null;
  const startTime = Date.now();

  try {
    console.log("SuperPages request received:", JSON.stringify(req.body));
    const { keyword, place, maxResults = 20 } = req.body;
    const userId = req.user?.id || "anonymous";

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

    const allBusinesses = [];
    const processedNames = new Set();
    let currentPage = 1;
    const maxPages = Math.ceil(maxResults / 20);

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

      await page.setExtraHTTPHeaders({
        "Accept-Language": "en-US,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      });

      // Build URL - SuperPages uses similar structure to Yellow Pages
      const pageUrl =
        currentPage === 1
          ? `https://www.superpages.com/${encodeURIComponent(
            place.toLowerCase().replace(/\s+/g, "-").replace(/,/g, "")
          )}/${encodeURIComponent(
            keyword.toLowerCase().replace(/\s+/g, "-")
          )}`
          : `https://www.superpages.com/${encodeURIComponent(
            place.toLowerCase().replace(/\s+/g, "-").replace(/,/g, "")
          )}/${encodeURIComponent(
            keyword.toLowerCase().replace(/\s+/g, "-")
          )}?page=${currentPage}`;

      console.log(`Navigating to: ${pageUrl}`);

      try {
        await page.goto(pageUrl, {
          waitUntil: "networkidle2",
          timeout: 45000,
        });
        console.log("✓ Navigation successful");
      } catch (navError) {
        console.log(`✗ Navigation failed: ${navError.message}`);
        break;
      }

      // Wait for initial content
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Check for alternative URL format if no results
      const hasResults = await page.evaluate(() => {
        return document.body.innerText.length > 1000;
      });

      if (!hasResults && currentPage === 1) {
        console.log("Trying alternative URL format...");
        // Format 2: Search query format
        const altUrl = `https://www.superpages.com/search?search_terms=${encodeURIComponent(
          keyword
        )}&geo_location_terms=${encodeURIComponent(place)}`;

        console.log(`Navigating to alternative URL: ${altUrl}`);
        await page.goto(altUrl, {
          waitUntil: "networkidle2",
          timeout: 45000,
        });
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      // Scroll to load lazy content
      console.log("Scrolling to load lazy content...");
      await page.evaluate(async () => {
        for (let i = 0; i < 8; i++) {
          window.scrollBy(0, 600);
          await new Promise((r) => setTimeout(r, 800));
        }
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 1000));
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log(`✓ Starting data extraction from page ${currentPage}...`);

      // First try to extract data directly from the page using JavaScript
      const pageData = await page.evaluate(() => {
        const businesses = [];

        // Try multiple selector patterns
        const selectors = [
          ".listing",
          ".business-listing",
          ".result",
          "[data-listing]",
          ".search-result",
          ".srp-listing",
          ".listing-content",
          "[class*='listing']",
          "[class*='business']",
          "article",
          ".info-primary",
          ".info-section",
        ];

        let elements = [];
        for (const selector of selectors) {
          const found = document.querySelectorAll(selector);
          if (found.length > 0) {
            elements = Array.from(found);
            console.log(`Found ${elements.length} with selector: ${selector}`);
            break;
          }
        }

        elements.forEach((el) => {
          try {
            // Extract name
            const nameEl = el.querySelector(
              ".business-name, .listing-name, h2 a, h3 a, .name a, [class*='business-name'], [class*='listing-name']"
            );
            const name = nameEl ? nameEl.innerText.trim() : "";

            // Extract phone
            const phoneEl = el.querySelector(
              ".phone, .business-phone, [class*='phone'], a[href^='tel:']"
            );
            let phone = "";
            if (phoneEl) {
              phone =
                phoneEl.innerText.trim() ||
                phoneEl.getAttribute("href")?.replace("tel:", "") ||
                "";
              // Clean phone number - remove "Call Now" and other text
              phone = phone.replace(/Call Now/gi, "").replace(/Click to Call/gi, "").trim();
            }

            // Extract address
            const addressEl = el.querySelector(
              ".address, .street-address, [class*='address'], .adr"
            );
            const address = addressEl ? addressEl.innerText.trim() : "";

            // Extract website
            const websiteEl = el.querySelector(
              "a[href*='http']:not([href*='superpages.com']):not([href*='facebook']):not([href*='twitter'])"
            );
            const website = websiteEl ? websiteEl.getAttribute("href") : "";

            // Extract category
            const categoryEl = el.querySelector(
              ".categories, .business-categories, [class*='category'], .breadcrumb"
            );
            const category = categoryEl ? categoryEl.innerText.trim() : "";

            // Extract rating
            const ratingEl = el.querySelector(
              "[class*='rating'], [class*='star'], .stars"
            );
            let stars = null;
            let reviews = null;
            if (ratingEl) {
              const ratingText =
                ratingEl.innerText || ratingEl.getAttribute("title") || "";
              const starsMatch = ratingText.match(/(\d+(?:\.\d+)?)/);
              stars = starsMatch ? parseFloat(starsMatch[1]) : null;

              const reviewEl = el.querySelector("[class*='review']");
              if (reviewEl) {
                const reviewMatch = reviewEl.innerText.match(/(\d+)/);
                reviews = reviewMatch ? parseInt(reviewMatch[1]) : null;
              }
            }

            // Extract URL
            const linkEl = el.querySelector("h2 a, h3 a, .business-name a");
            const url = linkEl ? linkEl.getAttribute("href") : "";

            if (name) {
              businesses.push({
                name,
                phone,
                address,
                website,
                category,
                stars,
                reviews,
                url,
              });
            }
          } catch (err) {
            console.log("Error extracting business:", err.message);
          }
        });

        return businesses;
      });

      console.log(`✓ Extracted ${pageData.length} businesses using JavaScript`);

      // Also parse with Cheerio as fallback
      const html = await page.content();
      const $ = cheerio.load(html);

      let pageResults = 0;

      // SuperPages listing selectors
      const businessSelectors = [
        ".listing",
        ".business-listing",
        ".result",
        "[data-listing]",
        ".search-result",
        ".srp-listing",
        ".listing-content",
        "[class*='listing']",
        "article",
        ".info-primary",
        ".info-section",
      ];

      let businessElements = $();
      for (const selector of businessSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          console.log(
            `Found ${elements.length} businesses with Cheerio selector: ${selector}`
          );
          businessElements = elements;
          break;
        }
      }

      // If JavaScript extraction found more results, use that data
      if (pageData.length > businessElements.length) {
        console.log("Using JavaScript-extracted data (more complete)");

        pageData.forEach((business) => {
          if (allBusinesses.length >= maxResults) return;
          if (!business.name || processedNames.has(business.name)) return;

          processedNames.add(business.name);

          const fullUrl =
            business.url && business.url.startsWith("http")
              ? business.url
              : business.url
                ? `https://www.superpages.com${business.url}`
                : "";

          const businessId = `sp_${business.name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "_")}_${place
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "_")}`;

          const businessData = {
            userId,
            businessId,
            storeName: business.name,
            category: business.category || "Business",
            address: business.address || "",
            phone: business.phone || "",
            superPagesUrl: fullUrl,
            bizWebsite: business.website || "",
            stars: business.stars,
            numberOfReviews: business.reviews,
            searchKeyword: keyword,
            searchLocation: place,
            scrapedAt: new Date().toISOString(),
            source: "SuperPages",
            pageNumber: currentPage,
          };

          allBusinesses.push(businessData);
          pageResults++;
        });

        console.log(
          `✓ Added ${pageResults} businesses from JavaScript extraction`
        );
      }

      // Cheerio fallback extraction (if JavaScript didn't get enough)
      if (pageResults === 0) {
        console.log("Falling back to Cheerio extraction...");

        businessElements.each((index, el) => {
          if (allBusinesses.length >= maxResults) return false;

          const $el = $(el);

          try {
            // Extract business name with more selectors
            const nameSelectors = [
              ".business-name",
              ".listing-name",
              "h2 a",
              "h3 a",
              "h4 a",
              ".name a",
              'a[class*="business"]',
              '[class*="business-name"]',
              '[class*="listing-name"]',
              ".profile-name",
              ".company-name",
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

            // Extract phone with more patterns
            const phoneSelectors = [
              ".phone",
              ".business-phone",
              ".tel",
              '[class*="phone"]',
              'a[href^="tel:"]',
              ".contact-phone",
              '[itemprop="telephone"]',
            ];

            let phone = "";
            for (const selector of phoneSelectors) {
              const phoneEl = $el.find(selector).first();
              if (phoneEl.length > 0) {
                let phoneText = phoneEl.text().trim();
                if (!phoneText && phoneEl.attr("href")) {
                  phoneText = phoneEl
                    .attr("href")
                    .replace("tel:", "")
                    .replace(/\D/g, "");
                  if (phoneText.length >= 10) {
                    phoneText = phoneText.replace(
                      /(\d{3})(\d{3})(\d{4})/,
                      "($1) $2-$3"
                    );
                  }
                }
                // Clean phone number - remove "Call Now" and other text
                phoneText = phoneText.replace(/Call Now/gi, "").replace(/Click to Call/gi, "").trim();

                if (phoneText && phoneText.match(/[\d\s\-\(\)\+]{10,}/)) {
                  phone = phoneText;
                  break;
                }
              }
            }

            // Extract address with more selectors
            const addressSelectors = [
              ".address",
              ".street-address",
              '[class*="address"]',
              ".adr",
              '[itemprop="address"]',
              ".location",
              ".business-address",
            ];

            let address = "";
            for (const selector of addressSelectors) {
              const addressEl = $el.find(selector).first();
              if (addressEl.length > 0 && addressEl.text().trim()) {
                address = addressEl.text().trim();
                break;
              }
            }

            // Extract website
            const websiteElement = $el
              .find(
                'a[href*="http"]:not([href*="superpages.com"]):not([href*="facebook"]):not([href*="twitter"]):not([href*="instagram"])'
              )
              .first();
            const website = websiteElement.attr("href") || "";

            // Extract category
            const categorySelectors = [
              ".categories",
              ".business-categories",
              '[class*="category"]',
              ".breadcrumb",
              ".business-type",
            ];

            let category = "";
            for (const selector of categorySelectors) {
              const catEl = $el.find(selector).first();
              if (catEl.length > 0 && catEl.text().trim()) {
                category = catEl.text().trim();
                break;
              }
            }

            // Extract rating
            let stars = null;
            let numberOfReviews = null;

            const ratingElement = $el.find(
              '[class*="rating"], [class*="star"], .stars'
            );
            if (ratingElement.length > 0) {
              const ratingText =
                ratingElement.text() || ratingElement.attr("title") || "";
              const starsMatch = ratingText.match(/(\d+(?:\.\d+)?)/);
              stars = starsMatch ? parseFloat(starsMatch[1]) : null;

              const reviewElement = $el.find(
                '[class*="review"], [class*="count"]'
              );
              const reviewText = reviewElement.text();
              const reviewMatch = reviewText.match(/(\d+)/);
              numberOfReviews = reviewMatch ? parseInt(reviewMatch[1]) : null;
            }

            // Extract SuperPages URL
            const superPagesUrl =
              $el
                .find("h2 a, h3 a, h4 a, .business-name a")
                .first()
                .attr("href") || "";
            const fullSuperPagesUrl = superPagesUrl.startsWith("http")
              ? superPagesUrl
              : superPagesUrl
                ? `https://www.superpages.com${superPagesUrl}`
                : "";

            const businessId = `sp_${storeName
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
              superPagesUrl: fullSuperPagesUrl,
              bizWebsite: website,
              stars,
              numberOfReviews,
              searchKeyword: keyword,
              searchLocation: place,
              scrapedAt: new Date().toISOString(),
              source: "SuperPages",
              pageNumber: currentPage,
            };

            allBusinesses.push(businessData);
            pageResults++;
          } catch (parseError) {
            console.log("Error parsing business data:", parseError.message);
          }
        });

        console.log(`✓ Cheerio extracted ${pageResults} businesses`);
      }

      console.log(`✓ Found ${pageResults} results on page ${currentPage}`);
      console.log(`✓ Total businesses collected: ${allBusinesses.length}`);

      if (pageResults === 0) {
        console.log(`⚠️ No results found on page ${currentPage}`);

        // Debug: Check what's on the page
        const pageDebug = await page.evaluate(() => {
          return {
            title: document.title,
            bodyLength: document.body.innerText.length,
            hasNoResults: document.body.innerText
              .toLowerCase()
              .includes("no results"),
            hasError: document.body.innerText.toLowerCase().includes("error"),
            url: window.location.href,
          };
        });
        console.log("Page debug info:", JSON.stringify(pageDebug, null, 2));

        const fs = require("fs");
        const debugHtml = await page.content();
        fs.writeFileSync(
          `debug_superpages_page_${currentPage}.html`,
          debugHtml
        );
        console.log(
          `Debug HTML saved to: debug_superpages_page_${currentPage}.html`
        );

        // If first page has no results, try one more alternative format
        if (currentPage === 1) {
          console.log("Trying final alternative search format...");
          const finalUrl = `https://www.superpages.com/search?search_terms=${encodeURIComponent(
            keyword
          )}&geo_location_terms=${encodeURIComponent(place)}&page=1`;

          try {
            await page.goto(finalUrl, {
              waitUntil: "networkidle2",
              timeout: 30000,
            });
            await new Promise((resolve) => setTimeout(resolve, 3000));

            // Try extraction one more time
            const retryData = await page.evaluate(() => {
              const businesses = [];
              const allElements = document.querySelectorAll("*");

              allElements.forEach((el) => {
                const text = el.innerText;
                if (text && text.length > 20 && text.length < 500) {
                  const hasPhone = /\(\d{3}\)\s*\d{3}-\d{4}/.test(text);
                  const hasAddress =
                    /\d+\s+\w+\s+(st|street|ave|avenue|rd|road|blvd|boulevard)/i.test(
                      text
                    );

                  if (hasPhone || hasAddress) {
                    const phoneMatch = text.match(
                      /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/
                    );
                    businesses.push({
                      text: text.substring(0, 200),
                      phone: phoneMatch ? phoneMatch[0] : "",
                    });
                  }
                }
              });

              return businesses.slice(0, 5);
            });

            console.log(
              "Retry extraction found:",
              JSON.stringify(retryData, null, 2)
            );
          } catch (retryError) {
            console.log("Retry failed:", retryError.message);
          }
        }

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
      message: "SuperPages leads generated successfully.",
      data: allBusinesses,
      metadata: {
        totalResults: allBusinesses.length,
        executionTimeSeconds: executionTime,
        searchKeyword: keyword,
        searchLocation: place,
        source: "SuperPages",
        pagesScraped: currentPage - 1,
        maxResultsRequested: maxResults,
      },
    });
  } catch (error) {
    console.error("Error in searchSuperPages:", error.message);
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

module.exports = { searchSuperPages };
