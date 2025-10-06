# Indian Lead Generation Sources

## Implemented Scrapers

### 1. JustDial (✅ Implemented)
**Endpoint**: `POST /search-justdial`

**Best For**: Local businesses, services, restaurants in India

**Data Fields**:
- Business name, address, phone
- Rating & reviews
- Year established
- Years in business
- Category
- Multiple phone numbers

**Example**:
```json
{
  "keyword": "Restaurant",
  "place": "Mumbai",
  "maxResults": 50
}
```

**Coverage**: 
- All major Indian cities
- 30+ million listings
- Local services, retail, restaurants

---

### 2. IndiaMART (✅ Implemented)
**Endpoint**: `POST /search-indiamart`

**Best For**: B2B leads, manufacturers, suppliers, wholesalers

**Data Fields**:
- Company name, address, phone
- GST number
- Trust seal/verification
- Year established
- Response rate
- Product categories

**Example**:
```json
{
  "keyword": "Textile Manufacturer",
  "place": "Surat",
  "maxResults": 50
}
```

**Coverage**:
- 6+ million suppliers
- B2B focus
- Manufacturing, wholesale, industrial

---

## Additional Indian Sources (Not Yet Implemented)

### 3. Sulekha
**URL**: https://www.sulekha.com
**Best For**: Local services, home services, education

**Data Available**:
- Service providers
- Educational institutions
- Healthcare providers
- Event services
- Real estate agents

**API Potential**: Medium
**Scraping Difficulty**: Medium

---

### 4. TradeIndia
**URL**: https://www.tradeindia.com
**Best For**: B2B, exporters, importers

**Data Available**:
- Manufacturers
- Exporters/Importers
- Product catalogs
- Company profiles
- Trade leads

**API Potential**: Low
**Scraping Difficulty**: Medium

---

### 5. ExportersIndia
**URL**: https://www.exportersindia.com
**Best For**: Export-import businesses

**Data Available**:
- Exporter details
- Product categories
- Company profiles
- Contact information

**API Potential**: Low
**Scraping Difficulty**: Medium

---

### 6. 99acres / MagicBricks
**URL**: https://www.99acres.com, https://www.magicbricks.com
**Best For**: Real estate agents, builders

**Data Available**:
- Real estate agents
- Builders/developers
- Property dealers
- Contact details

**API Potential**: Low
**Scraping Difficulty**: High (Heavy JavaScript)

---

### 7. Zomato
**URL**: https://www.zomato.com
**Best For**: Restaurants, food businesses

**Data Available**:
- Restaurant details
- Menu, pricing
- Reviews, ratings
- Contact info
- Delivery availability

**API Potential**: Medium (Has API but limited)
**Scraping Difficulty**: High (Heavy anti-scraping)

---

### 8. UrbanClap (Urban Company)
**URL**: https://www.urbancompany.com
**Best For**: Service professionals

**Data Available**:
- Service providers
- Ratings, reviews
- Service categories
- Pricing

**API Potential**: Low
**Scraping Difficulty**: High

---

### 9. Practo
**URL**: https://www.practo.com
**Best For**: Healthcare providers, doctors, clinics

**Data Available**:
- Doctor profiles
- Clinic details
- Specializations
- Contact information
- Consultation fees

**API Potential**: Low
**Scraping Difficulty**: Medium

---

### 10. Naukri / Monster India
**URL**: https://www.naukri.com
**Best For**: Company data, HR contacts

**Data Available**:
- Company profiles
- HR contacts
- Industry information
- Company size

**API Potential**: Low
**Scraping Difficulty**: High

---

## Comparison: Indian vs US Sources

| Feature | JustDial | IndiaMART | Google Maps | Yelp |
|---------|----------|-----------|-------------|------|
| **Coverage** | India Only | India Only | Global | Global |
| **Focus** | B2C Local | B2B | General | Reviews |
| **Phone Numbers** | ✅ Multiple | ✅ Multiple | ✅ Single | ⚠️ Limited |
| **GST Number** | ❌ | ✅ | ❌ | ❌ |
| **Year Established** | ✅ | ✅ | ❌ | ❌ |
| **Trust Seal** | ❌ | ✅ | ❌ | ❌ |
| **Response Rate** | ❌ | ✅ | ❌ | ❌ |

