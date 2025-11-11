# PDF Modernization Implementation Roadmap

## Overview
This document provides step-by-step implementation details for modernizing the RTO Compliance Checker PDF reports.

---

## Phase 1: Foundation Setup

### Step 1.1: Install Required Dependencies

```bash
npm install chart.js canvas qrcode
```

**Dependencies:**
- `chart.js`: For data visualizations (donut charts, bar charts)
- `canvas`: Backend canvas for Chart.js rendering
- `qrcode`: Generate QR codes for reports

### Step 1.2: Create Directory Structure

```bash
mkdir -p src/reports/templates
mkdir -p src/reports/styles
mkdir -p src/reports/assets/fonts
mkdir -p src/reports/assets/icons
mkdir -p src/reports/utils
```

---

## Phase 2: Puppeteer PDF Generator

### Step 2.1: Create New PDF Generator Class

**File:** `src/reports/modernPDFGenerator.js`

```javascript
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const QRCode = require('qrcode');

class ModernPDFGenerator {
  constructor() {
    this.outputDir = path.join(__dirname, '../../data/scans');
    this.templatesDir = path.join(__dirname, 'templates');
    this.stylesDir = path.join(__dirname, 'styles');
  }

  async generatePDFReport(complianceResult) {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      // Generate HTML content
      const html = await this.buildModernHTML(complianceResult);
      
      // Set content and wait for charts to render
      await page.setContent(html, { 
        waitUntil: 'networkidle0' 
      });
      
      // Generate PDF
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        displayHeaderFooter: false
      });
      
      // Save PDF
      const filename = `compliance-report-${complianceResult.scan_id}.pdf`;
      const filepath = path.join(this.outputDir, filename);
      await fs.writeFile(filepath, pdf);
      
      return {
        filename,
        filepath,
        size: pdf.length,
        format: 'PDF'
      };
      
    } finally {
      await browser.close();
    }
  }

  async buildModernHTML(result) {
    const styles = await this.getModernStyles();
    const chartScript = await this.getChartScript(result);
    const qrCode = await this.generateQRCode(result.scan_id);
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RTO Compliance Report - ${result.scan_id}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>${styles}</style>
</head>
<body>
  ${this.renderExecutiveSummary(result)}
  ${this.renderDetailedAnalysis(result)}
  ${this.renderFooter(result, qrCode)}
  ${chartScript}
</body>
</html>`;
  }

  renderExecutiveSummary(result) {
    const scoreClass = this.getScoreClass(result.compliance_score);
    const statusClass = result.status.toLowerCase().replace(/_/g, '-');
    
    return `
    <div class="page">
      <!-- Header -->
      <div class="header">
        <div class="logo-section">
          <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
          </svg>
          <div class="logo-text">
            <h1>RTO Compliance Report</h1>
            <p>ASQA Standards for RTOs 2025</p>
          </div>
        </div>
        <div class="report-meta">
          <span>Report ID: ${result.scan_id}</span>
        </div>
      </div>

      <!-- Dashboard Cards -->
      <div class="dashboard">
        <!-- Score Card -->
        <div class="card card-primary">
          <div class="card-header">
            <svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span>Compliance Score</span>
          </div>
          <div class="score-display">
            <div class="score-circle ${scoreClass}">
              <svg viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="90" class="score-bg"/>
                <circle cx="100" cy="100" r="90" class="score-fill" 
                        style="--score: ${result.compliance_score}"/>
              </svg>
              <div class="score-text">
                <span class="score-number">${result.compliance_score}</span>
                <span class="score-percent">%</span>
              </div>
            </div>
            <div class="score-label">${this.getScoreLabel(result.compliance_score)}</div>
          </div>
        </div>

        <!-- Violations Card -->
        <div class="card card-danger">
          <div class="card-header">
            <svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
            </svg>
            <span>Violations Found</span>
          </div>
          <div class="card-body">
            <div class="stat-number">${result.violations.length}</div>
            <div class="violation-breakdown">
              ${this.renderViolationBreakdown(result.violations)}
            </div>
          </div>
        </div>

        <!-- Status Card -->
        <div class="card card-info">
          <div class="card-header">
            <svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span>Overall Status</span>
          </div>
          <div class="card-body">
            <div class="status-badge ${statusClass}">
              ${result.status.replace(/_/g, ' ')}
            </div>
            <p class="status-description">${this.getStatusDescription(result.status)}</p>
          </div>
        </div>
      </div>

      <!-- Website Info -->
      <div class="info-section">
        <div class="info-item">
          <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
          </svg>
          <div>
            <div class="info-label">Website URL</div>
            <div class="info-value">${result.url}</div>
          </div>
        </div>
        <div class="info-item">
          <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          <div>
            <div class="info-label">Scan Date</div>
            <div class="info-value">${new Date(result.timestamp).toLocaleString()}</div>
          </div>
        </div>
      </div>

      <!-- Chart Section -->
      <div class="chart-section">
        <h2>Compliance Analysis</h2>
        <div class="charts-grid">
          <div class="chart-container">
            <h3>Severity Breakdown</h3>
            <canvas id="severityChart"></canvas>
          </div>
          <div class="stats-container">
            ${this.renderQuickStats(result)}
          </div>
        </div>
      </div>
    </div>`;
  }

  renderViolationBreakdown(violations) {
    const critical = violations.filter(v => v.severity === 'critical').length;
    const moderate = violations.filter(v => v.severity === 'moderate').length;
    const warning = violations.filter(v => v.severity === 'warning').length;
    
    return `
      <div class="breakdown-item critical">
        <span class="severity-icon">🚨</span>
        <span class="severity-count">${critical}</span>
        <span class="severity-label">Critical</span>
      </div>
      <div class="breakdown-item moderate">
        <span class="severity-icon">⚠️</span>
        <span class="severity-count">${moderate}</span>
        <span class="severity-label">Moderate</span>
      </div>
      <div class="breakdown-item warning">
        <span class="severity-icon">💡</span>
        <span class="severity-count">${warning}</span>
        <span class="severity-label">Warning</span>
      </div>`;
  }

  renderQuickStats(result) {
    const totalRules = (result.violations?.length || 0) + (result.passed_rules?.length || 0);
    
    return `
      <h3>Quick Stats</h3>
      <div class="stats-list">
        <div class="stat-item">
          <div class="stat-value">${totalRules}</div>
          <div class="stat-label">Rules Checked</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${result.violations.length}</div>
          <div class="stat-label">Issues Found</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${result.passed_rules?.length || 0}</div>
          <div class="stat-label">Rules Passed</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${result.recommendations?.length || 0}</div>
          <div class="stat-label">Action Items</div>
        </div>
      </div>`;
  }

  renderDetailedAnalysis(result) {
    return `
    <div class="page">
      ${this.renderViolations(result)}
      ${this.renderRecommendations(result)}
      ${result.passed_rules && result.passed_rules.length > 0 ? this.renderPassedRules(result) : ''}
    </div>`;
  }

  renderViolations(result) {
    if (!result.violations || result.violations.length === 0) {
      return `
        <div class="section success-section">
          <h2>✅ No Violations Found</h2>
          <p>Excellent! Your website meets all ASQA/AQF compliance standards.</p>
        </div>`;
    }

    const critical = result.violations.filter(v => v.severity === 'critical');
    const moderate = result.violations.filter(v => v.severity === 'moderate');
    const warning = result.violations.filter(v => v.severity === 'warning');

    return `
      ${critical.length > 0 ? this.renderViolationSection('Critical Violations', critical, 'critical') : ''}
      ${moderate.length > 0 ? this.renderViolationSection('Moderate Issues', moderate, 'moderate') : ''}
      ${warning.length > 0 ? this.renderViolationSection('Warnings', warning, 'warning') : ''}
    `;
  }

  renderViolationSection(title, violations, severity) {
    const icons = {
      critical: '🚨',
      moderate: '⚠️',
      warning: '💡'
    };

    return `
      <div class="section violation-section ${severity}">
        <h2>${icons[severity]} ${title} (${violations.length})</h2>
        ${violations.map((v, i) => `
          <div class="violation-card ${severity}">
            <div class="violation-number">${i + 1}</div>
            <div class="violation-content">
              <h3>${v.description}</h3>
              ${v.text_found ? `
                <div class="violation-detail">
                  <strong>Found:</strong> <code>"${v.text_found}"</code>
                </div>` : ''}
              <div class="violation-detail">
                <strong>Location:</strong> ${v.location}
              </div>
              ${v.recommendation ? `
                <div class="recommendation-box">
                  <strong>💡 Recommendation:</strong> ${v.recommendation}
                </div>` : ''}
              ${v.asqa_reference ? `
                <div class="reference">
                  <strong>ASQA Reference:</strong> ${v.asqa_reference}
                </div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>`;
  }

  renderRecommendations(result) {
    if (!result.recommendations || result.recommendations.length === 0) {
      return '';
    }

    return `
      <div class="section recommendations-section">
        <h2>📋 Recommendations for Improvement</h2>
        <div class="recommendations-list">
          ${result.recommendations.map((rec, i) => `
            <div class="recommendation-item">
              <div class="recommendation-number">${i + 1}</div>
              <div class="recommendation-text">${rec}</div>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  renderPassedRules(result) {
    return `
      <div class="section passed-section">
        <h2>✅ Passed Compliance Rules (${result.passed_rules.length})</h2>
        <div class="passed-grid">
          ${result.passed_rules.map(rule => `
            <div class="passed-item">
              <svg class="check-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
              <span>${rule.description}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  renderFooter(result, qrCode) {
    return `
      <div class="footer">
        <div class="footer-content">
          <div class="footer-left">
            <div class="footer-logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
              <span>RTO Compliance Checker</span>
            </div>
            <p>Generated on ${new Date().toLocaleString()}</p>
            <p>Based on ASQA Standards for RTOs 2025 and AQF requirements</p>
          </div>
          <div class="footer-right">
            <img src="${qrCode}" alt="Report QR Code" class="qr-code"/>
            <p class="qr-label">Scan for online version</p>
          </div>
        </div>
      </div>`;
  }

  async getChartScript(result) {
    const critical = result.violations.filter(v => v.severity === 'critical').length;
    const moderate = result.violations.filter(v => v.severity === 'moderate').length;
    const warning = result.violations.filter(v => v.severity === 'warning').length;

    return `
    <script>
      window.addEventListener('load', function() {
        const ctx = document.getElementById('severityChart');
        new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['Critical', 'Moderate', 'Warning'],
            datasets: [{
              data: [${critical}, ${moderate}, ${warning}],
              backgroundColor: ['#EF4444', '#F97316', '#3B82F6'],
              borderWidth: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  padding: 15,
                  font: { size: 12 }
                }
              }
            }
          }
        });
      });
    </script>`;
  }

  async generateQRCode(scanId) {
    const url = `https://compliance.example.com/reports/${scanId}`;
    return await QRCode.toDataURL(url);
  }

  // Helper methods
  getScoreClass(score) {
    if (score >= 95) return 'score-excellent';
    if (score >= 85) return 'score-good';
    if (score >= 75) return 'score-acceptable';
    return 'score-poor';
  }

  getScoreLabel(score) {
    if (score >= 95) return 'Excellent';
    if (score >= 85) return 'Good';
    if (score >= 75) return 'Acceptable';
    return 'Needs Improvement';
  }

  getStatusDescription(status) {
    const descriptions = {
      'PASS': 'Your website meets all ASQA/AQF compliance standards.',
      'PASS_WITH_NOTES': 'Good compliance with minor recommendations for improvement.',
      'NEEDS_REVIEW': 'Several violations require attention.',
      'ACTION_REQUIRED': 'Significant compliance issues need immediate action.',
      'FAIL': 'Critical violations must be resolved before ASQA audit.'
    };
    return descriptions[status] || '';
  }

  async getModernStyles() {
    // CSS will be in next step
    return '/* Styles defined in next step */';
  }
}

module.exports = ModernPDFGenerator;
```

This implementation provides:
1. ✅ Puppeteer-based PDF generation
2. ✅ Modern HTML template with dashboard
3. ✅ Visual score gauge
4. ✅ Color-coded violation cards
5. ✅ Chart.js integration for visualizations
6. ✅ QR code generation
7. ✅ Professional layout and structure

Next steps would be to create the CSS styles file and integrate this into the existing report generation system.