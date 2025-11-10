# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RTO Compliance Checker** - A web-based tool that automatically scans RTO (Registered Training Organisation) websites for ASQA/AQF compliance violations. The tool extracts web content and analyzes it against Australian Skills Quality Authority (ASQA) and Australian Qualifications Framework (AQF) standards.

**Key constraint:** All compliance checking must align with current ASQA Standards for RTOs 2025 and AQF requirements. See `/data/compliance/asqa-aqf-rules.json` for the complete rule set.

## Architecture

**Stack:** Node.js web application with AI-powered compliance analysis
- **Runtime:** Node.js 18+
- **Web Framework:** Express.js for REST API and web interface
- **AI Providers:** OpenAI, Anthropic Claude, DeepSeek (multi-provider with failover)
- **Web Scraping:** Puppeteer (dynamic content) + Axios (static content)
- **Data Storage:** JSON files for compliance rules, user data, and scan results
- **Frontend:** HTML/CSS/JavaScript with modern UI components

**Key architectural pattern:** AI-powered compliance checking with multi-model failover and web content extraction.

## Common Development Commands

### Setup & Installation
```bash
# Install dependencies
npm install

# Create directory structure
node scripts/setup/initialize-project.js

# Test AI model connections
node scripts/test/test-ai-connections.js

# Verify compliance rules loading
node scripts/test/test-compliance-rules.js

# Start development server
npm run dev
```

### Development & Testing
```bash
# Run compliance check on test URL
node scripts/test/test-compliance-check.js --url https://example-rto.edu.au

# Test web scraping functionality
node scripts/test/test-web-scraper.js --url https://example-rto.edu.au

# Run all tests
npm test

# Test specific compliance rule
node scripts/test/test-specific-rule.js --rule employment_guarantees
```

### Production Deployment
```bash
# Build for production
npm run build

# Start production server
npm start

# Run compliance scan in production mode
node scripts/production/scan-website.js --url https://example-rto.edu.au --output-format pdf
```

## Directory Structure

```
rto-compliance-checker/
├── src/
│   ├── compliance/           # Compliance checking engine
│   │   ├── complianceChecker.js    # Main compliance checker
│   │   ├── webComplianceChecker.js  # Web-specific compliance
│   │   └── rules/                  # Compliance rule definitions
│   ├── ai/                  # AI model integration
│   │   ├── modelRouter.js          # Multi-provider AI routing
│   │   ├── openaiClient.js         # OpenAI integration
│   │   ├── anthropicClient.js      # Anthropic Claude integration
│   │   └── deepseekClient.js       # DeepSeek integration
│   ├── web/                 # Web content extraction
│   │   ├── scraper.js              # Main web scraper
│   │   ├── contentExtractor.js     # Content parsing and cleanup
│   │   └── pageTypeDetector.js     # Detect page types (home, course, etc.)
│   ├── reports/             # Report generation
│   │   ├── reportGenerator.js      # PDF/HTML report generation
│   │   ├── complianceReport.js     # Compliance-specific reports
│   │   └── templates/              # Report templates
│   ├── api/                 # REST API endpoints
│   │   ├── server.js               # Express.js server
│   │   ├── routes/                 # API route handlers
│   │   └── middleware/             # Authentication, rate limiting
│   ├── utils/               # Utility functions
│   │   ├── fileManager.js          # File operations
│   │   ├── logger.js               # Logging system
│   │   └── errorHandler.js         # Error handling
│   └── public/              # Frontend assets
│       ├── index.html              # Main web interface
│       ├── css/                    # Stylesheets
│       └── js/                     # Frontend JavaScript
├── data/
│   ├── compliance/         # Compliance rules and data
│   │   ├── asqa-aqf-rules.json     # ASQA/AQF regulatory rules
│   │   ├── forbidden-terms.json    # Forbidden terms and patterns
│   │   ├── required-disclaimers.json # Mandatory statements
│   │   └── web-specific-rules.json # Web-specific compliance rules
│   ├── scans/              # Scan results and history
│   └── users/              # User data and preferences
├── config/                # Configuration files
│   ├── ai-models.json     # AI model routing configuration
│   ├── server.json        # Server and API configuration
│   └── compliance.json    # Compliance checking settings
├── scripts/               # Executable scripts
│   ├── setup/             # Project setup and initialization
│   ├── test/              # Testing and validation scripts
│   ├── production/        # Production operation scripts
│   └── maintenance/       # Maintenance and update scripts
└── documentation/         # Project documentation
    ├── api/               # API documentation
    ├── compliance/        # Compliance rule documentation
    └── deployment/        # Deployment guides
```

## Critical Compliance Requirements

**MUST READ:** `/data/compliance/asqa-aqf-rules.json` before working on compliance logic.

