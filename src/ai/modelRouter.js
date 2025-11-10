// src/ai/modelRouter.js
// AI Model Router - Selects optimal AI for each task

require('dotenv').config();
const OpenAIClient = require('./openaiClient');
const AnthropicClient = require('./anthropicClient');
const DeepSeekClient = require('./deepseekClient');
const fs = require('fs');
const path = require('path');

// Simple logger implementation
const logger = {
  debug: (message, data = {}) => console.log(`DEBUG: ${message}`, data),
  info: (message, data = {}) => console.log(`INFO: ${message}`, data),
  warn: (message, data = {}) => console.warn(`WARN: ${message}`, data),
  error: (message, data = {}) => console.error(`ERROR: ${message}`, data)
};

// Simple file manager
function getFileManager() {
  return {
    loadJSON: (filePath) => {
      try {
        const fullPath = path.resolve(filePath);
        if (fs.existsSync(fullPath)) {
          return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        }
        return null;
      } catch (error) {
        logger.error(`Failed to load JSON file: ${filePath}`, { error: error.message });
        return null;
      }
    }
  };
}

class ModelRouter {
  constructor() {
    // Initialize all clients
    this.clients = {
      openai: new OpenAIClient(),
      claude: new AnthropicClient(),
      deepseek: new DeepSeekClient()
    };

    // Load routing config and model registry
    const fm = getFileManager();
    this.config = fm.loadJSON('config/ai-models.json') || this.getDefaultConfig();
    this.modelRegistry = fm.loadJSON('config/model-registry.json') || {};
    
    // Resolve model references to actual model IDs
    this.resolveModelReferences();

    // Cost tracking
    this.totalCost = 0;
    this.usageStats = {};
  }

  /**
   * Resolve model references to actual model IDs using the registry
   */
  resolveModelReferences() {
    console.log('🔍 Resolving model references from registry...');
    
    for (const [modelKey, modelConfig] of Object.entries(this.config.models)) {
      if (modelConfig.model_ref) {
        const [provider, ref] = modelConfig.model_ref.split(':');
        
        if (this.modelRegistry.models[provider] && this.modelRegistry.models[provider][ref]) {
          const resolvedModelId = this.modelRegistry.models[provider][ref];
          modelConfig.model_id = resolvedModelId;
          console.log(`   ✅ ${modelKey}: ${modelConfig.model_ref} → ${resolvedModelId}`);
        } else {
          console.warn(`   ⚠️ ${modelKey}: Could not resolve model_ref "${modelConfig.model_ref}"`);
        }
      }
    }
    
    // Validate deprecated models
    const deprecatedModels = this.modelRegistry.validation?.model_status?.deprecated || [];
    for (const modelId of deprecatedModels) {
      console.warn(`   🚨 Deprecated model detected: ${modelId}`);
    }
  }

  getDefaultConfig() {
    return {
      roles: {
        RESEARCH: { primary: 'perplexity', fallback: 'openai' },
        REASONING: { primary: 'deepseek', fallback: 'claude' },
        DRAFTING: { primary: 'openai', fallback: 'claude' },
        COMPLIANCE: { primary: 'claude', fallback: 'openai' },
        EDITING: { primary: 'claude', fallback: 'openai' },
        SEO_META: { primary: 'openai', fallback: 'claude' },
        IMAGERY: { primary: 'openai', fallback: null }
      }
    };
  }

