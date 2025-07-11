/**
 * Professional Multi-Node Agentic System for Handit.ai
 * Uses multiple LLM nodes with comprehensive prompts
 * Responds only with Pinecone context and user conversation history
 * @module services/agenticSystem
 */

const { aiService } = require('./aiService');
const ConversationService = require('./conversationService');

class AgenticSystem {
    constructor() {
        this.conversationService = new ConversationService();
        this.sessionData = new Map();
    }

    /**
     * Main agentic processing with multiple LLM nodes
     * @param {string} userMessage - User input
     * @param {string} sessionId - Session identifier
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Multi-node processed response
     */
    async processUserInput(userMessage, sessionId, options = {}) {
        try {
            console.log(`🧠 Starting multi-node agentic processing for session: ${sessionId}`);
            
            // Store intermediate LLM responses
            const intermediateResponses = {};
            
            // Node 1: Context Analysis and Extraction
            const { contextData, llmResponse: node1Response } = await this.nodeContextAnalysis(userMessage, sessionId);
            intermediateResponses.node1_context_analysis = node1Response;
            
            // Node 2: Intent Classification and Planning
            const { intentPlan, llmResponse: node2Response } = await this.nodeIntentPlanning(userMessage, contextData, sessionId);
            intermediateResponses.node2_intent_planning = node2Response;
            
            // Node 3: Knowledge Synthesis 
            const { synthesizedKnowledge, llmResponse: node3Response } = await this.nodeKnowledgeSynthesis(contextData, intentPlan, sessionId);
            intermediateResponses.node3_knowledge_synthesis = node3Response;
            
            // Node 4: Response Generation
            const finalResponse = await this.nodeResponseGeneration(userMessage, synthesizedKnowledge, intentPlan, contextData, sessionId);
            intermediateResponses.node4_response_generation = finalResponse.llmResponse;
            
            // Add intermediate responses to final response
            finalResponse.intermediateResponses = intermediateResponses;
            
            // Update session data
            this.updateSessionData(sessionId, finalResponse, userMessage);
            
            console.log(`✅ Multi-node processing completed for session: ${sessionId}`);
            return finalResponse;
            
        } catch (error) {
            console.error('❌ Error in multi-node agentic system:', error);
            throw error;
        }
    }

