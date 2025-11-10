// src/index.js - Main entry point for RTO Compliance Checker
require('dotenv').config();

const app = require('./api/server');
const ComplianceChecker = require('./compliance/complianceChecker');
const { WebScraper } = require('./web/scraper');
const { getRouter } = require('./ai/modelRouter');

// RTO Compliance Checker class for programmatic usage
class RTOComplianceChecker {
  constructor() {
    this.complianceChecker = new ComplianceChecker();
    this.webScraper = new WebScraper();
    this.router = getRouter();
  }

  async checkWebPage(url, options = {}) {
    try {
      console.log(`Starting compliance check for: ${url}`);

      // Extract web content
      const content = await this.webScraper.extractContent(url, options.scraping);

      // Detect page type
      const pageType = this.webScraper.detectPageType(content);

      // Check compliance
      const result = await this.complianceChecker.checkCompliance(content, {
        url,
        pageType,
        ...options
      });

      console.log(`Compliance check completed - Score: ${result.compliance_score}%`);
      return result;
    } catch (error) {
      console.error(`Web compliance check failed: ${error.message}`);
      throw new Error(`Web compliance check failed: ${error.message}`);
    }
  }

  async checkMultiplePages(urls, options = {}) {
    try {
      console.log(`Starting batch compliance check for ${urls.length} URLs`);
      const results = await this.complianceChecker.checkMultiplePages(urls, options);
      const summary = await this.complianceChecker.generateSummaryReport(results);

      console.log(`Batch check completed - Average score: ${summary.summary.average_compliance_score}%`);
      return { summary, results };
    } catch (error) {
      console.error(`Batch compliance check failed: ${error.message}`);
      throw new Error(`Batch compliance check failed: ${error.message}`);
    }
  }

  async generateReport(scanResult, format = 'pdf') {
    const ReportGenerator = require('./reports/reportGenerator');
    const reportGenerator = new ReportGenerator();

    try {
      switch (format.toLowerCase()) {
        case 'pdf':
          return await reportGenerator.generatePDFReport(scanResult);
        case 'html':
          return await reportGenerator.generateHTMLReport(scanResult);
        case 'json':
          return await reportGenerator.generateJSONReport(scanResult);
        case 'all':
          return await reportGenerator.generateAllFormats(scanResult);
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      console.error(`Report generation failed: ${error.message}`);
      throw new Error(`Report generation failed: ${error.message}`);
    }
  }

  getSystemStatus() {
    return {
      ai_models: {
        available: Object.values(this.router.clients).filter(c => c.isConfigured()).length,
        total: Object.keys(this.router.clients).length,
        usage: this.router.getStats()
      },
      services: {
        compliance_checker: !!this.complianceChecker,
        web_scraper: !!this.webScraper,
        ai_router: !!this.router
      }
    };
  }
}

// CLI functionality
if (require.main === module) {
  console.log('🎯 RTO Compliance Checker');
  console.log('==========================');

  // Check if this is being run directly
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Starting web server...');
    console.log('Access the dashboard at: http://localhost:3000');
    // Server is already started by requiring it above
  } else if (args[0] === 'scan') {
    // CLI scan mode
    const url = args[1];
    if (!url) {
      console.error('Please provide a URL to scan');
      process.exit(1);
    }

    const checker = new RTOComplianceChecker();

    checker.checkWebPage(url)
      .then(result => {
        console.log('\n📊 Compliance Results:');
        console.log(`URL: ${result.url}`);
        console.log(`Score: ${result.compliance_score}%`);
        console.log(`Status: ${result.status}`);
        console.log(`Violations: ${result.violations.length}`);

        if (result.violations.length > 0) {
          console.log('\n⚠️  Violations found:');
          result.violations.forEach((v, i) => {
            console.log(`${i + 1}. ${v.description} (${v.severity})`);
            if (v.recommendation) {
              console.log(`   → ${v.recommendation}`);
            }
          });
        }

        if (result.recommendations.length > 0) {
          console.log('\n💡 Recommendations:');
          result.recommendations.forEach((rec, i) => {
            console.log(`${i + 1}. ${rec}`);
          });
        }
      })
      .catch(error => {
        console.error('❌ Scan failed:', error.message);
        process.exit(1);
      });
  } else if (args[0] === 'status') {
    const checker = new RTOComplianceChecker();
    const status = checker.getSystemStatus();

    console.log('\n📋 System Status:');
    console.log(`AI Models: ${status.ai_models.available}/${status.ai_models.total} configured`);
    console.log('Services:');
    Object.entries(status.services).forEach(([name, available]) => {
      console.log(`  ${name}: ${available ? '✅' : '❌'}`);
    });
  }
}

// Export for use as module
module.exports = {
  RTOComplianceChecker,
  ComplianceChecker,
  WebScraper,
  app
};