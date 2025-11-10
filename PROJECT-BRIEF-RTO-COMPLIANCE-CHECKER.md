# RTO Compliance Checker - Project Brief

## Project Overview

**RTO Compliance Checker** - A web-based tool that enables Registered Training Organisation (RTO) owners to automatically scan their college websites for ASQA/AQF compliance violations. The tool extracts web content and analyzes it against Australian Skills Quality Authority (ASQA) and Australian Qualifications Framework (AQF) standards.

**Target Users:** RTO owners, compliance officers, marketing teams, and web administrators who need to ensure their websites meet regulatory requirements.

**Core Value Proposition:** Reduce compliance risk by automatically detecting ASQA violations before regulatory audits, saving time and preventing potential penalties.

## Problem Statement

RTOs face significant compliance challenges with their online presence:

1. **Regulatory Complexity:** ASQA/AQF rules are detailed and constantly evolving
2. **Manual Review Burden:** Manual compliance checking is time-consuming and error-prone
3. **Risk of Violations:** Non-compliant content can lead to ASQA sanctions, fines, or registration suspension
4. **Marketing vs Compliance:** Marketing teams often create content without understanding regulatory constraints
5. **Audit Preparation:** RTOs need to ensure compliance before ASQA audits

## Solution Overview

A web-based compliance checker that:

1. **URL Input:** Users enter their RTO website URL
2. **Content Extraction:** Automatically scrapes and analyzes web content
3. **Compliance Analysis:** Checks against ASQA/AQF rules using AI
4. **Detailed Reporting:** Provides comprehensive compliance reports with actionable recommendations
5. **Batch Processing:** Can scan entire websites or specific pages
6. **Real-time Validation:** Immediate feedback on compliance issues

## Key Features

### Core Functionality
- **Single URL Checking:** Analyze individual pages for compliance
- **Batch Website Scanning:** Scan entire RTO websites
- **Real-time Scoring:** 0-100% compliance score with detailed breakdown
- **Violation Detection:** Identify critical ASQA violations and warnings
- **Recommendation Engine:** Provide specific fixes for identified issues

### Compliance Areas Covered
- **Forbidden Claims:** Employment guarantees, salary promises, completion time guarantees
- **Required Terminology:** Correct use of "unit" vs "course", RTO identification, AQF levels
- **Mandatory Disclaimers:** RPL availability, completion timeframes, national recognition
- **Marketing Standards:** Accurate claims, no misleading comparisons
- **Web-Specific Requirements:** Contact information, privacy policies, fee disclosure

### Reporting & Analytics
- **Detailed Compliance Reports:** PDF and HTML reports with issue breakdown
- **Historical Tracking:** Monitor compliance improvements over time
- **Comparative Analysis:** Benchmark against industry standards
- **Export Capabilities:** Download reports for audit preparation

## Technical Architecture

### Technology Stack
- **Backend:** Node.js with Express.js
- **AI Integration:** Multi-provider AI models (OpenAI, Anthropic Claude, DeepSeek)
- **Web Scraping:** Puppeteer for dynamic content, Axios for static content
- **Frontend:** HTML/CSS/JavaScript with modern UI framework
- **Database:** JSON file storage (scalable to MongoDB/PostgreSQL)
- **Deployment:** Docker containers for easy deployment

### Core Components
1. **Web Scraper:** Extract content from RTO websites
2. **Compliance Engine:** AI-powered ASQA/AQF rule checking
3. **Report Generator:** Create detailed compliance reports
4. **API Server:** RESTful API for web interface
5. **User Interface:** Intuitive web-based dashboard

## Target Market

### Primary Market
- **Small to Medium RTOs (50-500 students):** Limited compliance resources
- **New RTOs:** Establishing compliance processes
- **RTO Marketing Teams:** Creating compliant content

### Secondary Market
- **RTO Consultants:** Providing compliance services to multiple clients
- **VET Sector Agencies:** Managing compliance for multiple RTOs
- **Compliance Training Providers:** Educational tools for compliance officers