    /**
     * Node 1: Context Analysis and Extraction
     * Analyzes user message and extracts relevant context from Pinecone and conversation history
     */
    async nodeContextAnalysis(userMessage, sessionId) {
        try {
            console.log('🔍 Node 1: Context Analysis and Extraction');
            
            // Get Pinecone context
            const relevantDocs = await aiService.searchRelevantDocuments(userMessage, {
                topK: 5,
                minScore: 0.7
            });

            // Get conversation history
            const conversationHistory = await this.conversationService.getConversationHistory(sessionId, 6);
            
            // Get session data
            const sessionInfo = this.sessionData.get(sessionId) || {};

            // Node 1 LLM: Context Analysis
            const contextAnalysisPrompt = `You are an expert context analyzer for Handit.ai documentation and user conversations.

TASK: Analyze the user message and available context to extract the most relevant information.

USER MESSAGE: "${userMessage}"

AVAILABLE HANDIT.AI DOCUMENTATION (${relevantDocs.length} documents):
${relevantDocs.map((doc, i) => `
DOCUMENT ${i + 1} (Relevance: ${doc.score.toFixed(2)}):
${doc.text}
---`).join('\n')}

CONVERSATION HISTORY (${conversationHistory.messages?.length || 0} messages):
${conversationHistory.messages?.map(msg => `${msg.role}: ${msg.content}`).join('\n') || 'No previous conversation'}

CURRENT SESSION DATA:
- Programming Language: ${sessionInfo.programmingLanguage || 'unknown'}
- Framework: ${sessionInfo.framework || 'unknown'}
- Environment: ${sessionInfo.environment || 'unknown'}
- Previous Context: ${sessionInfo.previousContext || 'none'}

INSTRUCTIONS:
1. Extract the most relevant documentation snippets that directly relate to the user's question
2. Identify key technical context from conversation history
3. Determine what programming/technical context is available
4. Filter out irrelevant information
5. Prioritize accuracy and relevance over completeness

RESPONSE FORMAT (JSON):
{
  "relevantDocumentation": [
    {
      "content": "specific relevant text",
      "relevanceScore": 0.95,
      "category": "setup|integration|troubleshooting|features"
    }
  ],
  "conversationContext": {
    "technicalStack": "detected from history",
    "previousQuestions": ["list of related previous questions"],
    "userKnowledgeLevel": "beginner|intermediate|advanced",
    "setupStage": "initial|in-progress|advanced"
  },
  "contextQuality": {
    "documentationRelevance": "high|medium|low",
    "conversationRelevance": "high|medium|low",
    "sufficientInfo": true/false
  }
}

CRITICAL RULES:
- Only include documentation that DIRECTLY relates to the user's question
- Be extremely selective with relevance
- Preserve exact technical details and code examples
- Maintain context accuracy`;

            const contextAnalysisResponse = await aiService.generateResponse(contextAnalysisPrompt, {
                language: 'en',
                sessionId: sessionId,
                skipRAG: true,
                maxTokens: 1200
            });

            // Log Node 1 response
            console.log('📊 Node 1 LLM Response:', JSON.stringify(contextAnalysisResponse, null, 2));

            let contextData;
            try {
                contextData = JSON.parse(contextAnalysisResponse.answer);
            } catch (error) {
                console.warn('Context analysis JSON parse failed, using fallback');
                contextData = {
                    relevantDocumentation: relevantDocs.slice(0, 3).map(doc => ({
                        content: doc.text,
                        relevanceScore: doc.score,
                        category: "general"
                    })),
                    conversationContext: {
                        technicalStack: sessionInfo.programmingLanguage || "unknown",
                        previousQuestions: [],
                        userKnowledgeLevel: "intermediate",
                        setupStage: "initial"
                    },
                    contextQuality: {
                        documentationRelevance: "medium",
                        conversationRelevance: "medium", 
                        sufficientInfo: relevantDocs.length > 0
                    }
                };
            }

            contextData.rawDocs = relevantDocs;
            contextData.sessionInfo = sessionInfo;
            
            return { 
                contextData, 
                llmResponse: contextAnalysisResponse 
            };

        } catch (error) {
            console.error('Error in Node 1 Context Analysis:', error);
            throw error;
        }
    }

