/**
 * Evaluator Connection Service
 * Handles the multi-step flow for connecting evaluators to models
 * @module services/evaluatorConnectionService
 */

const { aiService } = require('./aiService');

class EvaluatorConnectionService {
    constructor(apiService) {
        this.apiService = apiService;
        // Store conversation states for multi-step flows
        this.conversationStates = new Map();
    }

    /**
     * Check if user is requesting evaluator connection (for NEW flows only)
     * @param {string} userMessage - User's message
     * @param {Object} conversationHistory - Conversation history
     * @returns {Promise<Object>} Detection result
     */
    async detectEvaluatorConnectionRequest(userMessage, conversationHistory) {
        const detectionPrompt = `Analyze if the user is requesting to START a NEW evaluator connection process for their AI agent/model.

USER MESSAGE: "${userMessage}"

CONVERSATION CONTEXT: ${conversationHistory.messages?.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n') || 'No context'}

INITIAL EVALUATOR CONNECTION INDICATORS:
- "connect evaluators"
- "associate evaluators" 
- "set up evaluators"
- "add evaluators to my model"
- "configure evaluation"
- "enable evaluation"
- "attach evaluators"
- "I want to connect/associate evaluators"

NOT EVALUATOR CONNECTION REQUESTS (these are flow responses):
- "create a new token" (user responding to token selection)
- "use existing" (user responding to token selection)
- "all evaluators" (user selecting evaluators)
- "yes" / "no" / "continue" (flow responses)
- specific names of tokens/providers/evaluators (flow responses)

TASK: Only detect INITIAL requests to start evaluator connection, NOT responses within an existing flow.

Return JSON:
{
  "isEvaluatorRequest": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

        try {
            const response = await aiService.generateResponse(detectionPrompt, { maxTokens: 200 });
            const result = JSON.parse(response.answer.match(/\{[\s\S]*\}/)?.[0] || '{"isEvaluatorRequest": false, "confidence": 0.0, "reasoning": "Parse error"}');
            return result;
        } catch (error) {
            console.error('Error detecting evaluator connection request:', error);
            return { isEvaluatorRequest: false, confidence: 0.0, reasoning: "Detection error" };
        }
    }

    /**
     * Start the evaluator connection flow
     * @param {string} sessionId - Session identifier
     * @param {string} userApiToken - User's API token
     * @returns {Promise<Object>} Flow response
     */
    async startEvaluatorConnectionFlow(sessionId, userApiToken) {
        try {
            console.log(`🔗 Starting evaluator connection flow for session: ${sessionId}`);
            
            // Step 1: Get available evaluators first
            const evaluatorsResult = await this.apiService.executeAction('get_evaluation_prompts', {}, userApiToken);
            
            if (!evaluatorsResult.success) {
                return {
                    answer: `I encountered an error getting available evaluators: ${evaluatorsResult.error}. Please make sure you have the correct API access.`,
                    success: false,
                    step: 'error'
                };
            }

            const evaluators = evaluatorsResult.data.data || [];
            
            // Store state for this conversation
            this.conversationStates.set(sessionId, {
                step: 'evaluator_selection',
                availableEvaluators: evaluators,
                userApiToken: userApiToken
            });

            console.log(`🎯 Found ${evaluators.length} available evaluators, generating AI response...`);

            // Use AI to generate intelligent response for evaluator selection
            return await this.generateInitialEvaluatorSelectionResponse(evaluators, sessionId);

        } catch (error) {
            console.error('Error starting evaluator connection flow:', error);
            return {
                answer: "I encountered an error starting the evaluator connection process. Please try again.",
                success: false,
                step: 'error'
            };
        }
    }

    /**
     * Generate AI-driven response for initial evaluator selection
     * @param {Array} evaluators - Available evaluators
     * @param {string} sessionId - Session identifier
     * @returns {Promise<Object>} AI-generated response
     */
    async generateInitialEvaluatorSelectionResponse(evaluators, sessionId) {
        try {
            console.log(`🤖 Generating AI response for ${evaluators.length} evaluators`);
            
            const evaluatorsContext = evaluators.length > 0 
                ? evaluators.map(evaluator => `- ${evaluator.name || evaluator.title}: ${evaluator.description || 'Evaluation tool'}`).join('\n')
                : 'No evaluators found';

            const aiPrompt = `You are helping a user associate evaluators with their AI models. Start by helping them select an evaluator.

AVAILABLE EVALUATORS:
${evaluatorsContext}

CONTEXT: The user wants to associate evaluators with their AI models. They need to first choose which evaluator to work with.

TASK: Generate a brief response that:
1. Acknowledges their request to associate evaluators
2. Explains they need to select an evaluator first
3. Lists the available evaluators clearly
4. Offers the option to create a new evaluator or edit existing ones
5. Asks them to choose an evaluator or let you know if they want to create/edit

GUIDELINES:
- Be helpful but very concise
- Keep explanations brief and to the point
- Make it conversational but brief
- Mention they can also create new or edit existing evaluators

Generate a brief evaluator selection response:`;

            const response = await aiService.generateResponse(aiPrompt, { maxTokens: 200 });

            console.log(`✅ Generated AI evaluator response: ${response.answer.substring(0, 100)}...`);

            return {
                answer: response.answer,
                success: true,
                step: 'evaluator_selection',
                availableEvaluators: evaluators,
                customAction: 'evaluator_management' // Signal to frontend for create/edit options
            };

        } catch (error) {
            console.error('Error generating evaluator selection response:', error);
            return {
                answer: "I'm ready to help you associate evaluators with your models. Please choose an evaluator from the available options, or let me know if you'd like to create a new one or edit an existing evaluator.",
                success: true,
                step: 'evaluator_selection',
                availableEvaluators: evaluators,
                customAction: 'evaluator_management'
            };
        }
    }

    /**
     * Generate AI-driven response for token selection
     * @param {Array} existingTokens - Existing integration tokens
     * @param {string} sessionId - Session identifier
     * @returns {Promise<Object>} AI-generated response
     */
    async generateAITokenResponse(existingTokens, sessionId) {
        try {
            console.log(`🤖 Generating AI response for ${existingTokens.length} existing tokens`);
            
            const tokenContext = existingTokens.length > 0 
                ? existingTokens.map(token => `- ${token.name} (Provider: ${token.provider?.name || 'Unknown'}, Status: ${token.status || 'Active'})`).join('\n')
                : 'No existing integration tokens found';

            const aiPrompt = `You are helping a user connect evaluators to their AI models. You need to guide them through the token selection process.

EXISTING INTEGRATION TOKENS:
${tokenContext}

CONTEXT: The user wants to connect evaluators to their AI agent. To do this, they need an integration token to authenticate with the evaluation service.

TASK: Generate a helpful response that:
1. Acknowledges their request to connect evaluators
2. Explains the current token situation
3. Guides them on next steps clearly

GUIDELINES:
- Be conversational but concise
- Explain why tokens are needed for evaluator connection
- If tokens exist, suggest using them or creating new ones
- If no tokens exist, guide them to create one
- Ask what they'd prefer to do next

Generate a helpful, conversational response:`;

            const response = await aiService.generateResponse(aiPrompt, { maxTokens: 300 });

            console.log(`✅ Generated AI token response: ${response.answer.substring(0, 100)}...`);

            return {
                answer: response.answer,
                success: true,
                step: 'token_selection',
                existingTokens: existingTokens
            };

        } catch (error) {
            console.error('Error generating AI token response:', error);
            return {
                answer: "I'm ready to help you connect evaluators to your models. Let me know how you'd like to proceed with the integration tokens.",
                success: true,
                step: 'token_selection',
                existingTokens: existingTokens
            };
        }
    }

    /**
     * Handle token selection step using AI
     * @param {string} sessionId - Session identifier
     * @param {string} userResponse - User's response
     * @returns {Promise<Object>} Flow response
     */
    async handleTokenSelection(sessionId, userResponse) {
        const state = this.conversationStates.get(sessionId);
        if (!state || state.step !== 'token_selection') {
            return { answer: "I lost track of our conversation. Let's start over with connecting evaluators.", success: false };
        }

        try {
            console.log(`🎯 Processing token selection response: "${userResponse}"`);
            console.log(`📋 Available tokens: ${state.existingTokens?.length || 0}`);
            
            // Use AI to understand user intent
            const intentAnalysis = await this.analyzeUserTokenIntent(userResponse, state.existingTokens);
            
            console.log('🧠 Token intent analysis:', JSON.stringify(intentAnalysis, null, 2));

            if (intentAnalysis.action === 'create_new') {
                return await this.startTokenCreation(sessionId);
            } else if (intentAnalysis.action === 'use_existing') {
                if (intentAnalysis.selectedTokenIndex !== null) {
                    // User specified a specific token
                    state.selectedToken = state.existingTokens[intentAnalysis.selectedTokenIndex];
                    this.conversationStates.set(sessionId, state);
                    return await this.proceedToEvaluatorSelection(sessionId);
                } else if (state.existingTokens.length === 1) {
                    // Only one token available
                    state.selectedToken = state.existingTokens[0];
                    this.conversationStates.set(sessionId, state);
                    return await this.proceedToEvaluatorSelection(sessionId);
                } else {
                    // Ask user to clarify which token
                    return await this.generateTokenClarificationResponse(state.existingTokens, userResponse);
                }
            } else if (intentAnalysis.action === 'unclear') {
                // AI couldn't understand, ask for clarification
                return await this.generateTokenClarificationResponse(state.existingTokens, userResponse);
            }

        } catch (error) {
            console.error('Error in AI token selection:', error);
            return {
                answer: "I had trouble understanding your preference. Could you let me know if you'd like to use one of your existing tokens or create a new one?",
                success: true,
                step: 'token_selection'
            };
        }
    }

    /**
     * Analyze user intent for token selection using AI
     * @param {string} userResponse - User's response
     * @param {Array} existingTokens - Available tokens
     * @returns {Promise<Object>} Intent analysis
     */
    async analyzeUserTokenIntent(userResponse, existingTokens) {
        try {
            const tokensContext = existingTokens.map((token, index) => 
                `${index}: ${token.name} (${token.provider || 'Unknown provider'})`
            ).join('\n');

            const intentPrompt = `Analyze the user's response to understand their intent for token selection.

USER RESPONSE: "${userResponse}"

AVAILABLE TOKENS:
${tokensContext}

POSSIBLE ACTIONS:
1. "create_new" - User wants to create a new integration token
2. "use_existing" - User wants to use an existing token
3. "unclear" - User's intent is not clear

TASK: Determine the user's intent and extract any specific token selection.

RESPONSE FORMAT (JSON):
{
  "action": "create_new|use_existing|unclear",
  "selectedTokenIndex": null_or_number,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

EXAMPLES:
- "create a new one" → {"action": "create_new", "selectedTokenIndex": null}
- "use the first one" → {"action": "use_existing", "selectedTokenIndex": 0}
- "production token" → {"action": "use_existing", "selectedTokenIndex": token_index_if_found}
- "existing" → {"action": "use_existing", "selectedTokenIndex": null}
- "I don't know" → {"action": "unclear", "selectedTokenIndex": null}

Return ONLY valid JSON:`;

            const response = await aiService.generateResponse(intentPrompt, { maxTokens: 200 });
            const result = JSON.parse(response.answer.match(/\{[\s\S]*\}/)?.[0] || '{"action": "unclear", "selectedTokenIndex": null, "confidence": 0.0, "reasoning": "Parse error"}');
            
            return result;

        } catch (error) {
            console.error('Error analyzing token intent:', error);
            return { action: 'unclear', selectedTokenIndex: null, confidence: 0.0, reasoning: 'Analysis error' };
        }
    }

    /**
     * Generate AI clarification response for token selection
     * @param {Array} existingTokens - Available tokens
     * @param {string} userResponse - User's previous response
     * @returns {Promise<Object>} Clarification response
     */
    async generateTokenClarificationResponse(existingTokens, userResponse) {
        try {
            const tokensContext = existingTokens.map(token => 
                `- ${token.name} (${token.provider || 'Unknown provider'})`
            ).join('\n');

            const clarificationPrompt = `The user gave an unclear response about token selection. Generate a helpful clarification request.

USER'S PREVIOUS RESPONSE: "${userResponse}"

AVAILABLE TOKENS:
${tokensContext}

TASK: Generate a natural, conversational response that:
1. Acknowledges their response
2. Gently asks for clarification
3. Mentions the available options without being rigid
4. Keeps the conversation flowing naturally

GUIDELINES:
- Be friendly and understanding
- Don't repeat numbered lists
- Make it conversational
- Guide them naturally to make a choice

Generate a helpful clarification response:`;

            const response = await aiService.generateResponse(clarificationPrompt, { maxTokens: 200 });

            return {
                answer: response.answer,
                success: true,
                step: 'token_selection'
            };

        } catch (error) {
            console.error('Error generating clarification response:', error);
            return {
                answer: "I want to make sure I understand correctly. Would you like to use one of your existing integration tokens, or would you prefer to create a new one?",
                success: true,
                step: 'token_selection'
            };
        }
    }

    /**
     * Start token creation process
     * @param {string} sessionId - Session identifier
     * @returns {Promise<Object>} Flow response
     */
    async startTokenCreation(sessionId) {
        const state = this.conversationStates.get(sessionId);
        
        try {
            // Get available providers
            const providersResult = await this.apiService.executeAction('get_providers', {}, state.userApiToken);
            console.log("providersResult", providersResult);
            if (!providersResult.success) {
                return {
                    answer: `I couldn't get the list of available providers: ${providersResult.error}`,
                    success: false
                };
            }

