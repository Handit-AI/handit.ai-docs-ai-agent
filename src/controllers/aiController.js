/**
 * Simplified AI Controller
 * @module controllers/aiController
 */

const { aiService } = require('../services/aiService');
// const AgenticSystem = require('../services/agenticSystem');
const ConversationService = require('../services/conversationService');
const AgenticAI = require('../services/agenticAi');
const ApiService = require('../services/apiService');

// Initialize services
// const agenticSystem = new AgenticSystem();
const agenticAI = new AgenticAI();
const conversationService = new ConversationService();
const apiService = new ApiService();

/**
 * Handle AI conversation (main endpoint)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handleLegacyConversation(req, res) {
    const startTime = Date.now();
    
    try {
        const { question, sessionId: providedSessionId, handitToken } = req.body;
        
        // Extract Authorization Bearer token from headers (for API calls, not endpoint auth)
        const authHeader = req.headers.authorization;
        let userApiToken = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            userApiToken = authHeader.substring(7); // Remove 'Bearer ' prefix
            console.log('🔑 User provided API token for external API calls');
        }
        
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
        
        // Process with guided agentic system, passing the user's API token
        const response = await agenticAI.processUserInput(question, sessionId, userApiToken, handitToken);
        
        // Create or get conversation and save messages
        const conversation = await conversationService.createOrGetConversation(sessionId);
        await conversationService.saveMessage(conversation.id, 'user', question);
        await conversationService.saveMessage(conversation.id, 'assistant', response.answer);
        
        const processingTime = Date.now() - startTime;
        console.log("🚀 DEPLOYMENT_CHECK: Code version EVALUATOR_FLOW_V2.1 - " + new Date().toISOString());
        console.log("process.env.OPENAI_MODEL", process.env.OPENAI_MODEL);
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
            customAction: response.customAction, // For frontend UI actions
            evaluators_added: response.evaluators_added, // For evaluator association detection
            custom_evaluator_management: response.custom_evaluator_management, // For evaluator management detection
            handitTokenUsed: !!handitToken,
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
        const apiHealth = await apiService.healthCheck();
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                aiService: health.status,
                openai: health.openai ? 'connected' : 'disconnected',
                pinecone: health.pinecone ? 'connected' : 'disconnected',
                externalApi: {
                    status: apiHealth.healthy ? 'connected' : 'disconnected',
                    message: apiHealth.message,
                    isOptional: apiHealth.isOptional || false
                }
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

/**
 * Test API integration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function testApiIntegration(req, res) {
    try {
        console.log('🧪 Testing API integration...');
        
        // Test API availability
        const apiHealth = await apiService.healthCheck();
        const availableActions = apiService.getAvailableActions();
        
        res.json({
            apiAvailable: apiService.isAvailable(),
            health: apiHealth,
            availableActions: availableActions,
            actionsDescription: apiService.getActionsDescription(),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ API integration test error:', error);
        
        res.status(500).json({
            error: 'API integration test failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * Get deployment version and build info
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getVersionInfo(req, res) {
    try {
        const fs = require('fs');
        const path = require('path');
        
        // Try to get package.json info
        let packageInfo = {};
        try {
            const packagePath = path.join(process.cwd(), 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            packageInfo = {
                name: packageJson.name,
                version: packageJson.version
            };
        } catch (e) {
            packageInfo = { error: 'Could not read package.json' };
        }

        // Get current commit hash if available
        let gitInfo = {};
        try {
            const gitHeadPath = path.join(process.cwd(), '.git/HEAD');
            if (fs.existsSync(gitHeadPath)) {
                const head = fs.readFileSync(gitHeadPath, 'utf8').trim();
                if (head.startsWith('ref:')) {
                    const refPath = path.join(process.cwd(), '.git', head.substring(5));
                    if (fs.existsSync(refPath)) {
                        gitInfo.commit = fs.readFileSync(refPath, 'utf8').trim();
                        gitInfo.branch = head.split('/').pop();
                    }
                } else {
                    gitInfo.commit = head;
                }
            }
        } catch (e) {
            gitInfo = { error: 'Could not read git info' };
        }

        res.json({
            deploymentVersion: "EVALUATOR_FLOW_V2.1",
            buildTimestamp: new Date().toISOString(),
            nodeVersion: process.version,
            environment: process.env.NODE_ENV || 'development',
            packageInfo: packageInfo,
            gitInfo: gitInfo,
            uptime: Math.floor(process.uptime()),
            // Build info from environment (set by Docker build)
            buildInfo: {
                buildDate: process.env.BUILD_DATE || 'unknown',
                commitSha: process.env.COMMIT_SHA || 'unknown',
                buildId: process.env.BUILD_ID || 'unknown',
                currentBranch: process.env.BRANCH || 'unknown'
            },
            // Runtime info
            deploymentTime: new Date().toISOString(),
            serverStartTime: new Date(Date.now() - process.uptime() * 1000).toISOString(),
            evaluatorFlowEnabled: true,
            features: {
                evaluatorConnection: true,
                aiDrivenFlow: true,
                providerModelSelection: true,
                handitTokenSupport: true,
                versionEndpoint: true,
                buildDebugging: true
            }
        });

    } catch (error) {
        console.error('❌ Version info error:', error);
        
        res.status(500).json({
            error: 'Version info failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

module.exports = {
    handleLegacyConversation,
    getConversationHistory,
    clearConversation,
    getHealthStatus,
    getPerformanceMetrics,
    handleDirectTest,
    testApiIntegration,
    getVersionInfo
};
