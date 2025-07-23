/**
 * Optimization Service
 * @module services/optimizationService
 */

const ApiService = require('./apiService');

class OptimizationService {
    constructor() {
        this.apiService = new ApiService();
    }

    /**
     * Run optimization process based on model ID and model log ID
     * @param {string} modelId - The model ID
     * @param {number} modelLogId - The model log ID
     * @param {string} userApiToken - Optional user API token
     * @returns {Object} Optimization result with status and flags
     */
    async runOptimization(modelId, modelLogId, userApiToken = null) {
        try {
            console.log(`🚀 Starting optimization process for model: ${modelId}, log: ${modelLogId}`);
            
            // Step 1: Validate inputs
            if (!modelId || !modelLogId) {
                throw new Error('Model ID and Model Log ID are required');
            }

            // Step 2: Check if API is available
            const apiHealth = await this.apiService.healthCheck();
            if (!apiHealth.healthy) {
                throw new Error('External API is not available for optimization');
            }

            // Step 3: Run optimization via API
            const optimizationResult = await this.apiService.executeAction(
                'run_optimization',
                {
                    modelId: modelId,
                    modelLogId: modelLogId
                },
                userApiToken
            );

            console.log(`✅ Optimization completed for model: ${modelId}, log: ${modelLogId}`);

            return {
                success: true,
                message: 'Optimization process finished successfully',
                modelId: modelId,
                modelLogId: modelLogId,
                optimizationId: optimizationResult.optimizationId || null,
                status: 'completed',
                timestamp: new Date().toISOString(),
                flags: {
                    optimization_completed: true,
                    optimization_success: true,
                    has_optimization_results: true
                },
                metadata: {
                    processingTime: optimizationResult.processingTime || 0,
                    apiUsed: !!userApiToken ? 'user_token' : 'environment_token'
                }
            };

        } catch (error) {
            console.error(`❌ Optimization failed for model: ${modelId}, log: ${modelLogId}:`, error);
            
            return {
                success: false,
                message: `Optimization process failed: ${error.message}`,
                modelId: modelId,
                modelLogId: modelLogId,
                status: 'failed',
                timestamp: new Date().toISOString(),
                flags: {
                    optimization_completed: true,
                    optimization_success: false,
                    has_optimization_results: false
                },
                error: {
                    code: error.code || 'OPTIMIZATION_ERROR',
                    message: error.message,
                    details: error.details || null
                }
            };
        }
    }

    /**
     * Get optimization status
     * @param {string} optimizationId - The optimization ID
     * @param {string} userApiToken - Optional user API token
     * @returns {Object} Optimization status
     */
    async getOptimizationStatus(optimizationId, userApiToken = null) {
        try {
            const statusResult = await this.apiService.executeAction(
                'get_optimization_status',
                {
                    optimizationId: optimizationId
                },
                userApiToken
            );

            return {
                success: true,
                optimizationId: optimizationId,
                status: statusResult.status || 'unknown',
                progress: statusResult.progress || 0,
                result: statusResult.result || null,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error(`❌ Failed to get optimization status for: ${optimizationId}:`, error);
            
            return {
                success: false,
                optimizationId: optimizationId,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Health check for optimization service
     * @returns {Object} Health status
     */
    async healthCheck() {
        try {
            const apiHealth = await this.apiService.healthCheck();
            
            return {
                healthy: apiHealth.healthy,
                message: apiHealth.healthy ? 'Optimization service is ready' : 'External API not available',
                apiAvailable: apiHealth.healthy,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                healthy: false,
                message: `Health check failed: ${error.message}`,
                apiAvailable: false,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = OptimizationService; 