            const providers = providersResult.data.data || [];
            if (providers.length === 0) {
                return {
                    answer: "No providers are available at the moment. Please contact support.",
                    success: false
                };
            }

            // Update state
            state.step = 'provider_selection';
            state.providers = providers;
            state.tokenCreation = {};
            this.conversationStates.set(sessionId, state);
            console.log("providers", providers);

            // Use AI to generate natural provider selection response
            return await this.generateProviderSelectionResponse(providers, sessionId);

        } catch (error) {
            console.error('Error starting token creation:', error);
            return {
                answer: "I encountered an error starting the token creation process. Please try again.",
                success: false
            };
        }
    }

    /**
     * Generate AI-driven response for provider selection
     * @param {Array} providers - Available providers
     * @param {string} sessionId - Session identifier
     * @returns {Promise<Object>} AI-generated response
     */
    async generateProviderSelectionResponse(providers, sessionId) {
        try {
            console.log(`🤖 Generating AI response for ${providers.length} providers`);
            
            const providersContext = providers.map(provider => 
                `- ${provider.name}: ${provider.description || 'Integration provider'}`
            ).join('\n');

            const aiPrompt = `You are helping a user create a new integration token. They need to choose a provider for the token.

AVAILABLE PROVIDERS:
${providersContext}

CONTEXT: The user has decided to create a new integration token and now needs to select which provider/service they want to create the token for.

TASK: Generate a concise response that:
1. Acknowledges they're creating a new token
2. Explains what providers are briefly
3. Lists the available providers clearly
4. Asks them to choose which provider they want

GUIDELINES:
- Be helpful but concise
- Explain that providers are the services they want to integrate with
- Make it conversational and clear
- Ask them to mention the provider name they prefer

Generate a helpful provider selection response:`;

            const response = await aiService.generateResponse(aiPrompt, { maxTokens: 300 });

            console.log(`✅ Generated AI provider response: ${response.answer.substring(0, 100)}...`);

            return {
                answer: response.answer,
                success: true,
                step: 'provider_selection',
                providers: providers
            };

        } catch (error) {
            console.error('Error generating provider selection response:', error);
            return {
                answer: `Perfect! Now I need to know which provider you'd like to create the token for. I have ${providers.length} providers available. Which one would you like to use?`,
                success: true,
                step: 'provider_selection',
                providers: providers
            };
        }
    }

    /**
     * Handle provider selection using AI
     * @param {string} sessionId - Session identifier
     * @param {string} userResponse - User's response
     * @returns {Promise<Object>} Flow response
     */
    async handleProviderSelection(sessionId, userResponse) {
        const state = this.conversationStates.get(sessionId);
        if (!state || state.step !== 'provider_selection') {
            return { answer: "I lost track of our conversation. Let's start over.", success: false };
        }

        try {
            console.log(`🎯 Processing provider selection: "${userResponse}"`);
            console.log(`📋 Available providers: ${state.providers?.length || 0}`);

            // Use AI to understand which provider the user wants
            const providerAnalysis = await this.analyzeProviderSelection(userResponse, state.providers);
            
            console.log('🧠 Provider selection analysis:', JSON.stringify(providerAnalysis, null, 2));

            if (!providerAnalysis.selectedProvider) {
                // AI couldn't identify clear selection, ask for clarification
                return await this.generateProviderClarificationResponse(userResponse, state.providers);
            }

            const selectedProvider = providerAnalysis.selectedProvider;
            state.tokenCreation.providerId = selectedProvider.id;
            state.tokenCreation.providerName = selectedProvider.name;
            state.step = 'token_name_input';
            this.conversationStates.set(sessionId, state);

            // Generate natural response about the selection
            return await this.generateTokenNamePromptResponse(selectedProvider);

        } catch (error) {
            console.error('Error in AI provider selection:', error);
            return {
                answer: "I had trouble understanding which provider you'd like to use. Could you tell me which specific provider you want to create the token for?",
                success: true,
                step: 'provider_selection'
            };
        }
    }

    /**
     * Analyze provider selection using AI
     * @param {string} userResponse - User's response
     * @param {Array} availableProviders - Available providers
     * @returns {Promise<Object>} Analysis result
     */
    async analyzeProviderSelection(userResponse, availableProviders) {
        try {
            const providersContext = availableProviders.map((provider, index) => 
                `${index}: ${provider.name} - ${provider.description || 'Integration provider'}`
            ).join('\n');

            const analysisPrompt = `Analyze the user's response to identify which provider they want to select for token creation.

USER RESPONSE: "${userResponse}"

AVAILABLE PROVIDERS:
${providersContext}

TASK: Identify which specific provider the user wants based on their response. They might mention:
- Provider names or partial names
- Service types or descriptions
- Keywords that match provider descriptions
- Company names or platform names

RESPONSE FORMAT (JSON):
{
  "selectedProvider": provider_object_or_null,
  "confidence": 0.0-1.0,
  "reasoning": "explanation of how selection was made"
}

EXAMPLES:
- "OpenAI" → find provider with OpenAI in name
- "I want to use Google" → find provider with Google in name
- "the first one" → select first provider
- "evaluation service" → find provider matching description

Return ONLY valid JSON with the actual provider object:`;

            const response = await aiService.generateResponse(analysisPrompt, { maxTokens: 400 });
            const result = JSON.parse(response.answer.match(/\{[\s\S]*\}/)?.[0] || '{"selectedProvider": null, "confidence": 0.0, "reasoning": "Parse error"}');
            
            // Validate and find the actual provider
            let selectedProvider = null;
            if (result.selectedProvider) {
                // Find matching provider by name, description, or index
                selectedProvider = availableProviders.find((provider, index) => 
                    index === result.selectedProvider.index ||
                    (provider.name || '').toLowerCase().includes((result.selectedProvider.name || '').toLowerCase()) ||
                    provider.id === result.selectedProvider.id ||
                    (userResponse.toLowerCase().includes(provider.name.toLowerCase()))
                );
            }
            
            return {
                selectedProvider: selectedProvider,
                confidence: result.confidence || 0.0,
                reasoning: result.reasoning || 'AI analysis'
            };

        } catch (error) {
            console.error('Error analyzing provider selection:', error);
            return { selectedProvider: null, confidence: 0.0, reasoning: 'Analysis error' };
        }
    }

    /**
     * Generate clarification response for provider selection
     * @param {string} userResponse - User's response
     * @param {Array} availableProviders - Available providers
     * @returns {Promise<Object>} Clarification response
     */
    async generateProviderClarificationResponse(userResponse, availableProviders) {
        try {
            const providersContext = availableProviders.map(provider => 
                `- ${provider.name}: ${provider.description || 'Integration provider'}`
            ).join('\n');

            const clarificationPrompt = `The user gave an unclear response about provider selection. Generate a helpful clarification.

USER'S RESPONSE: "${userResponse}"

AVAILABLE PROVIDERS:
${providersContext}

TASK: Generate a concise response that:
1. Acknowledges their response
2. Asks for clarification about which provider they want
3. Suggests they can mention provider names
4. Keeps it conversational

GUIDELINES:
- Be understanding and helpful
- Make it conversational but concise
- Give examples of how they can specify providers

Generate a helpful clarification response:`;

            const response = await aiService.generateResponse(clarificationPrompt, { maxTokens: 200 });

            return {
                answer: response.answer,
                success: true,
                step: 'provider_selection'
            };

        } catch (error) {
            console.error('Error generating provider clarification:', error);
            return {
                answer: "I want to make sure I select the right provider for you. Could you tell me which specific provider you'd like to create the token for? You can mention the provider name.",
                success: true,
                step: 'provider_selection'
            };
        }
    }

    /**
     * Generate natural response for token name prompt
     * @param {Object} selectedProvider - Selected provider
     * @returns {Promise<Object>} Token name prompt response
     */
    async generateTokenNamePromptResponse(selectedProvider) {
        try {
            const namePrompt = `Generate a natural response acknowledging the provider selection and asking for a token name.

SELECTED PROVIDER: ${selectedProvider.name} - ${selectedProvider.description || 'Integration provider'}

TASK: Generate a concise response that:
1. Acknowledges the provider selection
2. Explains what happens next (token name)
3. Gives helpful examples of good token names
4. Asks for the token name clearly

GUIDELINES:
- Be helpful and concise
- Make it conversational
- Give practical examples
- Keep it brief

Generate a helpful token name prompt:`;

            const response = await aiService.generateResponse(namePrompt, { maxTokens: 200 });

            return {
                answer: response.answer,
                success: true,
                step: 'token_name_input'
            };

        } catch (error) {
            console.error('Error generating token name prompt:', error);
            return {
                answer: `Perfect! You've selected ${selectedProvider.name}. Now I need a name for this integration token. What would you like to call it? (For example: "Production Token", "My Evaluation Token", or "${selectedProvider.name} Integration")`,
                success: true,
                step: 'token_name_input'
            };
        }
    }

    /**
     * Handle token name input using AI
     * @param {string} sessionId - Session identifier
     * @param {string} userResponse - User's response
     * @returns {Promise<Object>} Flow response
     */
    async handleTokenNameInput(sessionId, userResponse) {
        const state = this.conversationStates.get(sessionId);
        if (!state || state.step !== 'token_name_input') {
            return { answer: "I lost track of our conversation. Let's start over.", success: false };
        }

        try {
            console.log(`🎯 Processing token name input: "${userResponse}"`);
            console.log(`📋 Provider: ${state.tokenCreation.providerName}`);

            // Use AI to extract and validate token name
            const nameAnalysis = await this.analyzeTokenNameInput(userResponse, state.tokenCreation.providerName);
            
            console.log('🧠 Token name analysis:', JSON.stringify(nameAnalysis, null, 2));

            if (!nameAnalysis.extractedName) {
                // AI couldn't extract a valid name, ask for clarification
                return await this.generateTokenNameClarificationResponse(userResponse, state.tokenCreation.providerName);
            }

            // Store the extracted name and proceed
            state.tokenCreation.name = nameAnalysis.extractedName;
            state.step = 'token_value_input';
            this.conversationStates.set(sessionId, state);

            // Generate natural response asking for the token value
            return await this.generateTokenValuePromptResponse(nameAnalysis.extractedName, state.tokenCreation.providerName);

        } catch (error) {
            console.error('Error in AI token name input:', error);
            return {
                answer: "I had trouble understanding the token name. Could you tell me what you'd like to call this integration token?",
                success: true,
                step: 'token_name_input'
            };
        }
    }

    /**
     * Analyze token name input using AI
     * @param {string} userResponse - User's response
     * @param {string} providerName - Provider name for context
     * @returns {Promise<Object>} Analysis result
     */
    async analyzeTokenNameInput(userResponse, providerName) {
        try {
            const analysisPrompt = `Analyze the user's response to extract a suitable token name from their natural language input.

USER RESPONSE: "${userResponse}"
PROVIDER: ${providerName}

TASK: Extract a clean, meaningful token name from the user's response. They might say:
- Direct names: "Production Token", "My API Key", "Development Token"
- Conversational: "I'll call it my production token", "Let's name it dev-api-key"
- Descriptive: "Something for my production environment", "My main integration token"
- Simple: "production", "dev", "main"

RULES:
1. Extract the core name/identifier from their response
2. Clean it up (remove extra words like "I want to call it", "let's name it")
3. Ensure it's at least 3 characters long
4. Make it descriptive and professional
5. If they give a very short name, expand it appropriately

RESPONSE FORMAT (JSON):
{
  "extractedName": "cleaned_token_name_or_null",
  "confidence": 0.0-1.0,
  "reasoning": "explanation of extraction process"
}

EXAMPLES:
- "I want to call it my production token" → {"extractedName": "Production Token"}
- "dev api key" → {"extractedName": "Dev API Key"}
- "something for testing" → {"extractedName": "Testing Token"}
- "prod" → {"extractedName": "Production Token"}
- "main" → {"extractedName": "Main Integration Token"}

Return ONLY valid JSON:`;

            const response = await aiService.generateResponse(analysisPrompt, { maxTokens: 300 });
            const result = JSON.parse(response.answer.match(/\{[\s\S]*\}/)?.[0] || '{"extractedName": null, "confidence": 0.0, "reasoning": "Parse error"}');
            
            return result;

        } catch (error) {
            console.error('Error analyzing token name:', error);
            return { extractedName: null, confidence: 0.0, reasoning: 'Analysis error' };
        }
    }

    /**
     * Generate clarification response for token name
     * @param {string} userResponse - User's response
     * @param {string} providerName - Provider name
     * @returns {Promise<Object>} Clarification response
     */
    async generateTokenNameClarificationResponse(userResponse, providerName) {
        try {
            const clarificationPrompt = `The user gave an unclear response about token naming. Generate a helpful clarification.

USER'S RESPONSE: "${userResponse}"
PROVIDER: ${providerName}

TASK: Generate a concise response that:
1. Acknowledges their response
2. Asks for a clearer token name
3. Gives helpful examples specific to the provider
4. Keeps it conversational

GUIDELINES:
- Be understanding and helpful
- Give practical examples
- Make it conversational but concise
- Suggest meaningful names for the provider

Generate a helpful clarification response:`;

            const response = await aiService.generateResponse(clarificationPrompt, { maxTokens: 200 });

            return {
                answer: response.answer,
                success: true,
                step: 'token_name_input'
            };

        } catch (error) {
            console.error('Error generating token name clarification:', error);
            return {
                answer: `I want to make sure I give this ${providerName} token a good name. What would you like to call it? For example: "Production Token", "Development API", or "${providerName} Integration".`,
                success: true,
                step: 'token_name_input'
            };
        }
    }

    /**
     * Generate natural response asking for token value
     * @param {string} tokenName - Chosen token name
     * @param {string} providerName - Provider name
     * @returns {Promise<Object>} Token value prompt response
     */
    async generateTokenValuePromptResponse(tokenName, providerName) {
        try {
            const valuePrompt = `Generate a natural response acknowledging the token name and asking for the API token value.

TOKEN NAME: "${tokenName}"
PROVIDER: ${providerName}

TASK: Generate a concise response that:
1. Acknowledges the token name choice
2. Explains what they need to provide next (the actual API token)
3. Gives helpful context about where to find the token
4. Mentions security best practices briefly
5. Asks for the token value clearly

GUIDELINES:
- Be helpful and concise
- Make security feel natural, not scary
- Give practical guidance for finding the token
- Keep it conversational but brief

Generate a helpful token value request:`;

            const response = await aiService.generateResponse(valuePrompt, { maxTokens: 250 });

            return {
                answer: response.answer,
                success: true,
                step: 'token_value_input'
            };

        } catch (error) {
            console.error('Error generating token value prompt:', error);
            return {
                answer: `Perfect! I'll call it "${tokenName}". Now I need the actual API token from ${providerName}. Please share the token value (usually a long string starting with something like "sk-" or "api_"). Don't worry, this is secure and I'll handle it safely.`,
                success: true,
                step: 'token_value_input'
            };
        }
    }

    /**
     * Handle token value input using AI and create the token
     * @param {string} sessionId - Session identifier
     * @param {string} userResponse - User's response
     * @returns {Promise<Object>} Flow response
     */
    async handleTokenValueInput(sessionId, userResponse) {
        const state = this.conversationStates.get(sessionId);
        if (!state || state.step !== 'token_value_input') {
            return { answer: "I lost track of our conversation. Let's start over.", success: false };
        }

        try {
            console.log(`🎯 Processing token value input: "${userResponse.substring(0, 20)}..."`);
            console.log(`📋 Token name: ${state.tokenCreation.name}, Provider: ${state.tokenCreation.providerName}`);

            // Use AI to extract and validate the API token
            const tokenAnalysis = await this.analyzeTokenValueInput(userResponse, state.tokenCreation.providerName);
            
            console.log('🧠 Token value analysis:', JSON.stringify({
                hasExtractedToken: !!tokenAnalysis.extractedToken,
                confidence: tokenAnalysis.confidence,
                reasoning: tokenAnalysis.reasoning
            }, null, 2));

            if (!tokenAnalysis.extractedToken) {
                // AI couldn't extract a valid token, ask for clarification
                return await this.generateTokenValueClarificationResponse(userResponse, state.tokenCreation.providerName);
            }

            // Create the integration token
            const createResult = await this.apiService.executeAction('create_integration_token_new', {
                providerId: state.tokenCreation.providerId,
                name: state.tokenCreation.name,
                type: 'token',
                token: tokenAnalysis.extractedToken
            }, state.userApiToken);

            if (!createResult.success) {
                return await this.generateTokenCreationErrorResponse(createResult.error, state.tokenCreation.providerName);
            }

            // Store the created token and proceed
            state.selectedToken = createResult.data;
            console.log(`✅ Created integration token: ${state.tokenCreation.name}`);
            
            // After token creation, ask for provider model selection
            return await this.proceedToProviderModelSelection(sessionId);

        } catch (error) {
            console.error('Error in AI token value input:', error);
            return {
                answer: "I had trouble processing the API token. Could you share the token value again? It should be a long string from your provider.",
                success: true,
                step: 'token_value_input'
            };
        }
    }

    /**
     * Analyze token value input using AI
     * @param {string} userResponse - User's response
     * @param {string} providerName - Provider name for context
     * @returns {Promise<Object>} Analysis result
     */
    async analyzeTokenValueInput(userResponse, providerName) {
        try {
            const analysisPrompt = `Analyze the user's response to extract an API token from their natural language input.

USER RESPONSE: "${userResponse}"
PROVIDER: ${providerName}

TASK: Extract the actual API token from the user's response. They might say:
- Direct tokens: "sk-1234567890abcdef", "api_key_abc123xyz"
- Conversational: "Here's my token: sk-abc123", "The token is api_key_xyz"
- With context: "My API key from OpenAI is sk-...", "I got this from the dashboard: api_..."

TOKEN VALIDATION RULES:
1. Look for long strings (typically 20+ characters)
2. Common patterns: starts with "sk-", "api_", "key_", "ak_", etc.
3. Contains alphanumeric characters, possibly with dashes/underscores
4. Should be the longest meaningful string in the response
5. Exclude obvious non-tokens (URLs, explanations, etc.)

SECURITY NOTE: Extract only the token itself, no surrounding context.

RESPONSE FORMAT (JSON):
{
  "extractedToken": "actual_token_string_or_null",
  "confidence": 0.0-1.0,
  "reasoning": "explanation of extraction process"
}

EXAMPLES:
- "Here's my token: sk-1234567890abcdef" → {"extractedToken": "sk-1234567890abcdef"}
- "api_key_xyz123456789" → {"extractedToken": "api_key_xyz123456789"}
- "My key is abc123" → {"extractedToken": "abc123"}
- "I don't have it yet" → {"extractedToken": null}

Return ONLY valid JSON:`;

            const response = await aiService.generateResponse(analysisPrompt, { maxTokens: 300 });
            const result = JSON.parse(response.answer.match(/\{[\s\S]*\}/)?.[0] || '{"extractedToken": null, "confidence": 0.0, "reasoning": "Parse error"}');
            
            // Additional validation - ensure minimum length
            if (result.extractedToken && result.extractedToken.length < 10) {
                result.extractedToken = null;
                result.reasoning = "Token too short (minimum 10 characters required)";
                result.confidence = 0.0;
            }
            
            return result;

        } catch (error) {
            console.error('Error analyzing token value:', error);
            return { extractedToken: null, confidence: 0.0, reasoning: 'Analysis error' };
        }
    }

    /**
     * Generate clarification response for token value
     * @param {string} userResponse - User's response
     * @param {string} providerName - Provider name
     * @returns {Promise<Object>} Clarification response
     */
    async generateTokenValueClarificationResponse(userResponse, providerName) {
        try {
            const clarificationPrompt = `The user gave an unclear response about the API token. Generate a helpful clarification.

USER'S RESPONSE: "${userResponse}"
PROVIDER: ${providerName}

TASK: Generate a concise response that:
1. Acknowledges their response
2. Asks for the actual API token
3. Gives helpful guidance about finding the token
4. Mentions what a valid token looks like
5. Keeps it conversational

GUIDELINES:
- Be understanding and helpful
- Give practical guidance for the specific provider
- Make it conversational but concise
- Briefly mention security

Generate a helpful clarification response:`;

            const response = await aiService.generateResponse(clarificationPrompt, { maxTokens: 200 });

            return {
                answer: response.answer,
                success: true,
                step: 'token_value_input'
            };

        } catch (error) {
            console.error('Error generating token value clarification:', error);
            return {
                answer: `I need the actual API token from ${providerName}. This is usually a long string (like "sk-abc123..." or "api_key_xyz...") that you can find in your ${providerName} dashboard. Could you share that token?`,
                success: true,
                step: 'token_value_input'
            };
        }
    }

    /**
     * Generate error response for token creation failure
     * @param {string} error - Error message
     * @param {string} providerName - Provider name
     * @returns {Promise<Object>} Error response
     */
    async generateTokenCreationErrorResponse(error, providerName) {
        try {
            const errorPrompt = `Generate a helpful error response for token creation failure.

ERROR: "${error}"
PROVIDER: ${providerName}

TASK: Generate a concise response that:
1. Explains the issue in user-friendly terms
2. Suggests possible solutions
3. Asks them to try again
4. Keeps it helpful

GUIDELINES:
- Don't just repeat the technical error
- Give actionable suggestions
- Make it conversational but concise
- Stay helpful and professional

Generate a helpful error response:`;

            const response = await aiService.generateResponse(errorPrompt, { maxTokens: 200 });

            return {
                answer: response.answer,
                success: false,
                step: 'token_value_input'
            };

        } catch (error) {
            console.error('Error generating token creation error response:', error);
            return {
                answer: `I couldn't create the integration token with ${providerName}. This might be because the token is invalid or expired. Could you double-check the token and try again?`,
                success: false,
                step: 'token_value_input'
            };
        }
    }

    /**
     * Generate success response and proceed to evaluator selection
     * @param {string} tokenName - Created token name
     * @param {string} sessionId - Session ID
     * @returns {Promise<Object>} Success response
     */
    async generateTokenCreationSuccessResponse(tokenName, sessionId) {
        try {
            const successPrompt = `Generate a confirmation response for successful token creation and transition to evaluator selection.

TOKEN NAME: "${tokenName}"

TASK: Generate a concise response that:
1. Confirms the successful token creation
2. Explains what happens next (evaluator selection)
3. Makes a smooth transition to the next step
4. Keeps it conversational

GUIDELINES:
- Be helpful and concise
- Make the transition clear
- Keep it brief
- Focus on the next step

Generate a helpful success response:`;

            const response = await aiService.generateResponse(successPrompt, { maxTokens: 200 });

            // Get the actual evaluator selection response
            const evaluatorResponse = await this.proceedToEvaluatorSelection(sessionId);
            
            // Combine success message with evaluator selection
            return {
                answer: `${response.answer}\n\n${evaluatorResponse.answer}`,
                success: evaluatorResponse.success,
                step: evaluatorResponse.step,
                availableEvaluators: evaluatorResponse.availableEvaluators
            };

        } catch (error) {
            console.error('Error generating token creation success response:', error);
            // Fallback to direct evaluator selection
            return await this.proceedToEvaluatorSelection(sessionId);
        }
    }

    /**
     * Proceed to evaluator selection using AI
     * @param {string} sessionId - Session identifier
     * @returns {Promise<Object>} Flow response
     */
    async proceedToEvaluatorSelection(sessionId) {
        const state = this.conversationStates.get(sessionId);
        
        try {
            console.log(`🔍 Getting available evaluators...`);
            
            // Get available evaluators
            const evaluatorsResult = await this.apiService.executeAction('get_evaluation_prompts', {}, state.userApiToken);
            
            if (!evaluatorsResult.success) {
                return {
                    answer: `I couldn't get the available evaluators: ${evaluatorsResult.error}`,
                    success: false
                };
            }

            const evaluators = evaluatorsResult.data.data || [];
            if (evaluators.length === 0) {
                return {
                    answer: "No evaluators are currently available. Please contact support.",
                    success: false
                };
            }

            // Update state
            state.step = 'evaluator_selection';
            state.availableEvaluators = evaluators;
            this.conversationStates.set(sessionId, state);

            // Generate AI-driven response for evaluator selection
            return await this.generateEvaluatorSelectionResponse(evaluators, state.selectedToken);

        } catch (error) {
            console.error('Error getting evaluators:', error);
            return {
                answer: "I encountered an error getting available evaluators. Please try again.",
                success: false
            };
        }
    }

    /**
     * Generate AI-driven response for evaluator selection
     * @param {Array} evaluators - Available evaluators
     * @param {Object} selectedToken - Selected integration token
     * @returns {Promise<Object>} AI-generated response
     */
    async generateEvaluatorSelectionResponse(evaluators, selectedToken) {
        try {
            const evaluatorsContext = evaluators.map(evaluator => 
                `- ${evaluator.name || evaluator.title}: ${evaluator.description || 'Evaluation tool'}`
            ).join('\n');

            const selectionPrompt = `You are guiding a user through evaluator selection for their AI models. Generate a helpful, concise response.

CONTEXT: The user has selected the integration token "${selectedToken?.name || 'their token'}" and now needs to choose evaluators.

AVAILABLE EVALUATORS:
${evaluatorsContext}

TASK: Generate a conversational response that:
1. Acknowledges the token selection
2. Explains what evaluators do briefly
3. Lists the available evaluators clearly
4. Asks them to choose which evaluators they want
5. Makes the selection process natural

GUIDELINES:
- Be helpful but concise
- Explain the purpose of evaluators briefly
- Make it conversational but to the point
- Ask them to pick what matches their needs

Generate a helpful evaluator selection response:`;

            const response = await aiService.generateResponse(selectionPrompt, { maxTokens: 400 });

            return {
                answer: response.answer,
                success: true,
                step: 'evaluator_selection',
                availableEvaluators: evaluators
            };

        } catch (error) {
            console.error('Error generating evaluator selection response:', error);
            return {
                answer: `Great! Now let's choose the evaluators you want to connect. I found ${evaluators.length} evaluators available that can help assess your AI's performance. Which ones would you like to use?`,
                success: true,
                step: 'evaluator_selection',
                availableEvaluators: evaluators
            };
        }
    }

    /**
     * Handle evaluator selection using AI
     * @param {string} sessionId - Session identifier
     * @param {string} userResponse - User's response
     * @returns {Promise<Object>} Flow response
     */
    async handleEvaluatorSelection(sessionId, userResponse) {
        const state = this.conversationStates.get(sessionId);
        if (!state || state.step !== 'evaluator_selection') {
            return { answer: "I lost track of our conversation. Let's start over.", success: false };
        }

        try {
            console.log(`🎯 Processing evaluator selection: "${userResponse}"`);

            // Check if user wants to create new or edit evaluators
            const createEditAnalysis = await this.analyzeCreateEditIntent(userResponse);
            
            if (createEditAnalysis.wantsToCreateEdit) {
                return {
                    answer: "To create a new evaluator or edit an existing one, please use the evaluator management section in your dashboard. You can create custom evaluators with specific prompts and configurations there. Once you've created your evaluator, come back and I'll help you associate it with your models.",
                    success: true,
                    step: 'evaluator_management_redirect',
                    customAction: 'redirect_to_evaluator_management',
                    custom_evaluator_management: true
                };
            }

            // Use AI to understand which evaluator the user wants (single evaluator selection)
            const evaluatorAnalysis = await this.analyzeSingleEvaluatorSelection(userResponse, state.availableEvaluators);
            
            console.log('🧠 Evaluator selection analysis:', evaluatorAnalysis);

            if (!evaluatorAnalysis.selectedEvaluator) {
                // AI couldn't identify clear selection, ask for clarification
                return await this.generateEvaluatorClarificationResponse(userResponse, state.availableEvaluators);
            }

            // Store selected evaluator (single)
            state.selectedEvaluator = evaluatorAnalysis.selectedEvaluator;
            console.log(`📋 Selected evaluator: ${state.selectedEvaluator.name || state.selectedEvaluator.title}`);
            
            // Check if evaluator has a default token
            return await this.checkEvaluatorToken(sessionId);

        } catch (error) {
            console.error('Error in AI evaluator selection:', error);
            return {
                answer: "I had trouble understanding which evaluator you'd like. Could you tell me which specific evaluator you want to use?",
                success: true,
                step: 'evaluator_selection'
            };
        }
    }

    /**
     * Analyze if user wants to create new or edit evaluators
     * @param {string} userResponse - User's response
     * @returns {Promise<Object>} Analysis result
     */
    async analyzeCreateEditIntent(userResponse) {
        try {
            const intentPrompt = `Analyze if the user wants to create a new evaluator or edit existing evaluators.

USER RESPONSE: "${userResponse}"

TASK: Determine if the user wants to create/edit evaluators rather than select from existing ones.

INDICATORS FOR CREATE/EDIT:
- "create new", "new evaluator", "make new"
- "edit", "modify", "change", "customize"
- "create custom", "build my own"
- "none of these", "don't want any of these"

RESPONSE FORMAT (JSON):
{
  "wantsToCreateEdit": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Return ONLY valid JSON:`;

            const response = await aiService.generateResponse(intentPrompt, { maxTokens: 150 });
            const result = JSON.parse(response.answer.match(/\{[\s\S]*\}/)?.[0] || '{"wantsToCreateEdit": false, "confidence": 0.0, "reasoning": "Parse error"}');
            
            return result;

        } catch (error) {
            console.error('Error analyzing create/edit intent:', error);
            return { wantsToCreateEdit: false, confidence: 0.0, reasoning: 'Analysis error' };
        }
    }

    /**
     * Analyze single evaluator selection using AI
     * @param {string} userResponse - User's response
     * @param {Array} availableEvaluators - Available evaluators
     * @returns {Promise<Object>} Analysis result
     */
    async analyzeSingleEvaluatorSelection(userResponse, availableEvaluators) {
        try {
            const evaluatorsContext = availableEvaluators.map((evaluator, index) => 
                `${index}: ${evaluator.name || evaluator.title} - ${evaluator.description || 'Evaluation tool'}`
            ).join('\n');

            const analysisPrompt = `Analyze the user's response to identify which single evaluator they want to select.

USER RESPONSE: "${userResponse}"

AVAILABLE EVALUATORS:
${evaluatorsContext}

TASK: Identify which specific evaluator the user wants. They can only select ONE evaluator at a time.

RESPONSE FORMAT (JSON):
{
  "selectedEvaluator": evaluator_object_or_null,
  "confidence": 0.0-1.0,
  "reasoning": "explanation of how selection was made"
}

EXAMPLES:
- "safety evaluator" → find evaluator with safety in name or description
- "content safety" → find exact or close name match
- "the first one" → select first evaluator
- "accuracy checker" → find evaluator matching description

Return ONLY valid JSON with the actual evaluator object:`;

            const response = await aiService.generateResponse(analysisPrompt, { maxTokens: 300 });
            const result = JSON.parse(response.answer.match(/\{[\s\S]*\}/)?.[0] || '{"selectedEvaluator": null, "confidence": 0.0, "reasoning": "Parse error"}');
            
            // Validate and find the actual evaluator
            let selectedEvaluator = null;
            if (result.selectedEvaluator) {
                // Find matching evaluator by index, name, or description
                selectedEvaluator = availableEvaluators.find((evaluator, index) => 
                    index === result.selectedEvaluator.index ||
                    (evaluator.name || evaluator.title || '').toLowerCase().includes((result.selectedEvaluator.name || '').toLowerCase()) ||
                    evaluator.id === result.selectedEvaluator.id ||
                    (userResponse.toLowerCase().includes((evaluator.name || evaluator.title || '').toLowerCase()))
                );
            }
            
            return {
                selectedEvaluator: selectedEvaluator,
                confidence: result.confidence || 0.0,
                reasoning: result.reasoning || 'AI analysis'
            };

        } catch (error) {
            console.error('Error analyzing evaluator selection:', error);
            return { selectedEvaluator: null, confidence: 0.0, reasoning: 'Analysis error' };
        }
    }

    /**
     * Analyze evaluator selection using AI
     * @param {string} userResponse - User's response
     * @param {Array} availableEvaluators - Available evaluators
     * @returns {Promise<Object>} Analysis result
     */
    async analyzeEvaluatorSelection(userResponse, availableEvaluators) {
        try {
            const evaluatorsContext = availableEvaluators.map((evaluator, index) => 
                `${index}: ${evaluator.name || evaluator.title} - ${evaluator.description || 'Evaluation tool'}`
            ).join('\n');

            const analysisPrompt = `Analyze the user's response to identify which evaluators they want to select.

USER RESPONSE: "${userResponse}"

AVAILABLE EVALUATORS:
${evaluatorsContext}

TASK: Identify which specific evaluators the user wants based on their response. They might mention:
- Evaluator names or partial names
- Types of evaluation (safety, accuracy, bias, etc.)
- Keywords that match evaluator descriptions
- "all" or "everything"
- Specific preferences

RESPONSE FORMAT (JSON):
{
  "selectedEvaluators": [array_of_evaluator_objects],
  "confidence": 0.0-1.0,
  "reasoning": "explanation of how selections were made"
}

EXAMPLES:
- "safety and accuracy" → find evaluators with safety/accuracy in name or description
- "all of them" → select all evaluators
- "content safety evaluator" → find exact or close name match
- "bias detection and accuracy" → find matching evaluators
- "the first two" → select first two evaluators

Return ONLY valid JSON with the actual evaluator objects:`;

            const response = await aiService.generateResponse(analysisPrompt, { maxTokens: 500 });
            const result = JSON.parse(response.answer.match(/\{[\s\S]*\}/)?.[0] || '{"selectedEvaluators": [], "confidence": 0.0, "reasoning": "Parse error"}');
            
            // Validate and map the selected evaluators
            const validatedEvaluators = [];
            if (result.selectedEvaluators && Array.isArray(result.selectedEvaluators)) {
                for (const selection of result.selectedEvaluators) {
                    // Find matching evaluator by index, name, or description
                    const match = availableEvaluators.find((evaluator, index) => 
                        index === selection.index ||
                        (evaluator.name || evaluator.title || '').toLowerCase().includes((selection.name || '').toLowerCase()) ||
                        evaluator.id === selection.id
                    );
                    if (match) {
                        validatedEvaluators.push(match);
                    }
                }
            }
            
            return {
                selectedEvaluators: validatedEvaluators,
                confidence: result.confidence || 0.0,
                reasoning: result.reasoning || 'AI analysis'
            };

        } catch (error) {
            console.error('Error analyzing evaluator selection:', error);
            return { selectedEvaluators: [], confidence: 0.0, reasoning: 'Analysis error' };
        }
    }

    /**
     * Generate clarification response for evaluator selection
     * @param {string} userResponse - User's response
     * @param {Array} availableEvaluators - Available evaluators
     * @returns {Promise<Object>} Clarification response
     */
    async generateEvaluatorClarificationResponse(userResponse, availableEvaluators) {
        try {
            const evaluatorsContext = availableEvaluators.map(evaluator => 
                `- ${evaluator.name || evaluator.title}: ${evaluator.description || 'Evaluation tool'}`
            ).join('\n');

            const clarificationPrompt = `The user gave an unclear response about evaluator selection. Generate a helpful clarification.

USER'S RESPONSE: "${userResponse}"

AVAILABLE EVALUATORS:
${evaluatorsContext}

TASK: Generate a concise response that:
1. Acknowledges their response
2. Asks for clarification
3. Suggests they can mention evaluator names or types
4. Keeps it conversational

GUIDELINES:
- Be understanding and helpful
- Make it conversational but concise
- Give examples of how they can specify evaluators

Generate a helpful clarification response:`;

            const response = await aiService.generateResponse(clarificationPrompt, { maxTokens: 200 });

            return {
                answer: response.answer,
                success: true,
                step: 'evaluator_selection'
            };

        } catch (error) {
            console.error('Error generating evaluator clarification:', error);
            return {
                answer: "I want to make sure I select the right evaluators for you. Could you tell me which specific evaluators you'd like to use? You can mention their names or types of evaluation you're interested in.",
                success: true,
                step: 'evaluator_selection'
            };
        }
    }

    /**
     * Proceed to model selection using AI
     * @param {string} sessionId - Session identifier
     * @returns {Promise<Object>} Flow response
     */
    async proceedToModelSelection(sessionId) {
        const state = this.conversationStates.get(sessionId);
        
        try {
            console.log(`🏗️ Getting user models...`);
            
            // Get user's models/nodes
            const modelsResult = await this.apiService.executeAction('get_user_models', {}, state.userApiToken);
            console.log('🔍 Models result:', modelsResult);
            if (!modelsResult.success) {
                return {
                    answer: `I couldn't get your models: ${modelsResult.error}`,
                    success: false
                };
            }

            const models = modelsResult.data || [];
            if (models.length === 0) {
                return {
                    answer: "You don't have any models in your account yet. Please create a model first before associating evaluators.",
                    success: false
                };
            }

            // Update state
            state.step = 'model_selection';
            state.availableModels = models;
            this.conversationStates.set(sessionId, state);

            // Generate AI-driven response for model selection
            return await this.generateModelSelectionResponse(models, state.selectedEvaluators);

        } catch (error) {
            console.error('Error getting user models:', error);
            return {
                answer: "I encountered an error getting your models. Please try again.",
                success: false
            };
        }
    }

    /**
     * Generate AI-driven response for model selection
     * @param {Array} models - Available models
     * @param {Array} selectedEvaluators - Selected evaluators
     * @returns {Promise<Object>} AI-generated response
     */
    async generateModelSelectionResponse(models, selectedEvaluators) {
        try {
            const modelsContext = models.map(model => 
                `- ${model.name}: ${model.description || 'AI model'}`
            ).join('\n');

            const evaluatorNames = selectedEvaluators.map(e => e.name || e.title).join(', ');

            const selectionPrompt = `You are guiding a user through the final step of evaluator connection. Generate a natural, engaging response.

CONTEXT: The user has selected these evaluators: ${evaluatorNames}
Now they need to choose which models to associate these evaluators with.

AVAILABLE MODELS:
${modelsContext}

TASK: Generate a conversational response that:
1. Explains this is the final step
2. Presents the available models in a concise way
3. Asks them to choose which models they want
4. Makes the selection process feel natural and flexible

GUIDELINES:
- Be helpful but concise
- Explain that evaluators will monitor these models
- Make it conversational and encouraging
- Suggest they can choose specific models or all models
- Always list all the models

Generate an engaging final step response:`;

            const response = await aiService.generateResponse(selectionPrompt, { maxTokens: 300 });

            return {
                answer: response.answer,
                success: true,
                step: 'model_selection',
                availableModels: models
            };

        } catch (error) {
            console.error('Error generating model selection response:', error);
            const evaluatorNames = selectedEvaluators.map(e => e.name || e.title).join(', ');
            return {
                answer: `Perfect! You've selected: ${evaluatorNames}. Now I need to know which of your models you'd like to associate these evaluators with. Which models should I connect them to?`,
                success: true,
                step: 'model_selection',
                availableModels: models
            };
        }
    }

    /**
     * Handle model selection using AI and perform associations
     * @param {string} sessionId - Session identifier
     * @param {string} userResponse - User's response
     * @returns {Promise<Object>} Flow response
     */
    async handleModelSelection(sessionId, userResponse) {
        const state = this.conversationStates.get(sessionId);
        if (!state || state.step !== 'model_selection') {
            return { answer: "I lost track of our conversation. Let's start over.", success: false };
        }

        try {
            // Use AI to understand which models the user wants
            const modelAnalysis = await this.analyzeModelSelection(userResponse, state.availableModels);
            
            console.log('🧠 Model selection analysis:', modelAnalysis);

            if (modelAnalysis.selectedModels.length === 0) {
                // AI couldn't identify clear selections, ask for clarification
                return await this.generateModelClarificationResponse(userResponse, state.availableModels);
            }

            const selectedModels = modelAnalysis.selectedModels;
            
            console.log(`🔗 Starting associations for ${selectedModels.length} models and ${state.selectedEvaluators.length} evaluators`);
            
            // Perform all associations
            return await this.performAssociations(sessionId, selectedModels, state.selectedEvaluators, state.userApiToken);

        } catch (error) {
            console.error('Error in AI model selection:', error);
            return {
                answer: "I had trouble understanding which models you'd like. Could you tell me which specific models you want to associate the evaluators with?",
                success: true,
                step: 'model_selection'
            };
        }
    }

    /**
     * Analyze model selection using AI
     * @param {string} userResponse - User's response
     * @param {Array} availableModels - Available models
     * @returns {Promise<Object>} Analysis result
     */
    async analyzeModelSelection(userResponse, availableModels) {
        try {
            const modelsContext = availableModels.map((model, index) => 
                `${index}: ${model.name} - ${model.description || 'AI model'}`
            ).join('\n');

            const analysisPrompt = `Analyze the user's response to identify which models they want to select for evaluator association.

USER RESPONSE: "${userResponse}"

AVAILABLE MODELS:
${modelsContext}

TASK: Identify which specific models the user wants based on their response. They might mention:
- Model names or partial names
- "all" or "everything" or "all models"
- Specific model types or purposes
- "the first one", "both", etc.

RESPONSE FORMAT (JSON):
{
  "selectedModels": [array_of_model_objects],
  "confidence": 0.0-1.0,
  "reasoning": "explanation of how selections were made"
}

EXAMPLES:
- "all of them" → select all models
- "customer support bot" → find model with similar name
- "both" → select all available models
- "the production model" → find model matching description
- "first two" → select first two models

Return ONLY valid JSON with the actual model objects:`;

            const response = await aiService.generateResponse(analysisPrompt, { maxTokens: 400 });
            const result = JSON.parse(response.answer.match(/\{[\s\S]*\}/)?.[0] || '{"selectedModels": [], "confidence": 0.0, "reasoning": "Parse error"}');
            
            // Validate and map the selected models
            const validatedModels = [];
            if (result.selectedModels && Array.isArray(result.selectedModels)) {
                for (const selection of result.selectedModels) {
                    // Find matching model by index, name, or description
                    const match = availableModels.find((model, index) => 
                        index === selection.index ||
                        (model.name || '').toLowerCase().includes((selection.name || '').toLowerCase()) ||
                        model.id === selection.id
                    );
                    if (match) {
                        validatedModels.push(match);
                    }
                }
            }
            
            return {
                selectedModels: validatedModels,
                confidence: result.confidence || 0.0,
                reasoning: result.reasoning || 'AI analysis'
            };

        } catch (error) {
            console.error('Error analyzing model selection:', error);
            return { selectedModels: [], confidence: 0.0, reasoning: 'Analysis error' };
        }
    }

    /**
     * Generate clarification response for model selection
     * @param {string} userResponse - User's response
     * @param {Array} availableModels - Available models
     * @returns {Promise<Object>} Clarification response
     */
    async generateModelClarificationResponse(userResponse, availableModels) {
        try {
            const modelsContext = availableModels.map(model => 
                `- ${model.name}: ${model.description || 'AI model'}`
            ).join('\n');

            const clarificationPrompt = `The user gave an unclear response about model selection. Generate a helpful clarification.

USER'S RESPONSE: "${userResponse}"

AVAILABLE MODELS:
${modelsContext}

TASK: Generate a concise response that:
1. Acknowledges their response
2. Asks for clarification about which models they want
3. Suggests they can mention model names or say "all"
4. Keeps it conversational

GUIDELINES:
- Be understanding and helpful
- Make it conversational but concise
- Give examples of how they can specify models

Generate a helpful clarification response:`;

            const response = await aiService.generateResponse(clarificationPrompt, { maxTokens: 200 });

            return {
                answer: response.answer,
                success: true,
                step: 'model_selection'
            };

        } catch (error) {
            console.error('Error generating model clarification:', error);
            return {
                answer: "I want to make sure I connect the evaluators to the right models. Could you tell me which specific models you'd like to use? You can mention their names or say 'all' for all models.",
                success: true,
                step: 'model_selection'
            };
        }
    }

    /**
     * Perform the actual evaluator-model associations
     * @param {string} sessionId - Session identifier
     * @param {Array} models - Selected models
     * @param {Array} evaluators - Selected evaluators
     * @param {string} userApiToken - User's API token
     * @returns {Promise<Object>} Flow response
     */
    async performAssociations(sessionId, models, evaluators, userApiToken) {
        try {
            const results = [];
            const errors = [];

            // Perform associations for each model-evaluator combination
            for (const model of models) {
                for (const evaluator of evaluators) {
                    try {
                        const associationResult = await this.apiService.executeAction('associate_evaluator_to_model_new', {
                            modelId: model.id,
                            evaluationPromptId: evaluator.id
                        }, userApiToken);

                        if (associationResult.success) {
                            results.push(`✅ ${evaluator.name || evaluator.title} → ${model.name}`);
                        } else {
                            errors.push(`❌ ${evaluator.name || evaluator.title} → ${model.name}: ${associationResult.error}`);
                        }
                    } catch (error) {
                        errors.push(`❌ ${evaluator.name || evaluator.title} → ${model.name}: ${error.message}`);
                    }
                }
            }

            // Clean up state
            this.conversationStates.delete(sessionId);

            // Generate summary response
            let response = `🎉 **Evaluator Connection Complete!**\n\n`;
            
            if (results.length > 0) {
                response += `**Successful Associations:**\n${results.join('\n')}\n\n`;
            }
            
            if (errors.length > 0) {
                response += `**Failed Associations:**\n${errors.join('\n')}\n\n`;
            }
            
            response += `Summary: ${results.length} successful, ${errors.length} failed out of ${results.length + errors.length} total associations.`;
            
            if (errors.length === 0) {
                response += `\n\n✨ All evaluators have been successfully connected to your models! They will now evaluate your AI agent's performance.`;
            }

            return {
                answer: response,
                success: results.length > 0,
                step: 'completed',
                evaluators_added: true,
                summary: {
                    successful: results.length,
                    failed: errors.length,
                    total: results.length + errors.length
                }
            };

        } catch (error) {
            console.error('Error performing associations:', error);
            this.conversationStates.delete(sessionId);
            return {
                answer: "I encountered an error while performing the evaluator associations. Please try again.",
                success: false,
                step: 'error'
            };
        }
    }

    /**
     * Parse number selection from user input
     * @param {string} input - User input
     * @param {number} maxNumber - Maximum valid number
     * @returns {Array} Array of selected indices
     */
    parseNumberSelection(input, maxNumber) {
        const numbers = [];
        const parts = input.split(',');
        
        for (const part of parts) {
            const trimmed = part.trim();
            
            // Handle ranges like "1-3"
            if (trimmed.includes('-')) {
                const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()));
                if (!isNaN(start) && !isNaN(end) && start >= 1 && end <= maxNumber && start <= end) {
                    for (let i = start; i <= end; i++) {
                        numbers.push(i);
                    }
                }
            } else {
                // Handle single numbers
                const num = parseInt(trimmed);
                if (!isNaN(num) && num >= 1 && num <= maxNumber) {
                    numbers.push(num);
                }
            }
        }
        
        // Remove duplicates and sort
        return [...new Set(numbers)].sort((a, b) => a - b);
    }

    /**
     * Continue the evaluator connection flow using AI
     * @param {string} sessionId - Session identifier
     * @param {string} userResponse - User's response
     * @returns {Promise<Object>} Flow response
     */
    async continueFlow(sessionId, userResponse) {
        const state = this.conversationStates.get(sessionId);
        
        if (!state) {
            return {
                answer: "I don't have an active evaluator connection session. Would you like to start connecting evaluators to your models?",
                success: false
            };
        }

        console.log(`🔄 Continuing flow at step: ${state.step} with user response: "${userResponse}"`);
        console.log(`📊 Flow state:`, JSON.stringify({
            step: state.step,
            hasTokens: state.existingTokens?.length || 0,
            hasSelectedToken: !!state.selectedToken,
            hasSelectedEvaluators: state.selectedEvaluators?.length || 0
        }, null, 2));

        switch (state.step) {
            case 'evaluator_selection':
                console.log(`🎯 Handling evaluator selection step...`);
                return await this.handleEvaluatorSelection(sessionId, userResponse);
            case 'provider_selection':
                return await this.handleProviderSelection(sessionId, userResponse);
            case 'token_name_input':
                return await this.handleTokenNameInput(sessionId, userResponse);
            case 'token_value_input':
                return await this.handleTokenValueInput(sessionId, userResponse);
            case 'provider_model_selection':
                return await this.handleProviderModelSelection(sessionId, userResponse);
            case 'user_model_selection':
                return await this.handleUserModelSelection(sessionId, userResponse);
            default:
                // Use AI to understand what the user wants to do
                return await this.handleUnknownStep(sessionId, userResponse, state);
        }
    }

    /**
     * Handle unknown step using AI
     * @param {string} sessionId - Session identifier
     * @param {string} userResponse - User's response
     * @param {Object} state - Current conversation state
     * @returns {Promise<Object>} Flow response
     */
    async handleUnknownStep(sessionId, userResponse, state) {
        try {
            const contextPrompt = `The user is in an evaluator connection flow but we're not sure what step they're on.

USER RESPONSE: "${userResponse}"
CURRENT STATE: ${JSON.stringify(state, null, 2)}

TASK: Generate a helpful response that:
1. Acknowledges their message
2. Asks what they'd like to do next
3. Offers to restart the evaluator connection process if needed
4. Keeps it conversational and helpful

Generate a helpful response:`;

            const response = await aiService.generateResponse(contextPrompt, { maxTokens: 200 });

            return {
                answer: response.answer,
                success: true,
                step: 'unknown'
            };

        } catch (error) {
            console.error('Error handling unknown step:', error);
            return {
                answer: "I'm not sure what step we're on in the evaluator connection process. Would you like to start over with connecting evaluators to your models?",
                success: false
            };
        }
    }

    /**
     * Check if there's an active flow for a session
     * @param {string} sessionId - Session identifier
     * @returns {boolean} Whether there's an active flow
     */
    hasActiveFlow(sessionId) {
        const hasFlow = this.conversationStates.has(sessionId);
        const currentStep = hasFlow ? this.conversationStates.get(sessionId).step : null;
        console.log(`🔍 Active flow check for session ${sessionId}: ${hasFlow ? `YES (step: ${currentStep})` : 'NO'}`);
        return hasFlow;
    }

    /**
     * Get the current step of an active flow
     * @param {string} sessionId - Session identifier
     * @returns {string|null} Current step or null
     */
    getCurrentStep(sessionId) {
        const state = this.conversationStates.get(sessionId);
        return state ? state.step : null;
    }

    /**
     * Cancel an active flow
     * @param {string} sessionId - Session identifier
     * @returns {void}
     */
    cancelFlow(sessionId) {
        this.conversationStates.delete(sessionId);
    }

    /**
     * Check if evaluator has a default token
     * @param {string} sessionId - Session identifier
     * @returns {Promise<Object>} Flow response
     */
    async checkEvaluatorToken(sessionId) {
        const state = this.conversationStates.get(sessionId);
        
        try {
            const evaluator = state.selectedEvaluator;
            
            if (evaluator.defaultIntegrationTokenId) {
                console.log(`✅ Evaluator ${evaluator.name} already has a default token`);
                // Evaluator has a token, proceed to model selection
                return await this.proceedToUserModelSelection(sessionId);
            } else {
                console.log(`🔑 Evaluator ${evaluator.name} needs a token, starting token creation...`);
                // Evaluator needs a token, start token creation process
                return await this.proceedToTokenCreation(sessionId);
            }

        } catch (error) {
            console.error('Error checking evaluator token:', error);
            return {
                answer: "I encountered an error checking the evaluator's token. Please try again.",
                success: false,
                step: 'error'
            };
        }
    }

    /**
     * Proceed to token creation for evaluator
     * @param {string} sessionId - Session identifier
     * @returns {Promise<Object>} Flow response
     */
    async proceedToTokenCreation(sessionId) {
        const state = this.conversationStates.get(sessionId);
        
        try {
            // Get available providers
            const providersResult = await this.apiService.executeAction('get_providers', {}, state.userApiToken);
            
            if (!providersResult.success) {
                return {
                    answer: `I couldn't get the list of available providers: ${providersResult.error}`,
                    success: false
                };
            }

            const providers = providersResult.data.data || [];
            if (providers.length === 0) {
                return {
                    answer: "No providers are available at the moment. Please contact support.",
                    success: false
                };
            }

            // Update state
            state.step = 'provider_selection';
            state.providers = providers;
            state.tokenCreation = {};
            this.conversationStates.set(sessionId, state);

            return {
                answer: `The evaluator "${state.selectedEvaluator.name || state.selectedEvaluator.title}" needs an integration token to work. I'll help you create one. Which provider would you like to use for this evaluator? \n ${providers.map(provider => `- ${provider.name}`).join('\n')}`,
                success: true,
                step: 'provider_selection',
                providers: providers
            };

        } catch (error) {
            console.error('Error starting token creation for evaluator:', error);
            return {
                answer: "I encountered an error starting the token creation process. Please try again.",
                success: false
            };
        }
    }

    /**
     * Handle provider model selection after token creation
     * @param {string} sessionId - Session identifier
     * @param {string} userResponse - User's response
     * @returns {Promise<Object>} Flow response
     */
    async handleProviderModelSelection(sessionId, userResponse) {
        const state = this.conversationStates.get(sessionId);
        if (!state || state.step !== 'provider_model_selection') {
            return { answer: "I lost track of our conversation. Let's start over.", success: false };
        }

        try {
            console.log(`🎯 Processing provider model selection: "${userResponse}"`);

            // Use AI to understand which provider model the user wants
            const modelAnalysis = await this.analyzeProviderModelSelection(userResponse, state.providerModels);
            
            console.log('🧠 Provider model selection analysis:', JSON.stringify(modelAnalysis, null, 2));

            if (!modelAnalysis.selectedModel) {
                return await this.generateProviderModelClarificationResponse(userResponse, state.providerModels);
            }

            // Store selected provider model
            state.selectedProviderModel = modelAnalysis.selectedModel;
            
            // Update evaluator with default token and model
            return await this.updateEvaluatorWithDefaults(sessionId);

        } catch (error) {
            console.error('Error in provider model selection:', error);
            return {
                answer: "I had trouble understanding which model you'd like to use. Could you tell me which specific model from the provider you want to use?",
                success: true,
                step: 'provider_model_selection'
            };
        }
    }

    /**
     * Analyze provider model selection using AI
     * @param {string} userResponse - User's response
     * @param {Array} availableModels - Available provider models
     * @returns {Promise<Object>} Analysis result
     */
    async analyzeProviderModelSelection(userResponse, availableModels) {
        try {
            const modelsContext = availableModels.map((model, index) => 
                `${index}: ${model}`
            ).join('\n');

            const analysisPrompt = `Analyze the user's response to identify which provider model they want to select.

USER RESPONSE: "${userResponse}"

AVAILABLE PROVIDER MODELS:
${modelsContext}

TASK: Identify which specific provider model the user wants based on their response.

RESPONSE FORMAT (JSON):
{
  "selectedModel": model_name,
  "confidence": 0.0-1.0,
  "reasoning": "explanation of how selection was made"
}

Return ONLY valid JSON with the actual model object:`;

            const response = await aiService.generateResponse(analysisPrompt, { maxTokens: 200 });
            const result = JSON.parse(response.answer.match(/\{[\s\S]*\}/)?.[0] || '{"selectedModel": null, "confidence": 0.0, "reasoning": "Parse error"}');
            
            // Validate and find the actual model
            let selectedModel = null;
            if (result.selectedModel) {
                selectedModel = availableModels.find((model, index) => 
                    index === result.selectedModel.index ||
                    (model).toLowerCase().includes((result.selectedModel || '').toLowerCase())
                );
            }
            
            return {
                selectedModel: selectedModel,
                confidence: result.confidence || 0.0,
                reasoning: result.reasoning || 'AI analysis'
            };

        } catch (error) {
            console.error('Error analyzing provider model selection:', error);
            return { selectedModel: null, confidence: 0.0, reasoning: 'Analysis error' };
        }
    }

    /**
     * Generate clarification response for provider model selection
     * @param {string} userResponse - User's response
     * @param {Array} availableModels - Available models
     * @returns {Promise<Object>} Clarification response
     */
    async generateProviderModelClarificationResponse(userResponse, availableModels) {
        try {
            const modelsContext = availableModels.map(model => 
                `- ${model}`
            ).join('\n');

            const clarificationPrompt = `The user gave an unclear response about provider model selection. Generate a brief clarification.

USER'S RESPONSE: "${userResponse}"

AVAILABLE MODELS:
${modelsContext}

TASK: Generate a brief response that asks for clarification about which provider model they want.

Generate a brief clarification response:`;

            const response = await aiService.generateResponse(clarificationPrompt, { maxTokens: 150 });

            return {
                answer: response.answer,
                success: true,
                step: 'provider_model_selection'
            };

        } catch (error) {
            console.error('Error generating provider model clarification:', error);
            return {
                answer: "I want to make sure I select the right model from the provider. Could you tell me which specific model you'd like to use?",
                success: true,
                step: 'provider_model_selection'
            };
        }
    }

    /**
     * Update evaluator with default token and model
     * @param {string} sessionId - Session identifier
     * @returns {Promise<Object>} Flow response
     */
    async updateEvaluatorWithDefaults(sessionId) {
        const state = this.conversationStates.get(sessionId);
        
        try {
            console.log(`🔄 Updating evaluator with default token and model...`);

            const updateResult = await this.apiService.executeAction('update_evaluator_defaults', {
                id: state.selectedEvaluator.id,
                defaultIntegrationTokenId: state.selectedToken.id,
                defaultProviderModel: state.selectedProviderModel
            }, state.userApiToken);

            if (!updateResult.success) {
                return {
                    answer: `I couldn't update the evaluator with the default settings: ${updateResult.error}`,
                    success: false
                };
            }

            console.log(`✅ Evaluator updated with defaults`);

            // Now proceed to user model selection
            return await this.proceedToUserModelSelection(sessionId);

        } catch (error) {
            console.error('Error updating evaluator with defaults:', error);
            return {
                answer: "I encountered an error updating the evaluator. Please try again.",
                success: false
            };
        }
    }

    /**
     * Proceed to user model selection (renamed from proceedToModelSelection)
     * @param {string} sessionId - Session identifier
     * @returns {Promise<Object>} Flow response
     */
    async proceedToUserModelSelection(sessionId) {
        const state = this.conversationStates.get(sessionId);
        
        try {
            console.log(`🏗️ Getting user models...`);
            
            // Get user's models/nodes
            const modelsResult = await this.apiService.executeAction('get_user_models', {}, state.userApiToken);
            console.log('🔍 Models result:', modelsResult);
            if (!modelsResult.success) {
                return {
                    answer: `I couldn't get your models: ${modelsResult.error}`,
                    success: false
                };
            }

            const models = modelsResult.data || [];
            if (models.length === 0) {
                return {
                    answer: "You don't have any models in your account yet. Please create a model first before associating evaluators.",
                    success: false
                };
            }

            // Update state
            state.step = 'user_model_selection';
            state.availableModels = models;
            this.conversationStates.set(sessionId, state);

            // Generate AI-driven response for model selection
            return await this.generateUserModelSelectionResponse(models, state.selectedEvaluator);

        } catch (error) {
            console.error('Error getting user models:', error);
            return {
                answer: "I encountered an error getting your models. Please try again.",
                success: false
            };
        }
    }

    /**
     * Generate AI-driven response for user model selection
     * @param {Array} models - Available user models
     * @param {Object} selectedEvaluator - Selected evaluator
     * @returns {Promise<Object>} AI-generated response
     */
    async generateUserModelSelectionResponse(models, selectedEvaluator) {
        try {
            const modelsContext = models.map(model => 
                `- ${model.name}: ${model.description || 'AI model'}`
            ).join('\n');

            const evaluatorName = selectedEvaluator.name || selectedEvaluator.title;

            const selectionPrompt = `You are guiding a user through the final step of evaluator association. Generate a brief response.

CONTEXT: The user has configured the evaluator "${evaluatorName}" and now needs to choose which of their models to associate it with.

AVAILABLE MODELS:
${modelsContext}

TASK: Generate a brief response that:
1. Explains this is the final step
2. Presents the available models clearly
3. Asks them to choose which models they want to associate with the evaluator

GUIDELINES:
- Be helpful but very concise
- Explain that the evaluator will monitor these models briefly
- Make it conversational but brief
- Suggest they can choose specific models or all models
- Always list all the models

Generate a brief final step response:`;

            const response = await aiService.generateResponse(selectionPrompt, { maxTokens: 200 });

            return {
                answer: response.answer,
                success: true,
                step: 'user_model_selection',
                availableModels: models
            };

        } catch (error) {
            console.error('Error generating user model selection response:', error);
            return {
                answer: `Perfect! Now I need to know which of your models you'd like to associate with the "${selectedEvaluator.name || selectedEvaluator.title}" evaluator. Which models should I connect it to?`,
                success: true,
                step: 'user_model_selection',
                availableModels: models
            };
        }
    }

    /**
     * Proceed to provider model selection after token creation
     * @param {string} sessionId - Session identifier
     * @returns {Promise<Object>} Flow response
     */
    async proceedToProviderModelSelection(sessionId) {
        const state = this.conversationStates.get(sessionId);
        
        try {
            console.log(`🏗️ Getting provider models for ${state.tokenCreation.providerName}...`);
            
            // Find the selected provider from the existing providers data
            const selectedProvider = state.providers.find(provider => 
                provider.id == state.tokenCreation.providerId
            );

            if (!selectedProvider) {
                return {
                    answer: `I couldn't find the provider information for ${state.tokenCreation.providerName}. Please try again.`,
                    success: false
                };
            }

            // Extract models from provider config
            let providerModels = [];
            try {
              console.log("selectedProvider", selectedProvider);
                const config = typeof selectedProvider.config === 'string' 
                    ? JSON.parse(selectedProvider.config) 
                    : selectedProvider.config;
                
                providerModels = config?.models || [];
            } catch (configError) {
                console.error('Error parsing provider config:', configError);
                providerModels = [];
            }

            if (providerModels.length === 0) {
                return {
                    answer: `${state.tokenCreation.providerName} doesn't have any available models configured. Please contact support.`,
                    success: false
                };
            }

            // Update state
            state.step = 'provider_model_selection';
            state.providerModels = providerModels;
            this.conversationStates.set(sessionId, state);

            console.log(`📋 Found ${providerModels.length} models in ${state.tokenCreation.providerName} config`);

            return {
                answer: `Great! I've created the integration token "${state.tokenCreation.name}". Now I need to know which model from ${state.tokenCreation.providerName} you'd like to use as the default for this evaluator. Which model would you like to use? \n ${providerModels.map(model => `- ${model}`).join('\n')}`,
                success: true,
                step: 'provider_model_selection',
                providerModels: providerModels
            };

        } catch (error) {
            console.error('Error getting provider models from config:', error);
            return {
                answer: "I encountered an error getting the provider models. Please try again.",
                success: false
            };
        }
    }

    /**
     * Handle user model selection for association
     * @param {string} sessionId - Session identifier
     * @param {string} userResponse - User's response
     * @returns {Promise<Object>} Flow response
     */
    async handleUserModelSelection(sessionId, userResponse) {
        const state = this.conversationStates.get(sessionId);
        if (!state || state.step !== 'user_model_selection') {
            return { answer: "I lost track of our conversation. Let's start over.", success: false };
        }

        try {
            // Use AI to understand which models the user wants
            const modelAnalysis = await this.analyzeModelSelection(userResponse, state.availableModels);
            
            console.log('🧠 User model selection analysis:', modelAnalysis);

            if (modelAnalysis.selectedModels.length === 0) {
                // AI couldn't identify clear selections, ask for clarification
                return await this.generateModelClarificationResponse(userResponse, state.availableModels);
            }

            const selectedModels = modelAnalysis.selectedModels;
            
            console.log(`🔗 Starting associations for ${selectedModels.length} models and 1 evaluator`);
            
            // Perform associations (single evaluator to multiple models)
            return await this.performSingleEvaluatorAssociations(sessionId, selectedModels, state.selectedEvaluator, state.userApiToken);

        } catch (error) {
            console.error('Error in AI user model selection:', error);
            return {
                answer: "I had trouble understanding which models you'd like. Could you tell me which specific models you want to associate the evaluator with?",
                success: true,
                step: 'user_model_selection'
            };
        }
    }

    /**
     * Perform associations for a single evaluator to multiple models
     * @param {string} sessionId - Session identifier
     * @param {Array} models - Selected user models
     * @param {Object} evaluator - Selected evaluator
     * @param {string} userApiToken - User's API token
     * @returns {Promise<Object>} Flow response
     */
    async performSingleEvaluatorAssociations(sessionId, models, evaluator, userApiToken) {
        try {
            const results = [];
            const errors = [];

            // Perform associations for each model with the single evaluator
            for (const model of models) {
                try {
                    const associationResult = await this.apiService.executeAction('associate_evaluator_to_model_new', {
                        modelId: model.id,
                        evaluationPromptId: evaluator.id
                    }, userApiToken);

                    if (associationResult.success) {
                        results.push(`✅ ${evaluator.name || evaluator.title} → ${model.name}`);
                    } else {
                        errors.push(`❌ ${evaluator.name || evaluator.title} → ${model.name}: ${associationResult.error}`);
                    }
                } catch (error) {
                    errors.push(`❌ ${evaluator.name || evaluator.title} → ${model.name}: ${error.message}`);
                }
            }

            // Clean up state
            this.conversationStates.delete(sessionId);

            // Generate summary response
            let response = `🎉 **Evaluator Association Complete!**\n\n`;
            
            if (results.length > 0) {
                response += `**Successful Associations:**\n${results.join('\n')}\n\n`;
            }
            
            if (errors.length > 0) {
                response += `**Failed Associations:**\n${errors.join('\n')}\n\n`;
            }
            
            response += `Summary: ${results.length} successful, ${errors.length} failed out of ${results.length + errors.length} total associations.`;
            
            if (errors.length === 0) {
                response += `\n\n✨ The evaluator "${evaluator.name || evaluator.title}" has been successfully associated with your models! It will now evaluate their performance.`;
            }

            return {
                answer: response,
                success: results.length > 0,
                step: 'completed',
                evaluators_added: true,
                summary: {
                    successful: results.length,
                    failed: errors.length,
                    total: results.length + errors.length
                }
            };

        } catch (error) {
            console.error('Error performing single evaluator associations:', error);
            this.conversationStates.delete(sessionId);
            return {
                answer: "I encountered an error while performing the evaluator associations. Please try again.",
                success: false,
                step: 'error',
                evaluators_added: false
            };
        }
    }
}

module.exports = EvaluatorConnectionService; 