const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const QRCode = require('qrcode');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

class ModernPDFGenerator {
  constructor() {
    this.outputDir = path.join(__dirname, '../../data/scans');
    this.ensureOutputDir();
  }

  async ensureOutputDir() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to create output directory:', error.message);
    }
  }

  async generatePDFReport(complianceResult) {
    let browser;
    
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      });

      const page = await browser.newPage();
      
      // Generate HTML content
      const html = await this.buildModernHTML(complianceResult);
      
      // Set content with a simpler wait strategy
      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });
      
      // Use page.evaluate with setTimeout instead of waitForTimeout
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));
      
      // Generate PDF with optimized settings
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '15mm',
          right: '15mm',
          bottom: '15mm',
          left: '15mm'
        },
        displayHeaderFooter: false,
        preferCSSPageSize: true
      });
      
      // Save PDF
      const filename = `compliance-report-${complianceResult.scan_id}.pdf`;
      const filepath = path.join(this.outputDir, filename);
      await fs.writeFile(filepath, pdf);
      
      console.log(`✅ Modern PDF generated: ${filename} (${(pdf.length / 1024).toFixed(2)} KB)`);
      
      return {
        filename,
        filepath,
        size: pdf.length,
        format: 'PDF'
      };
      
    } catch (error) {
      console.error('PDF generation error:', error);
      throw new Error(`Modern PDF generation failed: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async buildModernHTML(result) {
    const styles = await this.getModernStyles();
    const qrCode = await this.generateQRCode(result.scan_id);
    const chartImage = await this.generateSeverityChart(result.violations);
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RTO Compliance Report - ${result.scan_id}</title>
  <style>${styles}</style>
</head>
<body>
  ${this.renderCoverPage(result)}
  ${this.renderExecutiveSummary(result, chartImage)}
  ${this.renderDetailedAnalysis(result)}
  ${this.renderFooter(result, qrCode)}
</body>
</html>`;
  }

  renderCoverPage(result) {
    const scoreClass = this.getScoreClass(result.compliance_score);
    const statusClass = result.status.toLowerCase().replace(/_/g, '-');
    
    return `
    <div class="page cover-page">
      <div class="cover-header">
        <div class="logo-section">
          <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
          </svg>
          <div class="logo-text">
            <h1>RTO COMPLIANCE REPORT</h1>
            <p>ASQA Standards for RTOs 2025</p>
          </div>
        </div>
      </div>

      <div class="cover-main">
        <div class="score-showcase ${scoreClass}">
          <div class="score-ring">
            <svg viewBox="0 0 200 200">
              <circle class="ring-bg" cx="100" cy="100" r="80"/>
              <circle class="ring-progress" cx="100" cy="100" r="80" 
                      style="stroke-dasharray: ${(result.compliance_score / 100) * 502.4} 502.4"/>
            </svg>
            <div class="score-content">
              <div class="score-number">${result.compliance_score}</div>
              <div class="score-unit">%</div>
              <div class="score-label">${this.getScoreLabel(result.compliance_score)}</div>
            </div>
          </div>
        </div>

        <div class="cover-info">
          <div class="info-row">
            <span class="info-label">Website:</span>
            <span class="info-value">${result.url}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Scan Date:</span>
            <span class="info-value">${new Date(result.timestamp).toLocaleDateString('en-AU', { 
              year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Report ID:</span>
            <span class="info-value">${result.scan_id}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Status:</span>
            <span class="status-badge ${statusClass}">${result.status.replace(/_/g, ' ')}</span>
          </div>
        </div>
      </div>

      <div class="cover-footer">
        <p>This report provides a comprehensive analysis of your website's compliance with ASQA and AQF requirements.</p>
      </div>
    </div>`;
  }

  renderExecutiveSummary(result, chartImage) {
    const critical = result.violations.filter(v => v.severity === 'critical').length;
    const moderate = result.violations.filter(v => v.severity === 'moderate').length;
    const warning = result.violations.filter(v => v.severity === 'warning').length;
    const totalRules = (result.violations?.length || 0) + (result.passed_rules?.length || 0);

    return `
    <div class="page">
      <h1 class="page-title">Executive Summary</h1>
      
      <div class="dashboard">
        <div class="card card-score">
          <div class="card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="card-content">
            <div class="card-label">Compliance Score</div>
            <div class="card-value">${result.compliance_score}%</div>
            <div class="card-sublabel">${this.getScoreLabel(result.compliance_score)}</div>
          </div>
        </div>

        <div class="card card-violations">
          <div class="card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
            </svg>
          </div>
          <div class="card-content">
            <div class="card-label">Total Issues</div>
            <div class="card-value">${result.violations.length}</div>
            <div class="breakdown">
              <span class="breakdown-item critical">🚨 ${critical}</span>
              <span class="breakdown-item moderate">⚠️ ${moderate}</span>
              <span class="breakdown-item warning">💡 ${warning}</span>
            </div>
          </div>
        </div>

        <div class="card card-rules">
          <div class="card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
            </svg>
          </div>
          <div class="card-content">
            <div class="card-label">Rules Checked</div>
            <div class="card-value">${totalRules}</div>
            <div class="card-sublabel">${result.passed_rules?.length || 0} Passed</div>
          </div>
        </div>
      </div>

      <div class="analysis-section">
        <div class="chart-container">
          <h2 class="section-title">Severity Breakdown</h2>
          <img src="${chartImage}" alt="Severity Distribution" class="chart-image"/>
        </div>

        <div class="quick-stats">
          <h2 class="section-title">Quick Statistics</h2>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-icon">📊</div>
              <div class="stat-content">
                <div class="stat-value">${totalRules}</div>
                <div class="stat-label">Total Rules</div>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-icon">✅</div>
              <div class="stat-content">
                <div class="stat-value">${result.passed_rules?.length || 0}</div>
                <div class="stat-label">Passed</div>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-icon">⚠️</div>
              <div class="stat-content">
                <div class="stat-value">${result.violations.length}</div>
                <div class="stat-label">Failed</div>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-icon">📋</div>
              <div class="stat-content">
                <div class="stat-value">${result.recommendations?.length || 0}</div>
                <div class="stat-label">Actions</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      ${this.renderKeyFindings(result)}
    </div>`;
  }

  renderKeyFindings(result) {
    const criticalViolations = result.violations.filter(v => v.severity === 'critical').slice(0, 3);
    
    if (criticalViolations.length === 0) {
      return `
        <div class="findings-section success">
          <h2 class="section-title">✅ Key Findings</h2>
          <div class="success-message">
            <p><strong>Excellent Compliance!</strong></p>
            <p>No critical violations were found. Your website meets ASQA/AQF standards.</p>
          </div>
        </div>`;
    }

    return `
      <div class="findings-section">
        <h2 class="section-title">🎯 Key Findings</h2>
        <div class="findings-list">
          ${criticalViolations.map((v, i) => `
            <div class="finding-item">
              <div class="finding-number">${i + 1}</div>
              <div class="finding-content">
                <h3>${v.description}</h3>
                <p class="finding-location">📍 ${v.location}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  renderDetailedAnalysis(result) {
    return `
    <div class="page">
      <h1 class="page-title">Detailed Analysis</h1>
      ${this.renderViolations(result)}
      ${this.renderRecommendations(result)}
      ${result.passed_rules && result.passed_rules.length > 0 ? this.renderPassedRules(result) : ''}
      ${result.ai_analysis ? this.renderAIAnalysis(result) : ''}
    </div>`;
  }

  renderViolations(result) {
    if (!result.violations || result.violations.length === 0) {
      return `
        <div class="section success-section">
          <h2 class="section-title">✅ No Violations Found</h2>
          <p class="success-text">Excellent! Your website meets all ASQA/AQF compliance standards.</p>
        </div>`;
    }

    const critical = result.violations.filter(v => v.severity === 'critical');
    const moderate = result.violations.filter(v => v.severity === 'moderate');
    const warning = result.violations.filter(v => v.severity === 'warning');

    return `
      ${critical.length > 0 ? this.renderViolationSection('🚨 Critical Violations', critical, 'critical') : ''}
      ${moderate.length > 0 ? this.renderViolationSection('⚠️ Moderate Issues', moderate, 'moderate') : ''}
      ${warning.length > 0 ? this.renderViolationSection('💡 Warnings', warning, 'warning') : ''}
    `;
  }

  renderViolationSection(title, violations, severity) {
    return `
      <div class="section violation-section">
        <h2 class="section-title ${severity}">${title} (${violations.length})</h2>
        <div class="violations-list">
          ${violations.map((v, i) => `
            <div class="violation-card ${severity}">
              <div class="violation-header">
                <span class="violation-number">${i + 1}</span>
                <h3 class="violation-title">${v.description}</h3>
              </div>
              <div class="violation-body">
                ${v.text_found ? `
                  <div class="violation-detail">
                    <strong>Found:</strong> <code>"${this.escapeHtml(v.text_found)}"</code>
                  </div>` : ''}
                <div class="violation-detail">
                  <strong>Location:</strong> ${v.location}
                </div>
                ${v.recommendation ? `
                  <div class="recommendation-box">
                    <div class="recommendation-label">💡 Recommendation</div>
                    <p>${v.recommendation}</p>
                  </div>` : ''}
                ${v.asqa_reference ? `
                  <div class="reference">
                    <strong>ASQA Reference:</strong> ${v.asqa_reference}
                  </div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  renderRecommendations(result) {
    if (!result.recommendations || result.recommendations.length === 0) {
      return '';
    }

    return `
      <div class="section recommendations-section">
        <h2 class="section-title">📋 Recommendations for Improvement</h2>
        <div class="recommendations-list">
          ${result.recommendations.map((rec, i) => `
            <div class="recommendation-item">
              <div class="recommendation-number">${i + 1}</div>
              <p class="recommendation-text">${rec}</p>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  renderPassedRules(result) {
    return `
      <div class="section passed-section">
        <h2 class="section-title">✅ Passed Compliance Rules (${result.passed_rules.length})</h2>
        <div class="passed-grid">
          ${result.passed_rules.slice(0, 20).map(rule => `
            <div class="passed-item">
              <svg class="check-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
              <span>${rule.description}</span>
            </div>
          `).join('')}
          ${result.passed_rules.length > 20 ? `
            <div class="passed-item more">
              <span>...and ${result.passed_rules.length - 20} more</span>
            </div>` : ''}
        </div>
      </div>`;
  }

  renderAIAnalysis(result) {
    return `
      <div class="section ai-section">
        <h2 class="section-title">🤖 AI Analysis Details</h2>
        <div class="ai-grid">
          <div class="ai-stat">
            <div class="ai-label">Model Used</div>
            <div class="ai-value">${result.ai_analysis.model_used || 'N/A'}</div>
          </div>
          <div class="ai-stat">
            <div class="ai-label">Confidence</div>
            <div class="ai-value">${result.ai_analysis.confidence ? Math.round(result.ai_analysis.confidence * 100) + '%' : 'N/A'}</div>
          </div>
          <div class="ai-stat">
            <div class="ai-label">Processing Time</div>
            <div class="ai-value">${result.ai_analysis.processing_time || 'N/A'}ms</div>
          </div>
        </div>
      </div>`;
  }

  renderFooter(result, qrCode) {
    return `
      <div class="report-footer">
        <div class="footer-content">
          <div class="footer-left">
            <div class="footer-logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
              <span>RTO Compliance Checker</span>
            </div>
            <div class="footer-info">
              <p>Generated on ${new Date().toLocaleString('en-AU')}</p>
              <p>Based on ASQA Standards for RTOs 2025 and AQF requirements</p>
              <p class="footer-disclaimer">This report is for informational purposes. Please consult with ASQA compliance experts for official assessments.</p>
            </div>
          </div>
          <div class="footer-right">
            <img src="${qrCode}" alt="Report QR Code" class="qr-code"/>
            <p class="qr-label">Scan for online version</p>
          </div>
        </div>
      </div>`;
  }

  async generateSeverityChart(violations) {
    const critical = violations.filter(v => v.severity === 'critical').length;
    const moderate = violations.filter(v => v.severity === 'moderate').length;
    const warning = violations.filter(v => v.severity === 'warning').length;

    const width = 400;
    const height = 300;
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

    const configuration = {
      type: 'doughnut',
      data: {
        labels: ['Critical', 'Moderate', 'Warning'],
        datasets: [{
          data: [critical, moderate, warning],
          backgroundColor: ['#EF4444', '#F97316', '#3B82F6'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              font: { size: 14, family: 'Arial' },
              color: '#374151'
            }
          }
        }
      }
    };

    const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  }

  async generateQRCode(scanId) {
    const url = `https://compliance-checker.example.com/reports/${scanId}`;
    return await QRCode.toDataURL(url, {
      width: 150,
      margin: 1,
      color: {
        dark: '#374151',
        light: '#FFFFFF'
      }
    });
  }

  async getModernStyles() {
    return `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
        color: #1F2937;
        background: white;
      }

      .page {
        page-break-after: always;
        padding: 20px;
        min-height: 100vh;
      }

      .page:last-child {
        page-break-after: auto;
      }

      /* Cover Page */
      .cover-page {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        text-align: center;
      }

      .cover-header {
        padding: 40px 20px;
      }

      .logo-section {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 20px;
      }

      .logo-icon {
        width: 60px;
        height: 60px;
        stroke-width: 2;
      }

      .logo-text h1 {
        font-size: 36px;
        font-weight: 700;
        letter-spacing: 1px;
        margin-bottom: 5px;
      }

      .logo-text p {
        font-size: 14px;
        opacity: 0.9;
      }

      .cover-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px;
      }

      .score-showcase {
        margin-bottom: 40px;
      }

      .score-ring {
        position: relative;
        width: 280px;
        height: 280px;
      }

      .score-ring svg {
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
      }

      .ring-bg {
        fill: none;
        stroke: rgba(255, 255, 255, 0.2);
        stroke-width: 16;
      }

      .ring-progress {
        fill: none;
        stroke: white;
        stroke-width: 16;
        stroke-linecap: round;
        transition: stroke-dasharray 1s ease;
      }

      .score-content {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
      }

      .score-number {
        font-size: 72px;
        font-weight: 700;
        line-height: 1;
      }

      .score-unit {
        font-size: 32px;
        opacity: 0.9;
      }

      .score-label {
        font-size: 18px;
        margin-top: 10px;
        opacity: 0.95;
        font-weight: 500;
      }

      .cover-info {
        background: rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        padding: 30px;
        max-width: 600px;
        width: 100%;
      }

      .info-row {
        display: flex;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      }

      .info-row:last-child {
        border-bottom: none;
      }

      .info-label {
        font-weight: 600;
        opacity: 0.9;
      }

      .info-value {
        text-align: right;
        font-weight: 500;
      }

      .status-badge {
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        background: rgba(255, 255, 255, 0.3);
      }

      .cover-footer {
        padding: 30px;
        opacity: 0.9;
      }

      /* Page Title */
      .page-title {
        font-size: 32px;
        font-weight: 700;
        color: #111827;
        margin-bottom: 30px;
        padding-bottom: 15px;
        border-bottom: 3px solid #667eea;
      }

      /* Dashboard Cards */
      .dashboard {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
        margin-bottom: 40px;
      }

      .card {
        background: white;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        border: 1px solid #E5E7EB;
      }

      .card-icon {
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        stroke-width: 2;
      }

      .card-score .card-icon { stroke: #10B981; }
      .card-violations .card-icon { stroke: #EF4444; }
      .card-rules .card-icon { stroke: #3B82F6; }

      .card-label {
        font-size: 14px;
        color: #6B7280;
        margin-bottom: 8px;
      }

      .card-value {
        font-size: 36px;
        font-weight: 700;
        color: #111827;
        line-height: 1;
      }

      .card-sublabel {
        font-size: 14px;
        color: #6B7280;
        margin-top: 8px;
      }

      .breakdown {
        display: flex;
        gap: 12px;
        margin-top: 12px;
        font-size: 14px;
      }

      .breakdown-item {
        padding: 4px 8px;
        border-radius: 6px;
        background: #F3F4F6;
        font-weight: 500;
      }

      .breakdown-item.critical { background: #FEE2E2; color: #991B1B; }
      .breakdown-item.moderate { background: #FFEDD5; color: #9A3412; }
      .breakdown-item.warning { background: #DBEAFE; color: #1E40AF; }

      /* Analysis Section */
      .analysis-section {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 30px;
        margin-bottom: 40px;
      }

      .section-title {
        font-size: 20px;
        font-weight: 600;
        color: #111827;
        margin-bottom: 20px;
      }

      .section-title.critical { color: #DC2626; }
      .section-title.moderate { color: #EA580C; }
      .section-title.warning { color: #2563EB; }

      .chart-container, .quick-stats {
        background: white;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .chart-image {
        width: 100%;
        height: auto;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }

      .stat-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: #F9FAFB;
        border-radius: 8px;
      }

      .stat-icon {
        font-size: 32px;
      }

      .stat-value {
        font-size: 28px;
        font-weight: 700;
        color: #111827;
        line-height: 1;
      }

      .stat-label {
        font-size: 12px;
        color: #6B7280;
      }

      /* Key Findings */
      .findings-section {
        margin-top: 40px;
        background: white;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .findings-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .finding-item {
        display: flex;
        gap: 16px;
        padding: 16px;
        background: #FEF2F2;
        border-left: 4px solid #EF4444;
        border-radius: 8px;
      }

      .finding-number {
        width: 32px;
        height: 32px;
        background: #EF4444;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        flex-shrink: 0;
      }

      .finding-content h3 {
        font-size: 16px;
        font-weight: 600;
        color: #991B1B;
        margin-bottom: 8px;
      }

      .finding-location {
        font-size: 14px;
        color: #6B7280;
      }

      /* Violations Section */
      .section {
        margin-bottom: 40px;
      }

      .violations-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .violation-card {
        background: white;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        border-left: 4px solid #E5E7EB;
      }

      .violation-card.critical { border-left-color: #EF4444; background: #FEF2F2; }
      .violation-card.moderate { border-left-color: #F97316; background: #FFF7ED; }
      .violation-card.warning { border-left-color: #3B82F6; background: #EFF6FF; }

      .violation-header {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 12px;
      }

      .violation-number {
        width: 28px;
        height: 28px;
        background: #6B7280;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 14px;
        flex-shrink: 0;
      }

      .violation-card.critical .violation-number { background: #EF4444; }
      .violation-card.moderate .violation-number { background: #F97316; }
      .violation-card.warning .violation-number { background: #3B82F6; }

      .violation-title {
        font-size: 16px;
        font-weight: 600;
        color: #111827;
      }

      .violation-body {
        margin-left: 40px;
      }

      .violation-detail {
        margin-bottom: 12px;
        font-size: 14px;
        color: #4B5563;
      }

      .violation-detail code {
        background: #F3F4F6;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 13px;
      }

      .recommendation-box {
        background: #DBEAFE;
        border-left: 3px solid #3B82F6;
        padding: 12px;
        border-radius: 6px;
        margin-top: 12px;
      }

      .recommendation-label {
        font-weight: 600;
        color: #1E40AF;
        margin-bottom: 8px;
      }

      .recommendation-box p {
        color: #1E3A8A;
        margin: 0;
      }

      .reference {
        font-size: 12px;
        color: #6B7280;
        margin-top: 12px;
        font-style: italic;
      }

      /* Recommendations Section */
      .recommendations-section {
        background: #F0FDF4;
        border: 2px solid #86EFAC;
        border-radius: 12px;
        padding: 24px;
      }

      .recommendations-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .recommendation-item {
        display: flex;
        gap: 16px;
        align-items: flex-start;
      }

      .recommendation-number {
        width: 32px;
        height: 32px;
        background: #10B981;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        flex-shrink: 0;
      }

      .recommendation-text {
        flex: 1;
        color: #065F46;
        line-height: 1.6;
      }

      /* Passed Rules */
      .passed-section {
        background: #F0FDF4;
        border: 2px solid #86EFAC;
        border-radius: 12px;
        padding: 24px;
      }

      .passed-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }

      .passed-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: white;
        border-radius: 6px;
        font-size: 14px;
        color: #065F46;
      }

      .check-icon {
        width: 20px;
        height: 20px;
        color: #10B981;
        flex-shrink: 0;
      }

      /* AI Analysis */
      .ai-section {
        background: #EFF6FF;
        border: 2px solid #93C5FD;
        border-radius: 12px;
        padding: 24px;
      }

      .ai-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
      }

      .ai-stat {
        text-align: center;
        padding: 16px;
        background: white;
        border-radius: 8px;
      }

      .ai-label {
        font-size: 12px;
        color: #6B7280;
        margin-bottom: 8px;
      }

      .ai-value {
        font-size: 24px;
        font-weight: 700;
        color: #1E40AF;
      }

      /* Success Section */
      .success-section {
        background: #F0FDF4;
        border: 2px solid #86EFAC;
        border-radius: 12px;
        padding: 40px;
        text-align: center;
      }

      .success-text {
        font-size: 18px;
        color: #065F46;
        margin-top: 16px;
      }

      /* Footer */
      .report-footer {
        margin-top: 60px;
        padding-top: 30px;
        border-top: 2px solid #E5E7EB;
      }

      .footer-content {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 40px;
      }

      .footer-logo {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }

      .footer-logo svg {
        width: 32px;
        height: 32px;
        stroke: #667eea;
      }

      .footer-logo span {
        font-size: 18px;
        font-weight: 600;
        color: #111827;
      }

      .footer-info {
        font-size: 12px;
        color: #6B7280;
        line-height: 1.6;
      }

      .footer-info p {
        margin-bottom: 6px;
      }

      .footer-disclaimer {
        margin-top: 12px;
        font-style: italic;
        color: #9CA3AF;
      }

      .footer-right {
        text-align: center;
      }

      .qr-code {
        width: 150px;
        height: 150px;
        border: 2px solid #E5E7EB;
        border-radius: 8px;
        padding: 8px;
        background: white;
      }

      .qr-label {
        margin-top: 8px;
        font-size: 12px;
        color: #6B7280;
      }

      /* Print Optimization */
      @media print {
        .page { page-break-inside: avoid; }
        .violation-card { page-break-inside: avoid; }
      }
    `;
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

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

module.exports = ModernPDFGenerator;