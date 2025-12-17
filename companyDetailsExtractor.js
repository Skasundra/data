const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");

// Add stealth plugin to evade detection
puppeteerExtra.use(StealthPlugin());

// Browser instance management (reuse from googleMaps.js)
let browserInstance = null;

const getBrowserInstance = async () => {
  if (!browserInstance) {
    console.log("Creating new browser instance for company details...");
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

// Extract company details from website
const extractCompanyDetails = async (companyWebsite, companyName) => {
  let page = null;
  
  try {
    console.log(`Extracting company details for: ${companyName} - ${companyWebsite}`);
    
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
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    });

    // Navigate to company website
    await page.goto(companyWebsite, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract main page details
    const mainPageData = await page.evaluate(() => {
      const data = {};

      // Extract emails from main page
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const pageText = document.body.innerText;
      const emails = [...new Set(pageText.match(emailRegex) || [])];
      
      // Filter out common non-HR emails
      const filteredEmails = emails.filter(email => 
        !email.includes('noreply') && 
        !email.includes('no-reply') &&
        !email.includes('support') &&
        !email.includes('sales') &&
        email.length < 50
      );

      data.emails = filteredEmails;

      // Look for HR/career related emails specifically
      const hrEmails = emails.filter(email => 
        email.toLowerCase().includes('hr') ||
        email.toLowerCase().includes('career') ||
        email.toLowerCase().includes('jobs') ||
        email.toLowerCase().includes('recruit') ||
        email.toLowerCase().includes('talent')
      );
      data.hrEmails = hrEmails;

      // Extract phone numbers
      const phoneRegex = /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
      const phones = [...new Set(pageText.match(phoneRegex) || [])];
      data.phoneNumbers = phones.slice(0, 3); // Limit to 3 phone numbers

      // Extract company description/about
      const aboutSelectors = [
        'meta[name="description"]',
        'meta[property="og:description"]',
        '.about-us',
        '.company-description',
        '#about',
        '.about-section'
      ];

      for (const selector of aboutSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          data.description = element.getAttribute('content') || element.innerText.trim();
          if (data.description && data.description.length > 50) break;
        }
      }

      // Extract social media links
      const socialLinks = {};
      const socialSelectors = {
        linkedin: 'a[href*="linkedin.com"]',
        facebook: 'a[href*="facebook.com"]',
        twitter: 'a[href*="twitter.com"]',
        instagram: 'a[href*="instagram.com"]'
      };

      Object.entries(socialSelectors).forEach(([platform, selector]) => {
        const element = document.querySelector(selector);
        if (element) {
          socialLinks[platform] = element.href;
        }
      });
      data.socialLinks = socialLinks;

      return data;
    });

    // Look for career/jobs page
    const careerPageData = await findCareerPage(page, companyWebsite);
    
    // Look for contact page
    const contactPageData = await findContactPage(page, companyWebsite);

    return {
      companyName,
      website: companyWebsite,
      ...mainPageData,
      careerPage: careerPageData,
      contactPage: contactPageData,
      scrapedAt: new Date().toISOString(),
      success: true
    };

  } catch (error) {
    console.log(`Error extracting company details for ${companyName}: ${error.message}`);
    return {
      companyName,
      website: companyWebsite,
      error: error.message,
      success: false,
      scrapedAt: new Date().toISOString()
    };
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (closeError) {
        console.log("Error closing page:", closeError.message);
      }
    }
  }
};

