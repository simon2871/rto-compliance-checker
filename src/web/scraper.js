const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

puppeteer.use(StealthPlugin());

class WebScraper {
  constructor() {
    this.defaultOptions = {
      timeout: 30000,
      waitUntil: 'networkidle2',
      headless: 'new',
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
  }

  async extractContent(url, options = {}) {
    const opts = { ...this.defaultOptions, ...options };

    // Try static extraction first (faster, less resource-intensive)
    try {
      const staticContent = await this.extractStaticContent(url, opts);
      if (staticContent && staticContent.text.trim().length > 100) {
        return {
          ...staticContent,
          method: 'static',
          url
        };
      }
    } catch (staticError) {
      console.log(`Static extraction failed for ${url}: ${staticError.message}`);
    }

    // Fall back to dynamic extraction
    try {
      const dynamicContent = await this.extractDynamicContent(url, opts);
      return {
        ...dynamicContent,
        method: 'dynamic',
        url
      };
    } catch (dynamicError) {
      console.log(`Dynamic extraction failed for ${url}: ${dynamicError.message}`);
      throw new Error(`Both extraction methods failed. Static: ${staticError.message}, Dynamic: ${dynamicError.message}`);
    }
  }

  async extractStaticContent(url, options = {}) {
    try {
      const response = await axios.get(url, {
        timeout: options.timeout || 30000,
        headers: {
          'User-Agent': options.userAgent || this.defaultOptions.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-AU,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      const $ = cheerio.load(response.data);

      return {
        text: this.extractTextContent($),
        html: response.data,
        title: $('title').text() || '',
        meta: this.extractMetaData($),
        links: this.extractLinks($, url),
        images: this.extractImages($, url),
        forms: this.extractForms($),
        structure: this.analyzeStructure($)
      };
    } catch (error) {
      throw new Error(`Static content extraction failed: ${error.message}`);
    }
  }

  async extractDynamicContent(url, options = {}) {
    let browser = null;

    try {
      browser = await puppeteer.launch({
        headless: options.headless || this.defaultOptions.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--window-size=1920,1080',
          '--lang=en-AU,en;q=0.9'
        ]
      });

      const page = await browser.newPage();
      await page.setViewport(options.viewport || this.defaultOptions.viewport);
      await page.setUserAgent(options.userAgent || this.defaultOptions.userAgent);

      // Set extra headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-AU,en;q=0.9'
      });

      // Navigate to the page
      await page.goto(url, {
        waitUntil: options.waitUntil || this.defaultOptions.waitUntil,
        timeout: options.timeout || this.defaultOptions.timeout
      });

      // Wait for content to load
      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, { timeout: 5000 });
      }

      // Remove unwanted elements
      const removeSelectors = [
        'script', 'style', 'noscript', 'iframe', 'embed', 'object',
        '.ads', '.advertisement', '.sidebar', '.popup', '.modal',
        'nav', 'footer', '.menu', '.navigation'
      ].concat(options.removeSelectors || []);

      for (const selector of removeSelectors) {
        try {
          await page.evaluate((sel) => {
            const elements = document.querySelectorAll(sel);
            elements.forEach(el => el.remove());
          }, selector);
        } catch (error) {
          // Ignore removal errors
        }
      }

      // Extract content
      const content = await page.evaluate(() => {
        const getTextContent = (element) => {
          if (!element) return '';

          // Skip script, style, and other non-content elements
          const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME'];
          if (skipTags.includes(element.tagName)) return '';

          let text = '';

          if (element.nodeType === Node.TEXT_NODE) {
            text = element.textContent.trim();
          } else if (element.nodeType === Node.ELEMENT_NODE) {
            // Get text from important elements
            const importantTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'LI', 'TD', 'TH', 'A', 'BUTTON'];
            if (importantTags.includes(element.tagName)) {
              text = element.textContent.trim();
            }

            // Recursively process children
            for (const child of element.childNodes) {
              text += ' ' + getTextContent(child);
            }
          }

          return text.replace(/\s+/g, ' ').trim();
        };

        const body = document.body;
        const text = getTextContent(body);

        return {
          text: text,
          title: document.title,
          html: document.documentElement.outerHTML,
          meta: {
            description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
            keywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '',
            author: document.querySelector('meta[name="author"]')?.getAttribute('content') || ''
          },
          links: Array.from(document.querySelectorAll('a[href]')).map(a => ({
            text: a.textContent.trim(),
            href: a.getAttribute('href'),
            title: a.getAttribute('title') || ''
          })),
          images: Array.from(document.querySelectorAll('img[src]')).map(img => ({
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt') || '',
            title: img.getAttribute('title') || ''
          })),
          forms: Array.from(document.querySelectorAll('form')).map(form => ({
            action: form.getAttribute('action') || '',
            method: form.getAttribute('method') || 'GET',
            fields: Array.from(form.querySelectorAll('input, select, textarea')).map(field => ({
              name: field.getAttribute('name') || '',
              type: field.getAttribute('type') || field.tagName.toLowerCase(),
              required: field.hasAttribute('required')
            }))
          }))
        };
      });

