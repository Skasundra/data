const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

// Add stealth plugin to evade detection
puppeteerExtra.use(StealthPlugin());

// Browser instance management
let browserInstance = null;

const getBrowserInstance = async () => {
  if (!browserInstance) {
    console.log("Creating new browser instance for LinkedIn...");
    browserInstance = await puppeteerExtra.launch({
      headless: false, // LinkedIn detection is strong, sometimes visible browser works better
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
        "--disable-extensions-except=/path/to/ublock", // Optional: use uBlock
        "--user-data-dir=" + path.join(require("os").tmpdir(), "chrome-linkedin"), // Persistent session (cross-platform)
      ],
      executablePath:
        process.env.CHROME_EXECUTABLE_PATH ||
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
      timeout: 60000,
      ignoreHTTPSErrors: true,
    });

    browserInstance.on("disconnected", () => {
      console.log("Browser disconnected, resetting instance");
      browserInstance = null;
    });
  }
  return browserInstance;
};

// Function to search for company LinkedIn URL
const searchCompanyLinkedIn = async (page, companyName, location = "") => {
  try {
    console.log(`Searching LinkedIn for: ${companyName}`);
    
    // Search on Google for LinkedIn company page
    const searchQuery = `site:linkedin.com/company "${companyName}" ${location}`;
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
    
    await page.goto(googleUrl, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Extract LinkedIn company URL from search results
    const linkedinUrl = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="linkedin.com/company"]'));
      for (const link of links) {
        const href = link.href;
        if (href.includes('/company/') && !href.includes('/posts') && !href.includes('/jobs')) {
          return href.split('?')[0]; // Remove query parameters
        }
      }
      return null;
    });
    
    return linkedinUrl;
  } catch (error) {
    console.log(`Error searching for ${companyName}: ${error.message}`);
    return null;
  }
};

const attemptAutoLogin = async (page) => {
  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;

  if (!email || !password) {
    console.log("⚠️ Credentials not set in environment variables (LINKEDIN_EMAIL / LINKEDIN_PASSWORD).");
    return false;
  }

  console.log("🚀 Attempting automated login using environment credentials...");

  try {
    // 1. Wait for email field
    await page.waitForSelector('input[type="email"], input[autocomplete="username"], input[id*="username"]', { timeout: 15000 });
    
    // 2. Type email
    await page.focus('input[type="email"], input[autocomplete="username"], input[id*="username"]');
    await page.evaluate(() => {
      const el = document.querySelector('input[type="email"], input[autocomplete="username"], input[id*="username"]');
      if (el) el.value = '';
    });
    await page.type('input[type="email"], input[autocomplete="username"], input[id*="username"]', email, { delay: 50 + Math.random() * 50 });
    await new Promise(r => setTimeout(r, 500 + Math.random() * 500));

    // 3. Type password
    await page.waitForSelector('input[type="password"], input[autocomplete="current-password"]', { timeout: 10000 });
    await page.focus('input[type="password"], input[autocomplete="current-password"]');
    await page.evaluate(() => {
      const el = document.querySelector('input[type="password"], input[autocomplete="current-password"]');
      if (el) el.value = '';
    });
    await page.type('input[type="password"], input[autocomplete="current-password"]', password, { delay: 50 + Math.random() * 50 });
    await new Promise(r => setTimeout(r, 500 + Math.random() * 500));

    // 4. Click Sign In Button
    console.log("Clicking Sign in button...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      const signInBtn = buttons.find(b => {
        const text = b.textContent?.trim() || b.value?.trim() || "";
        return text.toLowerCase() === "sign in" || text.toLowerCase().includes("sign in");
      });
      if (signInBtn) {
        signInBtn.click();
      } else {
        const form = document.querySelector('form');
        if (form) form.submit();
      }
    });

    // 5. Wait for navigation/checkpoint redirect
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    // Check if still needs login
    const stillNeedsLogin = await page.evaluate(() => {
      const url = window.location.href || "";
      const bodyText = document.body.innerText || "";
      if (url.includes("/uas/login") || url.includes("/login") || url.includes("/checkpoint")) {
        return true;
      }
      return document.body.innerText.includes('Sign in') || 
             document.body.innerText.includes('Join LinkedIn') ||
             !!document.querySelector('.authwall') ||
             bodyText.includes('Email or phone');
    });

    if (!stillNeedsLogin) {
      console.log("✅ Automated login succeeded!");
      return true;
    } else {
      console.log("⚠️ Automated login did not bypass login wall (possible CAPTCHA, verification code, or login error).");
      return false;
    }
  } catch (err) {
    console.log(`⚠️ Automated login attempt failed: ${err.message}`);
    return false;
  }
};