## Success Metrics

### User Engagement
- **Active Users:** 100+ RTOs using the tool monthly
- **Scan Volume:** 1,000+ compliance checks per month
- **User Retention:** 80% monthly retention rate

### Business Impact
- **Compliance Improvement:** Average 25% reduction in violations for regular users
- **Time Savings:** 90% reduction in manual compliance checking time
- **Risk Reduction:** Users report increased confidence in ASQA audit preparation

### Technical Performance
- **Accuracy:** 95%+ accuracy in violation detection
- **Speed:** Complete website scan within 5 minutes
- **Uptime:** 99.9% service availability

## Competitive Landscape

### Direct Competitors
- **Manual Compliance Consultants:** Expensive, time-consuming
- **Basic Compliance Checklists:** Limited automation, no AI analysis
- **Generic Website Scanners:** Not specialized for RTO compliance

### Competitive Advantages
- **Specialized Focus:** Built specifically for ASQA/AQF compliance
- **AI-Powered Analysis:** More sophisticated than rule-based checkers
- **Real-time Results:** Immediate feedback vs. manual review
- **Cost-Effective:** Fraction of consultant costs
- **Scalable:** Can handle multiple RTOs simultaneously

## Development Phases

### Phase 1: MVP (4-6 weeks)
- Basic URL input and content extraction
- Core ASQA/AQF compliance checking
- Simple web interface
- PDF report generation

### Phase 2: Enhanced Features (4-6 weeks)
- Batch website scanning
- Historical tracking
- User accounts and dashboards
- Advanced reporting features

### Phase 3: Enterprise Features (6-8 weeks)
- Multi-RTO management
- API access for integration
- Advanced analytics
- White-label options for consultants

### Phase 4: Scale & Optimize (Ongoing)
- Performance optimization
- Additional compliance rules
- Integration with RTO management systems
- Mobile application

## Revenue Model

### Subscription Tiers
- **Starter ($49/month):** 10 URL checks per month, basic reports
- **Professional ($149/month):** 100 URL checks, advanced reports, historical tracking
- **Enterprise ($499/month):** Unlimited checks, multi-RTO management, API access

### Additional Revenue Streams
- **One-time Compliance Audits:** $299 for comprehensive website audit
- **Consultant Partnerships:** Revenue sharing for referred clients
- **White-label Licensing:** Custom branding for large agencies

## Risk Assessment & Mitigation

### Technical Risks
- **Web Scraping Challenges:** Mitigate with multiple scraping strategies
- **AI Model Accuracy:** Continuous training and validation
- **Scalability Issues:** Cloud-based architecture with auto-scaling

### Business Risks
- **Regulatory Changes:** Automated rule updates and monitoring
- **Competition:** Continuous feature development and specialization
- **Market Adoption:** Free trial period and case studies

### Legal Risks
- **Liability for False Positives:** Clear terms of service and disclaimers
- **Data Privacy:** GDPR-compliant data handling
- **Intellectual Property:** Proper licensing of compliance rules

## Success Criteria

### Launch Success (3 months)
- 50 paying customers
- 500 compliance checks completed
- 90% customer satisfaction rating

### Growth Success (12 months)
- 200 paying customers
- 5,000 monthly compliance checks
- $50,000 monthly recurring revenue

### Market Leadership (24 months)
- 1,000 paying customers
- 50,000 monthly compliance checks
- Market leader in RTO compliance automation

## Next Steps

1. **Technical Setup:** Extract compliance components from existing project
2. **MVP Development:** Build core web scraping and compliance checking
3. **Beta Testing:** Partner with 5-10 RTOs for user testing
4. **Market Launch:** Public release with marketing campaign
5. **Continuous Improvement:** Regular updates based on user feedback and regulatory changes

---

**Project Status:** Ready for development
**Estimated Timeline:** 4-6 weeks to MVP
**Budget:** $15,000 for initial development
**Team:** 1-2 developers, 1 compliance consultant