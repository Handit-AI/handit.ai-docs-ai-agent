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
                
                // Check if user needs onboarding
                if (orientResult.on_boarding === true) {
                    // Redirect to onBoarding LLM
                    const onBoardingResponse = await this.onBoarding(userMessage, conversationHistory, intentionResult);
                    
                    return {
                        answer: onBoardingResponse.answer,
                        sessionId: sessionId,
                        userMessage: userMessage,
                        conversationHistory: conversationHistory,
                        intention: intentionResult,
                        orientation: orientResult,
                        onBoarding: onBoardingResponse,
                        extractedInfo: onBoardingResponse.extractedInfo,
                        nodeType: "on_boarding_process"
                    };
                } else {
                    // Handle general inquiries (non-onboarding)
                    return {
                        answer: "Processing your general inquiry...",
                        sessionId: sessionId,
                        userMessage: userMessage,
                        conversationHistory: conversationHistory,
                        intention: intentionResult,
                        orientation: orientResult,
                        nodeType: "general_inquiry"
                    };
                }
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

    /**
     * OnBoarding LLM - Handles user onboarding process
     * @param {string} userMessage - Current user message
     * @param {Object} conversationHistory - Conversation history
     * @param {Object} intentionResult - Router intention result
     * @returns {Promise<Object>} OnBoarding response
     * 
     * FLOW EXPLANATION:
     * 1. Extract context info from conversation history
     * 2. If extractedInfo.questions === true (user has provided important info) → Call setupHandit for tailored setup
     * 3. Else if phaseResult.isStarting === true (user starting from scratch) → Call questionContext to ask questions
     * 4. Else (user not starting from scratch) → Provide general onboarding
     * 
     * RESULT STRUCTURE:
     * - extractedInfo.questions = true → Setup instructions based on user's context
     * - extractedInfo.questions = false + isStarting = true → Context questions to gather info
     * - isStarting = false → General onboarding for experienced users
     */
    async onBoarding(userMessage, conversationHistory, intentionResult) {
        try {
            console.log('🚀 OnBoarding LLM: Processing user onboarding request');
            
            // First, classify which phase the user is in
            const phaseResult = await this.phaseClassification(userMessage, conversationHistory, intentionResult);
            
            // Extract context information from conversation history
            const extractedInfo = await this.extractContextInfo(userMessage, conversationHistory);
            
            // DECISION LOGIC EXPLANATION:
            // If extractedInfo.questions === true: User has already provided important information
            // (agent_name, agent_description, or language) so we can proceed with setup
            if (extractedInfo.questions === true) {
                console.log('📋 User has provided context info - proceeding with setup');
                const setupInfo = await this.setupHandit(userMessage, conversationHistory, extractedInfo);
                     
                return {
                    answer: setupInfo.answer,
                    type: 'onboarding_with_setup',
                    phase: phaseResult.phase,
                    isStarting: phaseResult.isStarting,
                    phaseDetails: phaseResult,
                    extractedInfo: extractedInfo,
                    setupInfo: setupInfo,
                    nextSteps: setupInfo.nextSteps || [],
                    explanation: "User provided context information, proceeding with tailored setup instructions"
                };
            }
            // If user is starting from scratch in Phase 1, ask context questions
            else if (phaseResult.isStarting === true) {
                console.log('❓ User starting from scratch - asking context questions');
                const contextQuestions = await this.questionContext(userMessage, conversationHistory, extractedInfo);
                
                return {
                    answer: contextQuestions.answer,
                    type: 'onboarding_questions',
                    phase: phaseResult.phase,
                    isStarting: phaseResult.isStarting,
                    phaseDetails: phaseResult,
                    extractedInfo: extractedInfo,
                    contextQuestions: contextQuestions,
                    nextSteps: [],
                    explanation: "User starting from scratch, gathering context information first"
                };
            } else {
                // For users not starting from scratch, provide different onboarding
                console.log('🎯 User not starting from scratch - general onboarding');
                return {
                    answer: `Welcome to Handit.ai onboarding! Based on your inquiry, you're interested in ${phaseResult.phase}. ${phaseResult.explanation}. and ${phaseResult.isStarting}`,
                    type: 'onboarding_general',
                    phase: phaseResult.phase,
                    isStarting: phaseResult.isStarting,
                    phaseDetails: phaseResult,
                    extractedInfo: extractedInfo,
                    nextSteps: [],
                    explanation: "User not starting from scratch, providing general onboarding guidance"
                };
            }
            
        } catch (error) {
            console.warn('⚠️ Error in OnBoarding LLM, using default response:', error.message);
            
            return {
                answer: "Welcome to Handit.ai onboarding! We're here to help you get started.",
                type: 'onboarding_error',
                phase: 'error_fallback',
                nextSteps: [],
                explanation: "Error occurred during onboarding process"
            };
        }
    }

    /**
     * Phase Classification LLM - Classifies which phase the user is in
     * @param {string} userMessage - Current user message
     * @param {Object} conversationHistory - Conversation history
     * @param {Object} intentionResult - Router intention result
     * @returns {Promise<Object>} Phase classification result
     */
    async phaseClassification(userMessage, conversationHistory, intentionResult) {
        try {
            console.log('📊 Phase Classification LLM: Analyzing user phase');
            
            // Import handitKnowledgeBase from pinecone.js
            const { handitKnowledgeBase } = require('../config/pinecone');
            
            // Use handitKnowledgeBase as context
            const context = handitKnowledgeBase;
            
            // Prepare conversation history for context
            const conversationContext = conversationHistory.messages?.map(msg => `${msg.role}: ${msg.content}`).join('\n') || 'No previous conversation';
            
            const phasePrompt = `You are a Phase Classification LLM. Your goal is to classify which phase the user is in based on the DOCUMENTATION CONTEXT and conversation history.

DOCUMENTATION CONTEXT:
${context}

CONVERSATION HISTORY:
${conversationContext}

CURRENT USER MESSAGE: "${userMessage}"

ROUTER INTENTION RESULT: ${JSON.stringify(intentionResult)}

HANDIT.AI PHASES:

Phase 1: AI Observability
Set up comprehensive tracing to see inside your AI agents and understand what they're doing

Phase 2: Quality Evaluation 
Add automated evaluation to continuously assess performance across multiple quality dimensions

Phase 3: Self-Improving AI 
Enable automatic optimization that generates better prompts, tests them, and provides proven improvements

TASK: 
1. Translate the user's message and the conversation history to english.
2. GO THROUGH THE ENTIRE DOCUMENTATION CONTEXT THOROUGHLY
3. Analyze the conversation history and current user message to determine which phase the user is interested in or currently working on
4. Classify the user's current phase based on their questions, concerns, or setup needs
5. If it's about Observability (Phase 1), determine if they're starting from scratch (0 progress, no installation, no configuration)

OBSERVABILITY STARTING INDICATORS:
- No previous installation mentioned
- Asking "how to get started"
- Asking "how to install"
- No configuration mentioned in history
- First time setup
- General "what do I need to do" questions

RESPONSE FORMAT (JSON):
{
  "phase1_observability": true/false,
  "phase2_evaluation": true/false,
  "phase3_selfimproving": true/false,
  "isStarting": true/false,
  "phase": "Phase 1: AI Observability" | "Phase 2: Quality Evaluation" | "Phase 3: Self-Improving AI",
  "explanation": "Brief explanation of why this phase was selected and if they're starting from scratch"
}

RULES:
- Only ONE phase can be true at a time
- If uncertain, default to Phase 1 (AI Observability)
- isStarting only applies to Phase 1 (Observability)
- If not Phase 1, isStarting should be false

Return ONLY valid JSON.`;

            const response = await aiService.generateResponse(phasePrompt, {
                maxTokens: 250
            });
            
            console.log('📊 Phase Classification Response:', response.answer);
            
            let phaseResult;
            try {
                let jsonText = response.answer.trim();
                
                // Extract JSON if wrapped in other text
                const jsonMatch = jsonText.match(/\{[\s\S]*?\}/);
                if (jsonMatch) {
                    jsonText = jsonMatch[0];
                }
                
                phaseResult = JSON.parse(jsonText);
                
                // Validate result - ensure only one phase is true
                const phases = [phaseResult.phase1_observability, phaseResult.phase2_evaluation, phaseResult.phase3_selfimproving];
                const trueCount = phases.filter(p => p === true).length;
                
                if (trueCount === 0) {
                    console.warn('⚠️ No phase selected, defaulting to Phase 1');
                    phaseResult.phase1_observability = true;
                    phaseResult.phase = "Phase 1: AI Observability";
                    phaseResult.isStarting = true;
                } else if (trueCount > 1) {
                    console.warn('⚠️ Multiple phases selected, defaulting to Phase 1');
                    phaseResult.phase1_observability = true;
                    phaseResult.phase2_evaluation = false;
                    phaseResult.phase3_selfimproving = false;
                    phaseResult.phase = "Phase 1: AI Observability";
                }
                
                // Ensure isStarting is only relevant for Phase 1
                if (!phaseResult.phase1_observability) {
                    phaseResult.isStarting = false;
                }
                
                // Ensure boolean values
                phaseResult.phase1_observability = Boolean(phaseResult.phase1_observability);
                phaseResult.phase2_evaluation = Boolean(phaseResult.phase2_evaluation);
                phaseResult.phase3_selfimproving = Boolean(phaseResult.phase3_selfimproving);
                phaseResult.isStarting = Boolean(phaseResult.isStarting);
                
            } catch (error) {
                console.warn('⚠️ Phase Classification JSON parse failed, defaulting to Phase 1:', error.message);
                phaseResult = { 
                    phase1_observability: true,
                    phase2_evaluation: false,
                    phase3_selfimproving: false,
                    isStarting: true,
                    phase: "Phase 1: AI Observability",
                    explanation: "JSON parse failed, defaulting to Phase 1 starting from scratch"
                };
            }
            
            console.log('📊 Phase Classification Result:', phaseResult);
            
            return phaseResult;
            
        } catch (error) {
            console.warn('⚠️ Error in Phase Classification, defaulting to Phase 1:', error.message);
            return { 
                phase1_observability: true,
                phase2_evaluation: false,
                phase3_selfimproving: false,
                isStarting: true,
                phase: "Phase 1: AI Observability",
                explanation: "Error occurred, defaulting to Phase 1 starting from scratch"
            };
        }
    }

    /**
     * Question Context LLM - Asks context questions for users starting from scratch
     * @param {string} userMessage - Current user message
     * @param {Object} conversationHistory - Conversation history
     * @param {Object} extractedInfo - Extracted context information from history
     * @returns {Promise<Object>} Context questions response
     */
    async questionContext(userMessage, conversationHistory, extractedInfo) {
        try {
            console.log('❓ Question Context LLM: Analyzing context questions needed');
            
            // Prepare conversation history for context
            const conversationContext = conversationHistory.messages?.map(msg => `${msg.role}: ${msg.content}`).join('\n') || 'No previous conversation';
            
            const questionPrompt = `You are a Question Context LLM. Your goal is to gather essential context information from users starting their Handit.ai journey.

CONVERSATION HISTORY:
${conversationContext}

CURRENT USER MESSAGE: "${userMessage}"

EXTRACTED CONTEXT INFO: ${JSON.stringify(extractedInfo)}

REQUIRED CONTEXT INFORMATION:
1. AppName - What is the name of their application/project?
2. Agent Purpose - What does their AI agent do? (que hace el agente)
3. Stack - What programming language is the user using?

TASK:
1. FIRST: Detect the user's language from their message and conversation history
2. Go through the conversation history and current message thoroughly
3. Check if ANY of the required information appears in the conversation:
   - App/project name mentioned
   - Agent functionality or purpose described
   - Programming language or framework mentioned
   - Check if the user ignored the questions
4. Only ask if none of the questions appears in the history
5. If the user ignored the questions, don't ask again
6. Ask ALL 3 questions together in ONE response (not separately)
7. Respond in the SAME LANGUAGE as the user

RESPONSE RULES:
- If ALL or SOME information is already available in the conversation → Don't ask questions, acknowledge the information
- If user previously ignored questions → Don't ask again, proceed with onboarding
- If NO information is available → Ask ALL 3 questions in ONE shot
- Keep questions natural and conversational
- Respond in the user's detected language
- Be friendly and welcoming
- Ask all questions together, not one by one

EXAMPLES of asking ALL questions together:
- English: "Great! To help you get started with Handit.ai, I'd like to know: 1) What's the name of your application or project? 2) What does your AI agent do? 3) What programming language are you using?"
- Spanish: "¡Perfecto! Para ayudarte a comenzar con Handit.ai, me gustaría saber: 1) ¿Cuál es el nombre de tu aplicación o proyecto? 2) ¿Qué hace tu agente de IA? 3) ¿Qué lenguaje de programación estás usando?"

RESPONSE FORMAT (JSON):
{
  "hasAppName": true/false,
  "hasAgentPurpose": true/false,
  "hasStack": true/false,
  "questionsIgnored": true/false,
  "shouldAskQuestions": true/false,
  "userLanguage": "detected language",
  "answer": "All questions together or acknowledgment message in user's language"
}

Return ONLY valid JSON.`;

            const response = await aiService.generateResponse(questionPrompt, {
                maxTokens: 400
            });
            
            console.log('❓ Question Context Response:', response.answer);
            
            let questionResult;
            try {
                let jsonText = response.answer.trim();
                
                // Extract JSON if wrapped in other text
                const jsonMatch = jsonText.match(/\{[\s\S]*?\}/);
                if (jsonMatch) {
                    jsonText = jsonMatch[0];
                }
                
                questionResult = JSON.parse(jsonText);
                
                // Validate result
                if (!questionResult.answer) {
                    console.warn('⚠️ No answer provided, using default');
                    questionResult.answer = "Welcome! To help you get started with Handit.ai, I'd like to know: 1) What's the name of your application or project? 2) What does your AI agent do? 3) What programming language are you using?";
                }
                
                // Ensure boolean values
                questionResult.hasAppName = Boolean(questionResult.hasAppName);
                questionResult.hasAgentPurpose = Boolean(questionResult.hasAgentPurpose);
                questionResult.hasStack = Boolean(questionResult.hasStack);
                questionResult.questionsIgnored = Boolean(questionResult.questionsIgnored);
                questionResult.shouldAskQuestions = Boolean(questionResult.shouldAskQuestions);
                
                // Add extracted context info to the result
                questionResult.extractedInfo = extractedInfo;
                
            } catch (error) {
                console.warn('⚠️ Question Context JSON parse failed, using default:', error.message);
                questionResult = {
                    hasAppName: false,
                    hasAgentPurpose: false,
                    hasStack: false,
                    questionsIgnored: false,
                    shouldAskQuestions: true,
                    userLanguage: "English",
                    answer: "Welcome! To help you get started with Handit.ai, I'd like to know: 1) What's the name of your application or project? 2) What does your AI agent do? 3) What programming language are you using?",
                    extractedInfo: extractedInfo
                };
            }
            
            console.log('❓ Question Context Result:', questionResult);
            
            return questionResult;
            
        } catch (error) {
            console.warn('⚠️ Error in Question Context, using default response:', error.message);
            return {
                hasAppName: false,
                hasAgentPurpose: false,
                hasStack: false,
                questionsIgnored: false,
                shouldAskQuestions: true,
                userLanguage: "English",
                answer: "Welcome! To help you get started with Handit.ai, I'd like to know: 1) What's the name of your application or project? 2) What does your AI agent do? 3) What programming language are you using?",
                extractedInfo: null
            };
        }
    }

    /**
     * Extract Context Info LLM - Detects and extracts important information from chat history
     * @param {string} userMessage - Current user message
     * @param {Object} conversationHistory - Conversation history
     * @returns {Promise<Object>} Extracted context information
     */
    async extractContextInfo(userMessage, conversationHistory) {
        try {
            console.log('🔍 Extract Context Info LLM: Analyzing conversation for important information');
            
            // Prepare conversation history for context
            const conversationContext = conversationHistory.messages?.map(msg => `${msg.role}: ${msg.content}`).join('\n') || 'No previous conversation';
            
            const extractPrompt = `You are an Extract Context Info LLM. Your goal is to detect and extract important information from the conversation history.

CONVERSATION HISTORY:
${conversationContext}

CURRENT USER MESSAGE: "${userMessage}"

IMPORTANT INFORMATION TO DETECT:
1. What's the name of your application or project? (agent_name)
2. What does your AI agent do? (agent_description)
3. What programming language are you using? (language)

TASK:
1. Go through the ENTIRE conversation history thoroughly and the current user message
2. Look for answers to the 3 important questions anywhere in the conversation and similar questions
3. Extract any information that answers these questions, even if asked differently
4. Detect if the user was asked these questions but ignored/avoided answering at least one
5. If you find partial information, extract what you can

DETECTION RULES:
- App/Project Name: Look for mentions of app names, project names, company names, product names
- Agent Description: Look for explanations of what their AI does, agent functionality, use cases, purposes
- Programming Language: Look for mentions of languages (Python, JavaScript, Java, etc.), frameworks, tech stack
- Questions Ignored: If questions were asked but user changed topic, didn't answer, or avoided responding

EXAMPLES of what to extract:
- "My app is called ChatBot Pro" → agent_name: "ChatBot Pro"
- "I'm building a customer service agent" → agent_description: "customer service agent"
- "We use Python for our backend" → language: "Python"
- "I'm working on an AI that helps with code reviews" → agent_description: "AI that helps with code reviews"

RESPONSE FORMAT (JSON):
{
  "agent_name": "extracted name or null",
  "agent_description": "extracted description or null", 
  "language": "extracted language or null",
  "questions": true/false,
  "extraction_confidence": "high" | "medium" | "low",
  "missing_info": ["agent_name", "agent_description", "language"] // array of missing information
}

RULES:

- questions: set true ONLY if at leats one IMPORTANT INFORMATION appears in the conversation history
- questions: set false ONLY if none of the IMPORTANT INFORMATION in the conversation history
- default to questions: false
- Be generous in extraction - if there's any hint, extract it
- extraction_confidence based on how clear the information is

Return ONLY valid JSON.`;

            const response = await aiService.generateResponse(extractPrompt, {
                maxTokens: 300
            });
            
            console.log('🔍 Extract Context Info Response:', response.answer);
            
            let extractResult;
            try {
                let jsonText = response.answer.trim();
                
                // Extract JSON if wrapped in other text
                const jsonMatch = jsonText.match(/\{[\s\S]*?\}/);
                if (jsonMatch) {
                    jsonText = jsonMatch[0];
                }
                
                extractResult = JSON.parse(jsonText);
                
                // Validate result
                if (!extractResult.hasOwnProperty('questions')) {
                    extractResult.questions = false;
                }
                
                // Ensure boolean value for questions
                extractResult.questions = Boolean(extractResult.questions);
                
                // Ensure missing_info is an array
                if (!Array.isArray(extractResult.missing_info)) {
                    extractResult.missing_info = [];
                    if (!extractResult.agent_name) extractResult.missing_info.push('agent_name');
                    if (!extractResult.agent_description) extractResult.missing_info.push('agent_description');
                    if (!extractResult.language) extractResult.missing_info.push('language');
                }
                
            } catch (error) {
                console.warn('⚠️ Extract Context Info JSON parse failed, using default:', error.message);
                extractResult = {
                    agent_name: null,
                    agent_description: null,
                    language: null,
                    questions: false,
                    extraction_confidence: "low",
                    missing_info: ["agent_name", "agent_description", "language"]
                };
            }
            
            console.log('🔍 Extract Context Info Result:', extractResult);
            
            return extractResult;
            
        } catch (error) {
            console.warn('⚠️ Error in Extract Context Info, using default response:', error.message);
            return {
                agent_name: null,
                agent_description: null,
                language: null,
                questions: false,
                extraction_confidence: "low",
                missing_info: ["agent_name", "agent_description", "language"]
            };
        }
    }

    /**
     * Setup Handit LLM - Provides tailored setup information based on extracted context
     * @param {string} userMessage - Current user message
     * @param {Object} conversationHistory - Conversation history
     * @param {Object} extractedInfo - Extracted context information
     * @returns {Promise<Object>} Setup information response
     */
    async setupHandit(userMessage, conversationHistory, extractedInfo) {
        try {
            console.log('🛠️ Setup Handit LLM: Providing tailored setup information');
            
            // Import handitKnowledgeBase from pinecone.js
            const { handitKnowledgeBase } = require('../config/pinecone');
            
            // Use handitKnowledgeBase as context
            const context = handitKnowledgeBase;
            
            // Prepare conversation history for context
            const conversationContext = conversationHistory.messages?.map(msg => `${msg.role}: ${msg.content}`).join('\n') || 'No previous conversation';
            
            const setupPrompt = `You are a Setup Handit LLM. Your goal is to provide tailored setup information for AI Observability based on the extracted context and documentation.

DOCUMENTATION CONTEXT:
${context}

CONVERSATION HISTORY:
${conversationContext}

CURRENT USER MESSAGE: "${userMessage}"

EXTRACTED CONTEXT INFO: ${JSON.stringify(extractedInfo)}

TASK:
1. GO THROUGH THE ENTIRE DOCUMENTATION CONTEXT THOROUGHLY
2. Based on the extracted information (agent_name, agent_description, language), provide COMPLETE personalized setup instructions for AI Observability
3. If there's a programming language in the extracted info (JS/JavaScript or Python), ONLY provide information related to that specific language
4. Use the agent_name if available to personalize the setup instructions
5. Focus on Phase 1: AI Observability - setting up comprehensive tracing to see inside AI agents
6. Provide THE WHOLE setup instructions tailored to their specific context
7. Detect user's language and respond in the same language

RESPONSE STRUCTURE:
- Personalized greeting using their agent_name if available
- Language-specific installation instructions
- Configuration steps tailored to their use case
- Next steps for AI Observability setup
- Keep technical terms like "AI Observability", "Quality Evaluation", "Self-Improving AI", "Handit.ai" in English



Generate ONLY the response text (no JSON, no quotes).`;

            const response = await aiService.generateResponse(setupPrompt, {
                maxTokens: 2600
            });
            
            console.log('🛠️ Setup Handit Response Generated');
            
            // Generate next steps based on extracted info
            const nextSteps = [];
            if (extractedInfo.language) {
                nextSteps.push(`Install Handit.ai for ${extractedInfo.language}`);
                nextSteps.push('Configure your project settings');
            }
            if (extractedInfo.agent_name) {
                nextSteps.push(`Set up tracing for ${extractedInfo.agent_name}`);
            }
            nextSteps.push('Test your AI Observability setup');
            
            return {
                answer: response.answer,
                language: extractedInfo.language || null,
                agentName: extractedInfo.agent_name || null,
                nextSteps: nextSteps
            };
            
        } catch (error) {
            console.warn('⚠️ Error in Setup Handit LLM, using default response:', error.message);
            
            return {
                answer: "Handit.ai is a powerful tool that helps you optimize your AI applications. You can integrate it with your existing codebase to collect data and improve your models. I can help you with AI Observability, Quality Evaluation, and Self-Improving AI systems. Would you like to know more about how Handit.ai can help optimize your AI applications?",
                nextSteps: []
            };
        }
    }

}

module.exports = AgenticAI;