// Function to scrape LinkedIn company page details
const scrapeLinkedInCompanyPage = async (page, linkedinUrl, companyData) => {
  try {
    console.log(`Scraping LinkedIn page: ${linkedinUrl}`);
    
    await page.goto(linkedinUrl, { waitUntil: "networkidle2", timeout: 30000 });
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check if we need to handle LinkedIn login/access restrictions
    let needsLogin = await page.evaluate(() => {
      const url = window.location.href || "";
      const bodyText = document.body.innerText || "";
      if (url.includes("/uas/login") || url.includes("/login") || url.includes("/checkpoint")) {
        return true;
      }
      return document.body.innerText.includes('Sign in') || 
             document.body.innerText.includes('Join LinkedIn') ||
             !!document.querySelector('.authwall') ||
             bodyText.includes('Email or phone');
    });
    
    if (needsLogin) {
      console.log("⚠️ LinkedIn requires login - navigating to login page...");
      await page.goto("https://www.linkedin.com/login", { waitUntil: "networkidle2", timeout: 30000 });
      
      let loggedIn = await attemptAutoLogin(page);
      
      if (!loggedIn) {
        console.log("⏳ Automated login unsuccessful or needs manual action. Waiting for manual login (up to 3 minutes)...");
        const startTime = Date.now();
        const maxWaitMs = 180000; // 3 minutes
        
        while (Date.now() - startTime < maxWaitMs) {
          await new Promise(r => setTimeout(r, 5000));
          const stillNeedsLogin = await page.evaluate(() => {
            const url = window.location.href || "";
            const bodyText = document.body.innerText || "";
            if (url.includes("/uas/login") || url.includes("/login") || url.includes("/checkpoint")) {
              return true;
            }
            return document.body.innerText.includes('Sign in') || 
                   document.body.innerText.includes('Join LinkedIn') ||
                   !!document.querySelector('.authwall') ||
                   bodyText.includes('Email or phone');
          });
          
          if (!stillNeedsLogin) {
            loggedIn = true;
            break;
          }
          console.log(`⏳ Waiting for manual login... ${Math.round((maxWaitMs - (Date.now() - startTime)) / 1000)}s remaining.`);
        }
      }
      
      if (loggedIn) {
        console.log("✅ Login successful! Re-navigating to company page...");
        await page.goto(linkedinUrl, { waitUntil: "networkidle2", timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        console.log("❌ Login timed out. Proceeding with limited public data extraction...");
      }
    }
    
    // Extract company details
    const companyDetails = await page.evaluate(() => {
      const data = {};
      
      try {
        // Company name
        const nameSelectors = [
          'h1.org-top-card-summary__title',
          '.org-top-card-summary__title',
          'h1[data-test-id="org-name"]',
          '.top-card-layout__title'
        ];
        
        for (const selector of nameSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            data.linkedinCompanyName = element.textContent.trim();
            break;
          }
        }
        
        // Company tagline/description
        const taglineSelectors = [
          '.org-top-card-summary__tagline',
          '[data-test-id="org-tagline"]',
          '.top-card-layout__headline'
        ];
        
        for (const selector of taglineSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            data.tagline = element.textContent.trim();
            break;
          }
        }
        
        // Industry
        const industrySelectors = [
          '.org-top-card-summary__industry',
          '[data-test-id="org-industry"]',
          '.top-card-layout__headline'
        ];
        
        for (const selector of industrySelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            data.industry = element.textContent.trim();
            break;
          }
        }
        
        // Company size
        const sizeSelectors = [
          '.org-top-card-summary__info-item:contains("employees")',
          '[data-test-id="org-employees"]',
          '.top-card-layout__first-subline'
        ];
        
        const sizeElements = document.querySelectorAll('.org-top-card-summary__info-item, .top-card-layout__first-subline');
        for (const element of sizeElements) {
          const text = element.textContent.toLowerCase();
          if (text.includes('employee') || text.includes('size')) {
            data.companySize = element.textContent.trim();
            break;
          }
        }
        
        // Location/Headquarters
        const locationElements = document.querySelectorAll('.org-top-card-summary__info-item, .top-card-layout__second-subline');
        for (const element of locationElements) {
          const text = element.textContent;
          if (text && !text.toLowerCase().includes('employee') && !text.toLowerCase().includes('industry')) {
            data.headquarters = text.trim();
            break;
          }
        }
        
        // Website
        const websiteSelectors = [
          'a[data-test-id="org-website-url"]',
          '.org-top-card-summary__info-item a[href^="http"]',
          '.top-card-layout__cta a[href^="http"]'
        ];
        
        for (const selector of websiteSelectors) {
          const element = document.querySelector(selector);
          if (element && element.href && !element.href.includes('linkedin.com')) {
            data.website = element.href;
            break;
          }
        }
        
        // Follower count
        const followerSelectors = [
          '.org-top-card-summary__follower-count',
          '[data-test-id="org-followers"]'
        ];
        
        for (const selector of followerSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            data.followers = element.textContent.trim();
            break;
          }
        }
        
        // About section (if available)
        const aboutElement = document.querySelector('.org-about-us__description, .about-us__description');
        if (aboutElement) {
          data.about = aboutElement.textContent.trim();
        }
        
        // Specialties
        const specialtiesElement = document.querySelector('.org-about-us__specialties, .specialties');
        if (specialtiesElement) {
          data.specialties = specialtiesElement.textContent.trim();
        }
        
        // Founded year
        const foundedElements = document.querySelectorAll('.org-about-us__info-item, .about-us__info-item');
        for (const element of foundedElements) {
          const text = element.textContent.toLowerCase();
          if (text.includes('founded')) {
            data.founded = element.textContent.trim();
            break;
          }
        }
        
        // Company type
        const typeElements = document.querySelectorAll('.org-about-us__info-item, .about-us__info-item');
        for (const element of typeElements) {
          const text = element.textContent.toLowerCase();
          if (text.includes('company type') || text.includes('type')) {
            data.companyType = element.textContent.trim();
            break;
          }
        }
        
      } catch (error) {
        console.log('Error extracting company data:', error.message);
      }
      
      return data;
    });
    
    // Combine original company data with LinkedIn data
    const enrichedData = {
      ...companyData,
      ...companyDetails,
      linkedinUrl: linkedinUrl,
      linkedinScrapedAt: new Date().toISOString(),
      linkedinScrapingSuccess: true
    };
    
    console.log(`✓ Successfully scraped: ${companyDetails.linkedinCompanyName || companyData.companyName}`);
    return enrichedData;
    
  } catch (error) {
    console.log(`Error scraping LinkedIn page: ${error.message}`);
    return {
      ...companyData,
      linkedinUrl: linkedinUrl,
      linkedinScrapedAt: new Date().toISOString(),
      linkedinScrapingSuccess: false,
      linkedinError: error.message
    };
  }
};

