const express = require("express");
const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Setup Stealth Plugin
puppeteerExtra.use(StealthPlugin());

const router = express.Router();

// ─── Logger ──────────────────────────────────────────────────────────────────
const log = {
  info:  (...a) => console.log(`[${new Date().toISOString()}] [HIRING-SCRAPER] [INFO] `, ...a),
  warn:  (...a) => console.warn(`[${new Date().toISOString()}] [HIRING-SCRAPER] [WARN] `, ...a),
  error: (...a) => console.error(`[${new Date().toISOString()}] [HIRING-SCRAPER] [ERROR]`, ...a),
};

// ─── Storage (uploads/ is ignored by nodemon) ────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const JOBS_FILE_PATH = path.join(UPLOADS_DIR, "hiring_scraper_jobs.json");

const readJobs = () => {
  try {
    if (!fs.existsSync(JOBS_FILE_PATH)) return [];
    const data = fs.readFileSync(JOBS_FILE_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    log.warn(`Could not read jobs file: ${error.message}`);
    return [];
  }
};

const writeJobs = (jobs) => {
  try {
    fs.writeFileSync(JOBS_FILE_PATH, JSON.stringify(jobs, null, 2), "utf8");
    return true;
  } catch (error) {
    log.error(`Failed to write jobs: ${error.message}`);
    return false;
  }
};

const addJobLog = (jobId, message) => {
  const jobs = readJobs();
  const job = jobs.find((j) => j.id === jobId);
  if (job) {
    if (!job.logs) job.logs = [];
    const timestamp = new Date().toLocaleTimeString();
    job.logs.push(`[${timestamp}] ${message}`);
    if (job.logs.length > 200) job.logs.shift();
    writeJobs(jobs);
  }
};

const getResultsFilePath = (jobId) => {
  return path.join(UPLOADS_DIR, `hiring_results_${jobId}.json`);
};

const readResults = (jobId) => {
  const filePath = getResultsFilePath(jobId);
  try {
    if (!fs.existsSync(filePath)) return [];
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    log.warn(`Could not read results file for job ${jobId}: ${error.message}`);
    return [];
  }
};

const writeResults = (jobId, results) => {
  const filePath = getResultsFilePath(jobId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(results, null, 2), "utf8");
    return true;
  } catch (error) {
    log.error(`Failed to write results for job ${jobId}: ${error.message}`);
    return false;
  }
};

// ─── Hiring Intent Keywords ──────────────────────────────────────────────────
const HIRING_KEYWORDS = [
  "hiring",
  "we're hiring",
  "we are hiring",
  "looking for",
  "urgent hiring",
  "urgently hiring",
  "join our team",
  "job opening",
  "job openings",
  "vacancy",
  "vacancies",
  "apply now",
  "immediate requirement",
  "immediate joining",
  "walk-in",
  "walk in",
  "openings",
  "urgently required",
  "send your resume",
  "send your cv",
  "drop your cv",
  "drop your resume",
  "share your resume",
  "share your cv",
  "currently hiring",
  "actively hiring",
  "open position",
  "open positions",
  "career opportunity",
  "we need",
  "requirement for",
  "looking to hire",
  "#hiring",
  "#wearehiring",
  "#jobopening",
  "#vacancy",
  "#urgenthiring",
  "#immediatejoiners",
  "#opentowork",
];

// ─── Email Extraction Regex ──────────────────────────────────────────────────
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const extractEmails = (text) => {
  if (!text) return [];
  const matches = text.match(EMAIL_REGEX);
  if (!matches) return [];
  // Filter out common false positives
  const blacklist = ["example.com", "email.com", "domain.com", "yourmail.com", "xyz.com"];
  return [...new Set(matches)].filter(
    (email) => !blacklist.some((bl) => email.toLowerCase().endsWith(`@${bl}`))
  );
};

// ─── Browser Manager (reuses LinkedIn persistent session) ────────────────────
let browserInstance = null;
let browserLock = false;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const getBrowserInstance = async () => {
  while (browserLock) await new Promise((r) => setTimeout(r, 100));

  if (browserInstance) return browserInstance;

  browserLock = true;
  try {
    log.info("Launching browser with LinkedIn persistent session...");
    browserInstance = await puppeteerExtra.launch({
      headless: false,
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
        "--user-data-dir=" + path.join(os.tmpdir(), "chrome-linkedin"), // Persistent session (shared with linkedinScraper.js)
      ],
      executablePath:
        process.env.CHROME_EXECUTABLE_PATH ||
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
      timeout: 60000,
      ignoreHTTPSErrors: true,
    });

    browserInstance.on("disconnected", () => {
      log.warn("Browser disconnected, resetting instance.");
      browserInstance = null;
    });
  } catch (error) {
    log.error("Failed to launch browser:", error);
    throw error;
  } finally {
    browserLock = false;
  }
  return browserInstance;
};

const closeBrowserInstance = async () => {
  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch (err) {
      log.error("Error closing browser:", err);
    }
    browserInstance = null;
  }
};

// ─── Page Setup ──────────────────────────────────────────────────────────────
const setupPage = async (browser) => {
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

  // Block heavy resources to speed things up (but keep scripts for LinkedIn SPA)
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const type = req.resourceType();
    if (type === "image" || type === "font" || type === "media") {
      req.abort();
    } else {
      req.continue();
    }
  });

  return page;
};

// ─── Date Filter Mapping ─────────────────────────────────────────────────────
// LinkedIn uses datePosted=["past-24h"] format (URL-encoded brackets/quotes)
const DATE_FILTER_MAP = {
  "past-24h": "past-24h",
  "past-week": "past-week",
  "past-month": "past-month",
  any: "",
};

// ─── LinkedIn Post Scraping Engine ───────────────────────────────────────────

/**
 * Scrolls the LinkedIn search results feed to load more posts.
 * Returns the number of post elements found after scrolling.
 */
