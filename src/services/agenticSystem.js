/**
 * Simplified Agentic System for Handit.ai
 * Single node that processes conversation history and user message
 * @module services/agenticSystem
 */

const { aiService } = require('./aiService');
const ConversationService = require('./conversationService');

class AgenticSystem {
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
            console.log(`🧠 Processing single node for session: ${sessionId}`);
            
            // Get conversation history
            const conversationHistory = await this.conversationService.getConversationHistory(sessionId, 10);
            
            // Print conversation history
            console.log('📜 CONVERSATION HISTORY:');
            console.log('========================');
            if (conversationHistory.messages && conversationHistory.messages.length > 0) {
                conversationHistory.messages.forEach((msg, index) => {
                    console.log(`${index + 1}. ${msg.role.toUpperCase()}: ${msg.content}`);
                });
            } else {
                console.log('No previous conversation history');
            }
            
            // Print current user message
            console.log('\n💬 CURRENT USER MESSAGE:');
            console.log('=========================');
            console.log(userMessage);
            
            // Call Router LLM to decide next action
            const routerResponse = await this.routerAgent(userMessage, conversationHistory, sessionId);
            
            console.log('\n✅ Processing completed');
            
            return routerResponse;
            
        } catch (error) {
            console.error('❌ Error in simple agentic system:', error);
            throw error;
        }
    }

    /**
     * Router LLM Agent - Decides if topic is about Handit.ai or not
     * @param {string} userMessage - Current user message
     * @param {Object} conversationHistory - Conversation history
     * @param {string} sessionId - Session identifier
     * @returns {Promise<Object>} Router decision and response
     */
    async routerAgent(userMessage, conversationHistory, sessionId) {
        try {
            console.log('🚦 Router Agent: Analyzing if topic is about Handit.ai');

            // Create conversation context for router
            const conversationContext = conversationHistory.messages?.map(msg => `${msg.role}: ${msg.content}`).join('\n') || 'No previous conversation';

            const routerPrompt = `You are a Router Agent for Handit.ai Copilot. Your job is to decide if the user's question is about Handit.ai or not.

HANDIT.AI TOPICS INCLUDE:
- Setup and configuration of Handit.ai (setup, settear, configurar, instalar), everything related to dev topic
- Installation of SDKs (Python, JavaScript)
- Integration with tech stacks (LangChain, OpenAI, etc.)
- Features: Tracing, Evaluation, Optimization, CI/CD
- Agent monitoring and observability
- LLM performance evaluation
- Prompt management and self-optimization
- A/B testing for AI
- Troubleshooting Handit.ai issues
- Getting started with Handit.ai
- Questions about Handit.ai documentation

IMPORTANT: If the user asks about "setup", "settear", "configurar", "instalar", "integrar", "configuración", "installation", "getting started", or any variation, even without mentioning Handit.ai explicitly, assume it's about Handit.ai setup since this is a Handit.ai assistant.

CONVERSATION HISTORY:
${conversationContext}

CURRENT USER MESSAGE: "${userMessage}"

DECISION RULES:
1. If the message is about Handit.ai topics → Return "HANDIT_AI"
2. If the message mentions setup/configuration terms (even without "Handit.ai") → Return "HANDIT_AI" 
3. If the message is clearly about unrelated topics (pizza, weather, general chat, etc.) → Return "OFF_TOPIC"

EXAMPLES:
- "como puedo settear" → "HANDIT_AI" (setup/configuration)
- "ayuda con configuración" → "HANDIT_AI" (setup/configuration)
- "how to install" → "HANDIT_AI" (setup/configuration)
- "quiero ordenar pizza" → "OFF_TOPIC" (unrelated)
- "que tiempo hace" → "OFF_TOPIC" (unrelated)

RESPONSE FORMAT (JSON):
{
  "decision": "HANDIT_AI" or "OFF_TOPIC",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this decision was made",
  "userIntent": "Brief description of what the user wants"
}

CRITICAL RULES:
- Only return JSON format
- Be very specific about the decision
- Consider both current message and conversation history
- ASSUME setup/configuration questions are about Handit.ai unless clearly stated otherwise
- Be inclusive of Spanish terms: settear, configurar, instalar, integrar`;

            const routerResponse = await aiService.generateResponse(routerPrompt, {
                maxTokens: 300
            });

            console.log('🚦 Router LLM Response:', JSON.stringify(routerResponse, null, 2));

            let routerDecision;
            try {
                routerDecision = JSON.parse(routerResponse.answer);
            } catch (error) {
                console.warn('Router JSON parse failed, using fallback');
                routerDecision = {
                    decision: "OFF_TOPIC",
                    confidence: 0.5,
                    reasoning: "Could not parse router response",
                    userIntent: "Unknown"
                };
            }

            // Act on router decision
            if (routerDecision.decision === "HANDIT_AI") {
                console.log('✅ Router Decision: HANDIT_AI - Calling Context Questioner');
                
                // Call Context Questioner directly
                return await this.contextQuestioner(userMessage, conversationHistory, sessionId, routerDecision);
            } else {
                console.log('❌ Router Decision: OFF_TOPIC - Generating polite redirect');
                return await this.generateOffTopicResponse(userMessage, sessionId, routerDecision);
            }

        } catch (error) {
            console.error('Error in Router Agent:', error);
            throw error;
        }
    }

    

    /**
     * Context Questioner LLM - Generates questions for user to get more context
     * @param {string} userMessage - Current user message
     * @param {Object} conversationHistory - Conversation history
     * @param {string} sessionId - Session identifier
     * @param {Object} routerDecision - Router decision data
     * @returns {Promise<Object>} Context questioner response
     */
    async contextQuestioner(userMessage, conversationHistory, sessionId, routerDecision) {
        try {
            console.log('❓ Context Questioner: Analizando si necesita hacer preguntas al usuario');
            
            // Import handitKnowledgeBase from pinecone.js
            const { handitKnowledgeBase } = require('../config/pinecone');
            
            // Use handitKnowledgeBase directly as context
            const availableContext = handitKnowledgeBase;
            
            console.log(`📚 CONTEXTO DISPONIBLE: ${availableContext.length} documentos de handitKnowledgeBase`);
            
            // Prepare conversation history
            const conversationContext = conversationHistory.messages?.map(msg => `${msg.role}: ${msg.content}`).join('\n') || 'No previous conversation';
            
                        console.log('\n🤔 EVALUANDO NECESIDAD DE PREGUNTAS AL USUARIO:');
            console.log(`- Pregunta del usuario: "${userMessage}"`);
            console.log(`- Contexto disponible: ${availableContext.length} documentos`);
            console.log(`- Contexto completo de handitKnowledgeBase`);
            
            const questionAnalysisPrompt = `You are a Context Questioner for Handit.ai. Your job is to decide if you need to ask the user questions to provide a complete and accurate response.

CRITICAL: DETECT the user's language from their message and generate ALL questions in that SAME language (Spanish if Spanish, English if English, etc.).

USER MESSAGE: "${userMessage}"
USER INTENT: ${routerDecision.userIntent}

CONVERSATION HISTORY:
${conversationContext}

AVAILABLE HANDIT.AI KNOWLEDGE BASE:
- Total documents available: ${availableContext.length}
- Complete knowledge base with setup guides, examples, and documentation
- All phases covered: Overview, Observability, Evaluation, Self-Improving

CONTEXT SUMMARY:
${availableContext}

CRITICAL ANALYSIS:
1. Can you provide a complete, accurate answer with the current context?
2. What specific information is missing to give the best possible response?
3. Are there questions that would significantly improve the response quality?
4. DETECT the user's language and respond in that SAME language

IMPORTANT RULES:
- Only ask questions if they are ESSENTIAL for providing a complete answer
- For setup/configuration questions, programming language and framework are usually essential
- For troubleshooting, specific error details are usually essential
- For integration questions, current tech stack is usually essential
- Don't ask questions if the context already contains the information
- Keep questions concise and focused
- ALWAYS generate questions in the user's detected language

RESPONSE FORMAT (JSON):
{
  "detectedLanguage": "spanish|english|other",
  "needsUserInput": true/false,
  "reasoning": "Detailed explanation of why questions are needed or not",
  "questions": [
    {
      "question": "¿En qué lenguaje de programación está construido tu agente IA? (Python, JavaScript, etc.)",
      "category": "technical_stack",
      "importance": "critical",
      "purpose": "Para proporcionar instrucciones específicas del lenguaje"
    },
    {
      "question": "¿Qué framework estás usando? (LangChain, OpenAI SDK, etc.)",
      "category": "technical_stack", 
      "importance": "high",
      "purpose": "Para proporcionar pasos de integración específicos del framework"
    }
  ],
  "canAnswerWithoutQuestions": true/false,
  "contextCompleteness": "complete|partial|insufficient"
}

LANGUAGE-SPECIFIC EXAMPLES:

SPANISH USER EXAMPLES:
- User: "como puedo settear" → Questions in Spanish:
  * "¿En qué lenguaje de programación está construido tu agente IA?"
  * "¿Qué framework estás usando?"
- User: "ayuda con integración" → Questions in Spanish:
  * "¿Cuál es tu stack tecnológico actual?"

ENGLISH USER EXAMPLES:
- User: "how to setup" → Questions in English:
  * "What programming language is your AI agent built in?"
  * "Which framework are you using?"
- User: "integration help" → Questions in English:
  * "What is your current tech stack?"

WHEN TO ASK QUESTIONS:
- User asks setup/configuration → Ask about programming language and framework
- User asks integration help → Ask about current tech stack
- User asks troubleshooting → Ask about specific error or issue
- User asks best practices → Usually don't need to ask, can provide general guidance

WHEN NOT TO ASK:
- User asks "what is Handit.ai" → Can answer from documentation
- User asks "pricing" → Can answer from documentation
- Context already contains tech stack information from conversation history

CRITICAL: Generate questions in the user's detected language!`;

            const questionAnalysisResponse = await aiService.generateResponse(questionAnalysisPrompt, {
                maxTokens: 800
            });
            
            console.log('❓ Question Analysis LLM Response:', JSON.stringify(questionAnalysisResponse, null, 2));
            
            let questionAnalysis;
            try {
                questionAnalysis = JSON.parse(questionAnalysisResponse.answer);
            } catch (error) {
                console.warn('Question analysis JSON parse failed, using fallback');
                questionAnalysis = {
                    detectedLanguage: "spanish", // Default to Spanish based on user message
                    needsUserInput: false,
                    reasoning: "Could not parse question analysis",
                    questions: [],
                    canAnswerWithoutQuestions: true,
                    contextCompleteness: "partial"
                };
            }
            
            console.log('\n🎯 ANÁLISIS DE PREGUNTAS:');
            console.log(`- Idioma detectado: ${questionAnalysis.detectedLanguage || 'unknown'}`);
            console.log(`- Necesita input del usuario: ${questionAnalysis.needsUserInput ? 'SÍ' : 'NO'}`);
            console.log(`- Puede responder sin preguntas: ${questionAnalysis.canAnswerWithoutQuestions ? 'SÍ' : 'NO'}`);
            console.log(`- Completitud del contexto: ${questionAnalysis.contextCompleteness}`);
            console.log(`- Razonamiento: ${questionAnalysis.reasoning}`);
            
            if (questionAnalysis.needsUserInput && questionAnalysis.questions.length > 0) {
                console.log('\n❓ PREGUNTAS GENERADAS PARA EL USUARIO:');
                questionAnalysis.questions.forEach((q, index) => {
                    console.log(`${index + 1}. [${q.importance.toUpperCase()}] ${q.question}`);
                    console.log(`   Categoría: ${q.category}`);
                    console.log(`   Propósito: ${q.purpose}`);
                    console.log('   ---');
                });
                
                // Generate user-facing questions
                const userQuestions = questionAnalysis.questions.map(q => q.question).join('\n\n');
                
                // Generate intro message in detected language
                const introMessages = {
                    spanish: `Para darte la mejor respuesta posible, necesito conocer algunos detalles:\n\n${userQuestions}`,
                    english: `To provide you with the best possible answer, I need to know some details:\n\n${userQuestions}`,
                    other: `Para darte la mejor respuesta posible, necesito conocer algunos detalles:\n\n${userQuestions}` // Default to Spanish
                };
                
                const detectedLang = questionAnalysis.detectedLanguage || 'spanish';
                const finalAnswer = introMessages[detectedLang] || introMessages.spanish;
                
                return {
                    answer: finalAnswer,
                    sessionId: sessionId,
                    requiresUserInput: true,
                    nextAction: 'wait_for_user_input',
                    detectedLanguage: detectedLang,
                    routerDecision: routerDecision,
                    userMessage: userMessage,
                    questionAnalysis: questionAnalysis,
                    availableContext: availableContext,
                    nodeType: "context_questioner_with_questions"
                };
            } else {
                console.log('\n✅ NO SE REQUIEREN PREGUNTAS AL USUARIO');
                console.log('Procediendo directamente al Phase Router');
                
                // Call Phase Router to determine which specialized LLM to use
                return await this.phaseRouter(userMessage, conversationHistory, sessionId, routerDecision, availableContext, questionAnalysis, null);
            }
            
        } catch (error) {
            console.error('Error in Context Questioner:', error);
            throw error;
        }
    }

    /**
     * Phase Router - Determines which specialized LLM to use based on user needs
     * @param {string} userMessage - Current user message
     * @param {Object} conversationHistory - Conversation history
     * @param {string} sessionId - Session identifier
     * @param {Object} routerDecision - Router decision data
     * @param {Array} availableContext - Available context from handitKnowledgeBase
     * @param {Object} questionAnalysis - Question analysis data
     * @param {Object} userAnswers - User answers to questions (null if no questions)
     * @returns {Promise<Object>} Phase router response
     */
    async phaseRouter(userMessage, conversationHistory, sessionId, routerDecision, availableContext, questionAnalysis, userAnswers) {
        try {
            console.log('🔄 Phase Router: Determinando qué LLM especializado usar');
            
            // Prepare conversation history
            const conversationContext = conversationHistory.messages?.map(msg => `${msg.role}: ${msg.content}`).join('\n') || 'No previous conversation';
            
            // Extract user's tech stack
            const userTechStack = this.extractTechStackFromConversation(conversationHistory);
            
            const phaseRouterPrompt = `You are a Phase Router for Handit.ai. Your job is to determine which phase of Handit.ai setup the user needs help with.

USER MESSAGE: "${userMessage}"
USER INTENT: ${routerDecision.userIntent}

CONVERSATION HISTORY:
${conversationContext}

USER TECH STACK:
${JSON.stringify(userTechStack, null, 2)}

HANDIT.AI PHASES:
1. OBSERVABILITY (Phase 1): Setup SDK, tracing, installation, getting started
2. EVALUATION (Phase 2): Quality evaluation, evaluators, metrics, assessment
3. SELF_IMPROVING (Phase 3): Optimization, A/B testing, prompt improvements

PHASE DETERMINATION RULES:
- If user asks about "setup", "install", "getting started", "tracing", "observability" → OBSERVABILITY
- If user asks about "evaluation", "quality", "metrics", "assessment", "evaluators" → EVALUATION  
- If user asks about "optimization", "A/B testing", "self-improving", "prompt optimization" → SELF_IMPROVING
- If user asks general questions or "what is Handit.ai" → OBSERVABILITY (start with basics)
- If unclear or mentions multiple phases → OBSERVABILITY (start with foundation)

CRITICAL: Phase 1 (Observability) is a prerequisite for Phase 2 and 3. Always start with Phase 1 unless user explicitly has it working.

RESPONSE FORMAT (JSON):
{
  "selectedPhase": "OBSERVABILITY|EVALUATION|SELF_IMPROVING",
  "reasoning": "Brief explanation of why this phase was selected",
  "userReadiness": "ready|needs_prerequisites|unclear",
  "detectedLanguage": "${questionAnalysis.detectedLanguage || 'spanish'}"
}

CRITICAL RULES:
- Only return JSON format
- Default to OBSERVABILITY if uncertain
- Consider conversation history and user's journey
- Respond in detected language: ${questionAnalysis.detectedLanguage || 'spanish'}`;

            const phaseRouterResponse = await aiService.generateResponse(phaseRouterPrompt, {
                maxTokens: 300
            });
            
            console.log('🔄 Phase Router LLM Response:', JSON.stringify(phaseRouterResponse, null, 2));
            
            let phaseDecision;
            try {
                phaseDecision = JSON.parse(phaseRouterResponse.answer);
            } catch (error) {
                console.warn('Phase router JSON parse failed, defaulting to OBSERVABILITY');
                phaseDecision = {
                    selectedPhase: "OBSERVABILITY",
                    reasoning: "Default to observability due to parse error",
                    userReadiness: "ready",
                    detectedLanguage: questionAnalysis.detectedLanguage || 'spanish'
                };
            }
            
            console.log('\n🎯 PHASE ROUTER DECISION:');
            console.log(`- Fase seleccionada: ${phaseDecision.selectedPhase}`);
            console.log(`- Razonamiento: ${phaseDecision.reasoning}`);
            console.log(`- Preparación del usuario: ${phaseDecision.userReadiness}`);
            console.log(`- Idioma detectado: ${phaseDecision.detectedLanguage}`);
            
            // Call the appropriate specialized LLM
            switch (phaseDecision.selectedPhase) {
                case 'OBSERVABILITY':
                    return await this.observabilityLLM(userMessage, conversationHistory, sessionId, routerDecision, availableContext, questionAnalysis, userAnswers, phaseDecision);
                case 'EVALUATION':
                    return await this.evaluationLLM(userMessage, conversationHistory, sessionId, routerDecision, availableContext, questionAnalysis, userAnswers, phaseDecision);
                case 'SELF_IMPROVING':
                    return await this.selfImprovingLLM(userMessage, conversationHistory, sessionId, routerDecision, availableContext, questionAnalysis, userAnswers, phaseDecision);
                default:
                    // Default to observability
                    return await this.observabilityLLM(userMessage, conversationHistory, sessionId, routerDecision, availableContext, questionAnalysis, userAnswers, phaseDecision);
            }
            
        } catch (error) {
            console.error('Error in Phase Router:', error);
            throw error;
        }
    }

    /**
     * Observability LLM - Specialized in Phase 1 (Tracing/Observability)
     * @param {string} userMessage - Current user message
     * @param {Object} conversationHistory - Conversation history
     * @param {string} sessionId - Session identifier
     * @param {Object} routerDecision - Router decision data
     * @param {Array} availableContext - Available context from handitKnowledgeBase
     * @param {Object} questionAnalysis - Question analysis data
     * @param {Object} userAnswers - User answers to questions (null if no questions)
     * @param {Object} phaseDecision - Phase router decision
     * @returns {Promise<Object>} Observability LLM response
     */
    async observabilityLLM(userMessage, conversationHistory, sessionId, routerDecision, availableContext, questionAnalysis, userAnswers, phaseDecision) {
        try {
            console.log('👀 Observability LLM: Guía especializada en Phase 1 (Tracing/Observability)');
            
            // Use all available context
            const observabilityContext = availableContext;
            
            console.log(`📚 CONTEXTO COMPLETO: ${observabilityContext.length} documentos de handitKnowledgeBase`);
            
            // Prepare conversation history
            const conversationContext = conversationHistory.messages?.map(msg => `${msg.role}: ${msg.content}`).join('\n') || 'No previous conversation';
            
            // Extract user's tech stack
            const userTechStack = this.extractTechStackFromConversation(conversationHistory);
            
                         const observabilityPrompt = `You are an Observability Expert for Handit.ai Phase 1. Your ONLY job is to guide users through COMPLETE AI Observability and Tracing setup.

CRITICAL: Respond in ${phaseDecision.detectedLanguage} language consistently.

USER MESSAGE: "${userMessage}"
USER INTENT: ${routerDecision.userIntent}

CONVERSATION HISTORY:
${conversationContext}

USER TECH STACK:
${JSON.stringify(userTechStack, null, 2)}

OBSERVABILITY DOCUMENTATION (${observabilityContext.length} documents):
${observabilityContext.map((doc, i) => `${i + 1}. ${doc.text}`).join('\n\n')}

YOUR MISSION: Provide a COMPLETE 7-step guide for Phase 1 setup:

📦 PASO 1: Instalación del SDK
📝 PASO 2: Obtener Token de Integración
⚙️ PASO 3: Crear archivo de configuración (handit_service.py/js)
🔐 PASO 4: Configurar variables de entorno (.env)
🚀 PASO 5: Implementar tracking en tu agente (CRÍTICO)
🔍 PASO 6: Ejemplo completo de código funcional
✅ PASO 7: Verificar que funciona

CRITICAL REQUIREMENTS:
- You MUST provide ALL 7 steps in your response
- Step 5 is CRITICAL: Show complete implementation of start_tracing, track_node, end_tracing
- Step 6 is CRITICAL: Show a complete working example with real code
- Include copy-paste ready code examples
- Be specific to user's tech stack (Python/JavaScript)
- Make it practical and immediately actionable

RESPONSE STRUCTURE:
1. Brief introduction
2. ALL 7 steps with code examples
3. Ask for confirmation after showing complete guide

EXAMPLES OF WHAT TO INCLUDE:

For Python:
\`\`\`python
# Step 5 & 6: Complete implementation
from handit_service import tracker

async def my_ai_agent(user_message):
    # Step 5a: Start tracing
    tracing_response = tracker.start_tracing(
        agent_name="my_ai_agent"
    )
    execution_id = tracing_response.get("executionId")
    
    try:
        # Your LLM call here
        response = await your_llm_call(user_message)
        
        # Step 5b: Track the operation
        tracker.track_node(
            input=user_message,
            output=response,
            node_name="main_llm_call",
            agent_name="my_ai_agent",
            node_type="llm",
            execution_id=execution_id
        )
        
        return response
    finally:
        # Step 5c: End tracing
        tracker.end_tracing(
            execution_id=execution_id,
            agent_name="my_ai_agent"
        )
\`\`\`

For JavaScript:
\`\`\`javascript
// Step 5 & 6: Complete implementation
import { startTracing, trackNode, endTracing } from '@handit.ai/node';

async function myAIAgent(userMessage) {
    // Step 5a: Start tracing
    const tracingResponse = await startTracing({
        agentName: 'my_ai_agent'
    });
    const executionId = tracingResponse.executionId;
    
    try {
        // Your LLM call here
        const response = await yourLLMCall(userMessage);
        
        // Step 5b: Track the operation
        await trackNode({
            input: userMessage,
            output: response,
            nodeName: 'main_llm_call',
            agentName: 'my_ai_agent',
            nodeType: 'llm',
            executionId
        });
        
        return response;
    } finally {
        // Step 5c: End tracing
        await endTracing({
            executionId,
            agentName: 'my_ai_agent'
        });
    }
}
\`\`\`

CRITICAL: You MUST include complete code examples that users can copy-paste and adapt to their specific use case. Don't just mention the functions, show them how to use them in a complete workflow.

Generate the COMPLETE 7-step guide now.`;

            const observabilityResponse = await aiService.generateResponse(observabilityPrompt, {
                maxTokens: 1200
            });
            
            console.log('👀 Observability LLM Response:', JSON.stringify(observabilityResponse, null, 2));
            
            return {
                answer: observabilityResponse.answer,
                sessionId: sessionId,
                phase: 'observability',
                requiresUserInput: true,
                nextAction: 'wait_for_step_confirmation',
                detectedLanguage: phaseDecision.detectedLanguage,
                userTechStack: userTechStack,
                filteredContext: observabilityContext,
                nodeType: "observability_llm_response"
            };
            
        } catch (error) {
            console.error('Error in Observability LLM:', error);
            throw error;
        }
    }

    /**
     * Evaluation LLM - Specialized in Phase 2 (Quality Evaluation)
     * @param {string} userMessage - Current user message
     * @param {Object} conversationHistory - Conversation history
     * @param {string} sessionId - Session identifier
     * @param {Object} routerDecision - Router decision data
     * @param {Array} availableContext - Available context from handitKnowledgeBase
     * @param {Object} questionAnalysis - Question analysis data
     * @param {Object} userAnswers - User answers to questions (null if no questions)
     * @param {Object} phaseDecision - Phase router decision
     * @returns {Promise<Object>} Evaluation LLM response
     */
    async evaluationLLM(userMessage, conversationHistory, sessionId, routerDecision, availableContext, questionAnalysis, userAnswers, phaseDecision) {
        try {
            console.log('📊 Evaluation LLM: Guía especializada en Phase 2 (Quality Evaluation)');
            
            // Use all available context
            const evaluationContext = availableContext;
            
            console.log(`📚 CONTEXTO COMPLETO: ${evaluationContext.length} documentos de handitKnowledgeBase`);
            
            // Prepare conversation history
            const conversationContext = conversationHistory.messages?.map(msg => `${msg.role}: ${msg.content}`).join('\n') || 'No previous conversation';
            
            const evaluationPrompt = `You are an Evaluation Expert for Handit.ai Phase 2. Your ONLY job is to guide users through Quality Evaluation setup.

CRITICAL: Respond in ${phaseDecision.detectedLanguage} language consistently.

USER MESSAGE: "${userMessage}"
USER INTENT: ${routerDecision.userIntent}

CONVERSATION HISTORY:
${conversationContext}

EVALUATION DOCUMENTATION (${evaluationContext.length} documents):
${evaluationContext.map((doc, i) => `${i + 1}. ${doc.text}`).join('\n\n')}

YOUR SPECIALIZATION - PHASE 2: QUALITY EVALUATION
✅ Connect Evaluation Models (OpenAI, other LLMs)
✅ Create Focused Evaluators (one per quality dimension)
✅ Associate Evaluators to LLM Nodes
✅ Monitor Evaluation Results
✅ Quality Metrics and Scoring

PREREQUISITE CHECK:
- Phase 1 (Observability) must be completed first
- If user hasn't completed Phase 1, redirect them to set up tracing first

RESPONSE GUIDELINES:
- Focus ONLY on Phase 2 (Quality Evaluation)
- Provide step-by-step evaluation setup
- Explain evaluator creation (one per quality dimension)
- Guide through dashboard configuration
- Ask for confirmation after each step

CRITICAL: 
- Check if they have Phase 1 working
- Guide through evaluator creation
- Explain how to associate evaluators to nodes
- Focus on quality assessment setup

Generate a complete, step-by-step response for Phase 2 evaluation setup.`;

            const evaluationResponse = await aiService.generateResponse(evaluationPrompt, {
                maxTokens: 1200
            });
            
            console.log('📊 Evaluation LLM Response:', JSON.stringify(evaluationResponse, null, 2));
            
            return {
                answer: evaluationResponse.answer,
                sessionId: sessionId,
                phase: 'evaluation',
                requiresUserInput: true,
                nextAction: 'wait_for_step_confirmation',
                detectedLanguage: phaseDecision.detectedLanguage,
                filteredContext: evaluationContext,
                nodeType: "evaluation_llm_response"
            };
            
        } catch (error) {
            console.error('Error in Evaluation LLM:', error);
            throw error;
        }
    }

    /**
     * Self-Improving LLM - Specialized in Phase 3 (Optimization)
     * @param {string} userMessage - Current user message
     * @param {Object} conversationHistory - Conversation history
     * @param {string} sessionId - Session identifier
     * @param {Object} routerDecision - Router decision data
     * @param {Array} availableContext - Available context from handitKnowledgeBase
     * @param {Object} questionAnalysis - Question analysis data
     * @param {Object} userAnswers - User answers to questions (null if no questions)
     * @param {Object} phaseDecision - Phase router decision
     * @returns {Promise<Object>} Self-Improving LLM response
     */
    async selfImprovingLLM(userMessage, conversationHistory, sessionId, routerDecision, availableContext, questionAnalysis, userAnswers, phaseDecision) {
        try {
            console.log('🚀 Self-Improving LLM: Guía especializada en Phase 3 (Optimization)');
            
            // Use all available context
            const optimizationContext = availableContext;
            
            console.log(`📚 CONTEXTO COMPLETO: ${optimizationContext.length} documentos de handitKnowledgeBase`);
            
            // Prepare conversation history
            const conversationContext = conversationHistory.messages?.map(msg => `${msg.role}: ${msg.content}`).join('\n') || 'No previous conversation';
            
            const selfImprovingPrompt = `You are a Self-Improving AI Expert for Handit.ai Phase 3. Your ONLY job is to guide users through AI Optimization setup.

CRITICAL: Respond in ${phaseDecision.detectedLanguage} language consistently.

USER MESSAGE: "${userMessage}"
USER INTENT: ${routerDecision.userIntent}

CONVERSATION HISTORY:
${conversationContext}

OPTIMIZATION DOCUMENTATION (${optimizationContext.length} documents):
${optimizationContext.map((doc, i) => `${i + 1}. ${doc.text}`).join('\n\n')}

YOUR SPECIALIZATION - PHASE 3: SELF-IMPROVING AI
✅ Connect Optimization Models
✅ Monitor Optimization Results
✅ Deploy Optimizations via SDK
✅ A/B Testing and Performance Comparison
✅ Prompt Optimization and Release Hub

PREREQUISITE CHECK:
- Phase 1 (Observability) must be completed
- Phase 2 (Evaluation) must be completed
- If user hasn't completed previous phases, redirect them appropriately

RESPONSE GUIDELINES:
- Focus ONLY on Phase 3 (Self-Improving/Optimization)
- Provide step-by-step optimization setup
- Guide through Release Hub usage
- Explain SDK integration for optimized prompts
- Ask for confirmation after each step

CRITICAL: 
- Check if they have Phase 1 and 2 working
- Guide through optimization model setup
- Explain how to deploy optimizations
- Focus on self-improving AI capabilities

Generate a complete, step-by-step response for Phase 3 optimization setup.`;

            const selfImprovingResponse = await aiService.generateResponse(selfImprovingPrompt, {
                maxTokens: 1200
            });
            
            console.log('🚀 Self-Improving LLM Response:', JSON.stringify(selfImprovingResponse, null, 2));
            
            return {
                answer: selfImprovingResponse.answer,
                sessionId: sessionId,
                phase: 'self_improving',
                requiresUserInput: true,
                nextAction: 'wait_for_step_confirmation',
                detectedLanguage: phaseDecision.detectedLanguage,
                filteredContext: optimizationContext,
                nodeType: "self_improving_llm_response"
            };
            
        } catch (error) {
            console.error('Error in Self-Improving LLM:', error);
            throw error;
        }
    }

    /**
     * Step-by-Step Guide LLM - Guides user through Handit.ai setup phases
     * @param {string} userMessage - Current user message
     * @param {Object} conversationHistory - Conversation history
     * @param {string} sessionId - Session identifier
     * @param {Object} routerDecision - Router decision data
     * @param {Array} availableContext - Available context from handitKnowledgeBase
     * @param {Object} questionAnalysis - Question analysis data
     * @param {Object} userAnswers - User answers to questions (null if no questions)
     * @returns {Promise<Object>} Step-by-step guide response
     */
    async stepByStepGuide(userMessage, conversationHistory, sessionId, routerDecision, availableContext, questionAnalysis, userAnswers) {
        try {
            console.log('👨‍🏫 Step-by-Step Guide: Generando guía personalizada para el usuario');
            
            // Use the available context directly
            const contextDocuments = availableContext;
            
            console.log(`📚 CONTEXTO DISPONIBLE: ${contextDocuments.length} documentos de handitKnowledgeBase`);
            
            // Prepare conversation history
            const conversationContext = conversationHistory.messages?.map(msg => `${msg.role}: ${msg.content}`).join('\n') || 'No previous conversation';
            
            // Extract user's tech stack from answers or conversation
            let userTechStack = {};
            if (userAnswers) {
                // TODO: Parse user answers to extract tech stack
                userTechStack = this.extractTechStackFromAnswers(userAnswers);
            } else {
                // Extract from conversation history if available
                userTechStack = this.extractTechStackFromConversation(conversationHistory);
            }
            
            console.log('\n🔧 INFORMACIÓN TÉCNICA DEL USUARIO:');
            console.log(`- Lenguaje detectado: ${questionAnalysis.detectedLanguage || 'spanish'}`);
            console.log(`- Stack tecnológico: ${JSON.stringify(userTechStack, null, 2)}`);
            
                        console.log('\n📚 CONTEXTO DISPONIBLE PARA LA GUÍA:');
            console.log(`- Documentos de handitKnowledgeBase: ${contextDocuments.length}`);
            console.log(`- Historial de conversación: ${conversationHistory.messages?.length || 0} mensajes`);
            console.log(`- Contexto completo disponible`);
            
            const stepByStepPrompt = `You are a Step-by-Step Guide for Handit.ai setup. Your job is to guide the user through the complete Handit.ai setup process in their detected language.

CRITICAL: Respond in ${questionAnalysis.detectedLanguage || 'spanish'} language consistently.

USER MESSAGE: "${userMessage}"
USER INTENT: ${routerDecision.userIntent}

CONVERSATION HISTORY:
${conversationContext}

USER TECH STACK:
${JSON.stringify(userTechStack, null, 2)}

HANDIT.AI DOCUMENTATION CONTEXT (${contextDocuments.length} documents):
${contextDocuments}

HANDIT.AI SETUP PHASES (Prerequisites Matter!):
1. OBSERVABILIDAD/TRACING (REQUIRED FIRST) - Most complex, requires code integration
   - Install SDK
   - Initialize tracker
   - Add tracing to LLM calls and tools
   - Verify data is flowing
   
2. EVALUACIÓN (Requires Phase 1) - Dashboard configuration
   - Connect evaluation models
   - Create evaluators
   - Associate evaluators to LLM nodes
   - Monitor results
   
3. SELF-IMPROVING (Requires Phase 1 & 2) - Dashboard configuration  
   - Connect optimization models
   - Monitor optimization results
   - Deploy optimizations

AVAILABLE CONTEXT:
- Complete handitKnowledgeBase with all setup phases
- Setup examples for Python and JavaScript
- Comprehensive documentation for all features

YOUR MISSION:
1. Determine which phase(s) the user needs based on their request and context
2. Start with Phase 1 (Observabilidad) if they haven't done it yet
3. Provide specific, actionable step-by-step guidance
4. Include code examples tailored to their tech stack
5. Ask for confirmation after each major step
6. Offer additional help with code architecture

RESPONSE STRUCTURE:
- Start with a friendly introduction explaining you'll guide them step-by-step
- Identify which phase(s) they need
- Provide the first concrete step with code example
- Ask for confirmation before proceeding
- Offer additional architectural help

EXAMPLES OF TECH-SPECIFIC GUIDANCE:
- Python + LangChain: Show handit.py initialization and LangChain integration
- JavaScript + OpenAI: Show Node.js setup and OpenAI wrapper
- Python + OpenAI: Show Python SDK setup and OpenAI integration

LANGUAGE EXAMPLES:
Spanish: "Te guiaré paso a paso para configurar Handit.ai exitosamente. Primero necesitamos..."
English: "I'll guide you step-by-step to successfully set up Handit.ai. First we need to..."

CRITICAL RULES:
- Always start with Observabilidad unless they explicitly have it working
- Provide concrete, copy-paste code examples
- Ask for confirmation after each step
- Adapt examples to their specific tech stack
- Be encouraging and supportive
- Offer help with code architecture/structure
- Respond in the user's detected language
- Reference the extracted documentation context when relevant`;

            const stepByStepResponse = await aiService.generateResponse(stepByStepPrompt, {
                maxTokens: 1500
            });
            
            console.log('👨‍🏫 Step-by-Step Guide LLM Response:', JSON.stringify(stepByStepResponse, null, 2));
            
            // Store all context for next interaction
            const completeContext = {
                userMessage,
                conversationHistory,
                routerDecision,
                questionAnalysis,
                userTechStack,
                availableContext: contextDocuments,
                detectedLanguage: questionAnalysis.detectedLanguage || 'spanish'
            };
            
            console.log('\n🎯 GUÍA PASO A PASO GENERADA');
            console.log(`- Fase identificada: Observabilidad (prerequisito)`);
            console.log(`- Stack del usuario: ${userTechStack.language || 'unknown'} + ${userTechStack.framework || 'unknown'}`);
            console.log(`- Idioma de respuesta: ${questionAnalysis.detectedLanguage || 'spanish'}`);
            console.log(`- Documentos utilizados: ${contextDocuments.length}`);
            
            return {
                answer: stepByStepResponse.answer,
                sessionId: sessionId,
                requiresUserInput: true,
                nextAction: 'wait_for_step_confirmation',
                detectedLanguage: questionAnalysis.detectedLanguage || 'spanish',
                currentPhase: 'observabilidad',
                userTechStack: userTechStack,
                completeContext: completeContext,
                nodeType: "step_by_step_guide_started"
            };
            
        } catch (error) {
            console.error('Error in Step-by-Step Guide:', error);
            throw error;
        }
    }

    /**
     * Extract tech stack from user answers
     * @param {Object} userAnswers - User answers to questions
     * @returns {Object} Extracted tech stack information
     */
    extractTechStackFromAnswers(userAnswers) {
        // TODO: Implement parsing of user answers
        // For now, return default structure
        return {
            language: 'unknown',
            framework: 'unknown',
            environment: 'unknown'
        };
    }

    /**
     * Extract tech stack from conversation history
     * @param {Object} conversationHistory - Conversation history
     * @returns {Object} Extracted tech stack information
     */
    extractTechStackFromConversation(conversationHistory) {
        const messages = conversationHistory.messages || [];
        const allText = messages.map(msg => msg.content).join(' ').toLowerCase();
        
        const techStack = {
            language: 'unknown',
            framework: 'unknown',
            environment: 'unknown'
        };
        
        // Detect programming language
        if (allText.includes('python') || allText.includes('py')) {
            techStack.language = 'python';
        } else if (allText.includes('javascript') || allText.includes('js') || allText.includes('node')) {
            techStack.language = 'javascript';
        }
        
        // Detect framework
        if (allText.includes('langchain')) {
            techStack.framework = 'langchain';
        } else if (allText.includes('openai')) {
            techStack.framework = 'openai';
        }
        
        // Detect environment
        if (allText.includes('local') || allText.includes('localhost')) {
            techStack.environment = 'local';
        } else if (allText.includes('cloud') || allText.includes('aws') || allText.includes('gcp')) {
            techStack.environment = 'cloud';
        }
        
        return techStack;
    }

    /**
     * Generate polite response for off-topic queries
     * @param {string} userMessage - Current user message
     * @param {string} sessionId - Session identifier
     * @param {Object} routerDecision - Router decision data
     * @returns {Promise<Object>} Off-topic response
     */
    async generateOffTopicResponse(userMessage, sessionId, routerDecision) {
        try {
            console.log('🤖 Generating polite off-topic response');

            const offTopicPrompt = `You are a polite Handit.ai Copilot assistant. The user asked about something unrelated to Handit.ai.

USER MESSAGE: "${userMessage}"
USER INTENT: ${routerDecision.userIntent}

Generate a polite response that:
1. Acknowledges their question respectfully
2. Explains that you're specifically designed to help with Handit.ai
3. Mentions what you CAN help with (setup, features, integration, etc.)
4. Suggests they ask about Handit.ai topics instead

RESPONSE GUIDELINES:
- Be friendly and helpful
- Don't be dismissive
- Keep it concise
- Respond in the same language as the user
- Include some specific Handit.ai features you can help with

EXAMPLES OF WHAT YOU CAN HELP WITH:
- Setting up Handit.ai in your tech stack
- Configuring tracing for your AI agents
- Understanding evaluation features
- Prompt optimization and A/B testing
- Troubleshooting integration issues

Generate ONLY the response text, not JSON.`;

            const offTopicResponse = await aiService.generateResponse(offTopicPrompt, {
                maxTokens: 200
            });

            console.log('🤖 Off-topic LLM Response:', JSON.stringify(offTopicResponse, null, 2));

            return {
                answer: offTopicResponse.answer,
                sessionId: sessionId,
                routerDecision: routerDecision,
                userMessage: userMessage,
                nodeType: "off_topic_response"
            };

        } catch (error) {
            console.error('Error generating off-topic response:', error);
            throw error;
        }
    }
}

module.exports = AgenticSystem; 