const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");

// Add stealth plugin to evade detection
puppeteerExtra.use(StealthPlugin());

// Configuration
const MAX_CONCURRENT_PAGES = 5;
const NAVIGATION_TIMEOUT = 25000;
const RETRY_ATTEMPTS = 2;

// Singleton browser instance
let browserInstance = null;
let pageCount = 0;
const MAX_PAGES_BEFORE_RESTART = 100;

const getBrowserInstance = async () => {
  if (browserInstance && pageCount >= MAX_PAGES_BEFORE_RESTART) {
    console.log(`Browser processed ${pageCount} pages. Restarting to prevent memory leaks...`);
    await closeBrowserInstance();
  }

  if (!browserInstance) {
    console.log("Creating new browser instance for company details...");
    try {
      browserInstance = await puppeteerExtra.launch({
        headless: true, // "new" is the updated headless mode, but true is safer for now
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
        console.log("Browser disconnected.");
        browserInstance = null;
        pageCount = 0;
      });

      pageCount = 0;
    } catch (error) {
      console.error("Failed to launch browser:", error);
      throw error;
    }
  }
  return browserInstance;
};

const closeBrowserInstance = async () => {
  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch (err) {
      console.error("Error closing browser:", err);
    }
    browserInstance = null;
    pageCount = 0;
  }
};

// Helper: Navigate with Retry
const navigateToPage = async (page, url) => {
  let lastError;
  for (let i = 0; i < RETRY_ATTEMPTS; i++) {
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: NAVIGATION_TIMEOUT,
      });
      // Small wait to ensure dynamic content loads
      await new Promise(resolve => setTimeout(resolve, i === 0 ? 1500 : 3000));
      return true;
    } catch (error) {
      console.warn(`Attempt ${i + 1} failed for ${url}: ${error.message}`);
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 1000)); // Cool down
    }
  }
  throw lastError;
};

// Generic Page Extractor
const extractDataFromPage = async (page) => {
  return await page.evaluate(() => {
    const getText = (selector) => {
      const el = document.querySelector(selector);
      return el ? el.innerText.trim() : null;
    };

    const data = {
      emails: [],
      phones: [],
      socialLinks: {},
      address: null,
      description: null
    };

    const bodyText = document.body.innerText;

    // 1. EXTRACT EMAILS
    // Regex for emails 
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    const rawEmails = bodyText.match(emailRegex) || [];

    // Also check mailto links specifically
    document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
      const href = a.getAttribute('href');
      if (href) {
        const email = href.replace('mailto:', '').split('?')[0];
        if (email) rawEmails.push(email);
      }
    });

    const invalidExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.js', '.css', '.woff'];
    data.emails = [...new Set(rawEmails.map(e => e.toLowerCase()))].filter(email => {
      if (email.length > 50 || email.length < 5) return false;
      // Filter out image files mistakenly identifying as emails
      if (invalidExtensions.some(ext => email.endsWith(ext))) return false;
      return true;
    });

    // 2. EXTRACT PHONES
    // Basic US/International phone regex - imperfect but decent
    const phoneRegex = /(?:\+?\d{1,3}[ -]?)?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}/g;
    const rawPhones = bodyText.match(phoneRegex) || [];

    // Check tel: links
    document.querySelectorAll('a[href^="tel:"]').forEach(a => {
      const href = a.getAttribute('href');
      if (href) {
        const phone = href.replace('tel:', '').split('?')[0];
        if (phone) rawPhones.push(phone);
      }
    });

    data.phones = [...new Set(rawPhones.map(p => p.trim()))];

    // 3. EXTRACT SOCIALS
    const socialMap = {
      linkedin: 'linkedin.com',
      facebook: 'facebook.com',
      instagram: 'instagram.com',
      twitter: 'twitter.com',
      youtube: 'youtube.com',
      tiktok: 'tiktok.com'
    };

    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.href.toLowerCase();
      for (const [key, domain] of Object.entries(socialMap)) {
        if (href.includes(domain) && !href.includes('/share')) {
          data.socialLinks[key] = a.href;
        }
      }
    });

    // 4. ADDRESS & DESCRIPTION
    // Heuristic: Look for footers or commonly named classes
    const addressSelectors = ['address', '.address', '.location', '.footer-address', '#contact-address'];
    for (let sel of addressSelectors) {
      const txt = getText(sel);
      if (txt && txt.length > 10 && /\d/.test(txt)) { // Address usually has numbers
        data.address = txt;
        break;
      }
    }

    const descSelectors = ['meta[name="description"]', 'meta[property="og:description"]'];
    for (let sel of descSelectors) {
      const el = document.querySelector(sel);
      if (el && el.content) {
        data.description = el.content;
        break;
      }
    }

    return data;
  });
};