// Find career/jobs page
const findCareerPage = async (page, baseUrl) => {
  try {
    console.log("Looking for career page...");
    
    // Common career page patterns
    const careerPatterns = [
      '/careers',
      '/jobs',
      '/career',
      '/employment',
      '/join-us',
      '/work-with-us',
      '/opportunities',
      '/hiring'
    ];

    // Look for career links on current page
    const careerLinks = await page.evaluate((patterns) => {
      const links = [];
      const allLinks = document.querySelectorAll('a[href]');
      
      allLinks.forEach(link => {
        const href = link.href.toLowerCase();
        const text = link.innerText.toLowerCase();
        
        // Check if link matches career patterns
        const matchesPattern = patterns.some(pattern => 
          href.includes(pattern) || text.includes('career') || 
          text.includes('jobs') || text.includes('join us')
        );
        
        if (matchesPattern) {
          links.push({
            url: link.href,
            text: link.innerText.trim()
          });
        }
      });
      
      return links;
    }, careerPatterns);

    if (careerLinks.length > 0) {
      // Visit the first career page found
      const careerUrl = careerLinks[0].url;
      console.log(`Found career page: ${careerUrl}`);
      
      try {
        await page.goto(careerUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        const careerPageDetails = await page.evaluate(() => {
          const data = {};
          
          // Extract job listings
          const jobSelectors = [
            '.job-listing',
            '.position',
            '.opening',
            '.career-item',
            '[class*="job"]',
            '[class*="position"]'
          ];
          
          const jobs = [];
          jobSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
              const title = el.querySelector('h1, h2, h3, h4, .title, .job-title')?.innerText?.trim();
              if (title && title.length > 0) {
                jobs.push({
                  title,
                  description: el.innerText.trim().substring(0, 200)
                });
              }
            });
          });
          
          data.availableJobs = jobs.slice(0, 5); // Limit to 5 jobs
          
          // Extract HR contact info from career page
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
          const pageText = document.body.innerText;
          const emails = [...new Set(pageText.match(emailRegex) || [])];
          
          const hrEmails = emails.filter(email => 
            email.toLowerCase().includes('hr') ||
            email.toLowerCase().includes('career') ||
            email.toLowerCase().includes('jobs') ||
            email.toLowerCase().includes('recruit')
          );
          
          data.careerEmails = hrEmails;
          
          return data;
        });

        return {
          url: careerUrl,
          found: true,
          ...careerPageDetails
        };
      } catch (error) {
        console.log(`Error visiting career page: ${error.message}`);
        return {
          url: careerUrl,
          found: true,
          error: error.message
        };
      }
    }

    return { found: false };
  } catch (error) {
    console.log(`Error finding career page: ${error.message}`);
    return { found: false, error: error.message };
  }
};

// Find contact page
const findContactPage = async (page, baseUrl) => {
  try {
    console.log("Looking for contact page...");
    
    // Look for contact links on current page
    const contactLinks = await page.evaluate(() => {
      const links = [];
      const allLinks = document.querySelectorAll('a[href]');
      
      allLinks.forEach(link => {
        const href = link.href.toLowerCase();
        const text = link.innerText.toLowerCase();
        
        if (href.includes('/contact') || text.includes('contact')) {
          links.push({
            url: link.href,
            text: link.innerText.trim()
          });
        }
      });
      
      return links;
    });

    if (contactLinks.length > 0) {
      const contactUrl = contactLinks[0].url;
      console.log(`Found contact page: ${contactUrl}`);
      
      try {
        await page.goto(contactUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        const contactPageDetails = await page.evaluate(() => {
          const data = {};
          
          // Extract contact emails
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
          const pageText = document.body.innerText;
          const emails = [...new Set(pageText.match(emailRegex) || [])];
          data.contactEmails = emails.slice(0, 5);
          
          // Extract phone numbers
          const phoneRegex = /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
          const phones = [...new Set(pageText.match(phoneRegex) || [])];
          data.contactPhones = phones.slice(0, 3);
          
          // Extract address
          const addressSelectors = [
            '.address',
            '.location',
            '[class*="address"]',
            '[class*="location"]'
          ];
          
          for (const selector of addressSelectors) {
            const element = document.querySelector(selector);
            if (element && element.innerText.trim().length > 10) {
              data.address = element.innerText.trim();
              break;
            }
          }
          
          return data;
        });

        return {
          url: contactUrl,
          found: true,
          ...contactPageDetails
        };
      } catch (error) {
        console.log(`Error visiting contact page: ${error.message}`);
        return {
          url: contactUrl,
          found: true,
          error: error.message
        };
      }
    }

    return { found: false };
  } catch (error) {
    console.log(`Error finding contact page: ${error.message}`);
    return { found: false, error: error.message };
  }
};

// Main function to process multiple companies
const extractMultipleCompanyDetails = async (companies, maxConcurrent = 3) => {
  console.log(`Starting company details extraction for ${companies.length} companies...`);
  
  const results = [];
  const chunks = [];
  
  // Split companies into chunks for concurrent processing
  for (let i = 0; i < companies.length; i += maxConcurrent) {
    chunks.push(companies.slice(i, i + maxConcurrent));
  }
  
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    console.log(`Processing chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} companies)`);
    
    const chunkPromises = chunk.map(async (company) => {
      if (!company.bizWebsite || company.bizWebsite === '') {
        return {
          companyName: company.storeName,
          website: null,
          error: 'No website available',
          success: false
        };
      }
      
      return await extractCompanyDetails(company.bizWebsite, company.storeName);
    });
    
    const chunkResults = await Promise.allSettled(chunkPromises);
    
    chunkResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          companyName: chunk[index].storeName,
          website: chunk[index].bizWebsite,
          error: result.reason.message,
          success: false
        });
      }
    });
    
    // Add delay between chunks to avoid overwhelming servers
    if (chunkIndex < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log(`Company details extraction completed. Processed ${results.length} companies.`);
  return results;
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

module.exports = {
  extractCompanyDetails,
  extractMultipleCompanyDetails
};