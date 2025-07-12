/**
 * AI Routes - Intelligent agentic conversation endpoints
 * @module routes/ai
 */

const express = require('express');
const router = express.Router();
const { 
    handleLegacyConversation,
    getConversationHistory,
    clearConversation,
    getHealthStatus,
    getPerformanceMetrics,
    handleDirectTest
} = require('../controllers/aiController');
const { validateQuestion } = require('../middleware/validation');


/**
 * @route POST /api/ai/ask
 * @desc Legacy endpoint for backward compatibility
 * @access Public
 * @body {string} question - User question
 * @body {string} [language] - Language preference (auto-detected if not provided)
 * @body {string} [context] - Additional context
 * @body {string} [sessionId] - Optional session ID
 * @returns {Object} Response in legacy format with agentic enhancements
 */
router.post('/chat', validateQuestion, handleLegacyConversation);

/**
 * @route POST /api/ai/test
 * @desc Direct test endpoint bypassing agentic system
 * @access Public
 * @body {string} message - User message
 * @returns {Object} Direct AI response
 */
router.post('/test', handleDirectTest);

/**
 * @route GET /api/ai/conversations/:sessionId
 * @desc Get conversation history with intelligent context
 * @access Public
 * @param {string} sessionId - Session identifier
 * @query {number} [limit=50] - Maximum number of messages
 * @query {number} [offset=0] - Offset for pagination
 * @returns {Object} Conversation history with context and statistics
 */
router.get('/conversations/:sessionId', getConversationHistory);

/**
 * @route DELETE /api/ai/conversations/:sessionId
 * @desc Clear conversation and reset context
 * @access Public
 * @param {string} sessionId - Session identifier
 * @returns {Object} Confirmation message
 */
router.delete('/conversations/:sessionId', clearConversation);

/**
 * @route GET /api/ai/health
 * @desc Get AI service health status with performance metrics
 * @access Public
 * @returns {Object} Health status and performance data
 */
router.get('/health', getHealthStatus);

/**
 * @route GET /api/ai/metrics
 * @desc Get detailed performance metrics
 * @access Public
 * @returns {Object} Performance metrics and analytics
 */
router.get('/metrics', getPerformanceMetrics);

module.exports = router; 