### ASQA Standards 2025 - Key Areas
1. **Forbidden Claims** (Critical Violations)
   - NO employment guarantees ("guaranteed job", "you will be hired")
   - NO salary promises ("you will earn $X", "average salary of...")
   - NO completion time guarantees ("complete in exactly 6 months")
   - NO misleading comparisons ("better than university")

2. **Required Terminology** (Critical)
   - Use "unit" NOT "course" when referring to unit codes
   - Always include RTO number: "College Name (RTO XXXXX)"
   - Use correct AQF levels: "Certificate III" not "Level 3"
   - Use "competent/not yet competent" not "pass/fail"

3. **Web-Specific Requirements**
   - Contact information must be visible
   - Privacy policy link required
   - Course fees must be disclosed
   - Refund policy must be accessible

### Quality Thresholds
All compliance checks must achieve:
- 95%+ overall compliance score to pass
- Zero critical violations for automatic approval
- 90%+ score for manual review consideration
- Detailed violation reporting with specific line numbers

## AI Model Router

The system uses role-based AI model routing configured in `config/ai-models.json`:

| Role | Primary Model | Purpose |
|------|--------------|---------|
| COMPLIANCE | Claude 4.5 Sonnet | ASQA/AQF compliance analysis |
| CONTENT_ANALYSIS | GPT-4 Turbo | Web content understanding |
| REPORT_GENERATION | Claude 4.5 Sonnet | Report writing and formatting |
| SUMMARIZATION | DeepSeek R1 | Quick compliance summaries |

**To change models:** Edit `config/ai-models.json` - no code changes needed.

**Key files:**
- `/src/ai/modelRouter.js` - Model selection and failover logic
- `/config/ai-models.json` - Model configuration and routing rules

## Web Scraping Strategy

### Multi-Approach Content Extraction
1. **Static Content:** Axios + Cheerio for simple HTML pages
2. **Dynamic Content:** Puppeteer for JavaScript-heavy sites
3. **Fallback:** Manual content extraction via API
4. **Error Handling:** Multiple retry strategies with different approaches

### Content Processing Pipeline
1. **HTML Extraction:** Pull text content from web pages
2. **Content Cleanup:** Remove navigation, footers, ads
3. **Structure Analysis:** Identify headings, forms, contact info
4. **Page Type Detection:** Classify page (home, course, about, etc.)
5. **Compliance Analysis:** Run AI-powered compliance checks

## Compliance Checking Pipeline

Typical compliance check flow:

1. **URL Input** - User enters RTO website URL
2. **Content Extraction** - Scrape and process web content
3. **Page Analysis** - Detect page types and content structure
4. **Compliance Check** - AI analysis against ASQA/AQF rules
5. **Violation Detection** - Identify specific rule violations
6. **Score Calculation** - Generate 0-100% compliance score
7. **Report Generation** - Create detailed compliance report
8. **Recommendations** - Provide specific fixes for violations

**Average processing time:** 30-60 seconds per page
**Accuracy target:** 95%+ violation detection rate

## Environment Variables

Required `.env` variables:
```bash
# AI API Keys (minimum: OpenAI + Anthropic)
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...

# Server Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Web Scraping
PUPPETEER_HEADLESS=true
SCRAPING_TIMEOUT=30000
MAX_CONCURRENT_SCANS=5

# Compliance Settings
COMPLIANCE_THRESHOLD=95
ENABLE_AI_ANALYSIS=true
REPORT_CACHE_TTL=3600
```

## Data Schema Patterns

### Compliance Check Result (`data/scans/{scan-id}.json`)
```json
{
  "id": "scan_123456",
  "url": "https://example-rto.edu.au",
  "timestamp": "2025-11-10T10:30:00Z",
  "compliance_score": 87,
  "status": "FAIL",
  "page_analysis": {
    "page_type": "homepage",
    "content_sections": ["hero", "courses", "about", "contact"],
    "word_count": 1250
  },
  "violations": {
    "critical": [
      {
        "rule_id": "cr_005",
        "category": "employment_guarantees",
        "description": "Found employment guarantee claim",
        "severity": "critical",
        "location": "hero_section",
        "text": "Get a guaranteed job after completion"
      }
    ],
    "warnings": [],
    "recommendations": []
  },
  "recommendations": [
    "Remove employment guarantee claims",
    "Add RTO number to homepage",
    "Include required disclaimers"
  ],
  "ai_analysis": {
    "model_used": "claude-4.5-sonnet",
    "confidence": 0.92,
    "processing_time": 45.2
  }
}
```

## Code Patterns

### Modular Function-Based Architecture
```javascript
// Preferred pattern: export functions, not classes
const { getRouter } = require('../ai/modelRouter');
const ComplianceChecker = require('../compliance/complianceChecker');

async function checkWebCompliance(url, options = {}) {
  const router = getRouter();
  const checker = new ComplianceChecker();
  
  try {
    const content = await extractWebContent(url);
    const result = await checker.checkCompliance(content, {
      url,
      pageType: detectPageType(content),
      ...options
    });
    
    return result;
  } catch (error) {
    console.error('Compliance check failed:', error);
    throw error;
  }
}

module.exports = { checkWebCompliance };
```

