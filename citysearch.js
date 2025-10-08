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

const scrapeDetailPage = async (page, detailUrl) => {
  try {
    console.log(`  → Scraping detail page: ${detailUrl}`);

    await page.goto(detailUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const detailData = await page.evaluate(() => {
      const data = {};

      // Extract email
      const emailEl = document.querySelector('a[href^="mailto:"]');
      data.email = emailEl
        ? emailEl.getAttribute("href").replace("mailto:", "")
        : "";

      // Extract full address
      const addressEl = document.querySelector(
        '[itemprop="address"], .address, .location'
      );
      data.fullAddress = addressEl ? addressEl.innerText.trim() : "";

      // Extract hours
      const hoursEl = document.querySelector(
        '.hours, [class*="hours"], [class*="Hours"]'
      );
      data.hours = hoursEl ? hoursEl.innerText.trim() : "";

      // Extract description
      const descEl = document.querySelector(
        '.description, [class*="description"], .about'
      );
      data.description = descEl ? descEl.innerText.trim() : "";

      // Extract social media links
      data.facebook = "";
      data.twitter = "";
      data.instagram = "";

      const socialLinks = document.querySelectorAll(
        'a[href*="facebook"], a[href*="twitter"], a[href*="instagram"]'
      );
      socialLinks.forEach((link) => {
        const href = link.getAttribute("href");
        if (href.includes("facebook")) data.facebook = href;
        if (href.includes("twitter")) data.twitter = href;
        if (href.includes("instagram")) data.instagram = href;
      });

      // Extract additional phone numbers
      const phoneLinks = document.querySelectorAll('a[href^="tel:"]');
      const phones = [];
      phoneLinks.forEach((link) => {
        const phone = link.getAttribute("href").replace("tel:", "").trim();
        if (phone && !phones.includes(phone)) {
          phones.push(phone);
        }
      });
      data.additionalPhones = phones;

      // Extract years in business
      const yearsEl = document.querySelector(
        '[class*="years"], [class*="established"]'
      );
      data.yearsInBusiness = yearsEl ? yearsEl.innerText.trim() : "";

      // Extract payment methods
      const paymentEl = document.querySelector(
        '[class*="payment"], [class*="accepted"]'
      );
      data.paymentMethods = paymentEl ? paymentEl.innerText.trim() : "";

      return data;
    });

    console.log(`  ✓ Detail page scraped successfully`);
    return detailData;
  } catch (error) {
    console.log(`  ✗ Error scraping detail page: ${error.message}`);
    return {};
  }
};

const searchCitySearch = async (req, res) => {
  let page = null;
  const startTime = Date.now();

  try {
    console.log("CitySearch request received:", JSON.stringify(req.body));
    const {
      keyword,
      place,
      maxResults = 20,
      includeDetails = false,
    } = req.body;
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

      // Build CitySearch URL - uses hyphenated format
      const formattedKeyword = keyword.toLowerCase().replace(/\s+/g, "-");
      const formattedPlace = place; // Keep place as is with comma and space

      const pageUrl =
        currentPage === 1
          ? `https://www.citysearch.com/results?term=${formattedKeyword}&where=${encodeURIComponent(
              formattedPlace
            )}`
          : `https://www.citysearch.com/results?term=${formattedKeyword}&where=${encodeURIComponent(
              formattedPlace
            )}&page=${currentPage}`;

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

      await new Promise((resolve) => setTimeout(resolve, 3000));

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

      // Extract data using JavaScript
      const pageData = await page.evaluate(() => {
        const businesses = [];

        const selectors = [
          ".listing",
          ".business-listing",
          ".result",
          "[data-listing]",
          ".search-result",
          "article",
          "[class*='listing']",
          "[class*='business']",
          "[class*='result']",
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
              ".business-name, .listing-name, h2 a, h3 a, .name a, [class*='business-name'], [class*='listing-name'], [class*='title']"
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
            }

            // Extract address
            const addressEl = el.querySelector(
              ".address, .street-address, [class*='address'], .adr, [itemprop='address']"
            );
            const address = addressEl ? addressEl.innerText.trim() : "";

            // Extract website
            const websiteEl = el.querySelector(
              "a[href*='http']:not([href*='citysearch.com']):not([href*='facebook']):not([href*='twitter'])"
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

            // Extract detail page URL
            const linkEl = el.querySelector(
              "h2 a, h3 a, .business-name a, a[href*='/profile/']"
            );
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

      // Parse with Cheerio as fallback
      const html = await page.content();
      const $ = cheerio.load(html);

      let pageResults = 0;

      const businessSelectors = [
        ".listing",
        ".business-listing",
        ".result",
        "[data-listing]",
        ".search-result",
        "article",
        "[class*='listing']",
        "[class*='business']",
        "[class*='result']",
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

      // Use JavaScript-extracted data if available
      if (pageData.length > 0) {
        console.log("Using JavaScript-extracted data");

        for (const business of pageData) {
          if (allBusinesses.length >= maxResults) break;
          if (!business.name || processedNames.has(business.name)) continue;

          processedNames.add(business.name);

          const fullUrl =
            business.url && business.url.startsWith("http")
              ? business.url
              : business.url
              ? `https://www.citysearch.com${business.url}`
              : "";

          const businessId = `cs_${business.name
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
            citySearchUrl: fullUrl,
            bizWebsite: business.website || "",
            stars: business.stars,
            numberOfReviews: business.reviews,
            searchKeyword: keyword,
            searchLocation: place,
            scrapedAt: new Date().toISOString(),
            source: "CitySearch",
            pageNumber: currentPage,
          };

          // Scrape detail page if requested and URL is available
          if (includeDetails && fullUrl) {
            const detailData = await scrapeDetailPage(page, fullUrl);
            Object.assign(businessData, detailData);
          }

          allBusinesses.push(businessData);
          pageResults++;
        }

        console.log(
          `✓ Added ${pageResults} businesses from JavaScript extraction`
        );
      }

      // Cheerio fallback extraction
      if (pageResults === 0 && businessElements.length > 0) {
        console.log("Falling back to Cheerio extraction...");

        for (let i = 0; i < businessElements.length; i++) {
          if (allBusinesses.length >= maxResults) break;

          const $el = businessElements.eq(i);

          try {
            const nameSelectors = [
              ".business-name",
              ".listing-name",
              "h2 a",
              "h3 a",
              "h4 a",
              ".name a",
              '[class*="business-name"]',
              '[class*="listing-name"]',
              '[class*="title"]',
            ];

            let storeName = "";
            for (const selector of nameSelectors) {
              const nameEl = $el.find(selector).first();
              if (nameEl.length > 0 && nameEl.text().trim()) {
                storeName = nameEl.text().trim();
                break;
              }
            }

            if (!storeName || processedNames.has(storeName)) continue;
            processedNames.add(storeName);

            const phoneSelectors = [
              ".phone",
              ".business-phone",
              ".tel",
              '[class*="phone"]',
              'a[href^="tel:"]',
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
                if (phoneText && phoneText.match(/[\d\s\-\(\)\+]{10,}/)) {
                  phone = phoneText;
                  break;
                }
              }
            }

            const addressSelectors = [
              ".address",
              ".street-address",
              '[class*="address"]',
              ".adr",
              '[itemprop="address"]',
            ];

            let address = "";
            for (const selector of addressSelectors) {
              const addressEl = $el.find(selector).first();
              if (addressEl.length > 0 && addressEl.text().trim()) {
                address = addressEl.text().trim();
                break;
              }
            }

            const websiteElement = $el
              .find(
                'a[href*="http"]:not([href*="citysearch.com"]):not([href*="facebook"]):not([href*="twitter"]):not([href*="instagram"])'
              )
              .first();
            const website = websiteElement.attr("href") || "";

            const categorySelectors = [
              ".categories",
              ".business-categories",
              '[class*="category"]',
              ".breadcrumb",
            ];

            let category = "";
            for (const selector of categorySelectors) {
              const catEl = $el.find(selector).first();
              if (catEl.length > 0 && catEl.text().trim()) {
                category = catEl.text().trim();
                break;
              }
            }

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

            const citySearchUrl =
              $el
                .find(
                  "h2 a, h3 a, h4 a, .business-name a, a[href*='/profile/']"
                )
                .first()
                .attr("href") || "";
            const fullCitySearchUrl = citySearchUrl.startsWith("http")
              ? citySearchUrl
              : citySearchUrl
              ? `https://www.citysearch.com${citySearchUrl}`
              : "";

            const businessId = `cs_${storeName
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
              citySearchUrl: fullCitySearchUrl,
              bizWebsite: website,
              stars,
              numberOfReviews,
              searchKeyword: keyword,
              searchLocation: place,
              scrapedAt: new Date().toISOString(),
              source: "CitySearch",
              pageNumber: currentPage,
            };

            // Scrape detail page if requested and URL is available
            if (includeDetails && fullCitySearchUrl) {
              const detailData = await scrapeDetailPage(
                page,
                fullCitySearchUrl
              );
              Object.assign(businessData, detailData);
            }

            allBusinesses.push(businessData);
            pageResults++;
          } catch (parseError) {
            console.log("Error parsing business data:", parseError.message);
          }
        }

        console.log(`✓ Cheerio extracted ${pageResults} businesses`);
      }

      console.log(`✓ Found ${pageResults} results on page ${currentPage}`);
      console.log(`✓ Total businesses collected: ${allBusinesses.length}`);

      if (pageResults === 0) {
        console.log(`⚠️ No results found on page ${currentPage}`);
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
      message: "CitySearch leads generated successfully.",
      data: allBusinesses,
      metadata: {
        totalResults: allBusinesses.length,
        executionTimeSeconds: executionTime,
        searchKeyword: keyword,
        searchLocation: place,
        source: "CitySearch",
        pagesScraped: currentPage - 1,
        maxResultsRequested: maxResults,
        detailsIncluded: includeDetails,
      },
    });
  } catch (error) {
    console.error("Error in searchCitySearch:", error.message);
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

module.exports = { searchCitySearch };