// Main function to process Excel file and scrape LinkedIn data
const processExcelAndScrapeLinkedIn = async (req, res) => {
  let page = null;
  const startTime = Date.now();
  
  try {
    console.log("LinkedIn scraping request received");
    
    if (!req.file) {
      return res.status(400).json({
        status: 400,
        message: "Excel file is required. Please upload an Excel file."
      });
    }
    
    const { maxResults = 50, delayBetweenRequests = 5000 } = req.body;
    
    // Read Excel file
    console.log("Reading Excel file...");
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const companies = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`Found ${companies.length} companies in Excel file`);
    
    if (companies.length === 0) {
      return res.status(400).json({
        status: 400,
        message: "Excel file is empty or has no valid data."
      });
    }
    
    // Validate required columns
    const firstRow = companies[0];
    const hasCompanyName = firstRow.hasOwnProperty('companyName') || 
                          firstRow.hasOwnProperty('company') || 
                          firstRow.hasOwnProperty('name') ||
                          firstRow.hasOwnProperty('storeName');
    
    if (!hasCompanyName) {
      return res.status(400).json({
        status: 400,
        message: "Excel file must contain a column named 'companyName', 'company', 'name', or 'storeName'."
      });
    }
    
    // Setup browser
    console.log("Setting up browser...");
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
      "Accept-Language": "en-US,en;q=0.9",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Cache-Control": "max-age=0",
    });
    
    const enrichedCompanies = [];
    const processedCount = Math.min(companies.length, maxResults);
    
    console.log(`Starting to process ${processedCount} companies...`);
    
    for (let i = 0; i < processedCount; i++) {
      const company = companies[i];
      
      // Get company name from various possible column names
      const companyName = company.companyName || 
                         company.company || 
                         company.name || 
                         company.storeName || 
                         company.businessName;
      
      const location = company.location || 
                      company.address || 
                      company.city || 
                      company.place || '';
      
      console.log(`\n[${i + 1}/${processedCount}] Processing: ${companyName}`);
      
      try {
        // Step 1: Search for LinkedIn company page
        const linkedinUrl = await searchCompanyLinkedIn(page, companyName, location);
        
        if (!linkedinUrl) {
          console.log(`⚠️ No LinkedIn page found for: ${companyName}`);
          enrichedCompanies.push({
            ...company,
            linkedinUrl: null,
            linkedinScrapingSuccess: false,
            linkedinError: "LinkedIn page not found",
            linkedinScrapedAt: new Date().toISOString()
          });
          continue;
        }
        
        // Step 2: Scrape LinkedIn company page
        const enrichedCompany = await scrapeLinkedInCompanyPage(page, linkedinUrl, company);
        enrichedCompanies.push(enrichedCompany);
        
        // Delay between requests to avoid rate limiting
        if (i < processedCount - 1) {
          console.log(`Waiting ${delayBetweenRequests}ms before next company...`);
          await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
        }
        
      } catch (error) {
        console.log(`Error processing ${companyName}: ${error.message}`);
        enrichedCompanies.push({
          ...company,
          linkedinUrl: null,
          linkedinScrapingSuccess: false,
          linkedinError: error.message,
          linkedinScrapedAt: new Date().toISOString()
        });
      }
    }
    
    // Clean up uploaded file
    try {
      fs.unlinkSync(req.file.path);
    } catch (cleanupError) {
      console.log("Error cleaning up uploaded file:", cleanupError.message);
    }
    
    const endTime = Date.now();
    const executionTime = Math.floor((endTime - startTime) / 1000);
    
    console.log(`\n=== LINKEDIN SCRAPING COMPLETE ===`);
    console.log(`Processed: ${enrichedCompanies.length} companies`);
    console.log(`Execution time: ${executionTime} seconds`);
    
    const successfulScrapes = enrichedCompanies.filter(c => c.linkedinScrapingSuccess).length;
    
    return res.status(200).json({
      status: 200,
      message: "LinkedIn company data enrichment completed successfully.",
      data: enrichedCompanies,
      metadata: {
        totalCompanies: enrichedCompanies.length,
        successfulScrapes: successfulScrapes,
        failedScrapes: enrichedCompanies.length - successfulScrapes,
        executionTimeSeconds: executionTime,
        source: "LinkedIn",
        processedFromExcel: true
      }
    });
    
  } catch (error) {
    console.error("Error in LinkedIn scraping:", error.message);
    console.error("Stack trace:", error.stack);
    
    // Clean up uploaded file on error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.log("Error cleaning up uploaded file:", cleanupError.message);
      }
    }
    
    return res.status(500).json({
      status: 500,
      message: "LinkedIn scraping service temporarily unavailable. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
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

module.exports = { processExcelAndScrapeLinkedIn };