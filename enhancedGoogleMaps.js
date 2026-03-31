const { searchGoogleMaps } = require('./googleMaps');
const { extractMultipleCompanyDetails } = require('./companyDetailsExtractor');

// Enhanced Google Maps scraper with company details extraction
const searchGoogleMapsWithCompanyDetails = async (req, res) => {
  try {
    console.log(`[EnhancedSearch] Starting for keyword: "${req.body.keyword}" in "${req.body.place}"`);

    const {
      keyword,
      place,
      maxResults = 10,
      detailedScrape = true,
      extractCompanyDetails = true,
      includeCareerPageDetails = true,
      delayBetweenRequests = 2000,
      maxCompanyDetails = 10
    } = req.body;

    // Input validation
    if (!keyword || !place) {
      return res.status(400).json({
        status: 400,
        message: "Both 'keyword' and 'place' are required parameters.",
      });
    }

    // Capture the original response from googleMaps scraper
    let googleMapsResults = null;
    let statusCode = 200;

    // Create a mock response object that intercepts the json/status calls
    const mockRes = {
      status: (code) => {
        statusCode = code;
        return mockRes;
      },
      json: (data) => {
        googleMapsResults = data;
        return mockRes;
      },
      // Handle cases where googleMaps might use send or end
      send: (data) => {
        googleMapsResults = data;
        return mockRes;
      }
    };

    // Use a copy of req to avoid side-effects
    const mockReq = {
      body: { ...req.body },
      user: req.user
    };

    // 1. EXECUTE BASIC SCRAPE
    // We await this. If searchGoogleMaps is properly async, it will finish before moving on.
    try {
      await searchGoogleMaps(mockReq, mockRes);
    } catch (innerError) {
      console.error("[EnhancedSearch] Inner scraper failed:", innerError);
      return res.status(500).json({
        status: 500,
        message: "Primary Google Maps scraper failed.",
        error: innerError.message
      });
    }

    // 2. CHECK RESULTS
    if (!googleMapsResults || statusCode !== 200) {
      console.warn(`[EnhancedSearch] Primary search returned status ${statusCode}`);
      return res.status(statusCode || 500).json(googleMapsResults || { message: "Unknown error in primary search" });
    }

    let finalResults = googleMapsResults.data || [];

    // 3. ENHANCE WITH COMPANY DETAILS
    if (extractCompanyDetails && finalResults.length > 0) {

      // Filter candidates: Must have a valid HTTP website
      const candidates = finalResults.filter(b =>
        b.bizWebsite &&
        b.bizWebsite.trim() !== '' &&
        b.bizWebsite.startsWith('http')
      ).slice(0, maxCompanyDetails);

      console.log(`[EnhancedSearch] Found ${candidates.length} candidates for detail extraction (Limit: ${maxCompanyDetails})`);

      if (candidates.length > 0) {
        try {
          // Use our robust extractor with concurrency limit of 4
          const detailedInfo = await extractMultipleCompanyDetails(candidates, 4);

          // Merge Data efficiently
          const detailsMap = new Map();
          detailedInfo.forEach(info => {
            // Key by website as it's most unique, fallback to name
            if (info.website) detailsMap.set(info.website, info);
            if (info.companyName) detailsMap.set(info.companyName, info);
          });

          finalResults = finalResults.map(biz => {
            // Try matching by website first
            let enhancement = detailsMap.get(biz.bizWebsite);
            // If not found, try name
            if (!enhancement) enhancement = detailsMap.get(biz.storeName);

            if (enhancement && enhancement.success) {
              return {
                ...biz,
                companyDetails: enhancement
              };
            }
            return biz;
          });

        } catch (enhancementError) {
          console.error(`[EnhancedSearch] Detail extraction warning: ${enhancementError.message}`);
          // We do NOT fail the request, strictly return partial results
        }
      }
    }

    // 4. RETURN FINAL RESPONSE
    const response = {
      ...googleMapsResults,
      data: finalResults,
      metadata: {
        ...(googleMapsResults.metadata || {}),
        enhancedMode: true,
        companyDetailsExtracted: extractCompanyDetails,
        totalEnhanced: finalResults.filter(r => r.companyDetails).length
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error("[EnhancedSearch] Critical Error:", error.message);
    return res.status(500).json({
      status: 500,
      message: "Service temporarily unavailable.",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
};

// Standalone function to extract company details for existing Google Maps results
const extractCompanyDetailsForExistingResults = async (req, res) => {
  try {
    console.log("Extracting company details for existing results...");

    const { businesses, maxCompanyDetails = 10 } = req.body;

    if (!businesses || !Array.isArray(businesses)) {
      return res.status(400).json({
        status: 400,
        message: "businesses array is required",
      });
    }

    // Filter businesses that have websites
    const businessesWithWebsites = businesses.filter(business =>
      business.bizWebsite &&
      business.bizWebsite !== '' &&
      business.bizWebsite.startsWith('http')
    ).slice(0, maxCompanyDetails);

    if (businessesWithWebsites.length === 0) {
      return res.status(200).json({
        status: 200,
        message: "No businesses with websites found",
        data: [],
        metadata: {
          totalBusinesses: businesses.length,
          businessesWithWebsites: 0,
          businessesProcessed: 0
        }
      });
    }

    console.log(`Processing ${businessesWithWebsites.length} businesses with websites`);

    const companyDetails = await extractMultipleCompanyDetails(businessesWithWebsites, 4);

    const successfulExtractions = companyDetails.filter(detail => detail.success);

    return res.status(200).json({
      status: 200,
      message: "Company details extracted successfully",
      data: companyDetails,
      metadata: {
        totalBusinesses: businesses.length,
        businessesWithWebsites: businessesWithWebsites.length,
        businessesProcessed: companyDetails.length,
        successfulExtractions: successfulExtractions.length,
        failedExtractions: companyDetails.length - successfulExtractions.length
      }
    });

  } catch (error) {
    console.error("Error extracting company details:", error.message);
    return res.status(500).json({
      status: 500,
      message: "Service temporarily unavailable. Please try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
};

module.exports = {
  searchGoogleMapsWithCompanyDetails,
  extractCompanyDetailsForExistingResults
};