    /**
     * Node 2: Intent Classification and Planning
     * Determines user intent and creates response strategy
     */
    async nodeIntentPlanning(userMessage, contextData, sessionId) {
        try {
            console.log('🎯 Node 2: Intent Classification and Planning');

            const intentPlanningPrompt = `You are an expert intent classifier and response planner for Handit.ai support.

TASK: Analyze user intent and create a strategic response plan based on available context.

USER MESSAGE: "${userMessage}"

AVAILABLE CONTEXT QUALITY:
- Documentation Relevance: ${contextData.contextQuality.documentationRelevance}
- Conversation Relevance: ${contextData.contextQuality.conversationRelevance}
- Sufficient Information: ${contextData.contextQuality.sufficientInfo}

USER TECHNICAL CONTEXT:
- Technical Stack: ${contextData.conversationContext.technicalStack}
- Knowledge Level: ${contextData.conversationContext.userKnowledgeLevel}
- Setup Stage: ${contextData.conversationContext.setupStage}

RELEVANT DOCUMENTATION AVAILABLE:
${contextData.relevantDocumentation.map((doc, i) => `${i + 1}. ${doc.category}: ${doc.content.substring(0, 200)}...`).join('\n')}

INSTRUCTIONS:
1. Classify the user's primary intent
2. Determine if we have sufficient context to provide a complete answer
3. Plan the response strategy based on available information
4. Identify what type of response would be most helpful
5. Consider the user's technical level and context

RESPONSE FORMAT (JSON):
{
  "primaryIntent": "setup|configuration|troubleshooting|integration|explanation|other",
  "intentConfidence": 0.95,
  "responseStrategy": "direct_answer|guided_questions|step_by_step|code_example|conceptual_explanation",
  "canProvideCompleteAnswer": true/false,
  "reasoningChain": [
    "step 1 of reasoning",
    "step 2 of reasoning", 
    "conclusion"
  ],
  "requiredResponseElements": [
    "technical_explanation",
    "code_examples", 
    "step_by_step_instructions",
    "troubleshooting_tips"
  ],
  "contextualFactors": {
    "userTechnicalLevel": "beginner|intermediate|advanced",
    "hasRelevantDocs": true/false,
    "needsAdditionalInfo": true/false,
    "responseComplexity": "simple|moderate|complex"
  }
}

CRITICAL RULES:
- Base decisions ONLY on available Handit.ai documentation
- Consider user's technical context from conversation history
- Be honest about information gaps
- Prioritize accuracy over completeness`;

            const intentResponse = await aiService.generateResponse(intentPlanningPrompt, {
                language: 'en',
                sessionId: sessionId,
                skipRAG: true,
                maxTokens: 800
            });

            // Log Node 2 response
            console.log('🎯 Node 2 LLM Response:', JSON.stringify(intentResponse, null, 2));

            let intentPlan;
            try {
                intentPlan = JSON.parse(intentResponse.answer);
            } catch (error) {
                console.warn('Intent planning JSON parse failed, using fallback');
                intentPlan = {
                    primaryIntent: "setup",
                    intentConfidence: 0.7,
                    responseStrategy: "direct_answer",
                    canProvideCompleteAnswer: contextData.contextQuality.sufficientInfo,
                    reasoningChain: ["User asked about Handit.ai", "We have documentation", "Can provide answer"],
                    requiredResponseElements: ["technical_explanation"],
                    contextualFactors: {
                        userTechnicalLevel: contextData.conversationContext.userKnowledgeLevel,
                        hasRelevantDocs: contextData.relevantDocumentation.length > 0,
                        needsAdditionalInfo: false,
                        responseComplexity: "moderate"
                    }
                };
            }

            return { 
                intentPlan, 
                llmResponse: intentResponse 
            };

        } catch (error) {
            console.error('Error in Node 2 Intent Planning:', error);
            throw error;
        }
    }