const POST_SELECTORS = '.feed-shared-update-v2, [data-urn*="urn:li:activity"], .occludable-update, .reusable-search__result-container, div[data-chameleon-result-urn], li.reusable-search__result-container, div.update-components-text';

const scrollLinkedInFeed = async (page, maxScrolls, jobId, keyword, signal) => {
  let staleCount = 0;
  let scrollCount = 0;
  let lastPostCount = 0;

  // Get initial post count before scrolling
  lastPostCount = await page.evaluate((sel) => document.querySelectorAll(sel).length, POST_SELECTORS);
  addJobLog(jobId, `[${keyword}] Initial posts on page before scrolling: ${lastPostCount}`);

  for (let i = 0; i < maxScrolls; i++) {
    if (signal?.aborted) {
      throw new Error("Job Cancelled");
    }

    // Try multiple scroll strategies
    await page.evaluate(() => {
      // Strategy 1: Scroll the main window
      window.scrollBy(0, window.innerHeight * 0.85);
      
      // Strategy 2: Also try scrolling the main content container
      // LinkedIn sometimes uses a scrollable div instead of window
      const mainContainer = document.querySelector('.scaffold-layout__main, .scaffold-finite-scroll__content, main[class*="scaffold"]');
      if (mainContainer) {
        mainContainer.scrollTop += 800;
      }
    });
    
    // Wait for content to load (human-like delay) with step-by-step abort checks
    const delay = 2000 + Math.random() * 2000;
    const steps = 8;
    for (let s = 0; s < steps; s++) {
      if (signal?.aborted) throw new Error("Job Cancelled");
      await new Promise(r => setTimeout(r, delay / steps));
    }

    // Try clicking "Show more results" button if present
    await page.evaluate(() => {
      const showMoreBtns = document.querySelectorAll(
        'button.scaffold-finite-scroll__load-button, ' +
        'button[aria-label*="more results"], ' +
        'button.artdeco-button--muted'
      );
      for (const btn of showMoreBtns) {
        const text = (btn.textContent || '').toLowerCase();
        if (text.includes('show more') || text.includes('more results') || text.includes('load more')) {
          btn.click();
          break;
        }
      }
    }).catch(() => {});

    // Check stale by post count (more reliable than page height for SPAs)
    const currentPostCount = await page.evaluate((sel) => document.querySelectorAll(sel).length, POST_SELECTORS);
    const heightChanged = await page.evaluate(() => {
      const h = document.body.scrollHeight;
      window.__lastScrollHeight = window.__lastScrollHeight || h;
      const changed = h !== window.__lastScrollHeight;
      window.__lastScrollHeight = h;
      return changed;
    });

    if (currentPostCount === lastPostCount && !heightChanged) {
      staleCount++;
      // Also try scrolling to absolute bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      if (staleCount >= 5) break;
      
      // Additional wait to let lazy-loaded content appear
      for (let s = 0; s < 5; s++) {
        if (signal?.aborted) throw new Error("Job Cancelled");
        await new Promise(r => setTimeout(r, 600));
      }
    } else {
      staleCount = 0;
      lastPostCount = currentPostCount;
    }
    scrollCount++;

    // Log progress periodically
    if (scrollCount % 3 === 0) {
      addJobLog(jobId, `[${keyword}] Scrolled ${scrollCount} times, ${currentPostCount} posts loaded so far...`);
    }
  }

  // Final post count
  const postCount = await page.evaluate((sel) => document.querySelectorAll(sel).length, POST_SELECTORS);
  return { scrollCount, postCount };
};

/**
 * Expands all "...see more" buttons on the page to reveal full post content.
 */
const expandAllPosts = async (page) => {
  try {
    // Multiple rounds of clicking - LinkedIn may render new "see more" buttons after expanding some
    for (let round = 0; round < 3; round++) {
      const clicked = await page.evaluate(async () => {
        let clickCount = 0;
        // Broad selector for all possible "see more" / "...more" toggle buttons
        const seeMoreButtons = document.querySelectorAll(
          'button[aria-label*="see more"], button[aria-label*="See more"], ' +
          'button.feed-shared-inline-show-more-text__see-more-less-toggle, ' +
          'button[class*="see-more"], span.feed-shared-inline-show-more-text__see-more-less-toggle, ' +
          'button.see-more, a.feed-shared-inline-show-more-text__see-more-less-toggle'
        );
        for (const btn of seeMoreButtons) {
          try {
            // Only click if it looks like "see more" (not "see less")
            const text = (btn.textContent || '').toLowerCase().trim();
            if (text.includes('less')) continue;
            btn.click();
            clickCount++;
            await new Promise((r) => setTimeout(r, 200));
          } catch (e) {
            // ignore individual button click failures
          }
        }

        // Also try clicking any "...more" text links in posts
        const moreLinks = document.querySelectorAll('button:not([aria-label])'); 
        for (const link of moreLinks) {
          try {
            const text = (link.textContent || '').trim().toLowerCase();
            if (text === '…more' || text === '...more' || text === 'more' || text === '…see more' || text === 'see more') {
              link.click();
              clickCount++;
              await new Promise((r) => setTimeout(r, 200));
            }
          } catch (e) {}
        }
        return clickCount;
      });

      // Wait for expanded content to render
      await new Promise((r) => setTimeout(r, 800));
      if (clicked === 0) break; // No more buttons to click
    }
  } catch (e) {
    // Ignore - some posts may not have see more buttons
  }
};

/**
 * Extracts post data from all visible posts on the current page.
 * Returns an array of raw post objects.
 */
