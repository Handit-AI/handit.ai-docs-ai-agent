/**
 * Simplified Agentic System for Handit.ai
 * Single node that processes conversation history and user message
 * @module services/agenticSystem
 */

const { aiService } = require('./aiService');
const ConversationService = require('./conversationService');


class AgenticAI {


    constructor() {
        this.conversationService = new ConversationService();
    }

    /**
     * Process user input with conversation history
     * @param {string} userMessage - Latest user message
     * @param {string} sessionId - Session identifier
     * @returns {Promise<Object>} Simple response
     */
    async processUserInput(userMessage, sessionId) {
        try {
            console.log(`💬 Current Question: ${userMessage}`);

            // Get conversation history
            const conversationHistory = await this.conversationService.getConversationHistory(sessionId, 20);

            // // Log conversation history
            // console.log('\n📜 Conversation History:');
            // if (conversationHistory.messages && conversationHistory.messages.length > 0) {
            //     conversationHistory.messages.forEach((msg, index) => {
            //         console.log(`${index + 1}. ${msg.role}: ${msg.content}`);
            //     });
            // } else {
            //     console.log('No previous conversation history');
            // }

            // Call RouterIntention LLM to classify user intention
            const intentionResult = await this.routerIntention(userMessage, conversationHistory);

            return {
                answer: "Processing your request...",
                sessionId: sessionId,
                userMessage: userMessage,
                conversationHistory: conversationHistory,
                intention: intentionResult
            };

        } catch (error) {
            console.error('❌ Error in simple agentic system:', error);
            throw error;
        }
    }

    /**
     * Router Intention LLM - Classifies user intention based on context
     * @param {string} userMessage - Current user message
     * @param {Object} conversationHistory - Conversation history
     * @returns {Promise<Object>} Intention classification result
     */
    async routerIntention(userMessage, conversationHistory) {
        try {
            // Import handitKnowledgeBase from pinecone.js
            const { handitKnowledgeBase } = require('../config/pinecone');

            // Use handitKnowledgeBase as context
            const context = handitKnowledgeBase;

            // Prepare conversation history for context
            const conversationContext = conversationHistory.messages?.map(msg => `${msg.role}: ${msg.content}`).join('\n') || 'No previous conversation';

            const intentionPrompt = `You are a Router Intention LLM. Your goal is to classify the user intention based on the DOCUMENTATION CONTEXT.

DOCUMENTATION CONTEXT:
${context}

CONVERSATION HISTORY:
${conversationContext}

CURRENT USER MESSAGE: "${userMessage}"

TASK: Analyze if the user's intention is about Handit or any topic based on the DOCUMENTATION CONTEXT.

DECISION RULES:

1.- GO THROUGH THE DOCUMENTATION CONTEXT AND CHECK IF THE USER'S MESSAGE OR THE CONVERSATION HISTORY IS ABOUT Handit or any topic covered in the DOCUMENTATION CONTEXT.
2.- If the user's message or the conversation history is about Handit or any topic covered in the DOCUMENTATION CONTEXT → Return handit: true
3.- If the user's message is clearly about something NOT covered in the DOCUMENTATION CONTEXT → Return handit: false

Return ONLY valid JSON:
{"handit": true} or {"handit": false}`;

            const response = await aiService.generateResponse(intentionPrompt, {
                maxTokens: 100
            });

            console.log('🎯 Router Intention Response:', response.answer);

            let intentionResult;
            try {
                let jsonText = response.answer.trim();

                // Extract JSON if wrapped in other text
                const jsonMatch = jsonText.match(/\{[^}]*\}/);
                if (jsonMatch) {
                    jsonText = jsonMatch[0];
                }

                intentionResult = JSON.parse(jsonText);

                // Validate result
                if (typeof intentionResult.handit !== 'boolean') {
                    console.warn('⚠️ Invalid handit field, defaulting to handit: true');
                    intentionResult = { handit: true };
                }

            } catch (error) {
                console.warn('⚠️ Router Intention JSON parse failed, defaulting to handit: true:', error.message);
                intentionResult = { handit: true };
            }

            console.log('🎯 Intention Classification:', intentionResult);

            return intentionResult;

        } catch (error) {
            console.warn('⚠️ Error in Router Intention, defaulting to handit: true:', error.message);
            return { handit: true }; // Default to handit if error
        }
    }

}

module.exports = AgenticAI;