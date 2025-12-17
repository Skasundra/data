// Example usage of the enhanced Google Maps scraper with company details extraction

const axios = require('axios');

const BASE_URL = 'http://localhost:9000';

// Example 1: Enhanced Google Maps search with company details
async function enhancedGoogleMapsSearch() {
  try {
    console.log('=== Enhanced Google Maps Search with Company Details ===');
    
    const response = await axios.post(`${BASE_URL}/search-enhanced`, {
      keyword: 'software company',
      place: 'San Francisco',
      maxResults: 5,
      detailedScrape: true,
      extractCompanyDetails: true,
      maxCompanyDetails: 3
    });

    console.log('Status:', response.data.status);
    console.log('Total Results:', response.data.data.length);
    console.log('Metadata:', response.data.metadata);
    
    // Show results with company details
    response.data.data.forEach((business, index) => {
      console.log(`\n--- Business ${index + 1} ---`);
      console.log('Name:', business.storeName);
      console.log('Website:', business.bizWebsite);
      console.log('Google URL:', business.googleUrl);
      
      if (business.companyDetails && business.companyDetails.success) {
        console.log('\n🏢 Company Details:');
        console.log('Description:', business.companyDetails.description?.substring(0, 100) + '...');
        console.log('Emails:', business.companyDetails.emails);
        console.log('HR Emails:', business.companyDetails.hrEmails);
        console.log('Phone Numbers:', business.companyDetails.phoneNumbers);
        console.log('Social Links:', business.companyDetails.socialLinks);
        
        if (business.companyDetails.careerPage?.found) {
          console.log('\n💼 Career Page Found:');
          console.log('URL:', business.companyDetails.careerPage.url);
          console.log('Career Emails:', business.companyDetails.careerPage.careerEmails);
          console.log('Available Jobs:', business.companyDetails.careerPage.availableJobs?.length || 0);
        }
        
        if (business.companyDetails.contactPage?.found) {
          console.log('\n📞 Contact Page Found:');
          console.log('URL:', business.companyDetails.contactPage.url);
          console.log('Contact Emails:', business.companyDetails.contactPage.contactEmails);
          console.log('Contact Phones:', business.companyDetails.contactPage.contactPhones);
        }
      }
    });
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Example 2: Extract company details for existing Google Maps results
async function extractDetailsForExistingResults() {
  try {
    console.log('\n=== Extract Company Details for Existing Results ===');
    
    // First, get some Google Maps results
    const searchResponse = await axios.post(`${BASE_URL}/search`, {
      keyword: 'restaurant',
      place: 'New York',
      maxResults: 3,
      detailedScrape: true
    });

    console.log('Found', searchResponse.data.data.length, 'businesses');
    
    // Filter businesses with websites
    const businessesWithWebsites = searchResponse.data.data.filter(b => 
      b.bizWebsite && b.bizWebsite !== ''
    );
    
    console.log('Businesses with websites:', businessesWithWebsites.length);
    
    if (businessesWithWebsites.length > 0) {
      // Extract company details for these businesses
      const detailsResponse = await axios.post(`${BASE_URL}/extract-company-details`, {
        businesses: businessesWithWebsites,
        maxCompanyDetails: 2
      });

      console.log('Company details extraction results:');
      console.log('Status:', detailsResponse.data.status);
      console.log('Metadata:', detailsResponse.data.metadata);
      
      detailsResponse.data.data.forEach((companyDetail, index) => {
        console.log(`\n--- Company ${index + 1} ---`);
        console.log('Name:', companyDetail.companyName);
        console.log('Website:', companyDetail.website);
        console.log('Success:', companyDetail.success);
        
        if (companyDetail.success) {
          console.log('Emails found:', companyDetail.emails?.length || 0);
          console.log('HR Emails:', companyDetail.hrEmails);
          console.log('Career page found:', companyDetail.careerPage?.found || false);
          console.log('Contact page found:', companyDetail.contactPage?.found || false);
        } else {
          console.log('Error:', companyDetail.error);
        }
      });
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Example 3: Regular Google Maps search (original functionality)
async function regularGoogleMapsSearch() {
  try {
    console.log('\n=== Regular Google Maps Search ===');
    
    const response = await axios.post(`${BASE_URL}/search`, {
      keyword: 'dentist',
      place: 'Los Angeles',
      maxResults: 3,
      detailedScrape: false
    });

    console.log('Status:', response.data.status);
    console.log('Total Results:', response.data.data.length);
    
    response.data.data.forEach((business, index) => {
      console.log(`\n--- Business ${index + 1} ---`);
      console.log('Name:', business.storeName);
      console.log('Category:', business.category);
      console.log('Address:', business.address);
      console.log('Phone:', business.phone);
      console.log('Website:', business.bizWebsite);
      console.log('Rating:', business.stars);
      console.log('Reviews:', business.numberOfReviews);
    });
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Run examples
async function runExamples() {
  console.log('🚀 Starting API Examples...\n');
  
  // Uncomment the examples you want to run:
  
  // await regularGoogleMapsSearch();
  // await enhancedGoogleMapsSearch();
  // await extractDetailsForExistingResults();
  
  console.log('\n✅ Examples completed!');
}

// Export functions for individual use
module.exports = {
  enhancedGoogleMapsSearch,
  extractDetailsForExistingResults,
  regularGoogleMapsSearch,
  runExamples
};

// Run if called directly
if (require.main === module) {
  runExamples();
}