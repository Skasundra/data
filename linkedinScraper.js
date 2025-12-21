const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const csv = require("csv-parser");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

// Add stealth plugin to evade detection
puppeteerExtra.use(StealthPlugin());

// LinkedIn credentials
const LINKEDIN_EMAIL = process.env.LINKEDIN_EMAIL || "testingofweb049@gmail.com";
const LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD || "TestingofWeb@049";

// Browser instance management
let browserInstance = null;
let isLoggedIn = false;

const getBrowserInstance = async () => {
  if (!browserInstance) {
    console.log("Creating new browser instance for LinkedIn scraping...");
    browserInstance = await puppeteerExtra.launch({
      headless: false,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
        "--no-first-run",
        "--no-default-browser-check",
        "--window-size=1920,1080",
        "--start-maximized",
        "--disable-gpu",
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
      isLoggedIn = false;
    });
  }
  return browserInstance;
};

// Function to login to LinkedIn
const loginToLinkedIn = async (page) => {
  try {
    console.log("🔐 Starting LinkedIn login process...");

    await page.goto("https://www.linkedin.com/login", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const currentUrl = page.url();
    if (currentUrl.includes("/feed") || currentUrl.includes("/mynetwork")) {
      console.log("✅ Already logged in (detected from URL)");
      isLoggedIn = true;
      return true;
    }

    console.log("📝 Filling login form...");
    console.log(`📧 Email: ${LINKEDIN_EMAIL}`);

    const emailSelector = "#username";
    await page.waitForSelector(emailSelector, { timeout: 10000 });
    await page.click(emailSelector);
    await page.type(emailSelector, LINKEDIN_EMAIL, { delay: 50 });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const passwordSelector = "#password";
    await page.waitForSelector(passwordSelector, { timeout: 10000 });
    await page.click(passwordSelector);
    await page.type(passwordSelector, LINKEDIN_PASSWORD, { delay: 50 });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log("🔘 Clicking login button...");
    const loginButtonSelector = 'button[type="submit"]';
    await page.waitForSelector(loginButtonSelector, { timeout: 10000 });
    await page.click(loginButtonSelector);

    console.log("⏳ Waiting for login to complete...");
    await new Promise((resolve) => setTimeout(resolve, 8000));

    const postLoginUrl = page.url();
    console.log(`📍 Post-login URL: ${postLoginUrl}`);

    if (postLoginUrl.includes("checkpoint") || postLoginUrl.includes("challenge")) {
      console.log("⚠️ Security verification required. Waiting 60 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 60000));
    }

    const finalUrl = page.url();
    if (finalUrl.includes("/feed") || finalUrl.includes("/mynetwork") || finalUrl.includes("/in/")) {
      console.log("✅ LinkedIn login successful!");
      isLoggedIn = true;
      return true;
    }

    console.log("⚠️ Login status uncertain, continuing anyway...");
    isLoggedIn = true;
    return true;
  } catch (error) {
    console.error("❌ Error during LinkedIn login:", error.message);
    return false;
  }
};

// Function to parse CSV file
const parseCSVFile = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
};

// Function to parse Excel file
const parseExcelFile = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
};

