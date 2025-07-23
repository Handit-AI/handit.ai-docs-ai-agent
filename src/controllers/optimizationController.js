/**
 * Optimization Controller
 * @module controllers/optimizationController
 */

const OptimizationService = require('../services/optimizationService');

// Initialize optimization service
const optimizationService = new OptimizationService();

/**
 * Run optimization process
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function runOptimization(req, res) {
    const startTime = Date.now();
    
    try {
        const { modelId } = req.params;
        const { modelLogId } = req.body;
        
        // Debug logging for parameter extraction
        console.log('🔍 DEBUG - Request params:', req.params);
        console.log('🔍 DEBUG - Request body:', req.body);
        console.log('🔍 DEBUG - Extracted modelId:', modelId);
        console.log('🔍 DEBUG - Extracted modelLogId:', modelLogId, 'Type:', typeof modelLogId);
        
        // Extract Authorization Bearer token from headers
        const authHeader = req.headers.authorization;
        let userApiToken = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            userApiToken = authHeader.substring(7); // Remove 'Bearer ' prefix
            console.log('🔑 User provided API token for optimization');
        }
        
        // Validate inputs
        if (!modelId) {
            return res.status(400).json({
                error: 'Model ID is required in URL parameters',
                code: 'MISSING_MODEL_ID'
            });
        }
        
        if (!modelLogId || typeof modelLogId !== 'number') {
            return res.status(400).json({
                error: 'Model Log ID is required and must be a number',
                code: 'INVALID_MODEL_LOG_ID',
                details: {
                    received: modelLogId,
                    type: typeof modelLogId,
                    body: req.body
                }
            });
        }

        console.log(`🚀 Starting optimization for model: ${modelId}, log: ${modelLogId}`);
        
        // Run optimization process
        const result = await optimizationService.runOptimization(modelId, modelLogId, userApiToken);
        
        const processingTime = Date.now() - startTime;
        
        if (result.success) {
            console.log(`✅ Optimization completed successfully for model: ${modelId}`);
            
            res.json({
                success: true,
                message: result.message,
                modelId: modelId,
                modelLogId: modelLogId,
                optimizationId: result.optimizationId,
                status: result.status,
                flags: result.flags,
                metadata: {
                    processingTimeMs: processingTime,
                    timestamp: new Date().toISOString(),
                    apiUsed: result.metadata.apiUsed
                }
            });
        } else {
            console.log(`❌ Optimization failed for model: ${modelId}: ${result.message}`);
            
            res.status(500).json({
                success: false,
                message: result.message,
                modelId: modelId,
                modelLogId: modelLogId,
                status: result.status,
                flags: result.flags,
                error: result.error,
                metadata: {
                    processingTimeMs: processingTime,
                    timestamp: new Date().toISOString()
                }
            });
        }

    } catch (error) {
        console.error('❌ Error in optimization:', error);
        
        const processingTime = Date.now() - startTime;
        
        res.status(500).json({
            success: false,
            error: 'Internal server error during optimization',
            code: 'OPTIMIZATION_ERROR',
            message: error.message,
            metadata: {
                processingTimeMs: processingTime,
                timestamp: new Date().toISOString()
            }
        });
    }
}

/**
 * Get optimization status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getOptimizationStatus(req, res) {
    try {
        const { optimizationId } = req.params;
        
        // Extract Authorization Bearer token from headers
        const authHeader = req.headers.authorization;
        let userApiToken = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            userApiToken = authHeader.substring(7);
        }
        
        if (!optimizationId) {
            return res.status(400).json({
                error: 'Optimization ID is required',
                code: 'MISSING_OPTIMIZATION_ID'
            });
        }

        console.log(`📊 Getting optimization status for: ${optimizationId}`);
        
        const result = await optimizationService.getOptimizationStatus(optimizationId, userApiToken);
        
        if (result.success) {
            res.json({
                success: true,
                optimizationId: optimizationId,
                status: result.status,
                progress: result.progress,
                result: result.result,
                timestamp: result.timestamp
            });
        } else {
            res.status(404).json({
                success: false,
                error: result.error,
                optimizationId: optimizationId,
                timestamp: result.timestamp
            });
        }

    } catch (error) {
        console.error('❌ Error getting optimization status:', error);
        
        res.status(500).json({
            success: false,
            error: 'Error retrieving optimization status',
            code: 'STATUS_ERROR',
            message: error.message
        });
    }
}

/**
 * Get optimization service health
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getOptimizationHealth(req, res) {
    try {
        const health = await optimizationService.healthCheck();
        
        res.json({
            service: 'optimization',
            status: health.healthy ? 'healthy' : 'unhealthy',
            message: health.message,
            apiAvailable: health.apiAvailable,
            timestamp: health.timestamp
        });

    } catch (error) {
        console.error('❌ Optimization health check error:', error);
        
        res.status(500).json({
            service: 'optimization',
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

module.exports = {
    runOptimization,
    getOptimizationStatus,
    getOptimizationHealth
}; 