  /**
   * Call AI with automatic model selection and fallback
   */
  async callWithFailover(role, prompt, options = {}) {
    const roleConfig = this.config.roles[role];
    
    if (!roleConfig) {
      throw new Error(`Unknown role: ${role}`);
    }

    // Map config keys to client names
    const primaryModel = roleConfig.primary || roleConfig.primary_model;
    const fallbackModel = roleConfig.fallback || roleConfig.fallback_model;
    
    logger.debug('Model selection', { role, primaryModel, fallbackModel });
    
    // Map model names to client names using the models configuration
    let primaryClientName = primaryModel;
    let fallbackClientName = fallbackModel;
    
    // Check if the model name exists in the models config and get its provider
    if (this.config.models[primaryModel]) {
      primaryClientName = this.config.models[primaryModel].provider;
    }
    
    if (fallbackModel && this.config.models[fallbackModel]) {
      fallbackClientName = this.config.models[fallbackModel].provider;
    }

    // Try primary model
    const primaryClient = this.getClient(primaryClientName);
    
    logger.info(`Checking primary client ${primaryClientName} for role ${role}`);
    logger.debug('Client existence/configured', { exists: !!primaryClient, configured: primaryClient?.isConfigured() });
    
    if (primaryClient && primaryClient.isConfigured()) {
      try {
        logger.info(`Using ${primaryClientName} for ${role}`);
        const start = Date.now();
        const result = await primaryClient.generateText(prompt, options);
        const durationMs = Date.now() - start;
        this.trackUsage(primaryClientName, result.usage);
        
        logger.info('AI response received', { client: primaryClientName, durationMs });
        logger.debug('AI response detail', { client: primaryClientName, usage: result.usage });
        
        // Normalize response format - some clients return 'content', others 'text'
        const normalizedResult = {
          ...result,
          text: result.text || result.content || ''
        };
        return normalizedResult;
      } catch (error) {
        logger.warn(`${primaryClientName} failed`, { message: error.message, stack: error.stack });
      }
    }

    // Try fallback model
    if (fallbackClientName) {
      const fallbackClient = this.getClient(fallbackClientName);
      
      if (fallbackClient && fallbackClient.isConfigured()) {
        logger.info(`Falling back to ${fallbackClientName} for ${role}`);
        const start = Date.now();
        const result = await fallbackClient.generateText(prompt, options);
        const durationMs = Date.now() - start;
        this.trackUsage(fallbackClientName, result.usage);
        
        logger.info('AI fallback response received', { client: fallbackClientName, durationMs });
        logger.debug('AI fallback response detail', { client: fallbackClientName, usage: result.usage });
        
        // Normalize response format - some clients return 'content', others 'text'
        const normalizedResult = {
          ...result,
          text: result.text || result.content || ''
        };
        return normalizedResult;
      }
    }

    throw new Error(`No configured AI models available for role: ${role}`);
  }

  /**
   * Generate image (DALL-E only for now)
   */
  async generateImage(prompt, options = {}) {
    const client = this.clients.openai;
    
    if (!client.isConfigured()) {
      throw new Error('OpenAI not configured for image generation');
    }

    console.log(`🎨 Generating image with DALL-E 3`);
    const result = await client.generateImage(prompt, options);
    
    // Track cost
    const cost = client.calculateImageCost(options.size || '1792x1024');
    this.trackCost('openai', cost);
    
    return result;
  }

  /**
   * Get specific client
   */
  getClient(name) {
    return this.clients[name];
  }

  /**
   * Track usage and costs
   */
  trackUsage(clientName, usage) {
    if (!this.usageStats[clientName]) {
      this.usageStats[clientName] = {
        calls: 0,
        tokens: 0,
        cost: 0
      };
    }

    this.usageStats[clientName].calls += 1;
    
    if (usage) {
      const tokens = usage.total_tokens || 
                    (usage.prompt_tokens + usage.completion_tokens) ||
                    (usage.input_tokens + usage.output_tokens) || 0;
      
      this.usageStats[clientName].tokens += tokens;

      // Calculate cost
      const client = this.clients[clientName];
      if (client) {
        const cost = client.calculateCost(usage);
        this.usageStats[clientName].cost += cost;
        this.totalCost += cost;
      }
    }
  }

  /**
   * Track cost directly
   */
  trackCost(clientName, cost) {
    if (!this.usageStats[clientName]) {
      this.usageStats[clientName] = {
        calls: 0,
        tokens: 0,
        cost: 0
      };
    }

    this.usageStats[clientName].cost += cost;
    this.totalCost += cost;
  }

  /**
   * Get usage statistics
   */
  getStats() {
    return {
      total_cost: this.totalCost,
      by_model: this.usageStats
    };
  }

  /**
   * Calculate cost for a specific role and usage
   * @param {string} role - The AI role used
   * @param {object} usage - Usage data from API response
   * @returns {number} Cost in USD
   */
  calculateCost(role, usage) {
    const roleConfig = this.config.roles[role];
    if (!roleConfig) {
      throw new Error(`Unknown role: ${role}`);
    }

    // Map config keys to client names
    const primaryModel = roleConfig.primary || roleConfig.primary_model;
    const modelToClient = {
      'perplexity_research': 'perplexity',
      'gpt4_turbo': 'openai',
      'claude_sonnet': 'claude',
      'deepseek_reasoning': 'deepseek'
    };
    
    const clientName = modelToClient[primaryModel] || primaryModel;
    const client = this.getClient(clientName);
    
    if (!client || !client.isConfigured()) {
      throw new Error(`Client ${clientName} not configured for cost calculation`);
    }

    return client.calculateCost(usage);
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.totalCost = 0;
    this.usageStats = {};
  }
}

// Singleton
let routerInstance = null;

module.exports = {
  getRouter: () => {
    if (!routerInstance) {
      routerInstance = new ModelRouter();
    }
    return routerInstance;
  },
  ModelRouter
};