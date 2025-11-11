# Modern PDF Reports - Usage Guide

## Overview

The RTO Compliance Checker now features **modern, professional PDF reports** with rich visualizations, color-coded sections, and an executive dashboard layout.

---

## Features

### 🎨 Visual Enhancements
- **Executive Dashboard**: Score gauges, violation counts, and key metrics at a glance
- **Color-Coded Violations**: Critical (red), Moderate (orange), Warning (blue)
- **Data Visualizations**: Donut charts showing severity breakdown
- **Modern Typography**: Professional fonts and clear hierarchy
- **Gradients & Shadows**: Contemporary design aesthetics

### 📊 Content Structure
1. **Cover Page**: Branded header with circular score gauge
2. **Executive Summary**: Dashboard with cards and charts
3. **Key Findings**: Top critical issues highlighted
4. **Detailed Analysis**: Full violation breakdown by severity
5. **Recommendations**: Actionable improvement steps
6. **Passed Rules**: Compliance achievements
7. **Footer**: QR code for online access

---

## Usage

### Automatic (Default)

The modern PDF generator is **enabled by default**. When you request a PDF report, the system automatically uses the modern generator:

```javascript
// In your API route or service
const reportGenerator = new ReportGenerator();
const pdfReport = await reportGenerator.generatePDFReport(complianceResult);
```

### Environment Configuration

Control which PDF generator to use via environment variable:

```bash
# .env file

# Use modern PDF (default)
USE_MODERN_PDF=true

# Use legacy PDF
USE_MODERN_PDF=false
```

### Manual Selection

```javascript
const { ReportGenerator } = require('./src/reports/reportGenerator');
const { ModernPDFGenerator } = require('./src/reports/modernPDFGenerator');

// Option 1: Use ReportGenerator (respects USE_MODERN_PDF)
const generator = new ReportGenerator();
await generator.generatePDFReport(result);

// Option 2: Use ModernPDFGenerator directly
const modernGen = new ModernPDFGenerator();
await modernGen.generatePDFReport(result);
```

---

## API Response

The PDF report returns the same structure as before:

```javascript
{
  filename: 'compliance-report-scan_123.pdf',
  filepath: '/data/scans/compliance-report-scan_123.pdf',
  size: 245632,  // bytes
  format: 'PDF'
}
```

---

## Requirements

### Dependencies (Already Installed)
```json
{
  "puppeteer": "^24.29.1",
  "chart.js": "^4.4.0",
  "chartjs-node-canvas": "^latest",
  "qrcode": "^1.5.3"
}
```

### System Requirements
- Node.js 18+
- Chrome/Chromium (installed by Puppeteer)
- 512MB+ free memory for PDF generation

---

## Performance

### Generation Time
- **Modern PDF**: 2-3 seconds (includes chart rendering)
- **Legacy PDF**: <1 second (basic text)

### File Size
- **Typical Report**: 200-400 KB
- **With Charts**: 300-500 KB
- **Multiple Pages**: 400-800 KB

### Optimization Tips
1. PDFs are generated asynchronously
2. Charts are rendered server-side
3. Images are embedded as base64
4. Puppeteer instances are properly closed

---

## Customization

### Color Scheme

Modify colors in [`src/reports/modernPDFGenerator.js`](../src/reports/modernPDFGenerator.js):

```javascript
// Score colors
if (score >= 95) return 'score-excellent';  // Green
if (score >= 85) return 'score-good';       // Light Green  
if (score >= 75) return 'score-acceptable'; // Yellow
return 'score-poor';                        // Red

// Violation colors
critical: '#EF4444'  // Red
moderate: '#F97316'  // Orange
warning: '#3B82F6'   // Blue
```

### Branding

Update logo and company info:

```javascript
// In renderCoverPage() method
<div class="logo-text">
  <h1>YOUR COMPANY NAME</h1>
  <p>Your Tagline</p>
</div>
```

### QR Code URL

Change the QR code destination:

```javascript
// In generateQRCode() method
const url = `https://your-domain.com/reports/${scanId}`;
```

---

## Troubleshooting

### Issue: "PDF generation failed"

**Cause**: Puppeteer/Chrome installation issue

**Solution**:
```bash
# Reinstall Puppeteer
npm uninstall puppeteer
npm install puppeteer --save

# Or use system Chrome
npm install puppeteer-core --save
```

### Issue: "Chart rendering failed"

**Cause**: Canvas/Chart.js dependency issue

**Solution**:
```bash
npm install canvas chart.js chartjs-node-canvas --save
```

### Issue: "Out of memory"

**Cause**: Insufficient memory for Puppeteer

**Solution**:
```javascript
// In modernPDFGenerator.js, add memory limits
await puppeteer.launch({
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--max-old-space-size=512'  // Add this
  ]
});
```

### Issue: "Slow PDF generation"

**Optimization**:
```javascript
// Reduce image quality for faster generation
await QRCode.toDataURL(url, {
  width: 100,  // Reduce from 150
  margin: 1
});
```

---

## Fallback Behavior

The system includes automatic fallback to legacy PDF if modern generation fails:

```javascript
1. Try modern PDF generation
   ↓ (if fails)
