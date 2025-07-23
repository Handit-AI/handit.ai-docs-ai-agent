/**
 * Optimization Routes
 * @module routes/optimization
 */

const express = require('express');
const router = express.Router();

const { 
    runOptimization,
    getOptimizationStatus,
    getOptimizationHealth
} = require('../controllers/optimizationController');

/**
 * @route POST /api/prompt-version/model/:modelId/prompt/optimize-from-error
 * @desc Run optimization process based on model ID and model log ID
 * @access Public
 * @body { modelLogId: number }
 * @returns {Object} Optimization result with success status and flags
 */
router.post('/model/:modelId/prompt/optimize-from-error', runOptimization);

/**
 * @route GET /api/optimizations/:optimizationId
 * @desc Get optimization status and results
 * @access Public
 * @returns {Object} Optimization status and progress
 */
router.get('/:optimizationId', getOptimizationStatus);

/**
 * @route GET /api/optimizations/health
 * @desc Get optimization service health status
 * @access Public
 * @returns {Object} Health status of optimization service
 */
router.get('/health', getOptimizationHealth);

module.exports = router; 