---

## Best Practices for Indian Lead Generation

### For B2C (Retail, Services, Restaurants)
1. **JustDial** - Primary source
2. **Google Maps** - Secondary source
3. **Sulekha** - Tertiary (if implemented)

### For B2B (Manufacturers, Suppliers)
1. **IndiaMART** - Primary source
2. **TradeIndia** - Secondary (if implemented)
3. **ExportersIndia** - Tertiary (if implemented)

### For Healthcare
1. **Practo** - Primary (if implemented)
2. **JustDial** - Secondary
3. **Google Maps** - Tertiary

### For Real Estate
1. **99acres** - Primary (if implemented)
2. **MagicBricks** - Secondary (if implemented)
3. **JustDial** - Tertiary

---

## Indian-Specific Data Fields

### GST Number
- 15-character alphanumeric
- Format: `22AAAAA0000A1Z5`
- Available on: IndiaMART, some B2B sites

### Trust Seals
- IndiaMART Trust Seal
- JustDial Verified
- Government registrations

### Response Rate
- IndiaMART shows supplier response rate
- Indicates business activity level

### Years in Business
- Common on Indian sites
- Shows "Since YYYY" or "Established YYYY"

---

## City Coverage (Major Indian Cities)

### Tier 1 Cities
- Mumbai, Delhi, Bangalore, Hyderabad, Chennai, Kolkata, Pune, Ahmedabad

### Tier 2 Cities
- Jaipur, Lucknow, Kanpur, Nagpur, Indore, Bhopal, Visakhapatnam, Patna

### Tier 3 Cities
- Agra, Nashik, Vadodara, Rajkot, Meerut, Varanasi, Srinagar, Amritsar

**All implemented scrapers support all Indian cities**

---

## Usage Examples

### JustDial - Local Restaurant Leads
```bash
curl -X POST http://localhost:9000/search-justdial \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "Restaurant",
    "place": "Mumbai",
    "maxResults": 100
  }'
```

### IndiaMART - Textile Manufacturers
```bash
curl -X POST http://localhost:9000/search-indiamart \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "Textile Manufacturer",
    "place": "Surat",
    "maxResults": 50
  }'
```

### JustDial - Doctors in Delhi
```bash
curl -X POST http://localhost:9000/search-justdial \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "Doctor",
    "place": "Delhi",
    "maxResults": 50
  }'
```

### IndiaMART - Electronics Suppliers
```bash
curl -X POST http://localhost:9000/search-indiamart \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "Electronics Supplier",
    "place": "Bangalore",
    "maxResults": 100
  }'
```

---

## Performance Metrics

### JustDial
- **Speed**: 5-8 seconds per page
- **Results per page**: ~10
- **Recommended maxResults**: 30-50
- **Best time**: Anytime (24/7)

### IndiaMART
- **Speed**: 5-8 seconds per page
- **Results per page**: ~20
- **Recommended maxResults**: 50-100
- **Best time**: Business hours (9 AM - 6 PM IST)

---

## Legal & Compliance

### Data Usage
- ✅ Public business information
- ✅ Contact details for B2B purposes
- ⚠️ Respect robots.txt
- ⚠️ Rate limiting recommended

### GDPR/Privacy
- Indian businesses expect B2B contact
- GST numbers are public information
- Phone numbers listed publicly

### Best Practices
- Use reasonable delays (5-8 seconds)
- Don't overload servers
- Cache results to avoid re-scraping
- Respect opt-out requests

---

## Future Implementations

Priority order for additional Indian scrapers:

1. **Sulekha** - High demand, medium difficulty
2. **TradeIndia** - B2B focus, medium difficulty
3. **Zomato** - High value, high difficulty
4. **Practo** - Healthcare focus, medium difficulty
5. **99acres** - Real estate, high difficulty

---

## Support & Updates

For issues or feature requests related to Indian data sources:
- Check selector updates (sites change frequently)
- Monitor Cloudflare blocks
- Update city slug formats as needed
- Test with different Indian cities
