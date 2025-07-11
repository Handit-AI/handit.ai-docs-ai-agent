/**
 * Model Configuration for OpenAI Models
 * Handles different parameter requirements for various OpenAI models
 * @module config/modelConfig
 */

/**
 * Get model-specific configuration
 * @param {string} modelName - OpenAI model name
 * @returns {Object} Model configuration
 */
function getModelConfig(modelName) {
    const isO1Model = modelName?.includes('o1');
    const isGPT4Model = modelName?.includes('gpt-4');
    const isGPT35Model = modelName?.includes('gpt-3.5');
    
    return {
        // Token limits
        tokenLimits: {
            maxTokens: isO1Model ? 'max_completion_tokens' : 'max_tokens',
            defaultLimit: isO1Model ? 2000 : 1000
        },
        
        // Temperature settings
        temperature: {
            default: isO1Model ? 1.0 : 0.3,
            min: isO1Model ? 1.0 : 0.0,
            max: isO1Model ? 1.0 : 2.0
        },
        
        // Supported parameters
        supportedParams: {
            temperature: !isO1Model, // o1 models don't support temperature control
            top_p: !isO1Model,
            frequency_penalty: !isO1Model,
            presence_penalty: !isO1Model,
            max_tokens: !isO1Model,
            max_completion_tokens: isO1Model,
            stream: !isO1Model // o1 models don't support streaming
        },
        
        // Model capabilities
        capabilities: {
            reasoning: isO1Model,
            codeGeneration: true,
            multiLanguage: true,
            conversational: true,
            systemPrompts: !isO1Model // o1 models handle system prompts differently
        },
        
        // Cost optimization
        costOptimization: {
            useCache: true,
            batchRequests: !isO1Model,
            parallelProcessing: !isO1Model
        }
    };
}

/**
 * Build OpenAI completion parameters based on model
 * @param {string} modelName - OpenAI model name
 * @param {Object} baseParams - Base parameters
 * @returns {Object} Model-specific parameters
 */
function buildCompletionParams(modelName, baseParams = {}) {
    const config = getModelConfig(modelName);
    const params = {
        model: modelName,
        messages: baseParams.messages || []
    };
    
    // Add token limits
    if (config.supportedParams.max_tokens && baseParams.maxTokens) {
        params.max_tokens = baseParams.maxTokens;
    } else if (config.supportedParams.max_completion_tokens && baseParams.maxTokens) {
        params.max_completion_tokens = baseParams.maxTokens;
    }
    
    // Add temperature (only for non-o1 models)
    if (config.supportedParams.temperature && baseParams.temperature !== undefined) {
        params.temperature = baseParams.temperature;
    }
    
    // Add other parameters for non-o1 models
    if (config.supportedParams.top_p && baseParams.top_p !== undefined) {
        params.top_p = baseParams.top_p;
    }
    
    if (config.supportedParams.frequency_penalty && baseParams.frequency_penalty !== undefined) {
        params.frequency_penalty = baseParams.frequency_penalty;
    }
    
    if (config.supportedParams.presence_penalty && baseParams.presence_penalty !== undefined) {
        params.presence_penalty = baseParams.presence_penalty;
    }
    
    return params;
}

/**
 * Optimize messages for specific model
 * @param {string} modelName - OpenAI model name
 * @param {Array} messages - Original messages
 * @returns {Array} Optimized messages
 */
function optimizeMessagesForModel(modelName, messages) {
    const config = getModelConfig(modelName);
    
    if (config.capabilities.reasoning) {
        // For o1 models, combine system and user messages
        const systemMessages = messages.filter(msg => msg.role === 'system');
        const userMessages = messages.filter(msg => msg.role === 'user');
        const assistantMessages = messages.filter(msg => msg.role === 'assistant');
        
        if (systemMessages.length > 0 && userMessages.length > 0) {
            // Combine system prompt with user message for o1 models
            const combinedContent = `${systemMessages.map(msg => msg.content).join('\n\n')}\n\n${userMessages[userMessages.length - 1].content}`;
            
            return [
                ...assistantMessages,
                {
                    role: 'user',
                    content: combinedContent
                }
            ];
        }
    }
    
    return messages;
}

/**
 * Get recommended settings for model
 * @param {string} modelName - OpenAI model name
 * @param {string} taskType - Type of task (reasoning, generation, conversation)
 * @returns {Object} Recommended settings
 */
function getRecommendedSettings(modelName, taskType = 'conversation') {
    const config = getModelConfig(modelName);
    
    const settings = {
        maxTokens: config.tokenLimits.defaultLimit,
        temperature: config.temperature.default
    };
    
    // Task-specific optimizations
    switch (taskType) {
        case 'reasoning':
            settings.maxTokens = Math.min(2000, config.tokenLimits.defaultLimit);
            settings.temperature = config.temperature.min;
            break;
            
        case 'generation':
            settings.maxTokens = config.tokenLimits.defaultLimit;
            settings.temperature = config.temperature.default;
            break;
            
        case 'conversation':
            settings.maxTokens = Math.min(1000, config.tokenLimits.defaultLimit);
            settings.temperature = config.temperature.default;
            break;
    }
    
    return settings;
}

module.exports = {
    getModelConfig,
    buildCompletionParams,
    optimizeMessagesForModel,
    getRecommendedSettings
}; 