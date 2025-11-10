#!/usr/bin/env node

/**
 * Project Initialization Script
 * Sets up the RTO Compliance Checker project structure and dependencies
 */

const fs = require('fs').promises;
const path = require('path');

class ProjectInitializer {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '../..');
    this.requiredDirs = [
      'data/compliance',
      'data/scans',
      'data/users',
      'data/uploads',
      'logs',
      'temp'
    ];
  }

  async init() {
    console.log('🎯 Initializing RTO Compliance Checker Project');
    console.log('='.repeat(50));

    try {
      await this.createDirectories();
      await this.createDefaultFiles();
      await this.validateDependencies();
      await this.createSampleData();

      console.log('\n✅ Project initialization completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Copy .env.example to .env and add your API keys');
      console.log('2. Run: npm install');
      console.log('3. Run: npm run setup:ai to test AI connections');
      console.log('4. Run: npm start to start the server');
      console.log('\n🌐 Visit: http://localhost:3000');

    } catch (error) {
      console.error('\n❌ Initialization failed:', error.message);
      process.exit(1);
    }
  }

  async createDirectories() {
    console.log('\n📁 Creating required directories...');

    for (const dir of this.requiredDirs) {
      const dirPath = path.join(this.projectRoot, dir);
      await fs.mkdir(dirPath, { recursive: true });
      console.log(`  ✓ Created: ${dir}`);
    }
  }

  async createDefaultFiles() {
    console.log('\n📄 Creating default configuration files...');

    // Create .gitignore
    const gitignorePath = path.join(this.projectRoot, '.gitignore');
    const gitignoreContent = `
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Build outputs
dist/
build/

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# nyc test coverage
.nyc_output

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env

# Data and uploads
data/scans/*
data/users/*
data/uploads/*
!data/scans/.gitkeep
!data/users/.gitkeep
!data/uploads/.gitkeep

# Temporary files
temp/
.tmp/

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# Reports
*.pdf
*.html
!public/index.html
`.trim();

    await fs.writeFile(gitignorePath, gitignoreContent);
    console.log('  ✓ Created: .gitignore');

    // Create .gitkeep files to preserve empty directories
    const gitkeepDirs = ['data/scans', 'data/users', 'data/uploads', 'logs'];
    for (const dir of gitkeepDirs) {
      const gitkeepPath = path.join(this.projectRoot, dir, '.gitkeep');
      await fs.writeFile(gitkeepPath, '');
      console.log(`  ✓ Created: ${dir}/.gitkeep`);
    }
  }

  async validateDependencies() {
    console.log('\n🔍 Validating project dependencies...');

    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      const packageData = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

      console.log(`  ✓ Package name: ${packageData.name}`);
      console.log(`  ✓ Version: ${packageData.version}`);
      console.log(`  ✓ Dependencies: ${Object.keys(packageData.dependencies || {}).length}`);
      console.log(`  ✓ Dev dependencies: ${Object.keys(packageData.devDependencies || {}).length}`);

      // Check for critical dependencies
      const criticalDeps = ['express', 'puppeteer', 'openai', '@anthropic-ai/sdk', 'pdf-lib'];
      const missingDeps = criticalDeps.filter(dep =>
        !(packageData.dependencies && packageData.dependencies[dep])
      );

      if (missingDeps.length > 0) {
        console.log(`  ⚠️  Missing critical dependencies: ${missingDeps.join(', ')}`);
        console.log('  💡 Run: npm install to install missing dependencies');
      } else {
        console.log('  ✓ All critical dependencies found');
      }

    } catch (error) {
      throw new Error(`Failed to validate dependencies: ${error.message}`);
    }
  }

  async createSampleData() {
    console.log('\n📊 Creating sample data and documentation...');

    // Create a sample scan result
    const sampleScanPath = path.join(this.projectRoot, 'data/scans/sample-scan.json');
    const sampleScan = {
      scan_id: 'sample_scan_001',
      url: 'https://example-rto.edu.au',
      timestamp: new Date().toISOString(),
      compliance_score: 87,
      status: 'NEEDS_REVIEW',
      page_type: 'homepage',
      violations: [
        {
          id: 'rto_identification_missing',
          category: 'required_information',
          severity: 'critical',
          description: 'RTO number must be clearly displayed',
          text_found: '',
          location: 'entire_page',
          recommendation: 'Add RTO number to homepage in format: College Name (RTO XXXXX)',
          asqa_reference: 'Standard 7.1 - Provider information'
        }
      ],
      recommendations: [
        'Add RTO number to homepage',
        'Include required disclaimers',
        'Add privacy policy link'
      ],
      sample: true
    };

    await fs.writeFile(sampleScanPath, JSON.stringify(sampleScan, null, 2));
    console.log('  ✓ Created sample scan result');

    // Create README if it doesn't exist
    const readmePath = path.join(this.projectRoot, 'README.md');
    try {
      await fs.access(readmePath);
    } catch {
      const readmeContent = `# RTO Compliance Checker

AI-powered compliance checking for Australian Registered Training Organisations (RTOs).

## Features

- 🤖 AI-powered ASQA/AQF compliance analysis
- 🌐 Web content extraction and analysis
- 📊 Real-time compliance scoring
- 📄 Detailed report generation (PDF, HTML, JSON)
- 🔄 Batch scanning capabilities
- 🎯 Violation detection with specific recommendations

## Quick Start

1. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

2. **Configure environment**
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your API keys
   \`\`\`

3. **Test AI connections**
   \`\`\`bash
   npm run setup:ai
   \`\`\`

4. **Start the server**
   \`\`\`bash
   npm start
   \`\`\`

5. **Visit the dashboard**
   Open http://localhost:3000 in your browser

## Required API Keys

Minimum setup requires:
- **OpenAI API Key** (for GPT-4 models)
- **Anthropic API Key** (for Claude models)

Optional:
- **DeepSeek API Key** (for cost-effective operations)

## Usage

### Web Interface
Simply visit http://localhost:3000 and enter your RTO website URL.

### Command Line
\`\`\`bash
# Scan a single URL
node src/index.js scan https://your-rto.edu.au

# Check system status
node src/index.js status

# Start web server
npm start
\`\`\`

### API Usage
\`\`\`bash
curl -X POST http://localhost:3000/api/scan \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://your-rto.edu.au"}'
\`\`\`

## Compliance Rules

The checker analyzes against:
- ASQA Standards for RTOs 2025
- Australian Qualifications Framework (AQF) requirements
- Marketing and advertising guidelines
- Web-specific compliance requirements

## Development

\`\`\`bash
# Development mode with auto-reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint
\`\`\`

## License

MIT License - see LICENSE file for details.
`;

      await fs.writeFile(readmePath, readmeContent);
      console.log('  ✓ Created README.md');
    }
  }
}

// Run initialization
if (require.main === module) {
  const initializer = new ProjectInitializer();
  initializer.init();
}

module.exports = ProjectInitializer;