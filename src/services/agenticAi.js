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

            // Check if user intention is about handit
            if (intentionResult.handit === false) {
                // Redirect to anotherTopic LLM for polite redirection
                const redirectResponse = await this.anotherTopic(userMessage, conversationHistory, intentionResult);
                return {
                    answer: redirectResponse.answer,
                    sessionId: sessionId,
                    userMessage: userMessage,
                    conversationHistory: conversationHistory,
                    intention: intentionResult,
                    nodeType: "another_topic_redirect"
                };
            } else {
                // Continue with handit-related processing
                return {
                    answer: "Processing your request...",
                    sessionId: sessionId,
                    userMessage: userMessage,
                    conversationHistory: conversationHistory,
                    intention: intentionResult,
                    nodeType: "handit_processing"
                };
            }

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
4.- Give a brief explanation of your decision in the explanation field.

Return ONLY valid JSON:
{"handit": true, "explanation": "Brief explanation of your decision"} or {"handit": false, "explanation": "Brief explanation of your decision"}`;

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

    /**
     * Another Topic LLM - Handles polite redirection when user asks about non-handit topics
     * @param {string} userMessage - Current user message
     * @param {Object} conversationHistory - Conversation history
     * @param {Object} intentionResult - Router intention result
     * @returns {Promise<Object>} Polite redirection response
     */
    async anotherTopic(userMessage, conversationHistory, intentionResult) {
        try {
            console.log('🔄 Another Topic LLM: Generating polite redirection');
            
            // Prepare conversation history for context
            const conversationContext = conversationHistory.messages?.map(msg => `${msg.role}: ${msg.content}`).join('\n') || 'No previous conversation';
            
            const redirectPrompt = `You are a helpful Handit.ai assistant. The user asked about something unrelated to Handit.ai. Generate a polite response to redirect them to ask about Handit.ai topics.

CONVERSATION HISTORY:
${conversationContext}

USER MESSAGE: "${userMessage}"

ROUTER INTENTION RESULT: ${JSON.stringify(intentionResult)}

ABOUT HANDIT.AI:
Handit: The Open Source Engine that Auto-Improves Your AI.
Handit evaluates every agent decision, auto-generates better prompts and datasets, A/B-tests the fix, and lets you control what goes live.

Here's what we'll accomplish in three phases:

Phase 1: AI Observability
Set up comprehensive tracing to see inside your AI agents and understand what they're doing

Phase 2: Quality Evaluation
Add automated evaluation to continuously assess performance across multiple quality dimensions

Phase 3: Self-Improving AI
Enable automatic optimization that generates better prompts, tests them, and provides proven improvements

TASK: Generate a short, polite response that:
1. Acknowledges their question respectfully
2. Explains that you're specifically designed to help with Handit.ai
3. Mentions what you CAN help with (observability, evaluation, optimizatio and more about Handit.ai)
4. Politely redirects them to ask about Handit.ai topics
5. Respond in the same language as the user
6. This key words AI Observability, Quality Evaluation, Self-Improving AI, Handit.ai, keep them in english, or any key word from Handit.ai don't translate them.

EXAMPLES:
- Be friendly and helpful
- Don't be dismissive of their question
- Keep it concise but informative
- Don't be verbose
- Suggest specific Handit.ai topics they might be interested in

Generate ONLY the response text (no JSON, no quotes).`;

            const response = await aiService.generateResponse(redirectPrompt, {
                maxTokens: 300
            });
            
            console.log('🔄 Another Topic Response Generated');
            
            return {
                answer: response.answer,
                topic: 'another_topic'
            };
            
        } catch (error) {
            console.warn('⚠️ Error in Another Topic LLM, using default response:', error.message);
            
            // Default polite response
            return {
                answer: "I appreciate your question, but I'm specifically designed to help with Handit.ai - the open source engine that auto-improves your AI. I can help you with AI observability, quality evaluation, and self-improving AI systems. Would you like to know more about how Handit.ai can help optimize your AI applications?",
                topic: 'another_topic'
            };
        }
    }

}

module.exports = AgenticAI;