    /**
     * Node 3: Knowledge Synthesis
     * Synthesizes relevant information into coherent knowledge base
     */
    async nodeKnowledgeSynthesis(contextData, intentPlan, sessionId) {
        try {
            console.log('🧩 Node 3: Knowledge Synthesis');

            const knowledgeSynthesisPrompt = `You are an expert knowledge synthesizer for Handit.ai documentation and user context.

TASK: Synthesize all relevant information into a coherent knowledge base for response generation.

USER INTENT: ${intentPlan.primaryIntent}
RESPONSE STRATEGY: ${intentPlan.responseStrategy}
REQUIRED ELEMENTS: ${intentPlan.requiredResponseElements.join(', ')}

RELEVANT HANDIT.AI DOCUMENTATION:
${contextData.relevantDocumentation.map((doc, i) => `
DOCUMENT ${i + 1} (${doc.category}):
${doc.content}
---`).join('\n')}

USER TECHNICAL CONTEXT:
- Technical Stack: ${contextData.conversationContext.technicalStack}
- Knowledge Level: ${contextData.conversationContext.userKnowledgeLevel}
- Setup Stage: ${contextData.conversationContext.setupStage}
- Previous Questions: ${contextData.conversationContext.previousQuestions.join(', ') || 'none'}

INSTRUCTIONS:
1. Extract and organize the most relevant information for the user's specific intent
2. Synthesize documentation into actionable knowledge
3. Adapt information to user's technical level and context
4. Prepare structured information for response generation
5. Ensure all information is from provided Handit.ai documentation

RESPONSE FORMAT (JSON):
{
  "synthesizedKnowledge": {
    "coreAnswer": "main answer based on documentation",
    "technicalDetails": [
      {
        "concept": "specific concept",
        "explanation": "explanation from docs",
        "codeExample": "relevant code if available",
        "applicableFrameworks": ["list of frameworks this applies to"]
      }
    ],
    "stepByStepGuide": [
      {
        "step": 1,
        "action": "specific action", 
        "details": "detailed explanation",
        "codeSnippet": "code if applicable"
      }
    ],
    "contextualNotes": [
      "note specific to user's tech stack",
      "consideration for their knowledge level"
    ]
  },
  "knowledgeGaps": [
    "information not available in documentation",
    "areas requiring clarification"
  ],
  "confidenceLevel": 0.95,
  "informationSources": [
    "specific documentation sections used"
  ]
}

CRITICAL RULES:
- Use ONLY information from provided Handit.ai documentation
- Adapt complexity to user's knowledge level
- Be specific and actionable
- Acknowledge any information gaps honestly
- Maintain technical accuracy`;

            const synthesisResponse = await aiService.generateResponse(knowledgeSynthesisPrompt, {
                language: 'en',
                sessionId: sessionId,
                skipRAG: true,
                maxTokens: 1500
            });

            // Log Node 3 response
            console.log('🧩 Node 3 LLM Response:', JSON.stringify(synthesisResponse, null, 2));

            let synthesizedKnowledge;
            try {
                synthesizedKnowledge = JSON.parse(synthesisResponse.answer);
            } catch (error) {
                console.warn('Knowledge synthesis JSON parse failed, using fallback');
                synthesizedKnowledge = {
                    synthesizedKnowledge: {
                        coreAnswer: "Based on the available Handit.ai documentation...",
                        technicalDetails: [],
                        stepByStepGuide: [],
                        contextualNotes: []
                    },
                    knowledgeGaps: [],
                    confidenceLevel: 0.7,
                    informationSources: ["Handit.ai documentation"]
                };
            }

            return { 
                synthesizedKnowledge, 
                llmResponse: synthesisResponse 
            };

        } catch (error) {
            console.error('Error in Node 3 Knowledge Synthesis:', error);
            throw error;
        }
    }

