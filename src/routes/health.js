/**
 * Health Check Routes
 * 
 * This module provides health check endpoints for monitoring the server status.
 * Health checks are essential for:
 * - Load balancers to determine if the service is healthy
 * - Monitoring systems to track service availability
 * - DevOps teams to verify service status
 * - Automated testing to ensure the API is responding
 * 
 * @author Handit.ai Team
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/health
 * 
 * Health check endpoint that returns server status and metrics.
 * This endpoint is typically used by:
 * - Load balancers for health checks
 * - Monitoring systems (Prometheus, Datadog, etc.)
 * - DevOps tools for service discovery
 * - Automated testing frameworks
 * 
 * @route GET /api/health
 * @returns {Object} Health information including status, uptime, memory usage, etc.
 * 
 * @example Response:
 * {
 *   "status": "OK",
 *   "timestamp": "2024-01-15T10:30:00.000Z",
 *   "uptime": 3600,
 *   "service": "Handit.ai Docs AI Agent",
 *   "version": "1.0.0",
 *   "environment": "development",
 *   "memory": {
 *     "used": 45.2,
 *     "total": 67.8
 *   }
 * }
 */
router.get('/', (req, res) => {
  // Collect comprehensive health information
  const healthInfo = {
    status: 'OK', // Service status - always 'OK' if endpoint is reachable
    timestamp: new Date().toISOString(), // Current server time
    uptime: process.uptime(), // Server uptime in seconds
    service: 'Handit.ai Docs AI Agent', // Service name for identification
    version: '1.0.0', // API version
    environment: process.env.NODE_ENV || 'development', // Current environment
    memory: {
      // Memory usage in MB (heap used by the Node.js process)
      used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      // Total heap memory allocated in MB
      total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100
    }
  };

  // Return health information with 200 status code
  res.status(200).json(healthInfo);
});

module.exports = router; 