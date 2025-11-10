const OpenAI = require('openai');

class OpenAIClient {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.modelConfig = {
      'gpt-4-turbo': {
        maxTokens: 4096,
        temperature: 0.3,
        costPer1K: { input: 0.01, output: 0.03 }
      },
      'gpt-3.5-turbo': {
        maxTokens: 4096,
        temperature: 0.3,
        costPer1K: { input: 0.0015, output: 0.002 }
      }
    };
  }

  isConfigured() {
    return !!process.env.OPENAI_API_KEY;
  }

  async generateText(prompt, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured');
    }

    const model = options.model || 'gpt-4-turbo';
    const config = this.modelConfig[model] || this.modelConfig['gpt-4-turbo'];

    try {
      const response = await this.client.chat.completions.create({
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
        ...options.additionalParams
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('No response from OpenAI');
      }

      return {
        text: choice.message.content,
        usage: response.usage,
        model: model,
        finishReason: choice.finish_reason
      };
    } catch (error) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  async generateImage(prompt, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await this.client.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: options.size || '1024x1024',
        quality: options.quality || 'standard',
        style: options.style || 'natural'
      });

      return {
        imageUrl: response.data[0].url,
        revisedPrompt: response.data[0].revised_prompt,
        size: options.size || '1024x1024'
      };
    } catch (error) {
      throw new Error(`OpenAI Image API error: ${error.message}`);
    }
  }

  calculateCost(usage) {
    if (!usage) return 0;

    const model = usage.model || 'gpt-4-turbo';
    const config = this.modelConfig[model];
    if (!config) return 0;

    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;

    return (inputTokens / 1000) * config.costPer1K.input +
           (outputTokens / 1000) * config.costPer1K.output;
  }

  calculateImageCost(size = '1024x1024', quality = 'standard') {
    const costs = {
      '1024x1024': { standard: 0.040, hd: 0.080 },
      '1792x1024': { standard: 0.080, hd: 0.120 },
      '1024x1792': { standard: 0.080, hd: 0.120 }
    };

    return costs[size]?.[quality] || 0.080;
  }

  async streamResponse(prompt, options = {}, onChunk) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured');
    }

    const model = options.model || 'gpt-4-turbo';
    const config = this.modelConfig[model] || this.modelConfig['gpt-4-turbo'];

    try {
      const stream = await this.client.chat.completions.create({
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
        stream: true
      });

      let fullContent = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullContent += content;

        if (onChunk) {
          onChunk({
            content,
            isComplete: false,
            fullContent
          });
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
      throw new Error(`OpenAI streaming error: ${error.message}`);
    }
  }
}

module.exports = OpenAIClient;