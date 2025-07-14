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

             // Import handitKnowledgeBase from pinecone.js
             const { handitKnowledgeBase } = require('../config/pinecone');
            
             // Use handitKnowledgeBase directly as context
             const availableContext = handitKnowledgeBase;

            console.log('🚦 Router Agent: Analyzing if topic is about Handit.ai');

            // Create conversation context for router
            const conversationContext = conversationHistory.messages?.map(msg => `${msg.role}: ${msg.content}`).join('\n') || 'No previous conversation';

            const routerPrompt = `You are a Router Agent. Determine if the user's message is related to the topics covered in the available documentation or completely unrelated.

USER MESSAGE: "${userMessage}"

AVAILABLE DOCUMENTATION CONTEXT:
${availableContext}

TASK: Check if the user's question is about ANY topic mentioned or covered in the documentation above.

DECISION RULES:
- If the user's message relates to ANY topic, concept, feature, or process mentioned in the documentation → Return "HANDIT_AI"
- If the user's message is clearly about something NOT covered in the documentation (weather, food, general chat, etc.) → Return "OFF_TOPIC"

EXAMPLES:
- Question about something mentioned in the docs → "HANDIT_AI"
- "what's the weather?" → "OFF_TOPIC" (not in docs)
- "how to cook pasta?" → "OFF_TOPIC" (not in docs)

Return ONLY valid JSON:
{"decision": "HANDIT_AI", "reasoning": "brief reason"}`;

            const routerResponse = await aiService.generateResponse(routerPrompt, {
                maxTokens: 300
            });

            console.log('🚦 Router LLM Response:', JSON.stringify(routerResponse, null, 2));

            let routerDecision;
            try {
                let jsonText = routerResponse.answer.trim();
                
                // Extract JSON if wrapped in other text
                const jsonMatch = jsonText.match(/\{[^}]*\}/);
                if (jsonMatch) {
                    jsonText = jsonMatch[0];
                }
                
                routerDecision = JSON.parse(jsonText);
                
                // Ensure decision has the required format
                if (!routerDecision.decision) {
                    throw new Error('Missing decision field');
                }
                
                // Validate decision value
                if (!['HANDIT_AI', 'OFF_TOPIC'].includes(routerDecision.decision)) {
                    console.warn('Invalid decision value:', routerDecision.decision);
                    routerDecision.decision = 'HANDIT_AI'; // Default to HANDIT_AI
                }
                
            } catch (error) {
                console.warn('Router JSON parse failed, defaulting to HANDIT_AI:', error.message);
                console.log('Raw router response:', routerResponse.answer);
                
                // Default to HANDIT_AI since this is a Handit.ai assistant
                routerDecision = {
                    decision: "HANDIT_AI",
                    confidence: 0.7,
                    reasoning: "Defaulting to Handit.ai topic due to parse error",
                    userIntent: "Likely asking about Handit.ai"
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
            
            // Prepare conversation history
            const conversationContext = conversationHistory.messages?.map(msg => `${msg.role}: ${msg.content}`).join('\n') || 'No previous conversation';
            
                        console.log('\n🤔 EVALUANDO NECESIDAD DE PREGUNTAS AL USUARIO:');
            console.log(`- Pregunta del usuario: "${userMessage}"`);
            console.log(`- Tipo de contexto disponible: ${typeof availableContext}`);
            console.log(`- Es array: ${Array.isArray(availableContext)}`);
            if (Array.isArray(availableContext)) {
                console.log(`- Número de documentos: ${availableContext.length}`);
            }
            console.log(`- Contexto completo de handitKnowledgeBase`);
            
            const questionAnalysisPrompt = `You are a Context Questioner for Handit.ai. Analyze if the user wants help with observability/setup topics from the documentation.

USER MESSAGE: "${userMessage}"
CONVERSATION HISTORY: ${conversationContext}

AVAILABLE DOCUMENTATION: 
${availableContext}

TASK: Analyze if the user's message is asking about ANY observability, setup, installation, configuration, or getting started.

1. DETECT user's language (Spanish/English) from their message
2. CHECK: Is the user asking about observability/setup topics from the documentation?
   - Look for questions about: setup, installation, configuration, tracing, monitoring, SDK setup, getting started, integration
   - If user wants help with ANY of these topics → set needsUserInput = TRUE and ask 3 questions
   - If user is just asking general questions about what Handit is → set needsUserInput = FALSE
3. ANALIZE THE CONVERSATION HISTORY AND CHECK IF THERE ARE ANY OF THESE QUESTIONS ASKED TO THE USER.
   - If you there are some questions already asked to the user, set needsUserInput = FALSE
   - If user just ignored these questions, set needsUserInput = FALSE
   - If user didnt answer all your questions, set needsUserInput = FALSE
   - If user answered all your questions, set needsUserInput = FALSE
   - If user is asking about something else, set needsUserInput = FALSE
   - If user is asking about something that is not in the documentation, set needsUserInput = FALSE
   - If user is already in on-boarding process, set needsUserInput = FALSE
 
4. IF YOU HAVE ALREADY ASKED THE USER THESE QUESTIONS, SET needsUserInput = FALSE
5. ANALIZE THE CONVERSATION HISTORY and user Message. IF USER IS ALREADY IN ON-BOARDING PROCESS, SET needsUserInput = FALSE


QUESTIONS TO ASK (when needsUserInput = TRUE):

SPANISH:
- "¿Sobre qué es tu aplicación IA, qué es lo que hace?"
- "¿En qué lenguaje de programación está construido?"
- "¿Qué framework estás usando?"

ENGLISH:
- "What is your AI application about, what does it do?"
- "What programming language is it built in?"
- "What framework are you using?"

EXAMPLES:
- "quiero settear handit" → needsUserInput: TRUE (wants setup help)
- "como configurar handit" → needsUserInput: TRUE (wants configuration help)
- "i want to connect my agent to handit" → needsUserInput: TRUE (wants integration help)
- "help me with handit observability" → needsUserInput: TRUE (wants observability help)
- "what is handit?" → needsUserInput: FALSE (just asking what it is)
- "tell me about handit features" → needsUserInput: FALSE (just asking about features)

CRITICAL: Base your decision on whether they want PRACTICAL HELP with setup/observability topics from the documentation, not just general information.

RESPONSE FORMAT (JSON):
{
  "detectedLanguage": "spanish|english",
  "needsUserInput": true/false,
  "reasoning": "Brief reason - is user asking for setup/observability help?",
  "questions": [
    {
      "question": "question text in user language",
      "category": "application_context|technical_stack",
      "importance": "helpful",
      "purpose": "To provide better setup guidance"
    }
  ]
}`;

            const questionAnalysisResponse = await aiService.generateResponse(questionAnalysisPrompt, {
                maxTokens: 800
            });
            
            console.log('❓ Question Analysis LLM Response:', JSON.stringify(questionAnalysisResponse, null, 2));
            
            let questionAnalysis;
            try {
                let jsonText = questionAnalysisResponse.answer.trim();
                
                // Extract JSON if wrapped in other text
                const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    jsonText = jsonMatch[0];
                }
                
                questionAnalysis = JSON.parse(jsonText);
            } catch (error) {
                console.warn('Question analysis JSON parse failed, using fallback');
                console.log('Raw question analysis response:', questionAnalysisResponse.answer);
                
                // Detect if it's a setup/observability question by analyzing the context
                // Look for observability/setup related terms that would be in the documentation
                const observabilityTerms = ['setup', 'settear', 'configurar', 'instalar', 'install', 'configure', 'connect', 'integration', 'tracing', 'observability', 'monitoring', 'SDK', 'getting started', 'empezar', 'how to', 'como puedo', 'ayuda'];
                
                // Convert availableContext to string for searching
                let contextString = '';
                if (availableContext) {
                    if (typeof availableContext === 'string') {
                        contextString = availableContext;
                    } else if (Array.isArray(availableContext)) {
                        // Join array of documentation strings
                        contextString = availableContext.join('\n\n');
                    } else if (typeof availableContext === 'object') {
                        contextString = JSON.stringify(availableContext);
                    } else {
                        contextString = String(availableContext);
                    }
                }
                
                const isObservabilityQuestion = observabilityTerms.some(term => 
                    userMessage.toLowerCase().includes(term.toLowerCase()) ||
                    (contextString && contextString.toLowerCase().includes(term.toLowerCase()) && userMessage.toLowerCase().includes('handit'))
                );
                
                // Detect language
                const spanishWords = ['settear', 'configurar', 'instalar', 'como', 'que', 'es', 'tu', 'quiero', 'ayuda'];
                const isSpanish = spanishWords.some(word => userMessage.toLowerCase().includes(word));
                
                questionAnalysis = {
                    detectedLanguage: isSpanish ? "spanish" : "english",
                    needsUserInput: isObservabilityQuestion,
                    reasoning: `Fallback: Observability/setup topics ${isObservabilityQuestion ? 'detected' : 'not detected'}`,
                    questions: isObservabilityQuestion ? [
                        {
                            question: isSpanish ? "¿Sobre qué es tu aplicación IA, qué es lo que hace?" : "What is your AI application about, what does it do?",
                            category: "application_context",
                            importance: "helpful",
                            purpose: "To provide better setup guidance"
                        },
                        {
                            question: isSpanish ? "¿En qué lenguaje de programación está construido?" : "What programming language is it built in?",
                            category: "technical_stack",
                            importance: "helpful", 
                            purpose: "To provide better setup guidance"
                        },
                        {
                            question: isSpanish ? "¿Qué framework estás usando?" : "What framework are you using?",
                            category: "technical_stack",
                            importance: "helpful",
                            purpose: "To provide better setup guidance"
                        }
                    ] : []
                };
            }
            
            console.log('\n🎯 ANÁLISIS DE PREGUNTAS:');
            console.log(`- Mensaje del usuario: "${userMessage}"`);
            console.log(`- Idioma detectado: ${questionAnalysis.detectedLanguage || 'unknown'}`);
            console.log(`- Necesita input del usuario: ${questionAnalysis.needsUserInput ? 'SÍ' : 'NO'}`);
            console.log(`- Número de preguntas: ${questionAnalysis.questions?.length || 0}`);
            console.log(`- Razonamiento: ${questionAnalysis.reasoning}`);
            
            // Check if user is asking about observability/setup topics from documentation
            const observabilityTerms = ['setup', 'settear', 'configurar', 'instalar', 'install', 'configure', 'connect', 'integration', 'tracing', 'observability', 'monitoring', 'SDK', 'getting started', 'empezar', 'how to', 'como puedo', 'ayuda'];
            
            // Convert availableContext to string for searching
            let contextString = '';
            if (availableContext) {
                if (typeof availableContext === 'string') {
                    contextString = availableContext;
                } else if (Array.isArray(availableContext)) {
                    // Join array of documentation strings
                    contextString = availableContext.join('\n\n');
                } else if (typeof availableContext === 'object') {
                    contextString = JSON.stringify(availableContext);
                } else {
                    contextString = String(availableContext);
                }
            }
            
            const foundTerms = observabilityTerms.filter(term => 
                userMessage.toLowerCase().includes(term.toLowerCase()) ||
                (contextString && contextString.toLowerCase().includes(term.toLowerCase()) && userMessage.toLowerCase().includes('handit'))
            );
            console.log(`- Términos de observabilidad/setup encontrados: [${foundTerms.join(', ')}]`);
            console.log(`- Pregunta relacionada con documentación: ${foundTerms.length > 0 ? 'SÍ' : 'NO'}`);
            console.log(`- Longitud del contexto convertido: ${contextString.length} caracteres`);
            console.log(`- Debería hacer preguntas: ${foundTerms.length > 0 ? 'SÍ' : 'NO'}`);
            
            // OVERRIDE: If user is asking about observability/setup topics but LLM said no, force questions
            if (foundTerms.length > 0 && (!questionAnalysis.needsUserInput || questionAnalysis.questions.length === 0)) {
                console.log('\n🔧 OVERRIDE: Forzando preguntas porque se detectó consulta sobre observabilidad/setup');
                
                const isSpanish = questionAnalysis.detectedLanguage === 'spanish' || 
                                 ['settear', 'configurar', 'instalar', 'como', 'que', 'quiero'].some(word => userMessage.toLowerCase().includes(word));
                
                questionAnalysis.needsUserInput = true;
                questionAnalysis.reasoning = `Override: Observability/setup topic detected [${foundTerms.join(', ')}]`;
                questionAnalysis.questions = [
                    {
                        question: isSpanish ? "¿Sobre qué es tu aplicación IA, qué es lo que hace?" : "What is your AI application about, what does it do?",
                        category: "application_context",
                        importance: "helpful",
                        purpose: "To provide better setup guidance"
                    },
                    {
                        question: isSpanish ? "¿En qué lenguaje de programación está construido?" : "What programming language is it built in?",
                        category: "technical_stack",
                        importance: "helpful",
                        purpose: "To provide better setup guidance"
                    },
                    {
                        question: isSpanish ? "¿Qué framework estás usando?" : "What framework are you using?",
                        category: "technical_stack",
                        importance: "helpful",
                        purpose: "To provide better setup guidance"
                    }
                ];
            }
            
            if (questionAnalysis.needsUserInput && questionAnalysis.questions.length > 0) {
                console.log('\n❓ PREGUNTAS GENERADAS PARA EL USUARIO:');
                questionAnalysis.questions.forEach((q, index) => {
                    console.log(`${index + 1}. [${q.importance.toUpperCase()}] ${q.question}`);
                    console.log(`   Categoría: ${q.category}`);
                    console.log(`   Propósito: ${q.purpose}`);
                    console.log('   ---');
                });
                
                // Generate user-facing questions with natural intro
                const userQuestions = questionAnalysis.questions.map(q => q.question).join('\n\n');
                
                // Generate natural intro message using LLM
                const introPrompt = `You are a helpful Handit.ai assistant. Generate a natural, friendly introduction for asking the user some questions.

USER MESSAGE: "${userMessage}"
USER INTENT: ${routerDecision.userIntent}
DETECTED LANGUAGE: ${questionAnalysis.detectedLanguage || 'spanish'}

QUESTIONS TO ASK:
${userQuestions}

INSTRUCTIONS:
- Generate a natural, conversational introduction in ${questionAnalysis.detectedLanguage || 'spanish'}
- Explain briefly why you need this information
- Be friendly and helpful
- Keep it concise but warm
- Include the questions naturally in your response
- Don't use formal templates, make it sound conversational

RESPONSE FORMAT: Just generate the complete message text that will be sent to the user (no JSON, no quotes, just the natural text).

EXAMPLES:
Spanish: "¡Perfecto! Para ayudarte con la configuración de Handit.ai, necesito conocer un poco más sobre tu proyecto..."
English: "Great! To help you set up Handit.ai properly, I'd like to know a bit more about your project..."`;

                const introResponse = await aiService.generateResponse(introPrompt, {
                    maxTokens: 300
                });
                
                const finalAnswer = introResponse.answer;
                
                return {
                    answer: finalAnswer,
                    sessionId: sessionId,
                    requiresUserInput: true,
                    nextAction: 'wait_for_user_input',
                    detectedLanguage: questionAnalysis.detectedLanguage,
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
            
            const phaseRouterPrompt = `You are a Phase Router for Handit.ai. Your job is to determine which phase of Handit.ai setup the user needs help with.

USER MESSAGE: "${userMessage}"
USER INTENT: ${routerDecision.userIntent}

CONVERSATION HISTORY:
${conversationContext}

HANDIT.AI PHASES:
1. OBSERVABILITY (Phase 1): Setup SDK, tracing, installation, getting started
2. EVALUATION (Phase 2): Quality evaluation, evaluators, metrics, assessment
3. SELF_IMPROVING (Phase 3): Optimization, A/B testing, prompt improvements

PHASE DETERMINATION RULES:
- If user asks about "setup", "install", "getting started", "tracing", "observability" → OBSERVABILITY
- If user asks about "evaluation", "quality", "metrics", "assessment", "evaluators" → EVALUATION  
- If user asks about "optimization", "A/B testing", "self-improving", "prompt optimization", "prompt engineering", "prompt management" → SELF_IMPROVING


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
            
            const observabilityPrompt = `You are an Observability Expert for Handit.ai Phase 1. Your ONLY job is to guide users through COMPLETE AI Observability and Tracing setup.

CRITICAL: Respond in ${phaseDecision.detectedLanguage} language consistently.

USER MESSAGE: "${userMessage}"
USER INTENT: ${routerDecision.userIntent}

CONVERSATION HISTORY:
${conversationContext}

DOCUMENTATION CONTEXT: ${observabilityContext} (THIS IS THE WHOLE CONTEXT OF THE KNOWLEDGE BASE, INSIDE INCLUDES THE OBSERVABILITY SECTION)


CRITICAL ANALYSIS - IDENTIFY USER'S CURRENT OBSERVABILITY STEP:
Analyze the conversation history to determine exactly which observability setup step the user is currently on or needs help with:


PHASE 1 OBSERVABILITY STEPS (for reference):
📦 PASO 1: Instalación del SDK (pip install handit-sdk OR npm install @handit.ai/node)
📝 PASO 2: Obtener Token de Integración (from dashboard settings)
⚙️ PASO 3: Crear archivo de configuración (handit_service.py/js)
🔐 PASO 4: Configurar variables de entorno (.env file with HANDIT_API_KEY)
🚀 PASO 5: Implementar tracking en tu agente (CRÍTICO) - start_tracing, track_node, end_tracing
✅ PASO 6: Verificar que funciona (test and check dashboard)

YOUR MISSION (STEP-BY-STEP CONVERSATIONAL APPROACH):
1. ANALYZE conversation history to identify their current step
2. Provide ONLY the NEXT step they need
3. Give detailed instructions for that ONE step only
4. Wait for user confirmation before proceeding to next step
5. If they haven't started → Suggest ONLY Step 1 (installation)
6. DETECT user's tech stack and provide tech-specific instructions for that step
7. Also provide examples of how to use the functions in the code

CRITICAL REQUIREMENTS:
- ANALYZE conversation history first to detect their progress
- Provide ONLY ONE step at a time, not the complete guide
- If they're starting fresh → Only suggest Step 1 (installation) and wait for response
- If they completed a step → Suggest the NEXT step only
- Give detailed, copy-paste ready instructions for the current step
- DETECT user's tech stack from conversation history (Python vs JavaScript)
- If no tech stack mentioned, ask which one they prefer OR provide both options
- Make each step practical and immediately actionable
- Focus ONLY on observability/Phase 1 content

RESPONSE STRUCTURE (CONVERSATIONAL):
1. Brief greeting acknowledging their current progress (if any)
2. Identify which step they need next (or Step 1 if starting)
3. Provide detailed instructions for THAT ONE step only
4. Ask for confirmation when they complete it before moving to next step

CRITICAL: You MUST include complete code examples that users can copy-paste and adapt to their specific use case. Don't just mention the functions, show them how to use them in a complete workflow.

`;

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

DOCUMENTATION CONTEXT: ${evaluationContext} (THIS IS THE WHOLE CONTEXT OF THE KNOWLEDGE BASE, INSIDE INCLUDES THE EVALUATION SECTION)



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

DOCUMENTATION CONTEXT ${optimizationContext}, (THIS IS THE WHOLE CONTEXT OF THE KNOWLEDGE BASE, INSIDE INCLUDES THE SELF-IMPROVING SECTION)


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
3. Mentions what you CAN help with (setup, explore features, integration, etc.)
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
- Prompt optimization
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