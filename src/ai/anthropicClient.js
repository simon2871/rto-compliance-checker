const Anthropic = require('@anthropic-ai/sdk');

class AnthropicClient {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.modelConfig = {
      'claude-3-5-sonnet-20241022': {
        maxTokens: 4096,
        temperature: 0.1,
        costPer1K: { input: 0.003, output: 0.015 }
      },
      'claude-3-haiku-20240307': {
        maxTokens: 4096,
        temperature: 0.1,
        costPer1K: { input: 0.00025, output: 0.00125 }
      }
    };
  }

  isConfigured() {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async generateText(prompt, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Anthropic API key not configured');
    }

    const model = options.model || 'claude-3-5-sonnet-20241022';
    const config = this.modelConfig[model] || this.modelConfig['claude-3-5-sonnet-20241022'];

    try {
      const response = await this.client.messages.create({
        model: model,
        max_tokens: options.maxTokens || config.maxTokens,
        temperature: options.temperature || config.temperature,
        messages: [
          {
            role: 'user',
            content: options.systemRole
              ? `${options.systemRole}\n\n${prompt}`
              : prompt
          }
        ],
        system: options.systemRole || undefined,
        ...options.additionalParams
      });

      const content = response.content[0];
      if (!content || content.type !== 'text') {
        throw new Error('No text response from Anthropic');
      }

      return {
        text: content.text,
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
          total_tokens: response.usage.input_tokens + response.usage.output_tokens
        },
        model: model,
        stopReason: response.stop_reason
      };
    } catch (error) {
      throw new Error(`Anthropic API error: ${error.message}`);
    }
  }

  calculateCost(usage) {
    if (!usage) return 0;

    const model = 'claude-3-5-sonnet-20241022';
    const config = this.modelConfig[model];
    if (!config) return 0;

    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;

    return (inputTokens / 1000) * config.costPer1K.input +
           (outputTokens / 1000) * config.costPer1K.output;
  }

  async streamResponse(prompt, options = {}, onChunk) {
    if (!this.isConfigured()) {
      throw new Error('Anthropic API key not configured');
    }

    const model = options.model || 'claude-3-5-sonnet-20241022';
    const config = this.modelConfig[model] || this.modelConfig['claude-3-5-sonnet-20241022'];

    try {
      const stream = await this.client.messages.create({
        model: model,
        max_tokens: options.maxTokens || config.maxTokens,
        temperature: options.temperature || config.temperature,
        messages: [
          {
            role: 'user',
            content: options.systemRole
              ? `${options.systemRole}\n\n${prompt}`
              : prompt
          }
        ],
        system: options.systemRole || undefined,
        stream: true
      });

      let fullContent = '';
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const content = chunk.delta.text;
          fullContent += content;

          if (onChunk) {
            onChunk({
              content,
              isComplete: false,
              fullContent
            });
          }
        }
      }

      if (onChunk) {
        onChunk({
          content: '',
          isComplete: true,
          fullContent
        });
      }

      return { text: fullContent };
    } catch (error) {
      throw new Error(`Anthropic streaming error: ${error.message}`);
    }
  }

  async generateComplianceAnalysis(content, rules, options = {}) {
    const systemPrompt = `You are an expert ASQA/AQF compliance analyst. Analyze the provided web content against Australian Skills Quality Authority and Australian Qualifications Framework requirements.

Key analysis criteria:
1. Forbidden claims (employment guarantees, salary promises, completion time guarantees)
2. Required terminology (unit vs course, competent/not yet competent, RTO identification)
3. Mandatory disclaimers (RPL availability, nationally recognised training)
4. Web-specific requirements (contact info, privacy policy, fee disclosure)
5. Marketing guidelines (accurate claims, verifiable testimonials)

Provide specific violations with:
- Rule ID and category
- Exact text found
- Location/context
- Severity level
- Specific recommendations for fixing

Format your response as JSON with this structure:
{
  "compliance_score": 0-100,
  "violations": [
    {
      "id": "rule_id",
      "category": "category",
      "severity": "critical|moderate|warning",
      "description": "issue description",
      "text_found": "exact text",
      "location": "where found",
      "recommendation": "how to fix"
    }
  ],
  "recommendations": ["general improvements"],
  "summary": "brief analysis summary"
}`;

    return this.generateText(content, {
      systemRole: systemPrompt,
      temperature: 0.1,
      maxTokens: 8192,
      ...options
    });
  }
}

module.exports = AnthropicClient;