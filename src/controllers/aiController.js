/**
 * Simplified AI Controller
 * @module controllers/aiController
 */

const { aiService } = require('../services/aiService');
// const AgenticSystem = require('../services/agenticSystem');
const ConversationService = require('../services/conversationService');
const AgenticAI = require('../services/agenticAi');

// Initialize services
// const agenticSystem = new AgenticSystem();
const agenticAI = new AgenticAI();
const conversationService = new ConversationService();

/**
 * Handle AI conversation (main endpoint)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handleLegacyConversation(req, res) {
    const startTime = Date.now();
    
    try {
        const { question, sessionId: providedSessionId } = req.body;
        
        // Validate input
        if (!question || typeof question !== 'string' || question.trim().length === 0) {
            return res.status(400).json({
                error: 'Question is required',
                code: 'INVALID_QUESTION'
            });
        }

        // Generate or use provided session ID
        const sessionId = providedSessionId || conversationService.generateSessionId();
        
        console.log(`🤖 Processing question for session: ${sessionId}`);
        console.log(`📝 Question: "${question.substring(0, 100)}${question.length > 100 ? '...' : ''}"`);
        
        // Process with guided agentic system
        const response = await agenticAI.processUserInput(question, sessionId);
        
        // Create or get conversation and save messages
        const conversation = await conversationService.createOrGetConversation(sessionId);
        await conversationService.saveMessage(conversation.id, 'user', question);
        await conversationService.saveMessage(conversation.id, 'assistant', response.answer);
        
        const processingTime = Date.now() - startTime;
        
        // Return guided response
        res.json({
            answer: response.answer,
            sessionId: sessionId,
            userMessage: response.userMessage,
            conversationHistory: response.conversationHistory,
            intention: response.intention,
            orientation: response.orientation,
            extractedInfo: response.extractedInfo,
            on_boarding_observability_finished: response.on_boarding_observability_finished,
            confidence: response.confidence,
            sources: response.sources,
            totalSources: response.totalSources,
            requiresUserInput: response.requiresUserInput || false,
            nextAction: response.nextAction || 'continue',
            metadata: {
                processingTimeMs: processingTime,
                timestamp: new Date().toISOString(),
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
            }
        });

    } catch (error) {
        console.error('❌ Error in conversation:', error);
        
        const processingTime = Date.now() - startTime;
        
        res.status(500).json({
            error: 'Internal server error',
            code: 'PROCESSING_ERROR',
            metadata: {
                processingTimeMs: processingTime,
                timestamp: new Date().toISOString()
            }
        });
    }
}

/**
 * Get conversation history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getConversationHistory(req, res) {
    try {
        const { sessionId } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        
        if (!sessionId) {
            return res.status(400).json({
                error: 'Session ID is required',
                code: 'MISSING_SESSION_ID'
            });
        }

        console.log(`📚 Getting conversation history for session: ${sessionId}`);
        
        const history = await conversationService.getConversationHistory(
            sessionId, 
            parseInt(limit), 
            parseInt(offset)
        );
        
        res.json({
            sessionId,
            messages: history.messages || [],
            totalMessages: history.totalMessages || 0,
            hasMore: history.hasMore || false,
            metadata: {
                timestamp: new Date().toISOString(),
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });

    } catch (error) {
        console.error('❌ Error getting conversation history:', error);
        
        res.status(500).json({
            error: 'Error retrieving conversation history',
            code: 'HISTORY_ERROR'
        });
    }
}

/**
 * Clear conversation history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function clearConversation(req, res) {
    try {
        const { sessionId } = req.params;
        
        if (!sessionId) {
            return res.status(400).json({
                error: 'Session ID is required',
                code: 'MISSING_SESSION_ID'
            });
        }

        console.log(`🗑️ Clearing conversation for session: ${sessionId}`);
        
        await conversationService.clearConversation(sessionId);
        
        res.json({
            message: 'Conversation cleared successfully',
            sessionId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error clearing conversation:', error);
        
        res.status(500).json({
            error: 'Error clearing conversation',
            code: 'CLEAR_ERROR'
        });
    }
}

/**
 * Get health status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getHealthStatus(req, res) {
    try {
        const health = await aiService.healthCheck();
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                aiService: health.status,
                openai: health.openai ? 'connected' : 'disconnected',
                pinecone: health.pinecone ? 'connected' : 'disconnected'
            }
        });

    } catch (error) {
        console.error('❌ Health check error:', error);
        
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * Get performance metrics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getPerformanceMetrics(req, res) {
    try {
        const metrics = aiService.getCacheStats();
        
        res.json({
            cacheStats: metrics,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage()
        });

    } catch (error) {
        console.error('❌ Error getting metrics:', error);
        
        res.status(500).json({
            error: 'Error retrieving metrics',
            code: 'METRICS_ERROR'
        });
    }
}

/**
 * Handle direct test (bypass agentic system)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handleDirectTest(req, res) {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({
                error: 'Message is required',
                code: 'INVALID_MESSAGE'
            });
        }

        const response = await aiService.generateResponse(message, {
            language: 'es',
            maxTokens: 500
        });
        
        res.json({
            answer: response.answer,
            confidence: response.confidence,
            sources: response.sources,
            processingTime: response.processingTime,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Direct test error:', error);
        
        res.status(500).json({
            error: 'Direct test failed',
            code: 'TEST_ERROR'
        });
    }
}

module.exports = {
    handleLegacyConversation,
    getConversationHistory,
    clearConversation,
    getHealthStatus,
    getPerformanceMetrics,
    handleDirectTest
};