### Error Handling Pattern
All web operations must have:
- Try/catch blocks with specific error types
- Retry logic with exponential backoff
- Fallback scraping methods
- User-friendly error messages
- Detailed logging for debugging

### Web Scraping Best Practices
```javascript
// Use utility helpers for web operations
const { extractContent, detectPageType } = require('../web/scraper');

// Extract content with multiple fallbacks
const content = await extractContent(url, {
  timeout: 30000,
  waitForSelector: 'main',
  removeSelectors: ['nav', 'footer', '.ads']
});

// Detect page type for context-specific rules
const pageType = detectPageType(content);
```

## API Integration

### REST API Endpoints
- `POST /api/scan` - Start compliance scan
- `GET /api/scan/:id` - Get scan results
- `GET /api/scan/:id/report` - Download PDF report
- `GET /api/rules` - Get compliance rules
- `POST /api/batch-scan` - Scan multiple URLs

### Authentication & Rate Limiting
- API key authentication for premium features
- Rate limiting: 10 scans/minute for free users
- Concurrent scan limits based on subscription tier

## Testing Strategy

**Unit tests:** Core compliance checking functions
**Integration tests:** AI model connections and web scraping
**E2E tests:** Full scan pipeline from URL to report
**Compliance tests:** Validate against known compliant/non-compliant sites

### Test Data Structure
```javascript
// Test fixtures for compliance rules
const testCases = {
  employment_guarantees: {
    compliant: "This qualification supports career development",
    non_compliant: "Get a guaranteed job after completion"
  },
  rto_identification: {
    compliant: "Edmund Barton College (RTO 90768)",
    non_compliant: "Edmund Barton College"
  }
};
```

## Troubleshooting

### Common Issues

**Web Scraping Failures:** If content extraction fails, check:
1. Website has robots.txt allowing scraping
2. Page requires JavaScript (use Puppeteer fallback)
3. Rate limiting or IP blocking (add delays/proxies)
4. SSL/TLS certificate issues

**Compliance Accuracy:** If accuracy is low, check:
1. AI model configuration in `config/ai-models.json`
2. Compliance rules are up to date in `data/compliance/`
3. Content preprocessing is working correctly
4. Prompt templates include latest ASQA requirements

**Performance Issues:** If scans are slow, check:
1. Concurrent scan limits in configuration
2. AI model response times and failover behavior
3. Web scraping timeout settings
4. Content processing pipeline efficiency

## Important Documentation

**Before starting any work:**
- `/data/compliance/asqa-aqf-rules.json` - **REQUIRED READING**
- `/documentation/compliance/rule-explanations.md` - Detailed rule explanations
- `/documentation/api/endpoints.md` - API documentation

**Technical reference:**
- `/documentation/deployment/setup-guide.md` - Installation & setup
- `/documentation/compliance/ai-prompts.md` - AI prompt templates
- `/documentation/api/rate-limiting.md` - Rate limiting strategy

## Development Workflow

### Adding New Compliance Rules
1. Update `/data/compliance/asqa-aqf-rules.json`
2. Add test cases in `/tests/compliance/`
3. Update AI prompts in `/src/compliance/prompts/`
4. Test with known compliant/non-compliant sites
5. Update documentation

### Modifying Web Scraping
1. Update `/src/web/scraper.js` for new extraction logic
2. Add fallback strategies for difficult sites
3. Test with various website types (WordPress, custom, etc.)
4. Update error handling and retry logic
5. Add integration tests

### Changing AI Models
1. Edit `config/ai-models.json`
2. Update model IDs and/or role assignments
3. Test compliance checking with sample URLs
4. Compare accuracy and cost before full rollout
5. Update model-specific prompts if needed

## Security Notes

- Respect robots.txt and rate limits when scraping
- Sanitize all user input (URLs, parameters)
- Implement proper authentication for API access
- Store scan results securely with appropriate access controls
- Use HTTPS for all API communications
- Implement proper error handling to avoid information leakage

## Performance Notes

- Target scan completion within 60 seconds
- Implement caching for repeated URL scans
- Use connection pooling for AI API calls
- Monitor AI API costs via provider dashboards
- Implement queue system for batch scans
- Use CDN for report assets and templates

## Next Steps for New Developers

1. Read `/data/compliance/asqa-aqf-rules.json` (non-negotiable)
2. Follow `/documentation/deployment/setup-guide.md` for installation
3. Test compliance checking with sample RTO websites
4. Review scan results in web interface at http://localhost:3000
5. Check web scraping works with various website types
6. Review `/documentation/compliance/rule-explanations.md` for detailed rule understanding