      return content;
    } catch (error) {
      throw new Error(`Dynamic content extraction failed: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  extractTextContent($) {
    // Remove script, style, and other non-content elements
    $('script, style, noscript, iframe, embed, object, nav, footer').remove();

    // Extract text from important elements
    const textElements = $('h1, h2, h3, h4, h5, h6, p, li, td, th, a, button, .title, .description, .content');

    let text = '';
    textElements.each((i, el) => {
      const elementText = $(el).text().trim();
      if (elementText.length > 0) {
        text += elementText + ' ';
      }
    });

    return text.replace(/\s+/g, ' ').trim();
  }

  extractMetaData($) {
    return {
      description: $('meta[name="description"]').attr('content') || '',
      keywords: $('meta[name="keywords"]').attr('content') || '',
      author: $('meta[name="author"]').attr('content') || '',
      viewport: $('meta[name="viewport"]').attr('content') || '',
      robots: $('meta[name="robots"]').attr('content') || ''
    };
  }

  extractLinks($, baseUrl) {
    const links = [];
    $('a[href]').each((i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const text = $el.text().trim();

      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        try {
          const absoluteUrl = new URL(href, baseUrl).href;
          links.push({
            text,
            href: absoluteUrl,
            title: $el.attr('title') || ''
          });
        } catch (error) {
          // Invalid URL, skip
        }
      }
    });
    return links;
  }

  extractImages($, baseUrl) {
    const images = [];
    $('img[src]').each((i, el) => {
      const $el = $(el);
      const src = $el.attr('src');

      if (src) {
        try {
          const absoluteUrl = new URL(src, baseUrl).href;
          images.push({
            src: absoluteUrl,
            alt: $el.attr('alt') || '',
            title: $el.attr('title') || ''
          });
        } catch (error) {
          // Invalid URL, skip
        }
      }
    });
    return images;
  }

  extractForms($) {
    const forms = [];
    $('form').each((i, el) => {
      const $el = $(el);
      forms.push({
        action: $el.attr('action') || '',
        method: $el.attr('method') || 'GET',
        fields: []
      });
    });
    return forms;
  }

  analyzeStructure($) {
    return {
      headings: {
        h1: $('h1').length,
        h2: $('h2').length,
        h3: $('h3').length,
        h4: $('h4').length,
        h5: $('h5').length,
        h6: $('h6').length
      },
      sections: {
        nav: $('nav').length,
        main: $('main').length,
        header: $('header').length,
        footer: $('footer').length,
        article: $('article').length,
        section: $('section').length
      },
      content: {
        paragraphs: $('p').length,
        lists: $('ul, ol').length,
        links: $('a').length,
        images: $('img').length,
        forms: $('form').length
      }
    };
  }

  detectPageType(content) {
    const text = content.text.toLowerCase();
    const title = content.title.toLowerCase();
    const meta = content.meta.description.toLowerCase();
    const combinedText = `${title} ${meta} ${text}`;

    // Keywords for different page types
    const pageTypes = {
      homepage: [
        'welcome', 'home', 'about us', 'college', 'training', 'courses',
        'contact', 'location', 'why choose us', 'our mission'
      ],
      course: [
        'course', 'qualification', 'certificate', 'diploma', 'unit',
        'competency', 'training package', 'assessment', 'enrol',
        'duration', 'prerequisites', 'outcomes'
      ],
      contact: [
        'contact', 'phone', 'email', 'address', 'location', 'map',
        'opening hours', 'get in touch', 'reach us'
      ],
      about: [
        'about us', 'our story', 'history', 'team', 'staff',
        'mission', 'vision', 'values', 'accreditation'
      ],
      enrollment: [
        'enrol', 'enrollment', 'apply', 'application', 'registration',
        'admission', 'how to enrol', 'enrolment process'
      ],
      fees: [
        'fees', 'cost', 'price', 'payment', 'tuition', 'funding',
        'refund', 'payment plan', 'student fees'
      ]
    };

    // Score each page type
    const scores = {};
    for (const [type, keywords] of Object.entries(pageTypes)) {
      scores[type] = 0;
      for (const keyword of keywords) {
        if (combinedText.includes(keyword)) {
          scores[type] += 1;
        }
      }
    }

    // Find the page type with the highest score
    let maxScore = 0;
    let detectedType = 'general';

    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedType = type;
      }
    }

    // If no strong match, return general
    return maxScore > 0 ? detectedType : 'general';
  }

  async extractMultiplePages(urls, options = {}) {
    const results = [];
    const concurrent = options.concurrent || 3;

    // Process URLs in batches
    for (let i = 0; i < urls.length; i += concurrent) {
      const batch = urls.slice(i, i + concurrent);
      const batchPromises = batch.map(url =>
        this.extractContent(url, options).catch(error => ({
          url,
          error: error.message,
          method: 'error'
        }))
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches to be respectful
      if (i + concurrent < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}

// Legacy functions for backward compatibility
async function fetchHtml(url) {
  const scraper = new WebScraper();
  const content = await scraper.extractStaticContent(url);
  return content.html;
}

async function extractVisibleText(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript, iframe, embed, object, nav, footer').remove();
  return $.text().replace(/\s+/g, ' ').trim();
}

module.exports = {
  WebScraper,
  fetchHtml,
  extractVisibleText
};