const extractPostsFromPage = async (page, searchKeyword) => {
  return page.evaluate((searchKeyword) => {
    const results = [];

    // ─── Collect post containers using multiple selector strategies ───
    // LinkedIn uses different container classes depending on page type
    const containerSet = new Set();
    const selectors = [
      '.feed-shared-update-v2',
      '[data-urn*="urn:li:activity"]',
      '.occludable-update',
      '.reusable-search__result-container',
      'div[data-chameleon-result-urn]',
      'li.reusable-search__result-container',
    ];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach(el => containerSet.add(el));
    }
    const postContainers = Array.from(containerSet);

    for (const container of postContainers) {
      try {
        // ── Extract Post URN / URL ──
        let postUrn = container.getAttribute("data-urn") || "";
        if (!postUrn) {
          const urnElement = container.querySelector("[data-urn]");
          if (urnElement) postUrn = urnElement.getAttribute("data-urn") || "";
        }
        if (!postUrn) {
          // Try data-chameleon-result-urn
          postUrn = container.getAttribute("data-chameleon-result-urn") || "";
        }

        let postUrl = "";
        if (postUrn && postUrn.includes("activity")) {
          // Extract activity ID
          const activityMatch = postUrn.match(/(urn:li:activity:\d+)/);
          if (activityMatch) {
            postUrl = `https://www.linkedin.com/feed/update/${activityMatch[1]}`;
          }
        }
        if (!postUrl) {
          // Try extracting from any link that points to a post
          const activityLinks = container.querySelectorAll(
            'a[href*="/feed/update/"], a[href*="activity"], a[href*="/posts/"]'
          );
          for (const link of activityLinks) {
            const href = link.href || link.getAttribute('href') || '';
            if (href && (href.includes('/feed/update/') || href.includes('/posts/'))) {
              postUrl = href.split("?")[0];
              break;
            }
          }
        }

        // ── Extract Post Content ──
        let postContent = "";
        // Try specific content selectors first (ordered by likelihood)
        const textSelectors = [
          '.feed-shared-update-v2__description',
          '.feed-shared-text',
          '.feed-shared-text-view',
          '.update-components-text',
          'div.feed-shared-update-v2__description-wrapper',
          '[class*="feed-shared-text"]',
          '[class*="update-components-text"]',
          '.break-words',
          '.entity-result__summary',
          'span[dir="ltr"]',
        ];
        for (const sel of textSelectors) {
          const textEls = container.querySelectorAll(sel);
          for (const textEl of textEls) {
            const text = textEl.textContent?.trim() || '';
            // Only use if it's substantial content (not just a name or small label)
            if (text.length > 40) {
              postContent = text;
              break;
            }
          }
          if (postContent) break;
        }

        // Fallback: Look for the largest text block in the container
        if (!postContent) {
          const allDivs = container.querySelectorAll('div, span, p');
          let longestText = '';
          for (const div of allDivs) {
            // Only consider leaf-ish nodes (avoid grabbing entire container text)
            if (div.children.length < 5) {
              const t = div.textContent?.trim() || '';
              if (t.length > longestText.length && t.length > 50) {
                longestText = t;
              }
            }
          }
          if (longestText) postContent = longestText;
        }

        // Last resort fallback
        if (!postContent) {
          postContent = container.textContent?.trim()?.slice(0, 3000) || "";
        }

        if (!postContent || postContent.length < 20) continue; // Skip near-empty posts

        // ── Extract Poster / Author Name ──
        let posterName = "";
        let posterHeadline = "";
        const actorSelectors = [
          '.feed-shared-actor__name',
          '.update-components-actor__name',
          '[class*="update-components-actor"] span[dir="ltr"]',
          '.entity-result__title-text a',
          '.entity-result__title-text',
          '[class*="actor"] .t-bold',
          'span.feed-shared-actor__name',
          // LinkedIn sometimes uses a link with the poster name
          'a[class*="app-aware-link"] span[dir="ltr"]',
        ];
        for (const sel of actorSelectors) {
          const el = container.querySelector(sel);
          if (el && el.textContent?.trim()) {
            const name = el.textContent.trim().split('\n')[0].trim();
            // Filter out obviously non-name text
            if (name.length > 1 && name.length < 100) {
              posterName = name;
              break;
            }
          }
        }

        // Headline / subtitle
        const headlineSelectors = [
          '.feed-shared-actor__description',
          '.update-components-actor__description',
          '.entity-result__primary-subtitle',
          '[class*="actor__description"]',
          '.feed-shared-actor__supplementary-actor-info',
        ];
        for (const sel of headlineSelectors) {
          const el = container.querySelector(sel);
          if (el && el.textContent?.trim()) {
            posterHeadline = el.textContent.trim().split('\n').map(l => l.trim()).filter(Boolean).join(' ');
            break;
          }
        }

        // ── Extract Company Name ──
        let companyName = "";
        const companySelectors = [
          '.feed-shared-actor__sub-description',
          '.update-components-actor__sub-description',
          '[class*="actor__sub-description"]',
          '.entity-result__secondary-subtitle',
        ];
        for (const sel of companySelectors) {
          const el = container.querySelector(sel);
          if (el && el.textContent?.trim()) {
            companyName = el.textContent.trim().split('\n').map(l => l.trim()).filter(Boolean).join(' ');
            break;
          }
        }
        // Try to extract company from headline text
        if (!companyName && posterHeadline) {
          const atMatch = posterHeadline.match(/(?:at|@|,)\s+(.+?)(?:\s*[|·•\-]|$)/i);
          if (atMatch) companyName = atMatch[1].trim();
        }
        // Also try from post content for "Company:" pattern
        if (!companyName && postContent) {
          const compMatch = postContent.match(/(?:company|organization|org)\s*[:\-]\s*(.{3,60}?)(?:[\n,.|]|$)/i);
          if (compMatch) companyName = compMatch[1].trim();
        }

        // ── Extract Posted Date / Time ──
        let postedDate = "";
        // First try <time> elements
        const timeEl = container.querySelector('time');
        if (timeEl) {
          postedDate = timeEl.getAttribute('datetime') || timeEl.textContent?.trim() || '';
        }
        if (!postedDate) {
          // Try sub-description elements that typically contain "1d", "2h", "3w" etc.
          const subDescSelectors = [
            '.feed-shared-actor__sub-description',
            '.update-components-actor__sub-description',
            '[class*="actor__sub-description"] span',
            '.entity-result__badge-text',
          ];
          for (const sel of subDescSelectors) {
            const els = container.querySelectorAll(sel);
            for (const el of els) {
              const text = el.textContent?.trim() || '';
              // Match relative time patterns like "1d", "2h", "3w", "1mo"
              if (/^\d+[hdwmo]+$/i.test(text) || /\d+\s*(hour|day|week|month|min)/i.test(text) || text.includes('ago')) {
                postedDate = text;
                break;
              }
            }
            if (postedDate) break;
          }
        }

        results.push({
          postUrl,
          postContent: postContent.slice(0, 5000),
          posterName,
          posterHeadline: posterHeadline.slice(0, 300),
          companyName,
          postedDate,
          searchKeyword,
        });
      } catch (e) {
        // Skip individual post extraction errors
        continue;
      }
    }

    return results;
  }, searchKeyword);
};

