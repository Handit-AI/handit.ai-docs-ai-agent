/**
 * Optimized AI Service - Efficient RAG implementation for Intelligent Agentic System
 * @module services/aiService
 * @requires @pinecone-database/pinecone
 * @requires openai
 * @requires ../config/pinecone
 * @requires ./conversationService
 */

const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');
const { initializePinecone } = require('../config/pinecone');
const { buildCompletionParams, optimizeMessagesForModel, getRecommendedSettings } = require('../config/modelConfig');
const ConversationService = require('./conversationService');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Optimized AI Service class with intelligent caching and efficient processing
 */
class AIService {
    constructor() {
        this.pineconeClient = null;
        this.pineconeIndex = null;
        this.openaiClient = null;
        this.conversationService = new ConversationService();
        this.initialized = false;
        
        // Intelligent caching system
        this.responseCache = new Map();
        this.embeddingCache = new Map();
        this.documentCache = new Map();
        
        // Performance optimization
        this.maxCacheSize = 1000;
        this.cacheHitCount = 0;
        this.cacheMissCount = 0;
    }

    /**
     * Initialize the AI service with optimized configuration
     * @async
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            console.log('🚀 Initializing Optimized AI Service...');
            
            // Initialize Pinecone with namespace
            const pineconeConfig = await initializePinecone();
            this.pineconeClient = pineconeConfig.client;
            this.pineconeIndex = pineconeConfig.index;
            this.namespace = pineconeConfig.namespace;
            this.baseIndex = pineconeConfig.baseIndex;
            
            console.log(`📂 AI Service using namespace: ${this.namespace}`);
            
            // Initialize OpenAI with optimized settings
            this.openaiClient = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
                timeout: 30000, // 30 second timeout
                maxRetries: 3
            });
            
            this.initialized = true;
            console.log('✅ Optimized AI Service initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing AI Service:', error);
            throw error;
        }
    }

    /**
     * Generate embedding with intelligent caching
     * @async
     * @param {string} text - Text to embed
     * @returns {Promise<number[]>} Embedding vector
     */
    async generateEmbedding(text) {
        if (!this.initialized) {
            await this.initialize();
        }

        // Check cache first
        const cacheKey = this.generateCacheKey(text);
        if (this.embeddingCache.has(cacheKey)) {
            this.cacheHitCount++;
            return this.embeddingCache.get(cacheKey);
        }

        try {
            const response = await this.openaiClient.embeddings.create({
                model: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002',
                input: text.substring(0, 8000) // Limit input length
            });
            
            const embedding = response.data[0].embedding;
            
            // Cache the result
            this.cacheEmbedding(cacheKey, embedding);
            this.cacheMissCount++;
            
            return embedding;
        } catch (error) {
            console.error('❌ Error generating embedding:', error);
            throw error;
        }
    }

    /**
     * Optimized document search with intelligent caching
     * @async
     * @param {string} query - Search query
     * @param {Object} [options={}] - Search options
     * @returns {Promise<Array>} Array of relevant documents
     */
    async searchRelevantDocuments(query, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        const { topK = 20, minScore = 0.7 } = options;
        
        // Check document cache
        const docCacheKey = `${query}_${topK}_${minScore}`;
        if (this.documentCache.has(docCacheKey)) {
            this.cacheHitCount++;
            return this.documentCache.get(docCacheKey);
        }

        try {
            // Generate embedding for the query
            const queryEmbedding = await this.generateEmbedding(query);
            
            // Search in Pinecone
            const searchResponse = await this.pineconeIndex.query({
                vector: queryEmbedding,
                topK: topK,
                includeMetadata: true,
                includeValues: false
            });
            
            // Filter and format results
            const relevantDocs = searchResponse.matches
                .filter(match => match.score >= minScore)
                .map(match => ({
                    id: match.id,
                    score: match.score,
                    text: match.metadata.text,
                    metadata: match.metadata
                }));
            
            // Cache the results
            this.cacheDocuments(docCacheKey, relevantDocs);
            this.cacheMissCount++;
            
            console.log(`🔍 Found ${relevantDocs.length} relevant documents (Cache: ${this.getCacheStats()})`);
            
            return relevantDocs;
        } catch (error) {
            console.error('❌ Error searching documents:', error);
            throw error;
        }
    }