// Helper: Scan page for links matching specific validation keywords
const findLinkByKeywords = async (page, keywords) => {
  return await page.evaluate((kw) => {
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    for (const a of anchors) {
      const href = a.href.toLowerCase();
      const text = a.innerText.toLowerCase();

      // Validation: Must be same domain (mostly) to avoid skipping to social media
      if (!href.startsWith(window.location.origin)) continue;

      if (kw.some(k => href.includes(k) || text.includes(k))) {
        return a.href;
      }
    }
    return null;
  }, keywords);
};

// Extract company details from website
const extractCompanyDetails = async (companyWebsite, companyName) => {
  let page = null;

  // Normalize URL
  if (!companyWebsite.startsWith('http')) {
    companyWebsite = 'http://' + companyWebsite;
  }

  try {
    // console.log(`Extracting company details for: ${companyName} - ${companyWebsite}`);

    const browser = await getBrowserInstance();
    page = await browser.newPage();
    pageCount++;

    // Set realistic headers
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1920, height: 1080 });

    // Block unnecessary resources to speed up
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Navigate to main page
    try {
      await navigateToPage(page, companyWebsite);
    } catch (navError) {
      return {
        companyName,
        website: companyWebsite,
        error: `Navigation failed: ${navError.message}`,
        success: false,
        scrapedAt: new Date().toISOString()
      };
    }

    // Extract Data using page evaluation
    let mainPageData = await extractDataFromPage(page);

    // If we missed emails/phones, try to find "Contact" or "About" pages
    let contactPageData = {};
    let careerPageData = {};

    const contactUrl = await findLinkByKeywords(page, ['contact', 'get in touch', 'support']);
    if (contactUrl) {
      // console.log(`Found Contact page: ${contactUrl}`);
      try {
        await navigateToPage(page, contactUrl);
        contactPageData = await extractDataFromPage(page);
        contactPageData.url = contactUrl;
      } catch (err) { /* ignore contact page errors */ }
    }

    // Attempt to find Career page if requested (we prioritize Contact usually)
    const careerUrl = await findLinkByKeywords(page, ['career', 'job', 'hiring', 'join us']);
    if (careerUrl) {
      // console.log(`Found Career page: ${careerUrl}`);
      try {
        await navigateToPage(page, careerUrl);
        careerPageData = await extractDataFromPage(page);
        careerPageData.url = careerUrl;
      } catch (err) { /* ignore career page errors */ }
    }

    // Merge Data
    // We prioritize Contact Page data for phones/emails, then Main Page
    const mergedData = {
      emails: [...new Set([...(contactPageData.emails || []), ...(mainPageData.emails || []), ...(careerPageData.emails || [])])].slice(0, 5),
      phones: [...new Set([...(contactPageData.phones || []), ...(mainPageData.phones || [])])].slice(0, 3),
      socialLinks: { ...mainPageData.socialLinks, ...contactPageData.socialLinks },
      address: contactPageData.address || mainPageData.address,
      description: mainPageData.description || contactPageData.description,
      companyName,
      website: companyWebsite,
      scrapedAt: new Date().toISOString(),
      success: true,
      subPages: {
        contact: contactUrl || null,
        career: careerUrl || null
      }
    };

    return mergedData;

  } catch (error) {
    console.error(`Fatal error scraping ${companyWebsite}: ${error.message}`);
    return {
      companyName,
      website: companyWebsite,
      error: error.message,
      success: false
    };
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (e) { /* ignore */ }
    }
  }
};


// Main Runner
const extractMultipleCompanyDetails = async (companies, maxConcurrent = 3) => {
  console.log(`Starting extraction for ${companies.length} companies...`);
  const results = [];

  // Custom chunking with safer error handling to process serially-parallel (chunk by chunk)
  // We use chunks to prevent having thousands of pending usage promises if the list is huge
  const chunkSize = maxConcurrent;
  for (let i = 0; i < companies.length; i += chunkSize) {
    const chunk = companies.slice(i, i + chunkSize);
    console.log(`Processing batch ${Math.floor(i / chunkSize) + 1} / ${Math.ceil(companies.length / chunkSize)}`);

    const promises = chunk.map(company => {
      // Handle missing website gracefully
      let url = company.bizWebsite;
      if (!url && company.website) url = company.website; // fallback

      if (!url) {
        return Promise.resolve({
          companyName: company.storeName || company.companyName,
          error: "No Website",
          success: false
        });
      }
      return extractCompanyDetails(url, company.storeName || company.companyName);
    });

    const chunkResults = await Promise.all(promises);
    results.push(...chunkResults);

    // Optional sleep between chunks to be nice
    if (i + chunkSize < companies.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return results;
};

// Process Handlers
process.on("SIGTERM", async () => closeBrowserInstance());
process.on("SIGINT", async () => closeBrowserInstance());

module.exports = {
  extractCompanyDetails,
  extractMultipleCompanyDetails
};