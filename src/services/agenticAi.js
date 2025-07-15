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
                // Continue with handit-related processing - call orientIntention
                const orientResult = await this.orientIntention(userMessage, conversationHistory, intentionResult);
                
                return {
                    answer: "Processing your request...",
                    sessionId: sessionId,
                    userMessage: userMessage,
                    conversationHistory: conversationHistory,
                    intention: intentionResult,
                    orientation: orientResult,
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

1.- translate the user's message and the conversation history to english.
2.- GO THROUGH THE DOCUMENTATION CONTEXT AND CHECK IF THE USER'S MESSAGE OR THE CONVERSATION HISTORY IS ABOUT Handit or any topic covered in the DOCUMENTATION CONTEXT.
3.- If the user's message or the conversation history is about Handit or any topic covered in the DOCUMENTATION CONTEXT → Return handit: true
4.- If the user's message or the conversation history is about Handit but not mentioned directly, like <i want to install it>, or something about AI or Engineering → Return handit: true
4.- If the user's message is clearly about something NOT covered in the DOCUMENTATION CONTEXT → Return handit: false
5.- Give a brief explanation of your decision in the explanation field.

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

    /**
     * Orient Intention LLM - Determines if user is in onboarding process or general inquiry
     * @param {string} userMessage - Current user message
     * @param {Object} conversationHistory - Conversation history
     * @param {Object} intentionResult - Router intention result
     * @returns {Promise<Object>} Orientation classification result
     */
    async orientIntention(userMessage, conversationHistory, intentionResult) {
        try {
            console.log('🧭 Orient Intention LLM: Classifying onboarding vs general inquiry');
            
            // Import handitKnowledgeBase from pinecone.js
            const { handitKnowledgeBase } = require('../config/pinecone');
            
            // Use handitKnowledgeBase as context
            const context = handitKnowledgeBase;
            
            // Prepare conversation history for context
            const conversationContext = conversationHistory.messages?.map(msg => `${msg.role}: ${msg.content}`).join('\n') || 'No previous conversation';
            
            const orientPrompt = `You are an Orient Intention LLM. Your goal is to determine if the user is in an onboarding setup process or has a general inquiry about Handit.ai.

HANDIT.AI CONTEXT:
${context}

CONVERSATION HISTORY:
${conversationContext}

CURRENT USER MESSAGE: "${userMessage}"

ROUTER INTENTION RESULT: ${JSON.stringify(intentionResult)}

ONBOARDING PROCESS DEFINITION:
The onboarding process includes these 3 phases:

Phase 1: AI Observability
Set up comprehensive tracing to see inside your AI agents and understand what they're doing

Phase 2: Quality Evaluation  
Add automated evaluation to continuously assess performance across multiple quality dimensions

Phase 3: Self-Improving AI
Enable automatic optimization that generates better prompts, tests them, and provides proven improvements

TASK: Analyze the last message and conversation history to determine:

1. Go through the HANDIT.AI CONTEXT

2. Is the user in or wants to start the ONBOARDING SETUP PROCESS? 
   - Looking to setup/configure/install Handit.ai
   - Asking about getting started with Handit.ai
   - Asking about any of the 3 phases (AI Observability, Quality Evaluation, Self-Improving AI)
   - Wanting to integrate Handit.ai into their system

3. Is this a GENERAL INQUIRY about Handit.ai?
   - Asking what Handit.ai is
   - Asking about features without wanting to set up
   - General questions about capabilities
   - Information requests without setup intent

CRITICAL RULES:
- Can return both true (user wants onboarding AND has general questions)
- CANNOT return both false (must be at least one true)
- If in doubt, favor on_boarding: true

RESPONSE FORMAT (JSON):
{
  "on_boarding": true/false,
  "general": true/false,
  "reasoning": "Brief explanation of classification"
}

Return ONLY valid JSON.`;

            const response = await aiService.generateResponse(orientPrompt, {
                maxTokens: 200
            });
            
            console.log('🧭 Orient Intention Response:', response.answer);
            
            let orientResult;
            try {
                let jsonText = response.answer.trim();
                
                // Extract JSON if wrapped in other text
                const jsonMatch = jsonText.match(/\{[\s\S]*?\}/);
                if (jsonMatch) {
                    jsonText = jsonMatch[0];
                }
                
                orientResult = JSON.parse(jsonText);
                
                // Validate result - cannot be both false
                if (!orientResult.on_boarding && !orientResult.general) {
                    console.warn('⚠️ Both flags are false, defaulting to on_boarding: true');
                    orientResult.on_boarding = true;
                }
                
                // Ensure boolean values
                orientResult.on_boarding = Boolean(orientResult.on_boarding);
                orientResult.general = Boolean(orientResult.general);
                
            } catch (error) {
                console.warn('⚠️ Orient Intention JSON parse failed, defaulting to on_boarding: true:', error.message);
                orientResult = { 
                    on_boarding: true, 
                    general: false, 
                    reasoning: "JSON parse failed, defaulting to onboarding" 
                };
            }
            
            console.log('🧭 Orientation Classification:', orientResult);
            
            return orientResult;
            
        } catch (error) {
            console.warn('⚠️ Error in Orient Intention, defaulting to on_boarding: true:', error.message);
            return { 
                on_boarding: true, 
                general: false, 
                reasoning: "Error occurred, defaulting to onboarding" 
            };
        }
    }

}

module.exports = AgenticAI;