const axios = require('axios');

class DeepSeekClient {
  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY;
    this.baseURL = 'https://api.deepseek.com/v1';
    this.modelConfig = {
      'deepseek-chat': {
        maxTokens: 4096,
        temperature: 0.1,
        costPer1K: { input: 0.00014, output: 0.00028 }
      },
      'deepseek-coder': {
        maxTokens: 4096,
        temperature: 0.1,
        costPer1K: { input: 0.00014, output: 0.00028 }
      }
    };
  }

  isConfigured() {
    return !!this.apiKey;
  }

  async generateText(prompt, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('DeepSeek API key not configured');
    }

    const model = options.model || 'deepseek-chat';
    const config = this.modelConfig[model] || this.modelConfig['deepseek-chat'];

    try {
      const response = await axios.post(`${this.baseURL}/chat/completions`, {
        model: model,
        messages: [
          {
            role: options.systemRole ? 'system' : 'user',
            content: options.systemRole || prompt
          },
          ...(options.systemRole ? [{ role: 'user', content: prompt }] : [])
        ],
        max_tokens: options.maxTokens || config.maxTokens,
        temperature: options.temperature || config.temperature,
        top_p: options.topP || 1,
        frequency_penalty: options.frequencyPenalty || 0,
        presence_penalty: options.presencePenalty || 0,
        stream: false
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const choice = response.data.choices[0];
      if (!choice) {
        throw new Error('No response from DeepSeek');
      }

      return {
        text: choice.message.content,
        usage: response.data.usage,
        model: model,
        finishReason: choice.finish_reason
      };
    } catch (error) {
      throw new Error(`DeepSeek API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  calculateCost(usage) {
    if (!usage) return 0;

    const model = 'deepseek-chat';
    const config = this.modelConfig[model];
    if (!config) return 0;

    const inputTokens = usage.prompt_tokens || usage.input_tokens || 0;
    const outputTokens = usage.completion_tokens || usage.output_tokens || 0;

    return (inputTokens / 1000) * config.costPer1K.input +
           (outputTokens / 1000) * config.costPer1K.output;
  }

  async generateSummary(content, maxLength = 500) {
    const prompt = `Summarize this web content for compliance analysis. Focus on:
- Marketing claims and promises
- Course/qualification descriptions
- Contact information
- Fees and payment terms
- Any disclaimers or policies mentioned

Keep the summary under ${maxLength} words and highlight any potentially concerning compliance issues.

Content to analyze:
${content}`;

    return this.generateText(prompt, {
      temperature: 0.1,
      maxTokens: 1000
    });
  }

  async extractKeyInformation(content) {
    const prompt = `Extract key information from this web content for RTO compliance checking. Return as JSON:

{
  "contact_info": {
    "phone": "phone number if found",
    "email": "email if found",
    "address": "address if found"
  },
  "rto_identification": "RTO number if found",
  "course_information": ["list of courses/qualifications mentioned"],
  "fee_information": "any fee details mentioned",
  "marketing_claims": ["any promises or guarantees"],
  "disclaimers": ["any disclaimers found"],
  "policies_mentioned": ["policies like privacy, refund etc."]
}

Content:
${content}`;

    return this.generateText(prompt, {
      temperature: 0.1,
      maxTokens: 2000
    });
  }
}

module.exports = DeepSeekClient;