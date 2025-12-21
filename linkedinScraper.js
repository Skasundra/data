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

// Configuration
const MAX_WORKERS = 5; // Number of parallel tabs
const DELAY_BETWEEN_BATCHES = 1000; // 1 second between batches

// Browser instance management
let browserInstance = null;
let isLoggedIn = false;

const getBrowserInstance = async () => {
  if (!browserInstance) {
    console.log("Creating new browser instance...");
    browserInstance = await puppeteerExtra.launch({
      headless: false,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--no-first-run",
        "--no-default-browser-check",
        "--window-size=1920,1080",
        "--disable-gpu",
      ],
      executablePath:
        process.env.CHROME_EXECUTABLE_PATH ||
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
      timeout: 60000,
      ignoreHTTPSErrors: true,
    });

    browserInstance.on("disconnected", () => {
      console.log("Browser disconnected");
      browserInstance = null;
      isLoggedIn = false;
    });
  }
  return browserInstance;
};

// Function to login to LinkedIn
const loginToLinkedIn = async (page) => {
  try {
    console.log("🔐 Starting LinkedIn login...");

    await page.goto("https://www.linkedin.com/login", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await new Promise((r) => setTimeout(r, 2000));

    const currentUrl = page.url();
    if (currentUrl.includes("/feed") || currentUrl.includes("/mynetwork")) {
      console.log("✅ Already logged in");
      isLoggedIn = true;
      return true;
    }

    console.log("📝 Filling login form...");

    await page.waitForSelector("#username", { timeout: 10000 });
    await page.type("#username", LINKEDIN_EMAIL, { delay: 30 });
    await new Promise((r) => setTimeout(r, 500));

    await page.waitForSelector("#password", { timeout: 10000 });
    await page.type("#password", LINKEDIN_PASSWORD, { delay: 30 });
    await new Promise((r) => setTimeout(r, 500));

    await page.click('button[type="submit"]');
    console.log("⏳ Waiting for login...");
    await new Promise((r) => setTimeout(r, 6000));

    const postLoginUrl = page.url();
    if (postLoginUrl.includes("checkpoint") || postLoginUrl.includes("challenge")) {
      console.log("⚠️ Security verification required. Waiting 60s...");
      await new Promise((r) => setTimeout(r, 60000));
    }

    console.log("✅ Login successful!");
    isLoggedIn = true;
    return true;
  } catch (error) {
    console.error("❌ Login error:", error.message);
    return false;
  }
};

// Parse CSV file
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

// Parse Excel file
const parseExcelFile = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
};