2. Log warning
   ↓
3. Fall back to legacy PDF
   ↓
4. Return successfully generated PDF
```

This ensures **100% uptime** for PDF generation.

---

## Comparison

| Feature | Legacy PDF | Modern PDF |
|---------|------------|------------|
| **Design** | Basic text | Professional dashboard |
| **Colors** | Limited | Full color palette |
| **Charts** | None | Data visualizations |
| **Layout** | Single column | Multi-column grid |
| **Typography** | Standard fonts | Modern web fonts |
| **File Size** | ~50-100 KB | ~200-500 KB |
| **Generation** | <1 second | 2-3 seconds |
| **Branding** | Minimal | Full branding |
| **QR Codes** | None | Included |
| **Responsive** | No | Print-optimized |

---

## Best Practices

### 1. Environment Variables
Always set `USE_MODERN_PDF` in production:
```bash
USE_MODERN_PDF=true
```

### 2. Error Handling
The system handles errors gracefully, but monitor logs:
```javascript
console.log('🎨 Generating modern PDF report...');
// or
console.warn('⚠️ Modern PDF generation failed, falling back to legacy');
```

### 3. Memory Management
For high-volume generation, consider:
- Queuing PDF requests
- Using a dedicated PDF service
- Scaling horizontally

### 4. Testing
Test with various compliance results:
```javascript
// No violations
{ violations: [], compliance_score: 100 }

// Mixed violations
{ violations: [critical, moderate, warning], compliance_score: 75 }

// Many rules passed
{ passed_rules: [...100 rules], compliance_score: 95 }
```

---

## Examples

### Example 1: Basic Usage

```javascript
const ReportGenerator = require('./src/reports/reportGenerator');

const generator = new ReportGenerator();
const result = await generator.generatePDFReport({
  scan_id: 'scan_123',
  url: 'https://example.edu.au',
  timestamp: new Date().toISOString(),
  compliance_score: 85,
  status: 'PASS_WITH_NOTES',
  violations: [...],
  recommendations: [...],
  passed_rules: [...]
});

console.log(`PDF generated: ${result.filename}`);
```

### Example 2: Generate All Formats

```javascript
const generator = new ReportGenerator();

// Generate PDF, HTML, and JSON
const results = await generator.generateAllFormats(complianceResult);

console.log('PDF:', results.pdf.filename);
console.log('HTML:', results.html.filename);
console.log('JSON:', results.json.filename);
```

### Example 3: Batch Processing

```javascript
const results = await Promise.all(
  complianceResults.map(result => 
    generator.generatePDFReport(result)
  )
);

console.log(`Generated ${results.length} PDFs`);
```

---

## Migration Guide

### From Legacy to Modern

**No code changes required!** The system automatically uses modern PDFs.

If you want to explicitly disable:
```bash
# .env
USE_MODERN_PDF=false
```

### Reverting to Legacy

1. Set environment variable:
   ```bash
   USE_MODERN_PDF=false
   ```

2. Or modify code:
   ```javascript
   // In reportGenerator.js constructor
   this.useModernPDF = false;
   ```

---

## Future Enhancements

### Planned Features
- [ ] Custom branding/white-label support
- [ ] Multi-language reports
- [ ] Historical trend charts
- [ ] PDF/A compliance for archival
- [ ] Digital signatures
- [ ] Interactive PDF elements
- [ ] Batch report summaries
- [ ] Email delivery with templates

---

## Support

For issues or questions:
1. Check the [troubleshooting](#troubleshooting) section
2. Review the [implementation roadmap](./pdf-implementation-roadmap.md)
3. See [design plan](./pdf-modernization-plan.md) for architecture details

---

## Technical Details

### Architecture

```
ReportGenerator (main)
├── Modern PDF (Puppeteer + HTML/CSS)
│   ├── Cover Page
│   ├── Executive Dashboard
│   ├── Detailed Analysis
│   └── Footer with QR
└── Legacy PDF (pdf-lib)
    └── Basic text layout
```

### File Structure

```
src/reports/
├── reportGenerator.js         # Main generator (routes to modern/legacy)
├── modernPDFGenerator.js      # Puppeteer-based modern PDF
└── [legacy code in reportGenerator.js]
```

### Data Flow

```
1. API Request → generatePDFReport()
2. Check USE_MODERN_PDF flag
3. Modern: Build HTML → Puppeteer → PDF
4. Legacy: pdf-lib text layout → PDF
5. Save to disk
6. Return file metadata
```

---

## Conclusion

The modern PDF generator provides professional, visually appealing reports that significantly improve the user experience while maintaining 100% backward compatibility through automatic fallback.

**Key Benefits:**
✅ Professional appearance
✅ Better data visualization
✅ Improved readability
✅ Zero breaking changes
✅ Automatic fallback
✅ Production-ready

Start using it today with no code changes required!