#!/usr/bin/env node

/**
 * AI Connections Test Script
 * Tests connectivity to various AI models and APIs
 */

require('dotenv').config();
const { getRouter } = require('../../src/ai/modelRouter');

class AIConnectionTester {
  constructor() {
    this.router = getRouter();
    this.testResults = [];
  }

  async runTests() {
    console.log('🤖 Testing AI Model Connections');
    console.log('='.repeat(50));

    try {
      await this.testAllModels();
      await this.testModelRouting();
      await this.testComplianceAnalysis();
      this.displayResults();

      if (this.allTestsPassed()) {
        console.log('\n✅ All AI tests passed! Ready for compliance scanning.');
      } else {
        console.log('\n⚠️  Some AI tests failed. Check configuration.');
      }

    } catch (error) {
      console.error('\n❌ AI testing failed:', error.message);
      process.exit(1);
    }
  }

  async testAllModels() {
    console.log('\n📡 Testing individual AI models...');

    const models = [
      { name: 'OpenAI (GPT-4)', client: this.router.clients.openai },
      { name: 'Anthropic (Claude)', client: this.router.clients.claude },
      { name: 'DeepSeek', client: this.router.clients.deepseek }
    ];

    for (const model of models) {
      await this.testModel(model);
    }
  }

  async testModel(model) {
    console.log(`\n🔍 Testing ${model.name}...`);

    try {
      // Check if configured
      if (!model.client.isConfigured()) {
        const result = {
          model: model.name,
          configured: false,
          connected: false,
          response_time: null,
          error: 'API key not configured'
        };
        this.testResults.push(result);
        console.log(`  ❌ ${model.name}: API key not configured`);
        return;
      }

      console.log(`  ✅ ${model.name}: Configured`);

      // Test basic text generation
      const startTime = Date.now();
      const testPrompt = 'Respond with "AI connection test successful" in exactly those words.';

      try {
        const response = await model.client.generateText(testPrompt, {
          temperature: 0.1,
          maxTokens: 50
        });

        const responseTime = Date.now() - startTime;
        const success = response.text && response.text.toLowerCase().includes('successful');

        const result = {
          model: model.name,
          configured: true,
          connected: success,
          response_time: responseTime,
          model_used: response.model,
          tokens_used: response.usage ? JSON.stringify(response.usage) : null,
          error: success ? null : 'Unexpected response'
        };

        this.testResults.push(result);

        if (success) {
          console.log(`  ✅ ${model.name}: Connected (${responseTime}ms)`);
        } else {
          console.log(`  ⚠️  ${model.name}: Unexpected response`);
          console.log(`     Response: ${response.text}`);
        }

      } catch (error) {
        const result = {
          model: model.name,
          configured: true,
          connected: false,
          response_time: Date.now() - startTime,
          error: error.message
        };
        this.testResults.push(result);
        console.log(`  ❌ ${model.name}: Connection failed`);
        console.log(`     Error: ${error.message}`);
      }

    } catch (error) {
      const result = {
        model: model.name,
        configured: false,
        connected: false,
        response_time: null,
        error: error.message
      };
      this.testResults.push(result);
      console.log(`  ❌ ${model.name}: Test failed`);
      console.log(`     Error: ${error.message}`);
    }
  }

  async testModelRouting() {
    console.log('\n🚦 Testing model routing and failover...');

    const testPrompt = 'What is 2 + 2? Respond with just the number.';

    try {
      const startTime = Date.now();
      const response = await this.router.callWithFailover('COMPLIANCE', testPrompt, {
        temperature: 0.1,
        maxTokens: 10
      });

      const responseTime = Date.now() - startTime;
      const success = response.text && response.text.trim() === '4';

      const result = {
        test: 'Model Routing',
        configured: true,
        connected: success,
        response_time: responseTime,
        model_used: response.model,
        tokens_used: response.usage ? JSON.stringify(response.usage) : null,
        error: success ? null : 'Routing failed'
      };

      this.testResults.push(result);

      if (success) {
        console.log(`  ✅ Model routing: Working (${responseTime}ms)`);
        console.log(`     Used model: ${response.model}`);
      } else {
        console.log(`  ❌ Model routing: Failed`);
        console.log(`     Response: ${response.text}`);
      }

    } catch (error) {
      const result = {
        test: 'Model Routing',
        configured: true,
        connected: false,
        response_time: null,
        error: error.message
      };
      this.testResults.push(result);
      console.log(`  ❌ Model routing: Failed`);
      console.log(`     Error: ${error.message}`);
    }
  }

