/**
 * Conversation Service for managing chat history and context
 * Provides database operations for conversations and messages
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

class ConversationService {
    constructor() {
        this.pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'handit_ai',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
    }

    /**
     * Generate a unique session ID
     * @returns {string} UUID-based session ID
     */
    generateSessionId() {
        return uuidv4();
    }

    /**
     * Create or get existing conversation
     * @param {string} sessionId - Session identifier
     * @param {string} clientIp - Client IP address
     * @param {string} userAgent - User agent string
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<Object>} Conversation object
     */
    async createOrGetConversation(sessionId, clientIp = null, userAgent = null, metadata = {}) {
        try {
            // Try to get existing conversation
            const existing = await this.pool.query(
                'SELECT * FROM conversations WHERE session_id = $1',
                [sessionId]
            );

            if (existing.rows.length > 0) {
                // Update last activity
                await this.pool.query(
                    'UPDATE conversations SET last_activity = CURRENT_TIMESTAMP WHERE session_id = $1',
                    [sessionId]
                );
                return existing.rows[0];
            }

            // Create new conversation
            const result = await this.pool.query(`
                INSERT INTO conversations (session_id, client_ip, user_agent, metadata)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [sessionId, clientIp, userAgent, metadata]);

            return result.rows[0];
        } catch (error) {
            console.error('Error creating/getting conversation:', error);
            throw error;
        }
    }

    /**
     * Save a message to the conversation
     * @param {string} conversationId - Conversation UUID
     * @param {string} role - Message role (user, assistant, system)
     * @param {string} content - Message content
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Message object
     */
    async saveMessage(conversationId, role, content, options = {}) {
        try {
            const {
                contentType = 'text',
                tokensUsed = null,
                processingTimeMs = null,
                contextUsed = [],
                evaluationScores = {},
                metadata = {}
            } = options;

            const result = await this.pool.query(`
                INSERT INTO messages (
                    conversation_id, role, content, content_type, 
                    tokens_used, processing_time_ms, context_used, 
                    evaluation_scores, metadata
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `, [
                conversationId, role, content, contentType,
                tokensUsed, processingTimeMs, contextUsed,
                evaluationScores, metadata
            ]);

            return result.rows[0];
        } catch (error) {
            console.error('Error saving message:', error);
            throw error;
        }
    }

    /**
     * Get conversation history
     * @param {string} sessionId - Session identifier
     * @param {number} limit - Maximum number of messages to retrieve
     * @param {number} offset - Offset for pagination
     * @returns {Promise<Object>} Object with messages array and metadata
     */
    async getConversationHistory(sessionId, limit = 50, offset = 0) {
        try {
            const result = await this.pool.query(`
                SELECT m.*, c.session_id
                FROM messages m
                JOIN conversations c ON m.conversation_id = c.id
                WHERE c.session_id = $1
                ORDER BY m.timestamp DESC
                LIMIT $2 OFFSET $3
            `, [sessionId, limit, offset]);

            const messages = result.rows.reverse(); // Return in chronological order
            
            return {
                messages: messages,
                totalMessages: messages.length,
                hasMore: messages.length === limit
            };
        } catch (error) {
            console.error('Error getting conversation history:', error);
            return {
                messages: [],
                totalMessages: 0,
                hasMore: false
            };
        }
    }

    /**
     * Get conversation context for AI agent
     * @param {string} sessionId - Session identifier
     * @param {number} messageLimit - Number of recent messages to include
     * @returns {Promise<Object>} Context object with messages and summary
     */
    async getConversationContext(sessionId, messageLimit = 10) {
        try {
            const historyResult = await this.getConversationHistory(sessionId, messageLimit);
            const messages = historyResult.messages || [];
            
            // Get conversation summary
            const conversation = await this.pool.query(
                'SELECT context_summary, tags FROM conversations WHERE session_id = $1',
                [sessionId]
            );

            const contextSummary = conversation.rows[0]?.context_summary || '';
            const tags = conversation.rows[0]?.tags || [];

            // Format messages for AI context
            const formattedMessages = messages.map(msg => ({
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
                contextUsed: msg.context_used || []
            }));

            return {
                sessionId,
                messages: formattedMessages,
                contextSummary,
                tags,
                totalMessages: messages.length
            };
        } catch (error) {
            console.error('Error getting conversation context:', error);
            return {
                sessionId,
                messages: [],
                contextSummary: '',
                tags: [],
                totalMessages: 0
            };
        }
    }

    /**
     * Update conversation summary (usually AI-generated)
     * @param {string} sessionId - Session identifier
     * @param {string} summary - Updated summary
     * @param {Array} tags - Updated tags
     * @returns {Promise<boolean>} Success status
     */
    async updateConversationSummary(sessionId, summary, tags = []) {
        try {
            await this.pool.query(
                'UPDATE conversations SET context_summary = $1, tags = $2 WHERE session_id = $3',
                [summary, tags, sessionId]
            );
            return true;
        } catch (error) {
            console.error('Error updating conversation summary:', error);
            return false;
        }
    }

    /**
     * Track knowledge base usage
     * @param {string} messageId - Message UUID
     * @param {Array} chunks - Array of chunk objects with relevance scores
     * @returns {Promise<boolean>} Success status
     */
    async trackKnowledgeUsage(messageId, chunks) {
        try {
            for (const chunk of chunks) {
                await this.pool.query(`
                    INSERT INTO knowledge_usage (
                        message_id, chunk_id, relevance_score, used_in_response
                    )
                    VALUES ($1, $2, $3, $4)
                `, [messageId, chunk.id, chunk.relevance_score, chunk.used_in_response || false]);
            }
            return true;
        } catch (error) {
            console.error('Error tracking knowledge usage:', error);
            return false;
        }
    }

    /**
     * Get conversation statistics
     * @param {string} sessionId - Session identifier
     * @returns {Promise<Object>} Statistics object
     */
    async getConversationStats(sessionId) {
        try {
            const result = await this.pool.query(`
                SELECT 
                    c.total_messages,
                    c.started_at,
                    c.last_activity,
                    COUNT(DISTINCT m.id) as actual_message_count,
                    AVG(m.tokens_used) as avg_tokens_per_message,
                    AVG(m.processing_time_ms) as avg_processing_time
                FROM conversations c
                LEFT JOIN messages m ON c.id = m.conversation_id
                WHERE c.session_id = $1
                GROUP BY c.id, c.total_messages, c.started_at, c.last_activity
            `, [sessionId]);

            return result.rows[0] || {};
        } catch (error) {
            console.error('Error getting conversation stats:', error);
            return {};
        }
    }

    /**
     * Archive old conversations
     * @param {number} daysOld - Archive conversations older than this many days
     * @returns {Promise<number>} Number of archived conversations
     */
    async archiveOldConversations(daysOld = 30) {
        try {
            const result = await this.pool.query(`
                UPDATE conversations 
                SET status = 'archived' 
                WHERE last_activity < (CURRENT_TIMESTAMP - INTERVAL '${daysOld} days')
                AND status = 'active'
            `);
            return result.rowCount;
        } catch (error) {
            console.error('Error archiving old conversations:', error);
            return 0;
        }
    }

    /**
     * Get most effective knowledge chunks
     * @param {number} limit - Number of chunks to return
     * @returns {Promise<Array>} Top performing chunks
     */
    async getTopKnowledgeChunks(limit = 10) {
        try {
            const result = await this.pool.query(`
                SELECT 
                    chunk_id,
                    COUNT(*) as usage_count,
                    AVG(relevance_score) as avg_relevance,
                    AVG(user_feedback) as avg_feedback
                FROM knowledge_usage
                WHERE used_in_response = true
                GROUP BY chunk_id
                ORDER BY usage_count DESC, avg_relevance DESC
                LIMIT $1
            `, [limit]);

            return result.rows;
        } catch (error) {
            console.error('Error getting top knowledge chunks:', error);
            return [];
        }
    }

    /**
     * Close database connection
     */
    async close() {
        await this.pool.end();
    }
}

module.exports = ConversationService; 