require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// Import modules
const ComplianceChecker = require('../compliance/complianceChecker');
const ReportGenerator = require('../reports/reportGenerator');
const { WebScraper } = require('../web/scraper');
const { getRouter } = require('../ai/modelRouter');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"]
    }
  }
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, '../../public')));

// Initialize services
const complianceChecker = new ComplianceChecker();
const reportGenerator = new ReportGenerator();
const scraper = new WebScraper();
const aiRouter = getRouter();

// Rate limiting (simple in-memory implementation)
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_REQUESTS = 20; // 20 requests per minute

function rateLimit(req, res, next) {
  const key = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;

  if (!rateLimits.has(key)) {
    rateLimits.set(key, []);
  }

  const requests = rateLimits.get(key).filter(timestamp => timestamp > windowStart);

  if (requests.length >= RATE_LIMIT_REQUESTS) {
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
    });
  }

  requests.push(now);
  rateLimits.set(key, requests);

  next();
}

// Utility function to validate URLs
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: require('../../package.json').version,
    services: {
      ai_router: !!aiRouter,
      compliance_checker: !!complianceChecker,
      report_generator: !!reportGenerator,
      scraper: !!scraper
    }
  });
});

// Get compliance rules
app.get('/api/rules', async (req, res) => {
  try {
    const rulesPath = path.join(__dirname, '../../data/compliance/asqa-aqf-rules.json');
    const rulesData = await fs.promises.readFile(rulesPath, 'utf8');
    const rules = JSON.parse(rulesData);

    res.json({
      success: true,
      data: {
        rules: rules.rules,
        compliance_thresholds: rules.compliance_thresholds,
        scoring: rules.scoring,
        metadata: rules.metadata
      }
    });
  } catch (error) {
    console.error('Error loading rules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load compliance rules',
      message: error.message
    });
  }
});

// Scan single URL
app.post('/api/scan', rateLimit, async (req, res) => {
  try {
    const { url, options = {} } = req.body;

    if (!url || !isValidUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing URL',
        message: 'Please provide a valid HTTP/HTTPS URL'
      });
    }

    console.log(`Starting compliance scan for: ${url}`);

    // Start scanning process
    const startTime = Date.now();

    // Extract content
    const content = await scraper.extractContent(url, options.scraping);

    // Detect page type
    const pageType = scraper.detectPageType(content);

    // Check compliance
    const result = await complianceChecker.checkCompliance(content, {
      url,
      pageType,
      ...options
    });

    result.processing_time = Date.now() - startTime;

    console.log(`Scan completed for ${url} - Score: ${result.compliance_score}%`);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({
      success: false,
      error: 'Scan failed',
      message: error.message
    });
  }
});

// Batch scan multiple URLs
app.post('/api/batch-scan', rateLimit, async (req, res) => {
  try {
    const { urls, options = {} } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing URLs array',
        message: 'Please provide an array of valid URLs'
      });
    }

    if (urls.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Too many URLs',
        message: 'Maximum 10 URLs allowed per batch scan'
      });
    }

    // Validate URLs
    const invalidUrls = urls.filter(url => !isValidUrl(url));
    if (invalidUrls.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URLs found',
        message: `Invalid URLs: ${invalidUrls.join(', ')}`
      });
    }

    console.log(`Starting batch scan for ${urls.length} URLs`);

    const results = await complianceChecker.checkMultiplePages(urls, options);
    const summary = await complianceChecker.generateSummaryReport(results);

    res.json({
      success: true,
      data: {
        summary,
        results
      }
    });
  } catch (error) {
    console.error('Batch scan error:', error);
    res.status(500).json({
      success: false,
      error: 'Batch scan failed',
      message: error.message
    });
  }
});

// Generate report for existing scan
app.post('/api/report/:scanId', async (req, res) => {
  try {
    const { scanId } = req.params;
    const { format = 'pdf' } = req.body;

    // For now, we'll need the scan result to be provided
    // In a real application, you'd retrieve this from a database
    const { scanResult } = req.body;

    if (!scanResult || scanResult.scan_id !== scanId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid scan data',
        message: 'Scan result data is required and must match scan ID'
      });
    }

    let reportResult;
    switch (format.toLowerCase()) {
      case 'pdf':
        reportResult = await reportGenerator.generatePDFReport(scanResult);
        break;
      case 'html':
        reportResult = await reportGenerator.generateHTMLReport(scanResult);
        break;
      case 'json':
        reportResult = await reportGenerator.generateJSONReport(scanResult);
        break;
      case 'all':
        reportResult = await reportGenerator.generateAllFormats(scanResult);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid format',
          message: 'Supported formats: pdf, html, json, all'
        });
    }

    res.json({
      success: true,
      data: reportResult
    });
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Report generation failed',
      message: error.message
    });
  }
});

// Download report
app.get('/api/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const reportsDir = path.join(__dirname, '../../data/scans');
    const filePath = path.join(reportsDir, filename);

    // Validate filename to prevent directory traversal
    if (!filename.match(/^[a-zA-Z0-9._-]+$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename'
      });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    const stat = await fs.promises.stat(filePath);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      error: 'Download failed',
      message: error.message
    });
  }
});

// Get AI model status
app.get('/api/ai/status', (req, res) => {
  const status = {};
  const router = getRouter();

  for (const [name, client] of Object.entries(router.clients)) {
    status[name] = {
      configured: client.isConfigured(),
      available: client.isConfigured()
    };
  }

  const stats = router.getStats();

  res.json({
    success: true,
    data: {
      models: status,
      usage: stats,
      roles: router.config.roles
    }
  });
});

// Extract content from URL (for testing)
app.post('/api/extract', rateLimit, async (req, res) => {
  try {
    const { url, options = {} } = req.body;

    if (!url || !isValidUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing URL'
      });
    }

    const content = await scraper.extractContent(url, options);
    const pageType = scraper.detectPageType(content);

    res.json({
      success: true,
      data: {
        ...content,
        page_type: pageType,
        word_count: content.text ? content.text.split(/\s+/).length : 0
      }
    });
  } catch (error) {
    console.error('Content extraction error:', error);
    res.status(500).json({
      success: false,
      error: 'Content extraction failed',
      message: error.message
    });
  }
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 RTO Compliance Checker API server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔗 API endpoint: http://localhost:${PORT}/api`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('Environment variables:');
  console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`- AI Models Configured: ${Object.values(aiRouter.clients).filter(c => c.isConfigured()).length}/${Object.keys(aiRouter.clients).length}`);
  console.log('');
  console.log('Ready to scan RTO websites for ASQA/AQF compliance! 🎯');
});

module.exports = app;