// Function to extract company website from LinkedIn page (with retry)
const extractCompanyWebsite = async (page, linkedinUrl, retryCount = 0) => {
  const maxRetries = 2;
  
  try {
    console.log(`🔍 Scraping: ${linkedinUrl}`);

    // Clean the URL and create about page URL
    let cleanUrl = linkedinUrl.trim();
    if (cleanUrl.endsWith("/")) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    
    // Try the about page first
    const aboutUrl = cleanUrl + "/about/";
    
    console.log(`📄 Navigating to: ${aboutUrl}`);

    // Use domcontentloaded instead of networkidle2 for faster loading
    try {
      await page.goto(aboutUrl, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
    } catch (navError) {
      console.log(`⚠️ Navigation issue, trying main page...`);
      // If about page fails, try main company page
      await page.goto(cleanUrl, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
    }

    // Wait for page content to load
    console.log("⏳ Waiting for page content...");
    await new Promise((resolve) => setTimeout(resolve, 4000));

    // Scroll down to load lazy content
    await page.evaluate(() => {
      window.scrollBy(0, 300);
    });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    // Scroll more to trigger any lazy loading
    await page.evaluate(() => {
      window.scrollBy(0, 500);
    });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Wait for dl element to appear (new DOM structure)
    try {
      await page.waitForSelector("dl", { timeout: 5000 });
      console.log("✅ Found dl element");
    } catch (e) {
      console.log("ℹ️ dl element not found, trying other selectors...");
    }

    // Extract data
    const companyData = await page.evaluate(() => {
      const data = {};

      // Get company name
      const h1 = document.querySelector("h1");
      if (h1) {
        data.companyName = h1.innerText.trim();
      }

      // METHOD 1: New DOM structure - Look for dt/dd with "Website" heading
      if (!data.website) {
        const allDt = document.querySelectorAll("dt");
        for (const dt of allDt) {
          const headingText = dt.innerText || dt.textContent;
          if (headingText && headingText.toLowerCase().includes("website")) {
            // Found Website heading, get the next dd element
            const dd = dt.nextElementSibling;
            if (dd && dd.tagName === "DD") {
              const link = dd.querySelector("a");
              if (link) {
                // Get href directly (it's the actual URL like http://uipath.com)
                let url = link.href;
                if (url && !url.includes("linkedin.com")) {
                  data.website = url;
                  data.source = "dt_dd_website";
                  break;
                }
                // Also try text content
                const linkText = link.innerText || link.textContent;
                if (linkText && linkText.trim()) {
                  let textUrl = linkText.trim();
                  if (!textUrl.startsWith("http")) {
                    textUrl = "https://" + textUrl;
                  }
                  data.website = textUrl;
                  data.source = "dt_dd_website_text";
                  break;
                }
              }
            }
          }
        }
      }

      // METHOD 2: Look for h3 with "Website" text
      if (!data.website) {
        const allH3 = document.querySelectorAll("h3");
        for (const h3 of allH3) {
          const headingText = h3.innerText || h3.textContent;
          if (headingText && headingText.toLowerCase().includes("website")) {
            // Find parent dt, then get next dd
            const parentDt = h3.closest("dt");
            if (parentDt) {
              const dd = parentDt.nextElementSibling;
              if (dd && dd.tagName === "DD") {
                const link = dd.querySelector("a");
                if (link) {
                  let url = link.href;
                  if (url && !url.includes("linkedin.com")) {
                    data.website = url;
                    data.source = "h3_website";
                    break;
                  }
                }
              }
            }
          }
        }
      }

      // METHOD 3: data-test-id="about-us__website" (old structure)
      if (!data.website) {
        const websiteContainer = document.querySelector('[data-test-id="about-us__website"]');
        if (websiteContainer) {
          const link = websiteContainer.querySelector("a");
          if (link) {
            const linkText = link.innerText || link.textContent;
            if (linkText && linkText.trim()) {
              let url = linkText.trim().replace(/[\n\r]/g, "").trim();
              if (!url.startsWith("http")) {
                url = "https://" + url;
              }
              data.website = url;
              data.source = "about-us__website";
            }
          }
        }
      }

      // METHOD 4: tracking control name
      if (!data.website) {
        const trackingLink = document.querySelector('a[data-tracking-control-name="about_website"]');
        if (trackingLink) {
          let url = trackingLink.href;
          if (url && !url.includes("linkedin.com")) {
            data.website = url;
            data.source = "tracking_control";
          }
        }
      }

      // METHOD 5: link-without-visited-state class (from your DOM)
      if (!data.website) {
        const links = document.querySelectorAll("a.link-without-visited-state");
        for (const link of links) {
          const href = link.href;
          if (href && !href.includes("linkedin.com") && !href.includes("tel:") && !href.includes("mailto:")) {
            if (href.startsWith("http")) {
              data.website = href;
              data.source = "link-without-visited-state";
              break;
            }
          }
        }
      }

      // METHOD 6: Any external link in dl element
      if (!data.website) {
        const dlElement = document.querySelector("dl");
        if (dlElement) {
          const links = dlElement.querySelectorAll("a");
          for (const link of links) {
            const href = link.href;
            if (href && 
                !href.includes("linkedin.com") && 
                !href.includes("tel:") && 
                !href.includes("mailto:") &&
                href.startsWith("http")) {
              data.website = href;
              data.source = "dl_external_link";
              break;
            }
          }
        }
      }

      // METHOD 7: redirect links
      if (!data.website) {
        const redirectLinks = document.querySelectorAll('a[href*="/redir/redirect"]');
        for (const link of redirectLinks) {
          const href = link.href;
          if (href && href.includes("url=")) {
            const urlMatch = href.match(/url=([^&]+)/);
            if (urlMatch) {
              try {
                const decodedUrl = decodeURIComponent(urlMatch[1]);
                if (decodedUrl && !decodedUrl.includes("linkedin.com")) {
                  data.website = decodedUrl;
                  data.source = "redirect_href";
                  break;
                }
              } catch (e) {}
            }
          }
        }
      }

      return data;
    });

    // Get company name from URL if not found
    if (!companyData.companyName) {
      const match = linkedinUrl.match(/\/company\/([^\/\?]+)/);
      if (match) {
        companyData.companyName = match[1]
          .replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
      }
    }

    console.log(`✅ Company: ${companyData.companyName || "Unknown"}`);
    console.log(`🌐 Website: ${companyData.website || "Not found"}`);
    if (companyData.source) {
      console.log(`📍 Source: ${companyData.source}`);
    }

    return {
      linkedinUrl,
      companyName: companyData.companyName || "Unknown",
      website: companyData.website || null,
      success: true,
      websiteFound: !!companyData.website,
      scrapedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.log(`❌ Error scraping ${linkedinUrl}: ${error.message}`);
    
    // Retry logic
    if (retryCount < maxRetries) {
      console.log(`🔄 Retrying (${retryCount + 1}/${maxRetries})...`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return extractCompanyWebsite(page, linkedinUrl, retryCount + 1);
    }
    
    return {
      linkedinUrl,
      companyName: "Error",
      website: null,
      error: error.message,
      success: false,
      websiteFound: false,
    };
  }
};

// Main LinkedIn scraper function
const scrapeLinkedInCompanies = async (req, res) => {
  let page = null;
  const startTime = Date.now();

  try {
    console.log("\n========================================");
    console.log("LinkedIn scraper request received");
    console.log("========================================\n");

    if (!req.file) {
      return res.status(400).json({
        status: 400,
        message: "No file uploaded. Please upload a CSV or Excel file.",
      });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();

    console.log(`📁 Processing file: ${req.file.originalname}`);

    // Parse the uploaded file
    let fileData = [];
    if (fileExtension === ".csv") {
      fileData = await parseCSVFile(filePath);
    } else if (fileExtension === ".xlsx" || fileExtension === ".xls") {
      fileData = parseExcelFile(filePath);
    } else {
      return res.status(400).json({
        status: 400,
        message: "Unsupported file format. Please upload CSV or Excel file.",
      });
    }

    console.log(`📊 Parsed ${fileData.length} rows from file`);

    // Extract LinkedIn URLs
    const linkedinUrls = [];
    fileData.forEach((row, index) => {
      for (const key in row) {
        const value = row[key];
        if (typeof value === "string" && value.includes("linkedin.com/company/")) {
          let url = value.trim();
          if (!url.startsWith("http")) {
            url = "https://" + url;
          }
          linkedinUrls.push({ url, rowIndex: index + 1 });
          break;
        }
      }
    });

    if (linkedinUrls.length === 0) {
      return res.status(400).json({
        status: 400,
        message: "No LinkedIn company URLs found in the uploaded file.",
      });
    }

    console.log(`🔗 Found ${linkedinUrls.length} LinkedIn URLs to scrape\n`);

    // Initialize browser and page
    const browser = await getBrowserInstance();
    page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1920, height: 1080 });

    // Set default navigation timeout
    page.setDefaultNavigationTimeout(45000);
    page.setDefaultTimeout(30000);

    // LOGIN TO LINKEDIN FIRST
    if (!isLoggedIn) {
      console.log("🔐 Need to login to LinkedIn first...\n");
      const loginSuccess = await loginToLinkedIn(page);
      if (!loginSuccess) {
        return res.status(401).json({
          status: 401,
          message: "Failed to login to LinkedIn. Please check credentials.",
        });
      }
      // Wait after login before starting scraping
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } else {
      console.log("✅ Already logged in to LinkedIn\n");
    }

    // Scrape each LinkedIn URL
    const results = [];
    const maxUrls = Math.min(linkedinUrls.length, 100);

    for (let i = 0; i < maxUrls; i++) {
      const { url, rowIndex } = linkedinUrls[i];

      console.log(`\n[${i + 1}/${maxUrls}] Processing Row ${rowIndex}`);
      console.log("─".repeat(40));

      const result = await extractCompanyWebsite(page, url);
      result.rowIndex = rowIndex;
      results.push(result);

      // Delay between requests (shorter delay for faster processing)
      if (i < maxUrls - 1) {
        const delay = 2000 + Math.random() * 2000; // 2-4 seconds
        console.log(`⏳ Waiting ${Math.round(delay / 1000)}s before next...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Clean up uploaded file
    try {
      fs.unlinkSync(filePath);
    } catch (e) {}

    const endTime = Date.now();
    const executionTime = Math.floor((endTime - startTime) / 1000);

    const successfulScrapes = results.filter((r) => r.success).length;
    const websitesFound = results.filter((r) => r.websiteFound).length;

    console.log("\n========================================");
    console.log("SCRAPING COMPLETE");
    console.log("========================================");
    console.log(`⏱️  Time: ${executionTime} seconds`);
    console.log(`📊 Processed: ${results.length} URLs`);
    console.log(`✅ Successful: ${successfulScrapes}`);
    console.log(`🌐 Websites found: ${websitesFound}`);
    console.log("========================================\n");

    return res.status(200).json({
      status: 200,
      message: "LinkedIn company websites extracted successfully.",
      data: results,
      metadata: {
        totalUrls: linkedinUrls.length,
        processedUrls: results.length,
        successfulScrapes,
        websitesFound,
        executionTimeSeconds: executionTime,
        source: "LinkedIn",
        fileName: req.file.originalname,
      },
    });
  } catch (error) {
    console.error("❌ Error in LinkedIn scraper:", error.message);

    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }

    return res.status(500).json({
      status: 500,
      message: "Service temporarily unavailable. Please try again later.",
      error: error.message,
    });
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (e) {}
    }
  }
};

// Graceful shutdown
process.on("SIGTERM", async () => {
  if (browserInstance) {
    await browserInstance.close();
  }
});

process.on("SIGINT", async () => {
  if (browserInstance) {
    await browserInstance.close();
  }
});

module.exports = { scrapeLinkedInCompanies };