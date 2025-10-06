# Lead Generation Scrapers Comparison

## Overview

| Scraper | Results/Page | Speed | Detail Pages | Best For |
|---------|-------------|-------|--------------|----------|
| **Google Maps** | 20-30 | Fast (3-5s) | No | General businesses, restaurants, retail |
| **Yellow Pages** | 20-30 | Medium (5-8s) | No | Traditional businesses, local services |
| **Yelp** | 10 | Slow (20-30s) | ✅ Yes | Restaurants, nightlife, detailed reviews |
| **BBB** | 10 | Medium (5-8s) | No | Accredited businesses, trust ratings |
| **Angi** | 10 | Slow (20-30s) | ✅ Yes | Home services, contractors, professionals |

## Data Quality

### Google Maps
- ✅ Most comprehensive coverage
- ✅ Accurate location data
- ✅ Real-time business hours
- ✅ High review counts
- ❌ Limited contact details
- ❌ No website on search results

### Yellow Pages
- ✅ Good phone number coverage
- ✅ Business categories
- ✅ Fast scraping
- ❌ Outdated listings possible
- ❌ Limited reviews

### Yelp (with Detail Pages)
- ✅ Detailed business info
- ✅ Website URLs
- ✅ Business hours
- ✅ Price range
- ✅ High-quality reviews
- ✅ Photos available
- ❌ Slower (detail page scraping)
- ❌ Restaurant/service focused

### BBB
- ✅ BBB accreditation status
- ✅ Trust ratings
- ✅ Complaint history
- ❌ Smaller database
- ❌ Limited to accredited businesses

### Angi (with Detail Pages)
- ✅ Years in business
- ✅ Service categories
- ✅ Detailed company info
- ✅ Website URLs
- ✅ Professional ratings
- ❌ Slower (detail page scraping)
- ❌ Home services focused

## Data Fields Comparison

| Field | Google Maps | Yellow Pages | Yelp | BBB | Angi |
|-------|------------|--------------|------|-----|------|
| Business Name | ✅ | ✅ | ✅ | ✅ | ✅ |
| Address | ✅ | ✅ | ✅ | ✅ | ✅ |
| Phone | ✅ | ✅ | ✅ | ✅ | ✅ |
| Website | ❌ | ✅ | ✅ | ❌ | ✅ |
| Rating | ✅ | ✅ | ✅ | ✅ | ✅ |
| Review Count | ✅ | ✅ | ✅ | ✅ | ✅ |
| Category | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hours | ❌ | ❌ | ✅ | ❌ | ❌ |
| Price Range | ❌ | ❌ | ✅ | ❌ | ❌ |
| Years in Business | ❌ | ❌ | ❌ | ❌ | ✅ |
| Services | ❌ | ❌ | ❌ | ❌ | ✅ |

## Use Cases

### Lead Generation for Sales
**Best Choice**: Google Maps + Yellow Pages
- Fast scraping
- High volume
- Good contact info
- Wide coverage

### Restaurant Marketing
**Best Choice**: Yelp
- Detailed reviews
- Price range
- Hours of operation
- Website links

### Home Services Marketing
**Best Choice**: Angi + BBB
- Professional ratings
- Years in business
- Service categories
- Trust indicators

### B2B Lead Generation
**Best Choice**: Yellow Pages + BBB
- Business focus
- Accreditation status
- Fast scraping
- Good phone coverage

### Quality over Quantity
**Best Choice**: Yelp + Angi
- Complete business profiles
- Website URLs
- Detailed information
- Worth the slower speed

## Recommended Combinations

### Maximum Coverage (Fast)
```javascript
// Run in parallel
Promise.all([
  fetch('/search', { /* Google Maps */ }),
  fetch('/search-yellowpages', { /* Yellow Pages */ })
])
```
**Result**: 40-60 leads in 10-15 seconds

### Maximum Detail (Slow)
```javascript
// Run in parallel
Promise.all([
  fetch('/search-yelp', { /* Yelp */ }),
  fetch('/search-angi', { /* Angi */ })
])
```
**Result**: 20 detailed leads in 40-60 seconds

### Balanced Approach
```javascript
// Run in sequence
1. Google Maps (fast, high volume)
2. Yelp (slow, detailed info for top results)
```
**Result**: 50 leads with 10 detailed profiles in 60 seconds

## Cloudflare Protection

| Scraper | Cloudflare | Bypass Success Rate |
|---------|-----------|-------------------|
| Google Maps | ⚠️ Sometimes | 95% |
| Yellow Pages | ✅ Yes | 90% |
| Yelp | ✅ Yes | 85% |
| BBB | ⚠️ Sometimes | 90% |
| Angi | ⚠️ Sometimes | 85% |

## Cost-Benefit Analysis

### Time to 100 Leads

| Scraper | Time | Detail Level | Recommended |
|---------|------|--------------|-------------|
| Google Maps | ~30-45s | Medium | ✅ Yes |
| Yellow Pages | ~40-60s | Medium | ✅ Yes |
| Yelp | ~200-300s | High | ⚠️ For specific needs |
| BBB | ~80-120s | Medium | ⚠️ For trust data |
| Angi | ~200-300s | High | ⚠️ For home services |

## Best Practices

1. **Start with Google Maps** - Fastest, most comprehensive
2. **Add Yellow Pages** - Good phone numbers, fast
3. **Use Yelp selectively** - Only when you need detailed info
4. **Use Angi for home services** - Best for contractors/professionals
5. **Use BBB for trust verification** - Check accreditation status

## API Response Times

### Average Response Times (20 results)

```
Google Maps:     8-12 seconds
Yellow Pages:    15-20 seconds
Yelp:            40-60 seconds (with detail pages)
BBB:             20-30 seconds
Angi:            40-60 seconds (with detail pages)
```

### Recommended maxResults

```
Google Maps:     50-100 (fast enough)
Yellow Pages:    30-50 (good balance)
Yelp:            10-20 (slow, but detailed)
BBB:             20-30 (medium speed)
Angi:            10-20 (slow, but detailed)
```
