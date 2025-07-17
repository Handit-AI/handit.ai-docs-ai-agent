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
     * @param {string} handitToken - Optional Handit.ai token for personalized examples
     * @returns {Promise<Object>} Simple response
     */
    async processUserInput(userMessage, sessionId, handitToken = null) {
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
                    const onBoardingResponse = await this.onBoarding(userMessage, conversationHistory, intentionResult, handitToken);
                    
                    return {
                        answer: onBoardingResponse.answer,
                        sessionId: sessionId,
                        userMessage: userMessage,
                        conversationHistory: conversationHistory,
                        intention: intentionResult,
                        orientation: orientResult,
                        onBoarding: onBoardingResponse,
                        extractedInfo: onBoardingResponse.extractedInfo,
                        nodeType: "on_boarding_process",
                        on_boarding_observability_finished: onBoardingResponse.on_boarding_observability_finished
                    };
                } else {
                    // Handle general inquiries (non-onboarding) - send to generalKnowledge LLM
                    const generalResponse = await this.generalKnowledge(userMessage, conversationHistory);
                    
                    return {
                        answer: generalResponse.answer,
                        sessionId: sessionId,
                        userMessage: userMessage,
                        conversationHistory: conversationHistory,
                        intention: intentionResult,
                        orientation: orientResult,
                        generalKnowledge: generalResponse,
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
     * @param {string} handitToken - Optional Handit.ai token for personalized examples
     * @returns {Promise<Object>} OnBoarding response
     * 
     * FLOW EXPLANATION:
     * 1. Check if all questions have been asked step by step
     * 2. If not all questions asked → Ask next question
     * 3. If all questions asked → Extract context info and proceed with setup
     * 
     * RESULT STRUCTURE:
     * - questionsCompleted = false → Ask next question step by step
     * - questionsCompleted = true → Extract info and provide setup instructions
     */
    async onBoarding(userMessage, conversationHistory, intentionResult, handitToken = null) {
        try {
            console.log('🚀 OnBoarding LLM: Processing user onboarding request');
            
            // First, classify which phase the user is in
            const phaseResult = await this.phaseClassification(userMessage, conversationHistory, intentionResult);
            
            // Check question status - step by step approach
            const questionStatus = await this.checkQuestionStatus(userMessage, conversationHistory);
            
            // DECISION LOGIC EXPLANATION:
            // If all questions have been asked step by step, extract info and proceed with setup
            if (questionStatus.allQuestionsAsked === true) {
                console.log('✅ All questions completed - extracting info and proceeding with setup');
                
                // NOW extract context information after all questions have been asked
                const extractedInfo = await this.extractContextInfo(userMessage, conversationHistory);
                const setupInfo = await this.setupHandit(userMessage, conversationHistory, extractedInfo, handitToken);
                     
                return {
                    answer: setupInfo.answer,
                    type: 'onboarding_with_setup',
                    phase: phaseResult.phase,
                    isStarting: phaseResult.isStarting,
                    phaseDetails: phaseResult,
                    extractedInfo: extractedInfo,
                    setupInfo: setupInfo,
                    nextSteps: setupInfo.nextSteps || [],
                    explanation: "All questions completed, proceeding with tailored setup instructions",
                    on_boarding_observability_finished: true,
                    questionStatus: questionStatus
                };
            }
            // If user is starting from scratch in Phase 1, ask questions step by step
            else if (phaseResult.isStarting === true) {
                console.log('❓ User starting from scratch - asking next question step by step');
                const contextQuestions = await this.questionContext(userMessage, conversationHistory, questionStatus);
                
                return {
                    answer: contextQuestions.answer,
                    type: 'onboarding_questions',
                    phase: phaseResult.phase,
                    isStarting: phaseResult.isStarting,
                    phaseDetails: phaseResult,
                    extractedInfo: null, // Don't extract until all questions are asked
                    contextQuestions: contextQuestions,
                    nextSteps: [],
                    explanation: "User starting from scratch, asking questions step by step",
                    questionStatus: questionStatus
                };
            } else {
                // For users not starting from scratch, send to generalKnowledge LLM
                console.log('🎯 User not starting from scratch - sending to generalKnowledge');
                const generalResponse = await this.generalKnowledge(userMessage, conversationHistory);
                
                return {
                    answer: generalResponse.answer,
                    type: 'onboarding_general_knowledge',
                    phase: phaseResult.phase,
                    isStarting: phaseResult.isStarting,
                    phaseDetails: phaseResult,
                    extractedInfo: null,
                    generalKnowledge: generalResponse,
                    nextSteps: [],
                    explanation: "User not starting from scratch, providing contextual response via generalKnowledge"
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
     * Question Context LLM - Asks context questions step by step for users starting from scratch
     * @param {string} userMessage - Current user message
     * @param {Object} conversationHistory - Conversation history
     * @param {Object} questionStatus - Question status from checkQuestionStatus
     * @returns {Promise<Object>} Context questions response
     */
    async questionContext(userMessage, conversationHistory, questionStatus) {
        try {
            console.log('❓ Question Context LLM: Determining next question to ask step by step');
            
            // Prepare conversation history for context
            const conversationContext = conversationHistory.messages?.map(msg => `${msg.role}: ${msg.content}`).join('\n') || 'No previous conversation';
            
            const questionPrompt = `You are a Question Context LLM. Your goal is to ask the NEXT context question in the step-by-step onboarding process.

CONVERSATION HISTORY:
${conversationContext}

CURRENT USER MESSAGE: "${userMessage}"

QUESTION STATUS: ${JSON.stringify(questionStatus)}

REQUIRED CONTEXT INFORMATION (ask ONE by ONE):
1. AppName - What is the name of their application/project?
2. agentProjectType - What type of AI project are you building? 1. Document Processing, 2. Customer Service Agent, 3. Chatbot, 4. Other
3. Stack - What technologies are you using to build your app? JavaScript / Python / LangChain / LangGraph/ n8n / etc.

TASK:
1. FIRST: Detect the user's language from their message and conversation history
2. Based on the QUESTION STATUS, determine which question to ask NEXT
3. Ask ONLY the next question that hasn't been asked yet
4. If a question was already asked but user didn't answer, SKIP to the next question
5. Never repeat questions that were already asked
6. Respond in the SAME LANGUAGE as the user

STEP-BY-STEP LOGIC (use QUESTION STATUS to determine):
- If appNameAsked = false → Ask for AppName
- If appNameAsked = true AND agentProjectTypeAsked = false → Ask for AgentProjectType  
- If appNameAsked = true AND agentProjectTypeAsked = true AND stackAsked = false → Ask for Stack
- If all questions asked → Acknowledge completion

RESPONSE RULES:
- Ask ONLY ONE question at a time
- NEVER repeat questions that were already asked (check questionStatus)
- If user skipped a previous question, don't ask it again
- Keep questions natural and conversational
- Respond in the user's detected language
- Be friendly and welcoming

EXAMPLES of asking ONE question:
- AppName: "Great! To help you get started with Handit.ai, what's the name of your application or project?"
- AgentProjectType: "Perfect! What type of AI project are you building?  1. Document Processing, 2. Customer Service Agent, 3. Chatbot, 4. Other"
- Stack: "Excellent! What technologies are you using to build your app? (JavaScript, Python, LangChain, LangGraph, n8n, etc.)"

RESPONSE FORMAT (JSON):
{
  "questionToAsk": "appName" | "agentProjectType" | "stack" | "completed",
  "userLanguage": "detected language",
  "answer": "Single question in user's language or completion message"
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
                    questionResult.answer = "Welcome! To help you get started with Handit.ai, what's the name of your application or project?";
                    questionResult.questionToAsk = "appName";
                }
                
                // Validate questionToAsk
                const validQuestions = ["appName", "agentProjectType", "stack", "completed"];
                if (!validQuestions.includes(questionResult.questionToAsk)) {
                    questionResult.questionToAsk = "appName";
                }
                
            } catch (error) {
                console.warn('⚠️ Question Context JSON parse failed, using default:', error.message);
                questionResult = {
                    questionToAsk: "appName",
                    userLanguage: "English",
                    answer: "Welcome! To help you get started with Handit.ai, what's the name of your application or project?"
                };
            }
            
            console.log('❓ Question Context Result:', questionResult);
            
            return questionResult;
            
        } catch (error) {
            console.warn('⚠️ Error in Question Context, using default response:', error.message);
            return {
                questionToAsk: "appName",
                userLanguage: "English",
                answer: "Welcome! To help you get started with Handit.ai, what's the name of your application or project?"
            };
        }
    }

    /**
     * Check Question Status LLM - Determines the status of each context question
     * @param {string} userMessage - Current user message
     * @param {Object} conversationHistory - Conversation history
     * @returns {Promise<Object>} Question status result
     */
    async checkQuestionStatus(userMessage, conversationHistory) {
        try {
            console.log('🔄 Check Question Status LLM: Analyzing step-by-step question progress');
            
            // Prepare conversation history for context
            const conversationContext = conversationHistory.messages?.map(msg => `${msg.role}: ${msg.content}`).join('\n') || 'No previous conversation';
            
            const statusPrompt = `You are a Check Question Status LLM. Your goal is to determine the status of each context question in the step-by-step onboarding process.

CONVERSATION HISTORY:
${conversationContext}

CURRENT USER MESSAGE: "${userMessage}"

REQUIRED CONTEXT QUESTIONS (step by step):
1. AppName - What is the name of their application/project?
2. agentProjectType - What type of AI project are you building? 1. Document Processing, 2. Customer Service Agent, 3. Chatbot, 4. Other
3. Stack - What technologies are you using to build your app? JavaScript / Python / LangChain / LangGraph/ n8n / etc.

TASK: Analyze the conversation history to determine:
1. Which questions have been ASKED by the assistant
2. Which questions have been ANSWERED by the user
3. If ALL 3 questions have been both asked OR answered

ANALYSIS RULES:
- appNameAsked: Has the assistant asked about app/project name?
- appNameAnswered: Has the user provided their app/project name?
- agentPurposeAsked: Has the assistant asked about what the AI agent does?
- agentPurposeAnswered: Has the user explained what their AI agent does?
- stackAsked: Has the assistant asked about programming language?
- stackAnswered: Has the user mentioned their programming language/tech stack?
- allQuestionsCompleted: Are ALL 3 questions both asked OR answered?

RESPONSE FORMAT (JSON):
{
  "appNameAsked": true/false,
  "appNameAnswered": true/false,
  "agentPurposeAsked": true/false,
  "agentPurposeAnswered": true/false,
  "stackAsked": true/false,
  "stackAnswered": true/false,
  "allQuestionsCompleted": true/false,
  "nextQuestionToAsk": "appName" | "agentProjectType" | "stack" | "none",
  "reasoning": "Brief explanation of current status"
}

Return ONLY valid JSON.`;

            const response = await aiService.generateResponse(statusPrompt, {
                maxTokens: 250
            });
            
            console.log('🔄 Check Question Status Response:', response.answer);
            
            let statusResult;
            try {
                let jsonText = response.answer.trim();
                
                // Extract JSON if wrapped in other text
                const jsonMatch = jsonText.match(/\{[\s\S]*?\}/);
                if (jsonMatch) {
                    jsonText = jsonMatch[0];
                }
                
                statusResult = JSON.parse(jsonText);
                
                // Validate result and ensure boolean values
                statusResult.appNameAsked = Boolean(statusResult.appNameAsked);
                statusResult.appNameAnswered = Boolean(statusResult.appNameAnswered);
                statusResult.agentPurposeAsked = Boolean(statusResult.agentPurposeAsked);
                statusResult.agentPurposeAnswered = Boolean(statusResult.agentPurposeAnswered);
                statusResult.stackAsked = Boolean(statusResult.stackAsked);
                statusResult.stackAnswered = Boolean(statusResult.stackAnswered);
                statusResult.allQuestionsCompleted = Boolean(statusResult.allQuestionsCompleted);
                
                // For backward compatibility with onBoarding method
                statusResult.allQuestionsAsked = statusResult.allQuestionsCompleted;
                
                // Validate nextQuestionToAsk
                const validNextQuestions = ["appName", "agentPurpose", "stack", "none"];
                if (!validNextQuestions.includes(statusResult.nextQuestionToAsk)) {
                    statusResult.nextQuestionToAsk = "appName";
                }
                
            } catch (error) {
                console.warn('⚠️ Check Question Status JSON parse failed, using defaults:', error.message);
                statusResult = { 
                    appNameAsked: false,
                    appNameAnswered: false,
                    agentPurposeAsked: false,
                    agentPurposeAnswered: false,
                    stackAsked: false,
                    stackAnswered: false,
                    allQuestionsCompleted: false,
                    allQuestionsAsked: false,
                    nextQuestionToAsk: "appName",
                    reasoning: "JSON parse failed, using defaults"
                };
            }
            
            console.log('🔄 Question Status:', statusResult);
            
            return statusResult;
            
        } catch (error) {
            console.warn('⚠️ Error in Check Question Status, using defaults:', error.message);
            return { 
                appNameAsked: false,
                appNameAnswered: false,
                agentPurposeAsked: false,
                agentPurposeAnswered: false,
                stackAsked: false,
                stackAnswered: false,
                allQuestionsCompleted: false,
                allQuestionsAsked: false,
                nextQuestionToAsk: "appName",
                reasoning: "Error occurred, using defaults"
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
2. What type of AI project are you building? (agentProjectType) - Document Processing, Customer Service Agent, Chatbot, Other
3. What technologies are you using to build your app? (stack) - JavaScript, Python, LangChain, LangGraph, n8n, etc.

TASK:
1. Go through the ENTIRE conversation history thoroughly and the current user message
2. Look for answers to the 3 important questions (IMPORTANT INFORMATION TO DETECT) anywhere in the conversation and similar questions
3. Extract any information that answers these questions (IMPORTANT INFORMATION TO DETECT), even if asked differently
4. Detect if the user was asked these questions but ignored/avoided answering at least one
5. If you find partial information, extract what you can

DETECTION RULES:
- App/Project Name: Look for mentions of app names, project names, company names, product names, etc
- Agent Project Type: Look for mentions of Document Processing, Customer Service Agent, Chatbot, or other project types
- Stack/Technologies: Look for mentions of technologies (JavaScript, Python, LangChain, LangGraph, n8n, etc.), frameworks, programming languages, etc
- Questions Ignored: If questions were asked but user changed topic, didn't answer, or avoided responding


RESPONSE FORMAT (JSON):
{
  "agent_name": "extracted name or null",
  "agentProjectType": "extracted project type or null", 
  "stack": "extracted technologies or null",
  "questions": true/false,
  "extraction_confidence": "high" | "medium" | "low",
  "missing_info": ["agent_name", "agentProjectType", "stack"], // array of missing information
  "explanation": "Brief explanation of the extraction process"
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
                    if (!extractResult.agentProjectType) extractResult.missing_info.push('agentProjectType');
                    if (!extractResult.stack) extractResult.missing_info.push('stack');
                }
                
            } catch (error) {
                console.warn('⚠️ Extract Context Info JSON parse failed, using default:', error.message);
                extractResult = {
                    agent_name: null,
                    agentProjectType: null,
                    stack: null,
                    questions: false,
                    extraction_confidence: "low",
                    missing_info: ["agent_name", "agentProjectType", "stack"]
                };
            }
            
            console.log('🔍 Extract Context Info Result:', extractResult);
            
            return extractResult;
            
        } catch (error) {
            console.warn('⚠️ Error in Extract Context Info, using default response:', error.message);
            return {
                agent_name: null,
                agentProjectType: null,
                stack: null,
                questions: false,
                extraction_confidence: "low",
                missing_info: ["agent_name", "agentProjectType", "stack"]
            };
        }
    }

    /**
     * Setup Handit LLM - Provides tailored setup information based on extracted context
     * @param {string} userMessage - Current user message
     * @param {Object} conversationHistory - Conversation history
     * @param {Object} extractedInfo - Extracted context information
     * @param {string} handitToken - Optional Handit.ai token for personalized examples
     * @returns {Promise<Object>} Setup information response
     */
    async setupHandit(userMessage, conversationHistory, extractedInfo, handitToken = null) {
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
${handitToken ? `
USER'S HANDIT TOKEN: ${handitToken}
IMPORTANT: Use this EXACT token in ALL code examples where HANDIT_API_KEY is needed. Replace "your-api-key" or "handit_12345_abcde" with "${handitToken}" in all examples.` : ''}

TASK:
1. GO THROUGH THE ENTIRE DOCUMENTATION CONTEXT THOROUGHLY
2. Based on the extracted information (agent_name, agentProjectType, stack), provide COMPLETE personalized setup instructions for AI Observability
3. If there's a technology stack in the extracted info (JS/JavaScript, Python, LangChain, etc.), ONLY provide information related to those specific technologies
4. Use the agent_name if available to personalize the setup instructions
5. Focus on Phase 1: AI Observability - setting up comprehensive tracing to see inside AI agents
6. Provide THE WHOLE setup instructions tailored to their specific context and project type
7. Detect user's language and respond in the same language
${handitToken ? `8. CRITICAL: Use the provided token "${handitToken}" in ALL code examples instead of placeholder tokens` : ''}

RESPONSE STRUCTURE:
- Personalized greeting using their agent_name if available
- Language-specific installation instructions
- Configuration steps tailored to their use case with REAL working examples using their token
- Next steps for AI Observability setup
- Keep technical terms like "AI Observability", "Quality Evaluation", "Self-Improving AI", "Handit.ai" in English

IF THE ${handitToken} IS NOT NULL, THEN NOT MENTION THE STEP WHERE THE USER NEEDS TO GET THE TOKEN FROM THE DASHBOARD

Generate ONLY the response text (no JSON, no quotes).`;

            const response = await aiService.generateResponse(setupPrompt, {
                maxTokens: 2600
            });
            
            console.log('🛠️ Setup Handit Response Generated');
            
            // Generate next steps based on extracted info
            const nextSteps = [];
            if (extractedInfo.stack) {
                nextSteps.push(`Install Handit.ai for ${extractedInfo.stack}`);
                nextSteps.push('Configure your project settings');
            }
            if (extractedInfo.agent_name) {
                nextSteps.push(`Set up tracing for ${extractedInfo.agent_name}`);
            }
            if (extractedInfo.agentProjectType) {
                nextSteps.push(`Configure ${extractedInfo.agentProjectType} specific settings`);
            }
            nextSteps.push('Test your AI Observability setup');
            
            return {
                answer: response.answer,
                stack: extractedInfo.stack || null,
                agentName: extractedInfo.agent_name || null,
                agentProjectType: extractedInfo.agentProjectType || null,
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

    /**
     * General Knowledge LLM - Handles general inquiries about Handit.ai topics
     * @param {string} userMessage - Current user message
     * @param {Object} conversationHistory - Conversation history
     * @returns {Promise<Object>} General knowledge response
     */
    async generalKnowledge(userMessage, conversationHistory) {
        try {
            console.log('🧠 General Knowledge LLM: Processing general Handit.ai inquiry');
            
            // Import handitKnowledgeBase from pinecone.js
            const { handitKnowledgeBase } = require('../config/pinecone');
            
            // Use handitKnowledgeBase as context
            const context = handitKnowledgeBase;
            
            // Prepare conversation history for context
            const conversationContext = conversationHistory.messages?.map(msg => `${msg.role}: ${msg.content}`).join('\n') || 'No previous conversation';
            
            const generalPrompt = `You are a General Knowledge LLM for Handit.ai. Your goal is to provide comprehensive and helpful answers about Handit.ai topics for users who have general inquiries.

HANDIT.AI DOCUMENTATION CONTEXT:
${context}

CONVERSATION HISTORY:
${conversationContext}

{CURRENT_USER_MESSAGE}: "${userMessage}"

TASK:
1. FIRST: Detect the user's language from their message and conversation history
2. GO THROUGH THE ENTIRE HANDIT.AI DOCUMENTATION CONTEXT THOROUGHLY
3. Response the user las meesage {CURRENT_USER_MESSAGE} Provideing comprehensive, accurate information but all based on HANDIT.AI DOCUMENTATION CONTEXT
4. Stay STRICTLY within Handit.ai topics - don't answer questions outside this scope
5. Respond in the SAME LANGUAGE as the user
6. Keep key terms like "AI Observability", "Quality Evaluation", "Self-Improving AI", "Handit.ai" in English, and all keywords about Handit.ai in English

RESPONSE GUIDELINES:
- Be comprehensive and informative
- Provide specific examples when helpful
- Include relevant technical details from documentation
- Be friendly and professional
- If the question is about getting started, mention both direct answers and onboarding option
- Focus on being helpful while staying within Handit.ai scope
- If is something not about code, then not be too verbose, just answer the question
- Respond in the SAME LANGUAGE as the user 
- If you using key terms like "AI Observability", "Quality Evaluation", "Self-Improving AI", "Handit.ai" in English, and all keywords about Handit.ai, then for this words keep it in English


Generate ONLY the response text (no JSON, no quotes).`;

            const response = await aiService.generateResponse(generalPrompt, {
                maxTokens: 1500
            });
            
            console.log('🧠 General Knowledge Response Generated');
            
            return {
                answer: response.answer,
                topic: 'general_handit_knowledge',
                context_used: true
            };
            
        } catch (error) {
            console.warn('⚠️ Error in General Knowledge LLM, using default response:', error.message);
            
            // Default helpful response
            return {
                answer: "I'm here to help you with any questions about Handit.ai! I can provide information about our AI observability features, quality evaluation system, self-improving AI capabilities, and technical implementation details. What would you like to know about Handit.ai?",
                topic: 'general_handit_knowledge',
                context_used: false
            };
        }
    }

}

module.exports = AgenticAI;