/**
 * Checks if the current page is a LinkedIn login/authwall page.
 */
const checkAuthwall = async (page) => {
  return page.evaluate(() => {
    const url = window.location.href || '';

    // ── URL-based login detection (most reliable) ──
    // Only flag login/authwall URLs, NOT the main feed or search
    if (
      url.includes('/uas/login') ||
      url.includes('/checkpoint/') ||
      url.includes('/authwall')
    ) {
      return true;
    }
    // /login page specifically (but not /login-something or /in/login-name)
    if (/\/login\/?(?:\?|$)/.test(url)) {
      return true;
    }

    // ── DOM-based detection ──
    // Check for authwall overlay
    if (document.querySelector('.authwall, .auth-wall')) return true;

    // Check for the main login form (email + password fields on screen)
    const emailInput = document.querySelector('input#username, input[name="session_key"], input[autocomplete="username"]');
    const passwordInput = document.querySelector('input#password, input[name="session_password"], input[type="password"]');
    if (emailInput && passwordInput) return true;

    // Check if the nav bar is missing (logged-in pages always have global-nav)
    const globalNav = document.querySelector('.global-nav, #global-nav, nav[class*="global-nav"]');
    // If the page has loaded and there's no global nav, likely auth-walled
    // But only if the page has content (not still loading)
    if (!globalNav && document.body.innerText.length > 100) {
      // Double-check: does the page have a "Join LinkedIn" or login form?
      const bodyText = document.body.innerText || '';
      if (
        (bodyText.includes('Join LinkedIn') || bodyText.includes('Email or phone')) &&
        bodyText.includes('Sign in')
      ) {
        return true;
      }
    }

    return false;
  });
};

/**
 * Waits for the user to manually log in to LinkedIn.
 * Polls every 5 seconds for up to 3 minutes.
 * Returns true if login succeeded, false if timed out.
 */
const waitForManualLogin = async (page, jobId, maxWaitMs = 180000) => {
  const startTime = Date.now();
  const pollInterval = 5000; // 5 seconds

  addJobLog(jobId, "🔐 LinkedIn login required! Please log in manually in the Chrome browser window that just opened.");
  addJobLog(jobId, "⏳ Waiting for you to complete login (up to 3 minutes)...");
  log.info("Waiting for manual LinkedIn login...");

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const stillNeedsLogin = await checkAuthwall(page);
    if (!stillNeedsLogin) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      addJobLog(jobId, `✅ LinkedIn login successful! (took ${elapsed}s) Continuing with scraping...`);
      log.info(`LinkedIn login completed after ${elapsed}s.`);
      return true;
    }

    const remaining = Math.round((maxWaitMs - (Date.now() - startTime)) / 1000);
    if (remaining > 0 && remaining % 30 === 0) {
      addJobLog(jobId, `⏳ Still waiting for login... ${remaining}s remaining. Please log in in the browser window.`);
    }
  }

  addJobLog(jobId, "❌ Login timed out after 3 minutes. Please log in to LinkedIn and try again.");
  log.warn("LinkedIn login timed out.");
  return false;
};

/**
 * Automatically inputs the email and password and attempts to log in.
 * Falls back to manual login if auto-login fails or CAPTCHA/Checkpoint appears.
 */