    /**
     * Optimized response generation with intelligent context management
     * @async
     * @param {string} question - User question
     * @param {Object} [options={}] - Generation options
     * @returns {Promise<Object>} Generated response with metadata
     */
    async generateResponse(question, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        const startTime = Date.now();
        
        try {
            const { 
                language = 'es', 
                context = '',
                sessionId = null,
                clientIp = null,
                userAgent = null,
                skipRAG = false // Option to skip RAG for certain queries
            } = options;

            // Check response cache for identical queries
            const responseCacheKey = `${question}_${language}_${context}`;
            if (this.responseCache.has(responseCacheKey)) {
                this.cacheHitCount++;
                const cachedResponse = this.responseCache.get(responseCacheKey);
                return {
                    ...cachedResponse,
                    fromCache: true,
                    processingTime: Date.now() - startTime
                };
            }
            
            // Handle conversation context efficiently
            let conversationContext = null;
            let conversation = null;
            
            if (sessionId) {
                try {
                    conversation = await this.conversationService.createOrGetConversation(
                        sessionId, clientIp, userAgent
                    );
                    conversationContext = await this.conversationService.getConversationContext(
                        sessionId, 5 // Reduced from 10 to 5 for efficiency
                    );
                } catch (error) {
                    console.warn('⚠️ Error getting conversation context:', error.message);
                }
            }
            
            // Retrieve relevant documents (skip if not needed)
            let relevantDocs = [];
            if (!skipRAG) {
                relevantDocs = await this.searchRelevantDocuments(question);
            }
            
            // Handle case with no relevant documents more efficiently
            if (!skipRAG && relevantDocs.length === 0) {
                const fallbackResponse = this.generateFallbackResponse(language);
                
                // Save conversation if sessionId provided
                if (sessionId && conversation) {
                    await this.saveConversationMessage(conversation.id, 'user', question, startTime);
                    await this.saveConversationMessage(conversation.id, 'assistant', fallbackResponse.answer, startTime);
                }
                
                return fallbackResponse;
            }
            
            // Prepare optimized context
            const retrievedContext = relevantDocs
                .slice(0, 10) // Limit to top 10 for efficiency
                .map((doc, index) => `[${index + 1}] ${doc.text}`)
                .join('\n\n');
            

            
            // Prepare conversation history context (optimized)
            let conversationHistoryContext = '';
            if (conversationContext && conversationContext.messages.length > 0) {
                const recentMessages = conversationContext.messages.slice(-4); // Reduced from 6 to 4
                conversationHistoryContext = `\n\nCONVERSATION CONTEXT:\n${recentMessages
                    .map(msg => `${msg.role}: ${msg.content.substring(0, 200)}...`)
                    .join('\n')}`;
            }
            
            // Create optimized system prompt
            const systemPrompt = this.createOptimizedSystemPrompt(retrievedContext, conversationHistoryContext);
            
            // Prepare user message
            const userMessage = context 
                ? `Context: ${context}\n\nQuestion: ${question}`
                : question;
            
            // Prepare messages for the specific model
            const modelName = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ];
            
            // Optimize messages for the specific model
            const optimizedMessages = optimizeMessagesForModel(modelName, messages);
            
            // Get recommended settings for this model
            const settings = getRecommendedSettings(modelName, 'conversation');
            
            // Use provided maxTokens or default to settings
            const maxTokens = options.maxTokens || settings.maxTokens;
            
            // Build completion parameters
            const completionParams = buildCompletionParams(modelName, {
                messages: optimizedMessages,
                maxTokens: maxTokens,
                temperature: settings.temperature,
                top_p: 0.9,
                frequency_penalty: 0.1,
                presence_penalty: 0.1
            });
            
            // Generate response using OpenAI with model-specific parameters
            const completion = await this.openaiClient.chat.completions.create(completionParams);
            
            const answer = completion.choices[0].message.content;
            
            // Calculate metrics
            const processingTime = Date.now() - startTime;
            const avgScore = relevantDocs.length > 0 
                ? relevantDocs.reduce((sum, doc) => sum + doc.score, 0) / relevantDocs.length 
                : 0;
            const confidence = this.calculateConfidence(avgScore, relevantDocs.length);
            
            // Prepare optimized response
            const response = {
                answer,
                sources: relevantDocs.slice(0, 5).map(doc => ({ // Limit sources to top 5
                    text: doc.text.substring(0, 150) + '...',
                    score: doc.score,
                    metadata: doc.metadata
                })),
                confidence,
                totalSources: relevantDocs.length,
                processingTime,
                fromCache: false
            };
            
            // Cache the response
            this.cacheResponse(responseCacheKey, response);
            this.cacheMissCount++;
            
            // Save conversation asynchronously for better performance
            if (sessionId && conversation) {
                this.saveConversationAsync(conversation.id, question, answer, startTime, {
                    processingTimeMs: processingTime,
                    contextUsed: relevantDocs.map(doc => doc.id),
                    evaluationScores: { confidence, avgScore },
                    tokensUsed: completion.usage?.total_tokens || null
                }, relevantDocs);
            }
            
            return response;
            
        } catch (error) {
            console.error('❌ Error generating response:', error);
            throw error;
        }
    }

    /**
     * Create optimized system prompt
     * @param {string} retrievedContext - Retrieved context
     * @param {string} conversationHistoryContext - Conversation history
     * @returns {string} Optimized system prompt
     */
    createOptimizedSystemPrompt(retrievedContext, conversationHistoryContext) {
        // For o1 models, use simpler prompts
        const modelName = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
        const isO1Model = modelName.includes('o1');
        
        if (isO1Model) {
            // For o1 models, use very simple prompts
            if (!retrievedContext || retrievedContext.trim().length < 50) {
                return `Eres un asistente experto de Handit.ai. Responde de manera clara y útil.${conversationHistoryContext}`;
            }
            
            return `Eres un asistente experto de Handit.ai. Ayuda al usuario basándote en esta documentación:

${retrievedContext}${conversationHistoryContext}

Responde de manera clara y práctica.`;
        }
        
        return `You are an expert Handit.ai assistant providing accurate, actionable guidance.

DOCUMENTATION CONTEXT:
${retrievedContext}${conversationHistoryContext}

CORE RESPONSIBILITIES:
- Provide accurate Handit.ai guidance based on documentation
- Give specific, actionable solutions
- Include relevant code examples
- Maintain conversation context
- Be helpful and professional

RESPONSE GUIDELINES:
- Base responses on provided documentation
- Provide specific implementation steps
- Include code examples when relevant
- Be concise but comprehensive
- Prioritize accuracy and usefulness

Always provide the most helpful solution based on available context.`;
    }

    /**
     * Generate fallback response for queries without relevant documents
     * @param {string} language - Response language
     * @returns {Object} Fallback response
     */
    generateFallbackResponse(language) {
        const responses = {
            es: `Lo siento, no encontré información específica sobre tu consulta en la documentación de Handit.ai. 

Esto podría ser porque:
1. El tema no está cubierto en la documentación actual
2. La consulta es muy específica o nueva
3. La información podría estar en un formato diferente

Por favor, intenta reformular tu pregunta o pregunta sobre un aspecto diferente de Handit.ai. Estoy aquí para ayudarte con configuración, integración, resolución de problemas y preguntas generales sobre las funcionalidades de Handit.ai.`,
            en: `I apologize, but I couldn't find specific information about your query in the Handit.ai documentation.

This could be because:
1. The topic might not be covered in our current documentation
2. The question might be too specific or new
3. The information might be available in a different format

Please try rephrasing your question or ask about a different aspect of Handit.ai. I'm here to help with setup, configuration, troubleshooting, and general questions about Handit.ai features.`
        };

        return {
            answer: responses[language] || responses.en,
            sources: [],
            confidence: 'low',
            totalSources: 0,
            processingTime: 0
        };
    }

    /**
     * Calculate confidence score based on relevance and document count
     * @param {number} avgScore - Average relevance score
     * @param {number} docCount - Number of relevant documents
     * @returns {string} Confidence level
     */
    calculateConfidence(avgScore, docCount) {
        if (docCount === 0) return 'low';
        if (avgScore >= 0.85 && docCount >= 3) return 'high';
        if (avgScore >= 0.75 && docCount >= 2) return 'medium';
        return 'low';
    }

    /**
     * Save conversation asynchronously for better performance
     * @param {string} conversationId - Conversation ID
     * @param {string} question - User question
     * @param {string} answer - Assistant answer
     * @param {number} startTime - Start time
     * @param {Object} metadata - Additional metadata
     * @param {Array} relevantDocs - Relevant documents
     */
    async saveConversationAsync(conversationId, question, answer, startTime, metadata, relevantDocs) {
        try {
            // Save messages
            await this.saveConversationMessage(conversationId, 'user', question, startTime);
            await this.saveConversationMessage(conversationId, 'assistant', answer, startTime, metadata);
            
            // Track knowledge usage
            if (relevantDocs.length > 0) {
                const lastMessage = await this.conversationService.pool.query(
                    'SELECT id FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1',
                    [conversationId]
                );
                
                if (lastMessage.rows.length > 0) {
                    const chunks = relevantDocs.map(doc => ({
                        id: doc.id,
                        relevance_score: doc.score,
                        used_in_response: true
                    }));
                    
                    await this.conversationService.trackKnowledgeUsage(
                        lastMessage.rows[0].id, 
                        chunks
                    );
                }
            }
        } catch (error) {
            console.warn('⚠️ Error saving conversation:', error.message);
        }
    }

    /**
     * Save conversation message
     * @param {string} conversationId - Conversation ID
     * @param {string} role - Message role
     * @param {string} content - Message content
     * @param {number} startTime - Start time
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Saved message
     */
    async saveConversationMessage(conversationId, role, content, startTime, options = {}) {
        try {
            return await this.conversationService.saveMessage(conversationId, role, content, {
                ...options,
                processingTimeMs: options.processingTimeMs || (Date.now() - startTime)
            });
        } catch (error) {
            console.error('❌ Error saving conversation message:', error);
            throw error;
        }
    }

    /**
     * Generate cache key for text
     * @param {string} text - Text to hash
     * @returns {string} Cache key
     */
    generateCacheKey(text) {
        return Buffer.from(text).toString('base64').substring(0, 32);
    }

    /**
     * Cache embedding result
     * @param {string} key - Cache key
     * @param {Array} embedding - Embedding vector
     */
    cacheEmbedding(key, embedding) {
        if (this.embeddingCache.size >= this.maxCacheSize) {
            const firstKey = this.embeddingCache.keys().next().value;
            this.embeddingCache.delete(firstKey);
        }
        this.embeddingCache.set(key, embedding);
    }

    /**
     * Cache document search results
     * @param {string} key - Cache key
     * @param {Array} documents - Document results
     */
    cacheDocuments(key, documents) {
        if (this.documentCache.size >= this.maxCacheSize) {
            const firstKey = this.documentCache.keys().next().value;
            this.documentCache.delete(firstKey);
        }
        this.documentCache.set(key, documents);
    }

    /**
     * Cache response result
     * @param {string} key - Cache key
     * @param {Object} response - Response object
     */
    cacheResponse(key, response) {
        if (this.responseCache.size >= this.maxCacheSize) {
            const firstKey = this.responseCache.keys().next().value;
            this.responseCache.delete(firstKey);
        }
        this.responseCache.set(key, response);
    }

    /**
     * Get cache statistics
     * @returns {string} Cache stats
     */
    getCacheStats() {
        const totalRequests = this.cacheHitCount + this.cacheMissCount;
        const hitRate = totalRequests > 0 ? (this.cacheHitCount / totalRequests * 100).toFixed(1) : 0;
        return `${hitRate}% hit rate`;
    }

    /**
     * Clear all caches
     */
    clearAllCaches() {
        this.responseCache.clear();
        this.embeddingCache.clear();
        this.documentCache.clear();
        this.cacheHitCount = 0;
        this.cacheMissCount = 0;
    }

    /**
     * Health check with cache statistics
     * @async
     * @returns {Promise<Object>} Health status with performance metrics
     */
    async healthCheck() {
        try {
            const health = {
                status: 'healthy',
                services: {
                    pinecone: 'unknown',
                    openai: 'unknown',
                    initialized: this.initialized
                },
                performance: {
                    cacheHitRate: this.getCacheStats(),
                    cacheSize: {
                        responses: this.responseCache.size,
                        embeddings: this.embeddingCache.size,
                        documents: this.documentCache.size
                    }
                },
                timestamp: new Date().toISOString()
            };
            
            if (this.initialized) {
                // Test Pinecone connection
                try {
                    await this.baseIndex.describeIndexStats();
                    health.services.pinecone = 'operational';
                    health.namespace = this.namespace;
                } catch (error) {
                    health.services.pinecone = 'error';
                    health.status = 'degraded';
                }
                
                // Test OpenAI connection
                try {
                    await this.openaiClient.models.list();
                    health.services.openai = 'operational';
                } catch (error) {
                    health.services.openai = 'error';
                    health.status = 'degraded';
                }
            }
            
            return health;
        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

// Export singleton instance
const aiService = new AIService();
module.exports = { AIService, aiService };