  async testComplianceAnalysis() {
    console.log('\n🎯 Testing compliance analysis...');

    const testContent = {
      text: `Welcome to Example College (RTO 12345). We guarantee you will get a job after completing our course. You will earn $80,000 per year. Complete our program in exactly 6 months. We are better than university.`,
      url: 'https://example-college.edu.au',
      page_type: 'homepage'
    };

    try {
      const startTime = Date.now();

      // Use the compliance checker directly
      const ComplianceChecker = require('../../src/compliance/complianceChecker');
      const checker = new ComplianceChecker();

      const result = await checker.checkCompliance(testContent, {
        useAI: true,
        url: testContent.url,
        pageType: testContent.page_type
      });

      const responseTime = Date.now() - startTime;
      const success = result && typeof result.compliance_score === 'number' && result.violations;

      const testResult = {
        test: 'Compliance Analysis',
        configured: true,
        connected: success,
        response_time: responseTime,
        compliance_score: result ? result.compliance_score : null,
        violations_found: result ? result.violations.length : null,
        error: success ? null : 'Compliance analysis failed'
      };

      this.testResults.push(testResult);

      if (success) {
        console.log(`  ✅ Compliance analysis: Working (${responseTime}ms)`);
        console.log(`     Score: ${result.compliance_score}%`);
        console.log(`     Violations: ${result.violations.length}`);
      } else {
        console.log(`  ❌ Compliance analysis: Failed`);
      }

    } catch (error) {
      const result = {
        test: 'Compliance Analysis',
        configured: true,
        connected: false,
        response_time: null,
        error: error.message
      };
      this.testResults.push(result);
      console.log(`  ❌ Compliance analysis: Failed`);
      console.log(`     Error: ${error.message}`);
    }
  }

  displayResults() {
    console.log('\n📊 Test Results Summary');
    console.log('='.repeat(50));

    const configured = this.testResults.filter(r => r.configured).length;
    const connected = this.testResults.filter(r => r.connected).length;
    const total = this.testResults.length;

    console.log(`\nModels configured: ${configured}/${total}`);
    console.log(`Connections successful: ${connected}/${total}`);
    console.log(`Success rate: ${Math.round((connected / total) * 100)}%`);

    if (this.router.getStats) {
      const stats = this.router.getStats();
      console.log(`\n💰 Total cost during tests: $${stats.total_cost?.toFixed(4) || '0.0000'}`);
    }

    console.log('\nDetailed Results:');
    this.testResults.forEach(result => {
      const name = result.model || result.test;
      const status = result.connected ? '✅' : '❌';
      const time = result.response_time ? ` (${result.response_time}ms)` : '';
      const model = result.model_used ? ` [${result.model_used}]` : '';

      console.log(`  ${status} ${name}${time}${model}`);

      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
    });
  }

  allTestsPassed() {
    // At least one AI model should be connected for the app to work
    const modelTests = this.testResults.filter(r => r.model);
    const connectedModels = modelTests.filter(r => r.connected).length;

    return connectedModels > 0;
  }

  async checkEnvironment() {
    console.log('\n🔧 Checking environment configuration...');

    const requiredEnvVars = [
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY'
    ];

    const optionalEnvVars = [
      'DEEPSEEK_API_KEY',
      'NODE_ENV',
      'PORT'
    ];

    let configured = 0;
    console.log('\nRequired environment variables:');

    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        console.log(`  ✅ ${envVar}: Set`);
        configured++;
      } else {
        console.log(`  ❌ ${envVar}: Not set`);
      }
    }

    console.log('\nOptional environment variables:');
    for (const envVar of optionalEnvVars) {
      if (process.env[envVar]) {
        console.log(`  ✅ ${envVar}: Set`);
      } else {
        console.log(`  ⚪ ${envVar}: Not set (optional)`);
      }
    }

    console.log(`\nEnvironment: ${configured}/${requiredEnvVars.length} required variables configured`);
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new AIConnectionTester();

  // Check environment first
  tester.checkEnvironment()
    .then(() => tester.runTests())
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = AIConnectionTester;