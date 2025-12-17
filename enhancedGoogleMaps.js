const { searchGoogleMaps } = require('./googleMaps');
const { extractMultipleCompanyDetails } = require('./companyDetailsExtractor');

// Enhanced Google Maps scraper with company details extraction
const searchGoogleMapsWithCompanyDetails = async (req, res) => {
  try {
    console.log("Starting enhanced Google Maps search with company details...");
    
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

    // Create a mock request/response for the original Google Maps function
    const mockReq = {
      body: { keyword, place, maxResults, detailedScrape, delayBetweenRequests },
      user: req.user
    };

    let googleMapsResults = null;
    
    // Create a mock response to capture the Google Maps results
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          googleMapsResults = data;
          return data;
        }
      })
    };

    // Call the original Google Maps scraper
    await searchGoogleMaps(mockReq, mockRes);

    if (!googleMapsResults || googleMapsResults.status !== 200) {
      return res.status(googleMapsResults?.status || 500).json(googleMapsResults);
    }

    let finalResults = googleMapsResults.data;

    // If company details extraction is requested
    if (extractCompanyDetails && finalResults.length > 0) {
      console.log("Extracting company details for businesses with websites...");
      
      // Filter businesses that have websites
      const businessesWithWebsites = finalResults.filter(business => 
        business.bizWebsite && 
        business.bizWebsite !== '' && 
        business.bizWebsite.startsWith('http')
      ).slice(0, maxCompanyDetails);

      console.log(`Found ${businessesWithWebsites.length} businesses with websites to process`);

      if (businessesWithWebsites.length > 0) {
        try {
          const companyDetails = await extractMultipleCompanyDetails(businessesWithWebsites, 3);
          
          // Merge company details with original results
          finalResults = finalResults.map(business => {
            const companyDetail = companyDetails.find(detail => 
              detail.companyName === business.storeName || 
              detail.website === business.bizWebsite
            );
            
            if (companyDetail) {
              return {
                ...business,
                companyDetails: companyDetail
              };
            }
            
            return business;
          });

          console.log(`Successfully extracted company details for ${companyDetails.filter(d => d.success).length} businesses`);
        } catch (companyError) {
          console.log(`Error extracting company details: ${companyError.message}`);
          // Continue with original results if company details extraction fails
        }
      }
    }

    // Enhanced response with company details metadata
    const response = {
      ...googleMapsResults,
      data: finalResults,
      metadata: {
        ...googleMapsResults.metadata,
        companyDetailsExtracted: extractCompanyDetails,
        businessesWithWebsites: finalResults.filter(b => b.bizWebsite && b.bizWebsite !== '').length,
        businessesWithCompanyDetails: finalResults.filter(b => b.companyDetails && b.companyDetails.success).length,
        maxCompanyDetailsRequested: maxCompanyDetails
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error("Error in enhanced Google Maps search:", error.message);
    return res.status(500).json({
      status: 500,
      message: "Service temporarily unavailable. Please try again later.",
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

    const companyDetails = await extractMultipleCompanyDetails(businessesWithWebsites, 3);
    
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