const attemptAutoLogin = async (page, jobId) => {
  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;

  if (!email || !password) {
    addJobLog(jobId, "⚠️ Credentials not set in environment variables (LINKEDIN_EMAIL / LINKEDIN_PASSWORD).");
    return false;
  }

  addJobLog(jobId, "🚀 Attempting automated login using environment credentials...");
  log.info("Attempting automated login...");

  try {
    // 1. Wait for the email/username field  
    // LinkedIn login page uses input#username and input#password
    const emailSelector = 'input#username, input[name="session_key"], input[autocomplete="username"]';
    await page.waitForSelector(emailSelector, { visible: true, timeout: 15000 });
    await new Promise(r => setTimeout(r, 800 + Math.random() * 500));

    // 2. Clear field via evaluate, then type with page.type (avoids ElementHandle click issues)
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) { el.value = ''; el.focus(); }
    }, emailSelector);
    await new Promise(r => setTimeout(r, 300));
    await page.type(emailSelector, email, { delay: 40 + Math.random() * 60 });
    await new Promise(r => setTimeout(r, 600 + Math.random() * 400));

    // 3. Clear and type password
    const passSelector = 'input#password, input[name="session_password"], input[type="password"]';
    await page.waitForSelector(passSelector, { visible: true, timeout: 10000 });
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) { el.value = ''; el.focus(); }
    }, passSelector);
    await new Promise(r => setTimeout(r, 300));
    await page.type(passSelector, password, { delay: 40 + Math.random() * 60 });
    await new Promise(r => setTimeout(r, 600 + Math.random() * 400));

    // 4. Click Sign In Button
    addJobLog(jobId, "Clicking Sign in button...");
    // LinkedIn login page uses a submit button with specific selectors
    const signInClicked = await page.evaluate(() => {
      // Try the most specific selectors first
      const btn = document.querySelector(
        'button[type="submit"], button[data-litms-control-urn="login-submit"], button.btn__primary--large'
      );
      if (btn) { btn.click(); return true; }

      // Fall back to text matching
      const buttons = Array.from(document.querySelectorAll('button'));
      const signInBtn = buttons.find(b => {
        const text = (b.textContent || '').trim().toLowerCase();
        return text === 'sign in' || text === 'log in';
      });
      if (signInBtn) { signInBtn.click(); return true; }

      // Last resort: submit the form
      const form = document.querySelector('form.login__form, form[action*="login"], form');
      if (form) { form.submit(); return true; }

      return false;
    });

    if (!signInClicked) {
      addJobLog(jobId, "⚠️ Could not find Sign In button.");
      return false;
    }

    // 5. Wait for navigation after login submit
    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    // 6. Check for checkpoint/verification page
    const currentUrl = page.url();
    if (currentUrl.includes('/checkpoint/')) {
      addJobLog(jobId, "⚠️ LinkedIn requires verification (CAPTCHA or email/phone code). Please complete it in the browser.");
      log.warn("Checkpoint detected after login attempt.");
      return false;
    }

    // 7. Check if actually logged in now
    const stillNeedsLogin = await checkAuthwall(page);
    if (!stillNeedsLogin) {
      addJobLog(jobId, "✅ Automated login succeeded!");
      log.info("Automated login succeeded.");
      return true;
    } else {
      addJobLog(jobId, "⚠️ Automated login did not bypass login wall (possible CAPTCHA, verification code, or login error).");
      log.warn("Automated login incomplete. Wall still present.");
      return false;
    }
  } catch (err) {
    addJobLog(jobId, `⚠️ Automated login attempt failed: ${err.message}`);
    log.error(`Auto login error: ${err.message}`);
    return false;
  }
};

/**
 * Ensures the browser is logged in to LinkedIn before scraping.
 * If not logged in, navigates to LinkedIn and waits for manual login.
 */
const ensureLinkedInLogin = async (page, jobId) => {
  addJobLog(jobId, "🔍 Checking LinkedIn session...");

  // Navigate to LinkedIn feed to check if already logged in via persistent session
  try {
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 30000 });
  } catch (navErr) {
    log.warn(`Feed navigation error (may be redirected): ${navErr.message}`);
  }
  await new Promise((r) => setTimeout(r, 4000));

  // Check current URL - if redirected to login, we need to authenticate
  const currentUrl = page.url();
  log.info(`After feed navigation, URL is: ${currentUrl}`);

  const needsLogin = await checkAuthwall(page);
  if (!needsLogin) {
    addJobLog(jobId, "✅ LinkedIn session is active. Ready to scrape!");
    return true;
  }

  // Navigate to login page explicitly
  addJobLog(jobId, "⚠️ Not logged in. Opening LinkedIn login page...");
  try {
    await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  } catch (navErr) {
    log.warn(`Login page navigation error: ${navErr.message}`);
  }
  await new Promise((r) => setTimeout(r, 3000));

  // Try auto-login first
  const autoLoginSuccess = await attemptAutoLogin(page, jobId);
  if (autoLoginSuccess) {
    // Verify by navigating to feed again
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 3000));
    const verified = !(await checkAuthwall(page));
    if (verified) {
      addJobLog(jobId, "✅ Login verified – LinkedIn feed is accessible.");
      return true;
    }
    addJobLog(jobId, "⚠️ Login appeared successful but verification failed. Falling back to manual login.");
  }

  // Fallback to manual login
  return waitForManualLogin(page, jobId);
};

/**
 * Main scraping function for a single keyword.
 * Searches LinkedIn, scrolls feed, filters hiring posts, extracts data.
 */
