const fs = require('fs').promises;
const path = require('path');
const { getRouter } = require('../ai/modelRouter');
const { WebScraper } = require('../web/scraper');

class ComplianceChecker {
  constructor() {
    this.router = getRouter();
    this.scraper = new WebScraper();
    this.rulesPath = path.join(__dirname, '../../data/compliance/asqa-aqf-rules.json');
    this.rules = null;
    this.loadRules();
  }

  async loadRules() {
    try {
      const rulesData = await fs.readFile(this.rulesPath, 'utf8');
      this.rules = JSON.parse(rulesData);
    } catch (error) {
      console.error('Failed to load compliance rules:', error);
      throw new Error('Compliance rules not available');
    }
  }

  async checkCompliance(content, options = {}) {
    if (!this.rules) {
      await this.loadRules();
    }

    const {
      url = '',
      pageType = 'general',
      includeRecommendations = true,
      useAI = true
    } = options;

    try {
      // Perform basic rule-based checking
      const basicResults = this.performBasicChecks(content, pageType);

      // If AI analysis is enabled and configured
      let aiResults = null;
      if (useAI && this.isAIConfigured()) {
        try {
          aiResults = await this.performAIAnalysis(content, pageType);
        } catch (aiError) {
          console.warn('AI analysis failed, using rule-based results only:', aiError.message);
        }
      }

      // Combine results
      const combinedResults = this.combineResults(basicResults, aiResults);

      // Calculate final score
      const finalScore = this.calculateComplianceScore(combinedResults);

      // Generate recommendations
      const recommendations = includeRecommendations
        ? this.generateRecommendations(combinedResults, pageType)
        : [];

      return {
        scan_id: this.generateScanId(),
        url,
        page_type: pageType,
        timestamp: new Date().toISOString(),
        compliance_score: finalScore,
        status: this.determineStatus(finalScore),
        violations: combinedResults.violations,
        required_elements: combinedResults.required_elements,
        passed_rules: combinedResults.passed_rules,
        recommendations,
        content_analysis: {
          word_count: content.text ? content.text.split(/\s+/).length : 0,
          page_type: pageType,
          extraction_method: content.method || 'unknown'
        },
        ai_analysis: aiResults ? {
          model_used: aiResults.model,
          confidence: aiResults.confidence || 0.8,
          processing_time: aiResults.processing_time
        } : null
      };
    } catch (error) {
      throw new Error(`Compliance check failed: ${error.message}`);
    }
  }

