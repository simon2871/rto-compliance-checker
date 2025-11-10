#!/usr/bin/env node

/**
 * Compliance Check Test Script
 * Tests the compliance checking functionality with sample data
 */

require('dotenv').config();
const ComplianceChecker = require('../../src/compliance/complianceChecker');
const { WebScraper } = require('../../src/web/scraper');

class ComplianceTestRunner {
  constructor() {
    this.checker = new ComplianceChecker();
    this.scraper = new WebScraper();
    this.testResults = [];
  }

  async runTests() {
    console.log('🧪 Running Compliance Check Tests');
    console.log('='.repeat(50));

    try {
      await this.testRuleBasedCompliance();
      await this.testAIAnalysis();
      await this.testReportGeneration();

      if (process.argv.includes('--url')) {
        const url = process.argv[process.argv.indexOf('--url') + 1];
        if (url) {
          await this.testLiveWebsite(url);
        }
      }

      this.displayResults();

    } catch (error) {
      console.error('\n❌ Compliance tests failed:', error.message);
      process.exit(1);
    }
  }

  async testRuleBasedCompliance() {
    console.log('\n📋 Testing rule-based compliance checking...');

    const testCases = [
      {
        name: 'Compliant RTO Homepage',
        content: {
          text: `Welcome to Edmund Barton College (RTO 90768). We offer nationally recognised training including Certificate III and Diploma courses. Our programs support career development with pathways to employment. Please note that completion times may vary based on individual circumstances. Contact us at (02) 1234 5678 or info@college.edu.au. Privacy Policy available here. Course fees: $2,500 per qualification. View our refund policy for more information.`,
          url: 'https://example-college.edu.au',
          page_type: 'homepage'
        },
        expectedScore: 95,
        expectedViolations: 0
      },
      {
        name: 'Non-compliant Marketing Claims',
        content: {
          text: `Get a guaranteed job after completing our 6-month program! You will earn $80,000 per year. We are better than university and all other colleges. Complete in exactly 6 months or your money back. Enroll now for immediate employment placement.`,
          url: 'https://bad-college.edu.au',
          page_type: 'homepage'
        },
        expectedScore: 50,
        expectedViolations: 4
      },
      {
        name: 'Mixed Compliance Content',
        content: {
          text: `Australian Training Institute provides quality education. We offer courses in business and IT. While many graduates find employment, we cannot guarantee specific job outcomes. Program duration is approximately 12 months for most students. Tuition fees are $3,000 per semester. Contact us for more information.`,
          url: 'https://mixed-college.edu.au',
          page_type: 'course'
        },
        expectedScore: 80,
        expectedViolations: 1
      }
    ];

    for (const testCase of testCases) {
      await this.runComplianceTest(testCase);
    }
  }

  async runComplianceTest(testCase) {
    console.log(`\n🔍 Testing: ${testCase.name}`);

    try {
      const startTime = Date.now();
      const result = await this.checker.checkCompliance(testCase.content, {
        useAI: false, // Test rule-based first
        url: testCase.content.url,
        pageType: testCase.content.page_type
      });

      const processingTime = Date.now() - startTime;

      const testResult = {
        name: testCase.name,
        passed: this.evaluateTestResult(result, testCase),
        score: result.compliance_score,
        violations: result.violations.length,
        expected_violations: testCase.expectedViolations,
        expected_score: testCase.expectedScore,
        processing_time: processingTime,
        status: result.status
      };

      this.testResults.push(testResult);

      if (testResult.passed) {
        console.log(`  ✅ Passed: Score ${result.compliance_score}% (${result.violations.length} violations)`);
      } else {
        console.log(`  ❌ Failed: Score ${result.compliance_score}% (${result.violations.length} violations)`);
        console.log(`     Expected: ~${testCase.expectedScore}% (${testCase.expectedViolations} violations)`);
      }

      // Show violations if any
      if (result.violations.length > 0) {
        console.log('  Violations found:');
        result.violations.forEach((v, i) => {
          console.log(`    ${i + 1}. ${v.description} (${v.severity})`);
        });
      }

    } catch (error) {
      const testResult = {
        name: testCase.name,
        passed: false,
        error: error.message,
        processing_time: null
      };
      this.testResults.push(testResult);
      console.log(`  ❌ Error: ${error.message}`);
    }
  }

  async testAIAnalysis() {
    console.log('\n🤖 Testing AI-powered analysis...');

    const testContent = {
      text: `Welcome to Modern College (RTO 45678). Our revolutionary training program guarantees you'll land a high-paying job within 30 days of graduation. Students consistently earn $95,000 annually. Complete our express program in exactly 8 weeks - no delays! We're unequivocally the superior choice compared to traditional universities and other vocational colleges. Enroll today and start your journey to guaranteed success!`,
      url: 'https://modern-college.edu.au',
      page_type: 'homepage'
    };

    try {
      console.log('  Running AI analysis...');
      const startTime = Date.now();

      const result = await this.checker.checkCompliance(testContent, {
        useAI: true,
        url: testContent.url,
        pageType: testContent.page_type
      });

      const processingTime = Date.now() - startTime;

      const testResult = {
        name: 'AI Analysis Test',
        passed: result.compliance_score < 80 && result.violations.length > 2, // Should detect violations
        score: result.compliance_score,
        violations: result.violations.length,
        ai_enabled: true,
        processing_time: processingTime,
        ai_analysis: !!result.ai_analysis
      };

      this.testResults.push(testResult);

      if (testResult.passed) {
        console.log(`  ✅ AI analysis working: Score ${result.compliance_score}% (${result.violations.length} violations)`);
        if (result.ai_analysis) {
          console.log(`     AI model: ${result.ai_analysis.model_used}`);
          console.log(`     Confidence: ${Math.round(result.ai_analysis.confidence * 100)}%`);
        }
      } else {
        console.log(`  ⚠️  AI analysis may need review: Score ${result.compliance_score}%`);
      }

    } catch (error) {
      const testResult = {
        name: 'AI Analysis Test',
        passed: false,
        error: error.message,
        ai_enabled: false
      };
      this.testResults.push(testResult);
      console.log(`  ❌ AI analysis failed: ${error.message}`);
    }
  }