// Extract website from a single LinkedIn page (optimized for speed)
const extractWebsiteFromPage = async (page, linkedinUrl, index) => {
  try {
    let cleanUrl = linkedinUrl.trim().replace(/\/$/, "");
    const aboutUrl = cleanUrl + "/about/";

    // Fast navigation
    await page.goto(aboutUrl, {
      waitUntil: "domcontentloaded",
      timeout: 25000,
    });

    // Shorter wait
    await new Promise((r) => setTimeout(r, 2500));

    // Quick scroll
    await page.evaluate(() => window.scrollBy(0, 400));
    await new Promise((r) => setTimeout(r, 1000));

    // Extract data
    const data = await page.evaluate(() => {
      const result = { companyName: null, website: null };

      // Get company name
      const h1 = document.querySelector("h1");
      if (h1) result.companyName = h1.innerText.trim();

      // Method 1: dt/dd structure with Website heading
      const allDt = document.querySelectorAll("dt");
      for (const dt of allDt) {
        if ((dt.innerText || "").toLowerCase().includes("website")) {
          const dd = dt.nextElementSibling;
          if (dd && dd.tagName === "DD") {
            const link = dd.querySelector("a");
            if (link && link.href && !link.href.includes("linkedin.com")) {
              result.website = link.href;
              return result;
            }
          }
        }
      }

      // Method 2: data-test-id
      const container = document.querySelector('[data-test-id="about-us__website"]');
      if (container) {
        const link = container.querySelector("a");
        if (link) {
          const text = (link.innerText || "").trim();
          if (text) {
            result.website = text.startsWith("http") ? text : "https://" + text;
            return result;
          }
        }
      }

      // Method 3: tracking control
      const trackingLink = document.querySelector('a[data-tracking-control-name="about_website"]');
      if (trackingLink && trackingLink.href && !trackingLink.href.includes("linkedin.com")) {
        result.website = trackingLink.href;
        return result;
      }

      // Method 4: link-without-visited-state
      const links = document.querySelectorAll("a.link-without-visited-state");
      for (const link of links) {
        if (link.href && !link.href.includes("linkedin.com") && !link.href.includes("tel:") && link.href.startsWith("http")) {
          result.website = link.href;
          return result;
        }
      }

      // Method 5: dl external links
      const dl = document.querySelector("dl");
      if (dl) {
        const dlLinks = dl.querySelectorAll("a");
        for (const link of dlLinks) {
          if (link.href && !link.href.includes("linkedin.com") && !link.href.includes("tel:") && link.href.startsWith("http")) {
            result.website = link.href;
            return result;
          }
        }
      }

      return result;
    });

    // Get company name from URL if not found
    if (!data.companyName) {
      const match = linkedinUrl.match(/\/company\/([^\/\?]+)/);
      if (match) {
        data.companyName = match[1].replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
      }
    }

    return {
      linkedinUrl,
      companyName: data.companyName || "Unknown",
      website: data.website || null,
      success: true,
      websiteFound: !!data.website,
      scrapedAt: new Date().toISOString(),
    };
  } catch (error) {
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

// Process a batch of URLs in parallel using multiple tabs
const processBatch = async (browser, urls, startIndex, onProgress) => {
  const results = [];
  const pages = [];

  try {
    // Create pages for this batch
    for (let i = 0; i < urls.length; i++) {
      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );
      await page.setViewport({ width: 1280, height: 800 });
      page.setDefaultNavigationTimeout(25000);
      pages.push(page);
    }

    // Process all URLs in parallel
    const promises = urls.map((urlData, i) => {
      const globalIndex = startIndex + i;
      return extractWebsiteFromPage(pages[i], urlData.url, globalIndex)
        .then((result) => {
          result.rowIndex = urlData.rowIndex;
          onProgress(globalIndex, result);
          return result;
        });
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
  } finally {
    // Close all pages
    for (const page of pages) {
      try {
        await page.close();
      } catch (e) {}
    }
  }

  return results;
};

// Main LinkedIn scraper function with parallel processing
const scrapeLinkedInCompanies = async (req, res) => {
  let loginPage = null;
  const startTime = Date.now();

  try {
    console.log("\n" + "=".repeat(50));
    console.log("🚀 LinkedIn Parallel Scraper Started");
    console.log("=".repeat(50) + "\n");

    if (!req.file) {
      return res.status(400).json({
        status: 400,
        message: "No file uploaded. Please upload a CSV or Excel file.",
      });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();

    console.log(`📁 File: ${req.file.originalname}`);

    // Parse file
    let fileData = [];
    if (fileExtension === ".csv") {
      fileData = await parseCSVFile(filePath);
    } else if (fileExtension === ".xlsx" || fileExtension === ".xls") {
      fileData = parseExcelFile(filePath);
    } else {
      return res.status(400).json({ status: 400, message: "Unsupported file format." });
    }

    console.log(`📊 Rows: ${fileData.length}`);

    // Extract LinkedIn URLs
    const linkedinUrls = [];
    fileData.forEach((row, index) => {
      for (const key in row) {
        const value = row[key];
        if (typeof value === "string" && value.includes("linkedin.com/company/")) {
          let url = value.trim();
          if (!url.startsWith("http")) url = "https://" + url;
          linkedinUrls.push({ url, rowIndex: index + 1 });
          break;
        }
      }
    });

    if (linkedinUrls.length === 0) {
      return res.status(400).json({ status: 400, message: "No LinkedIn URLs found." });
    }

    const totalUrls = Math.min(linkedinUrls.length, 100);
    console.log(`🔗 URLs to scrape: ${totalUrls}`);
    console.log(`👷 Workers: ${MAX_WORKERS} parallel tabs\n`);

    // Initialize browser
    const browser = await getBrowserInstance();

    // Login first
    if (!isLoggedIn) {
      loginPage = await browser.newPage();
      await loginPage.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );
      const loginSuccess = await loginToLinkedIn(loginPage);
      await loginPage.close();
      loginPage = null;

      if (!loginSuccess) {
        return res.status(401).json({ status: 401, message: "Login failed." });
      }
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Process URLs in batches
    const results = [];
    const urlsToProcess = linkedinUrls.slice(0, totalUrls);
    const batches = [];

    // Split into batches
    for (let i = 0; i < urlsToProcess.length; i += MAX_WORKERS) {
      batches.push(urlsToProcess.slice(i, i + MAX_WORKERS));
    }

    console.log(`📦 Batches: ${batches.length} (${MAX_WORKERS} URLs each)\n`);

    // Progress callback
    const onProgress = (index, result) => {
      const status = result.websiteFound ? "✅" : "⚠️";
      const website = result.website ? result.website.substring(0, 40) : "Not found";
      console.log(`[${index + 1}/${totalUrls}] ${status} ${result.companyName} → ${website}`);
    };

    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const startIndex = i * MAX_WORKERS;

      console.log(`\n📦 Batch ${i + 1}/${batches.length} (${batch.length} URLs)`);

      const batchResults = await processBatch(browser, batch, startIndex, onProgress);
      results.push(...batchResults);

      // Small delay between batches
      if (i < batches.length - 1) {
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES));
      }
    }

    // Cleanup
    try {
      fs.unlinkSync(filePath);
    } catch (e) {}

    const endTime = Date.now();
    const executionTime = Math.floor((endTime - startTime) / 1000);
    const successfulScrapes = results.filter((r) => r.success).length;
    const websitesFound = results.filter((r) => r.websiteFound).length;

    console.log("\n" + "=".repeat(50));
    console.log("✅ SCRAPING COMPLETE");
    console.log("=".repeat(50));
    console.log(`⏱️  Time: ${executionTime}s (${(executionTime / totalUrls).toFixed(1)}s per URL)`);
    console.log(`📊 Processed: ${results.length}`);
    console.log(`✅ Successful: ${successfulScrapes}`);
    console.log(`🌐 Websites: ${websitesFound}`);
    console.log(`⚡ Speed: ${MAX_WORKERS}x parallel`);
    console.log("=".repeat(50) + "\n");

    return res.status(200).json({
      status: 200,
      message: "LinkedIn scraping completed successfully.",
      data: results,
      metadata: {
        totalUrls: linkedinUrls.length,
        processedUrls: results.length,
        successfulScrapes,
        websitesFound,
        executionTimeSeconds: executionTime,
        avgTimePerUrl: (executionTime / totalUrls).toFixed(1),
        parallelWorkers: MAX_WORKERS,
        source: "LinkedIn",
        fileName: req.file.originalname,
      },
    });
  } catch (error) {
    console.error("❌ Error:", error.message);

    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }

    return res.status(500).json({
      status: 500,
      message: "Service error. Please try again.",
      error: error.message,
    });
  } finally {
    if (loginPage) {
      try { await loginPage.close(); } catch (e) {}
    }
  }
};

// Graceful shutdown
process.on("SIGTERM", async () => {
  if (browserInstance) await browserInstance.close();
});

process.on("SIGINT", async () => {
  if (browserInstance) await browserInstance.close();
});

module.exports = { scrapeLinkedInCompanies };