  performBasicChecks(content, pageType) {
    const text = content.text || '';
    const violations = [];
    const requiredElements = [];
    const passedRules = [];

    // Check critical violations
    for (const rule of this.rules.rules.critical_violations) {
      const matches = this.findMatches(text, rule);
      if (matches.length > 0) {
        violations.push(...matches.map(match => ({
          id: rule.id,
          category: rule.category,
          severity: rule.severity,
          description: rule.description,
          text_found: match.text,
          location: match.location,
          recommendation: this.getRuleRecommendation(rule),
          asqa_reference: rule.asqa_reference
        })));
      } else {
        // Rule passed - no violations found
        passedRules.push({
          id: rule.id,
          category: rule.category,
          type: 'critical_violation',
          description: rule.description,
          status: 'passed',
          message: `No forbidden ${rule.name.replace('_', ' ')} found`,
          asqa_reference: rule.asqa_reference
        });
      }
    }

    // Check required terminology
    for (const rule of this.rules.rules.required_terminology) {
      const matches = this.findMatches(text, rule);
      if (matches.length > 0) {
        violations.push(...matches.map(match => ({
          id: rule.id,
          category: rule.category,
          severity: rule.severity,
          description: rule.description,
          text_found: match.text,
          location: match.location,
          recommendation: rule.correction,
          asqa_reference: rule.asqa_reference
        })));
      } else {
        // Rule passed - correct terminology used
        passedRules.push({
          id: rule.id,
          category: rule.category,
          type: 'required_terminology',
          description: rule.description,
          status: 'passed',
          message: `Correct terminology used - no ${rule.name.replace('_', ' ')} violations found`,
          asqa_reference: rule.asqa_reference
        });
      }
    }

    // Check required disclaimers
    for (const rule of this.rules.rules.required_disclaimers) {
      const matches = this.findMatches(text, rule);
      if (matches.length === 0 && rule.required) {
        violations.push({
          id: rule.id,
          category: rule.category,
          severity: rule.severity,
          description: `Missing required disclaimer: ${rule.description}`,
          text_found: '',
          location: 'entire_page',
          recommendation: `Add: ${rule.description}`,
          asqa_reference: rule.asqa_reference
        });
      } else if (matches.length > 0) {
        requiredElements.push({
          id: rule.id,
          type: 'disclaimer',
          description: rule.description,
          found: true,
          asqa_reference: rule.asqa_reference
        });
      }
    }

    // Check web-specific requirements
    for (const rule of this.rules.rules.web_specific_requirements) {
      let found = false;
      let location = '';

      switch (rule.id) {
        case 'ws_001': // Contact information
          if (content.links && content.links.some(link =>
            link.text.toLowerCase().includes('contact') ||
            link.href.toLowerCase().includes('contact')
          )) {
            found = true;
            location = 'navigation';
          } else if (text.match(/(\d{2,3}[\s-]?\d{3,4}[\s-]?\d{3,4}|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)) {
            found = true;
            location = 'content';
          }
          break;

        case 'ws_002': // Privacy policy
          if (content.links && content.links.some(link =>
            link.text.toLowerCase().includes('privacy') &&
            link.text.toLowerCase().includes('policy')
          )) {
            found = true;
            location = 'navigation';
          }
          break;

        case 'ws_003': // Fee disclosure
          if (text.match(/\$\d+|\bfee|\bcost|\bprice|\btuition/i)) {
            found = true;
            location = 'content';
          }
          break;

        case 'ws_004': // Refund policy
          if (content.links && content.links.some(link =>
            link.text.toLowerCase().includes('refund') &&
            link.text.toLowerCase().includes('policy')
          )) {
            found = true;
            location = 'navigation';
          }
          break;
      }

      if (!found && rule.required) {
        violations.push({
          id: rule.id,
          category: rule.category,
          severity: rule.severity,
          description: `Missing required web element: ${rule.description}`,
          text_found: '',
          location: 'entire_page',
          recommendation: `Add: ${rule.description}`,
          asqa_reference: rule.asqa_reference
        });
      } else if (found) {
        requiredElements.push({
          id: rule.id,
          type: 'web_requirement',
          description: rule.description,
          found: true,
          location,
          asqa_reference: rule.asqa_reference
        });

        // Also add to passed rules
        passedRules.push({
          id: rule.id,
          category: rule.category,
          type: 'web_requirement',
          description: rule.description,
          status: 'passed',
          message: `Required web element found: ${rule.description}`,
          location,
          asqa_reference: rule.asqa_reference
        });
      }
    }

    return {
      violations,
      required_elements: requiredElements,
      passed_rules: passedRules,
      method: 'rule_based'
    };
  }

  async performAIAnalysis(content, pageType) {
    const startTime = Date.now();

    try {
      const prompt = this.buildAIPrompt(content, pageType);
      const result = await this.router.callWithFailover('COMPLIANCE', prompt, {
        temperature: 0.1,
        maxTokens: 8192
      });

      // Parse AI response
      let aiAnalysis;
      try {
        aiAnalysis = JSON.parse(result.text);
      } catch (parseError) {
        // If JSON parsing fails, create a basic structure
        aiAnalysis = {
          compliance_score: 75,
          violations: [],
          recommendations: [result.text.substring(0, 500)],
          summary: 'AI analysis completed but response format needs refinement'
        };
      }

      return {
        ...aiAnalysis,
        model: result.model || 'unknown',
        confidence: 0.85,
        processing_time: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`AI analysis failed: ${error.message}`);
    }
  }

  buildAIPrompt(content, pageType) {
    return `You are an expert ASQA/AQF compliance analyst. Analyze this RTO web content for compliance violations.

Page Type: ${pageType}
Content: ${content.text?.substring(0, 8000) || ''}

Analyze against these ASQA/AQF requirements:
1. Forbidden claims: employment guarantees, salary promises, completion time guarantees
2. Required terminology: proper use of "unit" vs "course", RTO identification
3. Required disclaimers: RPL availability, nationally recognised training
4. Web requirements: contact info, privacy policy, fee disclosure
5. Marketing guidelines: accurate claims, verifiable testimonials

Provide your analysis in this exact JSON format:
{
  "compliance_score": 0-100,
  "violations": [
    {
      "id": "rule_id",
      "category": "critical_violations|required_terminology|required_disclaimers|web_specific_requirements",
      "severity": "critical|moderate|warning",
      "description": "specific issue description",
      "text_found": "exact text that violates the rule",
      "location": "where in the content this was found",
      "recommendation": "specific fix recommendation"
    }
  ],
  "recommendations": ["improvement suggestions"],
  "summary": "brief analysis summary"
}

Be thorough but practical. Focus on actual violations that would impact ASQA compliance.`;
  }

  combineResults(basicResults, aiResults) {
    const combined = {
      violations: [...(basicResults.violations || [])],
      required_elements: basicResults.required_elements || [],
      passed_rules: [...(basicResults.passed_rules || [])]
    };

    // Add AI violations if available
    if (aiResults && aiResults.violations) {
      // Merge violations, avoiding duplicates
      for (const aiViolation of aiResults.violations) {
        const isDuplicate = combined.violations.some(existing =>
          existing.text_found === aiViolation.text_found &&
          existing.category === aiViolation.category
        );

        if (!isDuplicate) {
          combined.violations.push({
            ...aiViolation,
            source: 'ai_analysis'
          });
        }
      }
    }

    return combined;
  }

  calculateComplianceScore(results) {
    let score = 100;

    // Deduct points for violations
    for (const violation of results.violations) {
      const weights = this.rules.compliance_thresholds.severity_weights;
      const weight = weights[violation.severity] || 10;
      score -= weight;
    }

    // Ensure score doesn't go below 0
    score = Math.max(0, score);

    // Bonus points for having all required elements
    if (results.required_elements && results.required_elements.length > 0) {
      const allRequiredFound = results.required_elements.every(el => el.found);
      if (allRequiredFound) {
        score = Math.min(100, score + 5);
      }
    }

    return Math.round(score);
  }

  determineStatus(score) {
    const thresholds = this.rules.compliance_thresholds.overall_score;

    if (score >= thresholds.excellent) return 'PASS';
    if (score >= thresholds.good) return 'PASS_WITH_NOTES';
    if (score >= thresholds.acceptable) return 'NEEDS_REVIEW';
    if (score >= thresholds.needs_improvement) return 'ACTION_REQUIRED';
    return 'FAIL';
  }

  generateRecommendations(results, pageType) {
    const recommendations = [];

    // Add specific recommendations from violations
    for (const violation of results.violations) {
      if (violation.recommendation) {
        recommendations.push(violation.recommendation);
      }
    }

    // Add page-type specific recommendations
    if (pageType === 'homepage') {
      recommendations.push('Ensure RTO number is prominently displayed on homepage');
      recommendations.push('Include clear contact information and privacy policy link');
    } else if (pageType === 'course') {
      recommendations.push('Use "unit of competency" instead of "course" when referring to unit codes');
      recommendations.push('Include RPL availability information');
    }

    // Add best practice recommendations
    if (results.violations.some(v => v.severity === 'critical')) {
      recommendations.push('Immediate action required: Address all critical violations before ASQA audit');
    }

    // Remove duplicates
    return [...new Set(recommendations)];
  }

  findMatches(text, rule) {
    const matches = [];

    if (!rule.pattern || !text) return matches;

    try {
      const regex = new RegExp(rule.pattern, rule.flags || 'gi');
      let match;

      while ((match = regex.exec(text)) !== null) {
        matches.push({
          text: match[0],
          index: match.index,
          location: this.estimateLocation(text, match.index)
        });
      }
    } catch (error) {
      console.warn(`Invalid regex pattern for rule ${rule.id}:`, error.message);
    }

    return matches;
  }

  estimateLocation(text, index) {
    const before = text.substring(0, index);
    const wordCount = before.split(/\s+/).length;

    if (wordCount < 50) return 'beginning';
    if (wordCount < 200) return 'middle';
    return 'end';
  }

  getRuleRecommendation(rule) {
    if (rule.examples && rule.examples.compliant) {
      return `Example of compliant text: "${rule.examples.compliant}"`;
    }
    return `Remove or revise the violating content to meet ASQA requirements`;
  }

  isAIConfigured() {
    return this.router.clients.claude?.isConfigured() ||
           this.router.clients.openai?.isConfigured();
  }

  generateScanId() {
    return `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async checkMultiplePages(urls, options = {}) {
    const results = [];

    for (const url of urls) {
      try {
        // Extract content
        const content = await this.scraper.extractContent(url, options.scraping);

        // Detect page type
        const pageType = this.scraper.detectPageType(content);

        // Check compliance
        const result = await this.checkCompliance(content, {
          ...options,
          url,
          pageType
        });

        results.push(result);
      } catch (error) {
        results.push({
          url,
          error: error.message,
          compliance_score: 0,
          status: 'ERROR'
        });
      }
    }

    return results;
  }

  async generateSummaryReport(results) {
    const totalScore = results.reduce((sum, r) => sum + (r.compliance_score || 0), 0);
    const averageScore = Math.round(totalScore / results.length);

    const allViolations = results.flatMap(r => r.violations || []);
    const violationCounts = allViolations.reduce((acc, v) => {
      acc[v.severity] = (acc[v.severity] || 0) + 1;
      return acc;
    }, {});

    return {
      summary: {
        total_pages: results.length,
        average_compliance_score: averageScore,
        overall_status: this.determineStatus(averageScore),
        total_violations: allViolations.length,
        violation_breakdown: violationCounts,
        scan_completed: new Date().toISOString()
      },
      pages: results,
      recommendations: this.generateSiteWideRecommendations(allViolations)
    };
  }

  generateSiteWideRecommendations(violations) {
    const recommendations = [];
    const categories = [...new Set(violations.map(v => v.category))];

    for (const category of categories) {
      const categoryViolations = violations.filter(v => v.category === category);
      if (categoryViolations.length > 1) {
        recommendations.push(`${category.replace(/_/g, ' ')}: ${categoryViolations.length} violations found across the site`);
      }
    }

    const criticalViolations = violations.filter(v => v.severity === 'critical');
    if (criticalViolations.length > 0) {
      recommendations.push('URGENT: Address all critical violations immediately to avoid ASQA penalties');
    }

    return recommendations;
  }
}

module.exports = ComplianceChecker;