const scrapeKeyword = async (jobId, keyword, maxPages, dateFilter, signal) => {
  const browser = await getBrowserInstance();
  const page = await setupPage(browser);

  try {
    if (signal?.aborted) throw new Error("Job Cancelled");

    // ─── Build search URL matching LinkedIn's actual URL format ───
    // Reference: https://www.linkedin.com/search/results/content/?keywords=Mern%20stack%20hiring&origin=FACETED_SEARCH&sortBy=%5B%22date_posted%22%5D
    const encodedKeyword = encodeURIComponent(keyword);

    // Start with base URL + origin parameter
    let searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodedKeyword}`;

    // Add date filter if specified (LinkedIn format: datePosted=["past-24h"])
    const timeParam = DATE_FILTER_MAP[dateFilter];
    if (timeParam) {
      searchUrl += `&origin=FACETED_SEARCH`;
      searchUrl += `&datePosted=${encodeURIComponent(JSON.stringify([timeParam]))}`;
      // Also sort by date when filtering by date
      searchUrl += `&sortBy=${encodeURIComponent(JSON.stringify(["date_posted"]))}`;
    } else {
      searchUrl += `&origin=SWITCH_SEARCH_VERTICAL`;
      searchUrl += `&sortBy=${encodeURIComponent(JSON.stringify(["date_posted"]))}`;
    }

    addJobLog(jobId, `[${keyword}] Navigating to LinkedIn search...`);
    log.info(`[${keyword}] Navigating to: ${searchUrl}`);

    if (signal?.aborted) throw new Error("Job Cancelled");
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    
    // Wait for the LinkedIn SPA to fully render. domcontentloaded fires early;
    // LinkedIn needs time to hydrate React components and fetch search results.
    addJobLog(jobId, `[${keyword}] Page loaded (DOM ready). Waiting for LinkedIn SPA to render results...`);
    
    // Wait up to 15s for search results to appear, polling every 1s
    let spaReady = false;
    for (let attempt = 0; attempt < 15; attempt++) {
      if (signal?.aborted) throw new Error("Job Cancelled");
      await new Promise((r) => setTimeout(r, 1000));
      
      const pageState = await page.evaluate((postSel) => {
        const url = window.location.href;
        const postCount = document.querySelectorAll(postSel).length;
        const hasScaffold = !!document.querySelector('.scaffold-layout, .scaffold-finite-scroll, .search-results-container');
        const hasGlobalNav = !!document.querySelector('.global-nav, #global-nav, nav[class*="global-nav"]');
        const bodyLen = (document.body.innerText || '').length;
        return { url, postCount, hasScaffold, hasGlobalNav, bodyLen };
      }, POST_SELECTORS);

      if (attempt === 2) {
        addJobLog(jobId, `[${keyword}] SPA state: posts=${pageState.postCount}, scaffold=${pageState.hasScaffold}, nav=${pageState.hasGlobalNav}, bodyChars=${pageState.bodyLen}`);
      }

      if (pageState.postCount > 0) {
        addJobLog(jobId, `[${keyword}] ✅ Found ${pageState.postCount} post elements after ${attempt + 1}s wait.`);
        spaReady = true;
        break;
      }
      
      // If scaffold layout loaded but no posts yet, keep waiting
      if (pageState.hasScaffold || pageState.hasGlobalNav) {
        continue;
      }
    }

    // Check for authwall if SPA didn't render posts
    if (!spaReady) {
      const needsLogin = await checkAuthwall(page);
      if (needsLogin) {
        if (signal?.aborted) throw new Error("Job Cancelled");
        addJobLog(jobId, `[${keyword}] ⚠️ LinkedIn login page detected. Attempting automated/manual login...`);
        const loggedIn = await attemptAutoLogin(page, jobId).then(res => res || waitForManualLogin(page, jobId));
        if (!loggedIn) {
          addJobLog(jobId, `[${keyword}] ❌ Cannot proceed without login. Skipping keyword.`);
          return [];
        }
        if (signal?.aborted) throw new Error("Job Cancelled");
        // After login, re-navigate to the search URL
        addJobLog(jobId, `[${keyword}] Re-navigating to search after login...`);
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
        
        // Wait again for SPA to render after re-navigation
        for (let attempt = 0; attempt < 15; attempt++) {
          if (signal?.aborted) throw new Error("Job Cancelled");
          await new Promise((r) => setTimeout(r, 1000));
          const postCount = await page.evaluate((sel) => document.querySelectorAll(sel).length, POST_SELECTORS);
          if (postCount > 0) {
            addJobLog(jobId, `[${keyword}] ✅ Found ${postCount} post elements after re-navigation.`);
            break;
          }
        }
      } else {
        // Not an auth issue — maybe no results or page took too long
        // Log diagnostic info
        const diagInfo = await page.evaluate(() => {
          const url = window.location.href;
          const title = document.title;
          const bodySnippet = (document.body.innerText || '').slice(0, 500);
          // Log all unique tag+class combos to help identify the right selectors
          const allClasses = new Set();
          document.querySelectorAll('div[class], li[class], section[class]').forEach(el => {
            const cls = el.className;
            if (typeof cls === 'string' && cls.length < 150) allClasses.add(el.tagName + '.' + cls.split(' ')[0]);
          });
          return { url, title, bodySnippet, sampleClasses: Array.from(allClasses).slice(0, 30) };
        });
        addJobLog(jobId, `[${keyword}] ⚠️ No posts found on page. URL: ${diagInfo.url}`);
        addJobLog(jobId, `[${keyword}] Page title: ${diagInfo.title}`);
        addJobLog(jobId, `[${keyword}] DOM classes sample: ${diagInfo.sampleClasses.join(', ')}`);
        log.warn(`[${keyword}] No posts - body snippet: ${diagInfo.bodySnippet.slice(0, 200)}`);
      }
    }

    if (signal?.aborted) throw new Error("Job Cancelled");
    
    // Final count before scrolling
    const initialPostCount = await page.evaluate((sel) => document.querySelectorAll(sel).length, POST_SELECTORS);
    addJobLog(jobId, `[${keyword}] Starting scroll phase with ${initialPostCount} initial posts. Max scrolls: ${maxPages * 5}`);

    // Scroll to load more posts
    const maxScrolls = maxPages * 5;
    const scrollResult = await scrollLinkedInFeed(page, maxScrolls, jobId, keyword, signal);
    
    if (signal?.aborted) throw new Error("Job Cancelled");
    addJobLog(
      jobId,
      `[${keyword}] Scrolled ${scrollResult.scrollCount} times. Found ${scrollResult.postCount} post elements.`
    );

    if (scrollResult.postCount === 0) {
      addJobLog(jobId, `[${keyword}] No posts found for this keyword.`);
      return [];
    }

    // Expand "see more" on all posts
    addJobLog(jobId, `[${keyword}] Expanding truncated posts...`);
    await expandAllPosts(page);

    // Extract raw post data from DOM
    addJobLog(jobId, `[${keyword}] Extracting post data...`);
    const rawPosts = await extractPostsFromPage(page, keyword);
    addJobLog(jobId, `[${keyword}] Extracted ${rawPosts.length} raw posts. Filtering for hiring intent...`);

    // Filter posts for hiring intent
    const hiringPosts = [];
    for (const post of rawPosts) {
      const contentLower = post.postContent.toLowerCase();

      // Check if post contains any hiring keywords
      const matchedKeywords = HIRING_KEYWORDS.filter((hk) => contentLower.includes(hk.toLowerCase()));

      if (matchedKeywords.length === 0) continue; // Not a hiring post

      // Extract emails from post content
      const emails = extractEmails(post.postContent);

      // Attempt to extract a specific job position from the post
      let jobPosition = keyword; // Default to search keyword
      // Try to find more specific position in the post
      const positionPatterns = [
        /(?:hiring|looking for|need|required?)\s*(?:a|an)?\s*(.{5,60}?)(?:\.|,|\n|$)/i,
        /position\s*:\s*(.{5,60}?)(?:\.|,|\n|$)/i,
        /role\s*:\s*(.{5,60}?)(?:\.|,|\n|$)/i,
        /(?:job\s+)?title\s*:\s*(.{5,60}?)(?:\.|,|\n|$)/i,
        /opening\s+(?:for|of)\s*(?:a|an)?\s*(.{5,60}?)(?:\.|,|\n|$)/i,
      ];
      for (const pattern of positionPatterns) {
        const match = post.postContent.match(pattern);
        if (match && match[1] && match[1].trim().length > 3) {
          jobPosition = match[1].trim();
          break;
        }
      }

      hiringPosts.push({
        id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        jobPosition,
        companyName: post.companyName || "Not specified",
        hiringEmail: emails.length > 0 ? emails.join(", ") : "Not found in post",
        postContent: post.postContent,
        postUrl: post.postUrl || "URL not available",
        postedDate: post.postedDate || "Not available",
        posterName: post.posterName || "Unknown",
        posterHeadline: post.posterHeadline || "",
        matchedKeywords: matchedKeywords,
        searchKeyword: keyword,
        scrapedAt: new Date().toISOString(),
      });
    }

    addJobLog(
      jobId,
      `[${keyword}] ✅ Found ${hiringPosts.length} hiring posts out of ${rawPosts.length} total posts.`
    );
    log.info(`[${keyword}] Found ${hiringPosts.length} hiring posts.`);

    return hiringPosts;
  } catch (error) {
    log.error(`[${keyword}] Scraping error: ${error.message}`);
    addJobLog(jobId, `[${keyword}] ❌ Error: ${error.message}`);
    return [];
  } finally {
    await page.close().catch(() => {});
    // Human-like delay between keyword searches with abort checks
    const delay = 3000 + Math.random() * 5000;
    const steps = 15;
    for (let s = 0; s < steps; s++) {
      if (signal?.aborted) break; // Don't throw inside finally, just exit fast
      await new Promise((r) => setTimeout(r, delay / steps));
    }
  }
};

// ─── Job Execution Queue ─────────────────────────────────────────────────────
const activeJobs = new Map();

const executeJob = async (jobId) => {
  const abortController = new AbortController();
  activeJobs.set(jobId, abortController);

  const jobs = readJobs();
  const job = jobs.find((j) => j.id === jobId);
  if (!job) {
    activeJobs.delete(jobId);
    return;
  }

  job.status = "Running";
  job.startedAt = new Date().toISOString();
  job.logs = [];
  writeJobs(jobs);

  addJobLog(jobId, `Job "${job.name}" started. Processing ${job.keywords.length} keyword(s).`);

  const allResults = [];
  const existingUrls = new Set(); // For deduplication

  try {
    // 🔍 Pre-check and ensure active LinkedIn login session
    const browser = await getBrowserInstance();
    const loginPage = await setupPage(browser);
    try {
      const loggedIn = await ensureLinkedInLogin(loginPage, jobId);
      if (!loggedIn) {
        throw new Error("LinkedIn authentication failed or timed out.");
      }
    } finally {
      await loginPage.close().catch(() => {});
    }

    for (let i = 0; i < job.keywords.length; i++) {
      // Check for cancellation
      if (abortController.signal.aborted) {
        throw new Error("Job Cancelled");
      }
      const currentJobs = readJobs();
      const currentJob = currentJobs.find((j) => j.id === jobId);
      if (currentJob && currentJob.status === "Cancelled") {
        throw new Error("Job Cancelled");
      }

      const keyword = job.keywords[i];

      addJobLog(jobId, `─── Processing keyword ${i + 1}/${job.keywords.length}: "${keyword}" ───`);

      // Update keyword status
      const kwJobs = readJobs();
      const kwJob = kwJobs.find((j) => j.id === jobId);
      if (kwJob && kwJob.keywordStatuses) {
        kwJob.keywordStatuses[i] = { keyword, status: "Running", resultCount: 0 };
        writeJobs(kwJobs);
      }

      let retries = 0;
      const MAX_RETRIES = 2;
      let keywordResults = [];

      while (retries <= MAX_RETRIES) {
        try {
          keywordResults = await scrapeKeyword(jobId, keyword, job.maxPages, job.dateFilter, abortController.signal);
          break;
        } catch (err) {
          if (err.message === "Job Cancelled" || abortController.signal.aborted) {
            throw new Error("Job Cancelled");
          }
          retries++;
          addJobLog(jobId, `[${keyword}] Attempt ${retries} failed: ${err.message}`);
          if (retries > MAX_RETRIES) {
            addJobLog(jobId, `[${keyword}] ❌ All retries exhausted. Skipping keyword.`);
          } else {
            const delay = 3000 * retries;
            const steps = 10 * retries;
            for (let s = 0; s < steps; s++) {
              if (abortController.signal.aborted) throw new Error("Job Cancelled");
              await new Promise((r) => setTimeout(r, delay / steps));
            }
          }
        }
      }

      // Deduplicate against existing results
      const newResults = keywordResults.filter((post) => {
        if (!post.postUrl || post.postUrl === "URL not available") return true;
        if (existingUrls.has(post.postUrl)) {
          return false;
        }
        existingUrls.add(post.postUrl);
        return true;
      });

      allResults.push(...newResults);
      writeResults(jobId, allResults);

      // Update keyword status
      const statusJobs = readJobs();
      const statusJob = statusJobs.find((j) => j.id === jobId);
      if (statusJob && statusJob.keywordStatuses) {
        statusJob.keywordStatuses[i] = {
          keyword,
          status: "Completed",
          resultCount: newResults.length,
        };
        statusJob.totalResults = allResults.length;
        writeJobs(statusJobs);
      }

      addJobLog(
        jobId,
        `[${keyword}] Completed. ${newResults.length} unique hiring posts added. Total so far: ${allResults.length}`
      );
    }

    // Finalize job
    const finalJobs = readJobs();
    const finalJob = finalJobs.find((j) => j.id === jobId);
    if (finalJob) {
      if (abortController.signal.aborted || finalJob.status === "Cancelled") {
        finalJob.status = "Cancelled";
        addJobLog(jobId, "Job was cancelled by user.");
      } else {
        finalJob.status = "Completed";
        finalJob.totalResults = allResults.length;
        addJobLog(
          jobId,
          `✅ Job completed successfully. Total hiring posts found: ${allResults.length}`
        );
      }
      finalJob.completedAt = new Date().toISOString();
      writeJobs(finalJobs);
    }
  } catch (error) {
    log.error(`Critical error executing job ${jobId}: ${error.message}`);
    const currentJobs = readJobs();
    const finalJob = currentJobs.find((j) => j.id === jobId);
    if (finalJob) {
      finalJob.status = error.message === "Job Cancelled" ? "Cancelled" : "Failed";
      finalJob.error = error.message;
      finalJob.totalResults = allResults.length;
      finalJob.completedAt = new Date().toISOString();
      addJobLog(jobId, `Job ended with status: ${finalJob.status}. Reason: ${error.message}`);
      writeJobs(currentJobs);
    }
  } finally {
    activeJobs.delete(jobId);
  }
};

// ─── API Routes ──────────────────────────────────────────────────────────────

// 1. Create a new scraping job
router.post("/jobs", async (req, res) => {
  try {
    const { name, keywords, maxPages = 5, dateFilter = "past-week" } = req.body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res
        .status(400)
        .json({ status: 400, message: "At least one keyword is required." });
    }

    // Sanitize
    const sanitizedKeywords = keywords
      .map((k) => String(k).trim().slice(0, 150))
      .filter((k) => k.length > 0);

    if (sanitizedKeywords.length === 0) {
      return res
        .status(400)
        .json({ status: 400, message: "Keyword list is empty after validation." });
    }

    const newJob = {
      id: `hjob_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: (name || `Hiring Search ${new Date().toLocaleDateString()}`).trim().slice(0, 100),
      status: "Pending",
      keywords: sanitizedKeywords,
      maxPages: Math.min(Math.max(parseInt(maxPages, 10) || 5, 1), 20),
      dateFilter: Object.keys(DATE_FILTER_MAP).includes(dateFilter) ? dateFilter : "past-week",
      keywordStatuses: sanitizedKeywords.map((kw) => ({
        keyword: kw,
        status: "Pending",
        resultCount: 0,
      })),
      totalResults: 0,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      error: null,
      logs: [],
    };

    const jobs = readJobs();
    jobs.unshift(newJob);
    writeJobs(jobs);

    // Execute in background
    executeJob(newJob.id);

    return res.status(201).json({
      status: 201,
      message: "Hiring post scraping job started successfully.",
      data: newJob,
    });
  } catch (error) {
    log.error("Failed to create scraping job:", error.message);
    return res.status(400).json({ status: 400, message: error.message });
  }
});