    /**
     * Node 4: Response Generation
     * Generates final user-facing response in user's detected language
     */
    async nodeResponseGeneration(userMessage, synthesizedKnowledge, intentPlan, contextData, sessionId) {
        try {
            console.log('💬 Node 4: Response Generation');

            const responseGenerationPrompt = `You are an expert Handit.ai assistant providing final responses to users in their native language.

TASK: Detect the user's language and generate ONLY the final answer text (not JSON) in that SAME language based on synthesized knowledge.

USER QUESTION: "${userMessage}"

SYNTHESIZED KNOWLEDGE:
Core Answer: ${synthesizedKnowledge.synthesizedKnowledge.coreAnswer}

Technical Details:
${synthesizedKnowledge.synthesizedKnowledge.technicalDetails.map((detail, i) => `
${i + 1}. ${detail.concept}: ${detail.explanation}
   Code Example: ${detail.codeExample || 'none'}
   Frameworks: ${detail.applicableFrameworks?.join(', ') || 'general'}`).join('\n')}

Step-by-Step Guide:
${synthesizedKnowledge.synthesizedKnowledge.stepByStepGuide.map((step, i) => `
${step.step}. ${step.action}
   Details: ${step.details}
   Code: ${step.codeSnippet || 'none'}`).join('\n')}

Contextual Notes:
${synthesizedKnowledge.synthesizedKnowledge.contextualNotes.join('\n')}

Knowledge Gaps: ${synthesizedKnowledge.knowledgeGaps.join(', ') || 'none'}

RESPONSE STRATEGY: ${intentPlan.responseStrategy}
USER TECHNICAL LEVEL: ${intentPlan.contextualFactors.userTechnicalLevel}
RESPONSE COMPLEXITY: ${intentPlan.contextualFactors.responseComplexity}

INSTRUCTIONS:
1. DETECT the user's language from their question and respond in that SAME language
2. Use ONLY the provided synthesized knowledge
3. Structure response according to the strategy (${intentPlan.responseStrategy})
4. Adapt language complexity to user's technical level
5. Include relevant code examples if available
6. Be honest about any knowledge gaps
7. Provide actionable, specific guidance
8. Return ONLY the final answer text, NOT JSON format

CRITICAL RULES:
- DETECT user's language and respond in that SAME language (Spanish if Spanish, English if English, etc.)
- Use ONLY information from synthesized knowledge
- Include proper Markdown formatting for code blocks
- Be specific and actionable
- Acknowledge limitations honestly
- Structure for clarity and readability
- DO NOT return JSON, return ONLY the final answer text`;

            const finalResponse = await aiService.generateResponse(responseGenerationPrompt, {
                language: 'auto', // Let LLM detect user's language
                sessionId: sessionId,
                skipRAG: true
                // Removed maxTokens limit for unlimited response
            });

            // Log Node 4 response
            console.log('💬 Node 4 LLM Response:', JSON.stringify(finalResponse, null, 2));

            // Build complete response object with all Pinecone documents as sources
            const response = {
                answer: finalResponse.answer, // Only the final text answer
                confidence: synthesizedKnowledge.confidenceLevel || 0.8,
                sources: contextData.rawDocs || [], // All Pinecone documents
                totalSources: contextData.rawDocs?.length || 0,
                sessionId: sessionId,
                requiresUserInput: false,
                nextAction: 'complete',
                technicalContext: {
                    detectedLanguage: intentPlan.contextualFactors?.detectedLanguage || "unknown",
                    detectedFramework: intentPlan.contextualFactors?.detectedFramework || "unknown",
                    applicableScenarios: ["Handit.ai documentation assistance"]
                },
                responseMetadata: {
                    answerType: intentPlan.canProvideCompleteAnswer ? "complete" : "partial",
                    coverageLevel: intentPlan.contextualFactors.responseComplexity || "moderate",
                    includesCodeExamples: synthesizedKnowledge.synthesizedKnowledge.technicalDetails?.some(d => d.codeExample) || false,
                    includesStepByStep: synthesizedKnowledge.synthesizedKnowledge.stepByStepGuide?.length > 0 || false,
                    detectedUserLanguage: "auto-detected"
                },
                llmResponse: finalResponse // Store Node 4 LLM response
            };

            return response;

        } catch (error) {
            console.error('Error in Node 4 Response Generation:', error);
            throw error;
        }
    }

    /**
     * Update session data based on multi-node processing
     */
    updateSessionData(sessionId, response, userMessage) {
        const sessionInfo = this.sessionData.get(sessionId) || {};
        
        // Update with detected technical context
        if (response.technicalContext) {
            if (response.technicalContext.detectedLanguage) {
                sessionInfo.programmingLanguage = response.technicalContext.detectedLanguage;
            }
            if (response.technicalContext.detectedFramework) {
                sessionInfo.framework = response.technicalContext.detectedFramework;
            }
        }
        
        sessionInfo.lastMessage = userMessage;
        sessionInfo.lastResponse = response.answer;
        sessionInfo.lastUpdated = new Date().toISOString();
        sessionInfo.processingNodes = 4;
        
        this.sessionData.set(sessionId, sessionInfo);
    }
}

module.exports = AgenticSystem; 