/**
 * Generic API Service
 * Handles interactions with any API as an optional tool
 * @module services/apiService
 */

const axios = require('axios');
const apiConfig = require('../config/apiActions.json');

class ApiService {
    constructor() {
        this.apiUrl = //process.env[apiConfig.baseUrl.env];
        this.apiUrl = "http://localhost:3001";
        this.apiKey = process.env[apiConfig.authentication.tokenEnv];
        this.isEnabled = this.apiUrl && this.apiKey;
        this.config = apiConfig;
        
        if (this.isEnabled) {
            this.client = axios.create({
                baseURL: this.apiUrl,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10 second timeout
            });
        }
        
        const status = this.apiUrl ? 
            (this.apiKey ? 'Fully configured' : 'URL configured (token can be provided by user)') : 
            'Disabled (missing API_URL)';
        console.log(`🔌 API Service: ${status}`);
    }

    /**
     * Check if the API is available
     * @returns {boolean} True if API is configured and available
     */
    isAvailable() {
        // API is available if we have at least the URL (token can come from user)
        return !!this.apiUrl;
    }

    /**
     * Get available API actions/tools
     * @returns {Array} List of available actions
     */
    getAvailableActions() {
        if (!this.apiUrl) {
            return [];
        }

        return Object.keys(this.config.actions).map(actionName => ({
            name: actionName,
            description: this.config.actions[actionName].description,
            method: this.config.actions[actionName].method,
            endpoint: this.config.actions[actionName].endpoint,
            parameters: this.config.actions[actionName].parameters
        }));
    }

    /**
     * Execute an action on the API
     * @param {string} actionName - Name of the action to execute
     * @param {Object} parameters - Parameters for the action
     * @param {string} userApiToken - Optional user-provided API token
     * @returns {Promise<Object>} API response or error
     */
    async executeAction(actionName, parameters = {}, userApiToken = null) {
        // Check if we have API URL configured (API_KEY is optional if user provides token)
        if (!this.apiUrl) {
            return {
                success: false,
                error: 'API Service is not configured. Please set API_URL environment variable.',
                isOptional: true
            };
        }
        
        // Check if we have any token (either from env or user-provided)
        if (!this.apiKey && !userApiToken) {
            return {
                success: false,
                error: 'No API token available. Either set API_KEY environment variable or provide Authorization header.',
                isOptional: true
            };
        }

        const actionConfig = this.config.actions[actionName];
        if (!actionConfig) {
            return {
                success: false,
                error: `Unknown action: ${actionName}`,
                availableActions: this.getAvailableActions()
            };
        }

        try {
            console.log(`🚀 Executing API action: ${actionName}`, parameters);
            
            // Determine which API token to use
            const tokenToUse = userApiToken || this.apiKey;
            const tokenSource = userApiToken ? 'user-provided' : 'environment';
            console.log(`🔑 Using ${tokenSource} API token for request`);
            
            // Build the endpoint URL with parameter substitution
            let endpoint = actionConfig.endpoint;
            
            // Replace path parameters (e.g., {agentId} with actual values)
            const pathParamMatches = endpoint.match(/\{([^}]+)\}/g);
            if (pathParamMatches) {
                for (const match of pathParamMatches) {
                    const paramName = match.slice(1, -1); // Remove { and }
                    if (parameters[paramName]) {
                        endpoint = endpoint.replace(match, parameters[paramName]);
                    } else {
                        throw new Error(`Missing required parameter: ${paramName}`);
                    }
                }
            }
            
            // Prepare request options
            const requestOptions = {
                method: actionConfig.method.toLowerCase(),
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            // Add authorization header if we have a token
            if (tokenToUse) {
                requestOptions.headers['Authorization'] = `Bearer ${tokenToUse}`;
            }
            
            // Add query parameters for GET requests
            if (actionConfig.method === 'GET') {
                const queryParams = {};
                if (actionConfig.parameters?.optional) {
                    for (const param of actionConfig.parameters.optional) {
                        if (parameters[param] !== undefined) {
                            queryParams[param] = parameters[param];
                        }
                    }
                }
                if (Object.keys(queryParams).length > 0) {
                    requestOptions.params = queryParams;
                }
            }
            
            // Add request body for POST/PUT/PATCH requests
            if (['POST', 'PUT', 'PATCH'].includes(actionConfig.method)) {
                const requestBody = {};
                if (actionConfig.requestBody) {
                    for (const [key, type] of Object.entries(actionConfig.requestBody)) {
                        if (parameters[key] !== undefined) {
                            requestBody[key] = parameters[key];
                        }
                    }
                }
                requestOptions.data = requestBody;
            }
            
            // Execute the request using axios directly for better control over headers
            const response = await axios.request({
                ...requestOptions,
                baseURL: this.apiUrl,
                timeout: 10000
            });

            return {
                success: true,
                data: response.data,
                action: actionName,
                parameters: parameters
            };

        } catch (error) {
            console.error(`❌ Error executing API action ${actionName}:`, error.message);
            
            // Handle different types of errors
            if (error.response) {
                // API returned an error response
                return {
                    success: false,
                    error: error.response.data?.message || 'API error occurred',
                    status: error.response.status,
                    action: actionName,
                    isApiError: true
                };
            } else if (error.request) {
                // Network error
                return {
                    success: false,
                    error: 'Failed to connect to API. Please check your connection and API URL.',
                    action: actionName,
                    isNetworkError: true
                };
            } else {
                // Other error
                return {
                    success: false,
                    error: `Error executing action: ${error.message}`,
                    action: actionName
                };
            }
        }
    }

    /**
     * Health check for the API
     * @returns {Promise<Object>} Health status
     */
    async healthCheck() {
        if (!this.apiUrl) {
            return {
                healthy: false,
                message: 'API URL not configured',
                isOptional: true
            };
        }

        try {
            const response = await this.client.get('/health');
            return {
                healthy: true,
                message: 'API is healthy',
                status: response.status,
                data: response.data
            };
        } catch (error) {
            return {
                healthy: false,
                message: error.message,
                isNetworkError: !error.response
            };
        }
    }

    /**
     * Get formatted action description for AI prompts
     * @returns {string} Formatted description of available actions
     */
    getActionsDescription() {
        if (!this.apiUrl) {
            return "API Service is not configured. The agent can still provide documentation and guidance without API access.";
        }

        const actions = this.getAvailableActions();
        const descriptions = actions.map(action => {
            const requiredParams = action.parameters?.required || [];
            const optionalParams = action.parameters?.optional || [];
            const allParams = [...requiredParams, ...optionalParams.map(p => `${p}?`)];
            
            return `- ${action.name}: ${action.description} (${action.method} ${action.endpoint}) - Parameters: ${allParams.join(', ') || 'none'}`;
        }).join('\n');

        return `Available API actions:\n${descriptions}`;
    }
}

module.exports = ApiService; 