// 2. List all jobs
router.get("/jobs", (req, res) => {
  const jobs = readJobs();
  return res.json({ status: 200, data: jobs });
});

// 3. Get job status + logs
router.get("/jobs/:jobId", (req, res) => {
  const { jobId } = req.params;
  const jobs = readJobs();
  const job = jobs.find((j) => j.id === jobId);
  if (!job) {
    return res.status(404).json({ status: 404, message: "Job not found." });
  }
  return res.json({ status: 200, data: job });
});

// 4. Get job results
router.get("/jobs/:jobId/results", (req, res) => {
  const { jobId } = req.params;
  const jobs = readJobs();
  const job = jobs.find((j) => j.id === jobId);
  if (!job) {
    return res.status(404).json({ status: 404, message: "Job not found." });
  }

  const results = readResults(jobId);
  return res.json({
    status: 200,
    metadata: {
      jobId: job.id,
      name: job.name,
      status: job.status,
      totalKeywords: job.keywords.length,
      totalResults: results.length,
    },
    data: results,
  });
});

// 5. Cancel running / Delete completed job
router.delete("/jobs/:jobId", (req, res) => {
  const { jobId } = req.params;
  const jobs = readJobs();
  const jobIndex = jobs.findIndex((j) => j.id === jobId);
  if (jobIndex === -1) {
    return res.status(404).json({ status: 404, message: "Job not found." });
  }

  const job = jobs[jobIndex];

  // Abort running execution if any
  const controller = activeJobs.get(jobId);
  if (controller) {
    controller.abort();
    activeJobs.delete(jobId);
  }

  // Update status to Cancelled if still running
  if (["Pending", "Running"].includes(job.status)) {
    job.status = "Cancelled";
    job.completedAt = new Date().toISOString();
    if (job.keywordStatuses) {
      job.keywordStatuses.forEach((ks) => {
        if (["Pending", "Running"].includes(ks.status)) {
          ks.status = "Cancelled";
        }
      });
    }
    writeJobs(jobs);
    return res.json({
      status: 200,
      message: "Job cancellation requested.",
      data: job,
    });
  }

  // If already finished, delete job + result files
  jobs.splice(jobIndex, 1);
  writeJobs(jobs);

  const resultsPath = getResultsFilePath(jobId);
  if (fs.existsSync(resultsPath)) {
    try {
      fs.unlinkSync(resultsPath);
    } catch (e) {
      log.error(`Failed to delete results file: ${e.message}`);
    }
  }

  return res.json({ status: 200, message: "Job deleted successfully." });
});

module.exports = { hiringPostRouter: router };