  async testReportGeneration() {
    console.log('\n📄 Testing report generation...');

    // Create a sample result
    const sampleResult = {
      scan_id: 'test_report_001',
      url: 'https://test-college.edu.au',
      timestamp: new Date().toISOString(),
      compliance_score: 75,
      status: 'NEEDS_REVIEW',
      page_type: 'homepage',
      violations: [
        {
          id: 'cr_001',
          category: 'forbidden_claims',
          severity: 'critical',
          description: 'Found employment guarantee claim',
          text_found: 'guaranteed job',
          location: 'hero_section',
          recommendation: 'Remove employment guarantee claims',
          asqa_reference: 'Standard 4.1'
        }
      ],
      recommendations: [
        'Remove employment guarantee claims',
        'Add RTO number to homepage'
      ],
      content_analysis: {
        word_count: 150,
        page_type: 'homepage'
      }
    };

    try {
      const ReportGenerator = require('../../src/reports/reportGenerator');
      const reportGenerator = new ReportGenerator();

      console.log('  Generating PDF report...');
      const pdfResult = await reportGenerator.generatePDFReport(sampleResult);
      console.log(`  ✅ PDF generated: ${pdfResult.filename} (${pdfResult.size} bytes)`);

      console.log('  Generating HTML report...');
      const htmlResult = await reportGenerator.generateHTMLReport(sampleResult);
      console.log(`  ✅ HTML generated: ${htmlResult.filename} (${htmlResult.size} bytes)`);

      console.log('  Generating JSON report...');
      const jsonResult = await reportGenerator.generateJSONReport(sampleResult);
      console.log(`  ✅ JSON generated: ${jsonResult.filename} (${jsonResult.size} bytes)`);

      const testResult = {
        name: 'Report Generation',
        passed: true,
        pdf_generated: !!pdfResult,
        html_generated: !!htmlResult,
        json_generated: !!jsonResult
      };

      this.testResults.push(testResult);

    } catch (error) {
      const testResult = {
        name: 'Report Generation',
        passed: false,
        error: error.message
      };
      this.testResults.push(testResult);
      console.log(`  ❌ Report generation failed: ${error.message}`);
    }
  }

  async testLiveWebsite(url) {
    console.log(`\n🌐 Testing live website: ${url}`);

    try {
      console.log('  Extracting content...');
      const content = await this.scraper.extractContent(url);

      console.log(`  Content extracted: ${content.text?.length || 0} characters`);
      console.log(`  Method: ${content.method}`);
      console.log(`  Title: ${content.title}`);

      const pageType = this.scraper.detectPageType(content);
      console.log(`  Page type detected: ${pageType}`);

      console.log('  Running compliance check...');
      const startTime = Date.now();

      const result = await this.checker.checkCompliance(content, {
        url,
        pageType,
        useAI: true
      });

      const processingTime = Date.now() - startTime;

      console.log(`  ✅ Live scan completed:`);
      console.log(`     Score: ${result.compliance_score}%`);
      console.log(`     Status: ${result.status}`);
      console.log(`     Violations: ${result.violations.length}`);
      console.log(`     Processing time: ${processingTime}ms`);

      if (result.violations.length > 0) {
        console.log('  Top violations:');
        result.violations.slice(0, 3).forEach((v, i) => {
          console.log(`    ${i + 1}. ${v.description} (${v.severity})`);
        });
      }

      const testResult = {
        name: `Live Website: ${url}`,
        passed: true,
        score: result.compliance_score,
        violations: result.violations.length,
        processing_time: processingTime,
        live_test: true
      };

      this.testResults.push(testResult);

    } catch (error) {
      const testResult = {
        name: `Live Website: ${url}`,
        passed: false,
        error: error.message,
        live_test: true
      };
      this.testResults.push(testResult);
      console.log(`  ❌ Live scan failed: ${error.message}`);
    }
  }

  evaluateTestResult(result, testCase) {
    // Allow some flexibility in scoring
    const scoreRange = Math.abs(result.compliance_score - testCase.expectedScore) <= 15;
    const violationRange = Math.abs(result.violations.length - testCase.expectedViolations) <= 2;

    return scoreRange && violationRange;
  }

  displayResults() {
    console.log('\n📊 Test Results Summary');
    console.log('='.repeat(50));

    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    console.log(`\nTotal tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);

    if (failedTests > 0) {
      console.log('\nFailed tests:');
      this.testResults.filter(r => !r.passed).forEach(result => {
        console.log(`  ❌ ${result.name}`);
        if (result.error) {
          console.log(`     Error: ${result.error}`);
        } else {
          console.log(`     Expected: ~${result.expected_score}% (${result.expected_violations} violations)`);
          console.log(`     Got: ${result.score}% (${result.violations} violations)`);
        }
      });
    }

    // Performance summary
    const performanceTests = this.testResults.filter(r => r.processing_time);
    if (performanceTests.length > 0) {
      const avgTime = performanceTests.reduce((sum, r) => sum + r.processing_time, 0) / performanceTests.length;
      console.log(`\n⚡ Average processing time: ${Math.round(avgTime)}ms`);
    }

    console.log('\n🎯 Compliance checker testing completed!');
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new ComplianceTestRunner();
  tester.runTests();
}

module.exports = ComplianceTestRunner;