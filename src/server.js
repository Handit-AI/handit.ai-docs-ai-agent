/**
 * Handit.ai Documentation AI Agent - Express Server
 * 
 * This is the main server file for the Handit.ai documentation AI agent backend.
 * It provides a REST API to interact with an AI agent specialized in answering
 * questions about Handit.ai documentation.
 * 
 * Features:
 * - Express.js REST API
 * - CORS support for cross-origin requests
 * - Security middleware (Helmet)
 * - Rate limiting to prevent abuse
 * - Request logging
 * - Error handling
 * - Health check endpoints
 * - AI agent endpoints
 * 
 * @author Handit.ai Team
 * @version 1.0.0
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import route modules
const aiRoutes = require('./routes/ai');
const healthRoutes = require('./routes/health');
const optimizationRoutes = require('./routes/optimization');

// Initialize Express application
const app = express();
const PORT = process.env.PORT || 3000;

/**
 * MIDDLEWARE CONFIGURATION
 */

// Security middleware - adds various HTTP headers for security
app.use(helmet());

// CORS (Cross-Origin Resource Sharing) configuration
// Allows specific origins to access the API based on environment
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'https://dashboard.handit.ai', 'https://handit.ai', 'https://beta.handit.ai'], // Development allowed origins
  credentials: true // Allow credentials (cookies, authorization headers)
}));

// Rate limiting middleware to prevent API abuse
// Limits the number of requests per IP address within a time window
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // Time window: 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Max requests per window: 100 default
  message: {
    error: 'Too many requests from this IP address, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use('/api/', limiter);

// HTTP request logging middleware (disabled during testing)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Body parsing middleware - enables parsing of JSON and URL-encoded data
app.use(express.json({ limit: '10mb' })); // Parse JSON payloads with 10MB limit
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded payloads

/**
 * ROUTE CONFIGURATION
 */

// Health check routes - for monitoring server status
app.use('/api/health', healthRoutes);

// AI agent routes - main functionality for processing questions
app.use('/api/ai', aiRoutes);

// Optimization routes - for running optimization processes
app.use('/api/prompt-version', optimizationRoutes);

// Default route - provides API information and available endpoints
app.get('/', (req, res) => {
  res.json({
    message: 'Handit.ai Docs AI Agent API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      ask: '/api/ai/ask',
      optimization: '/api/prompt-version/model/:modelId/prompt/optimize-from-error'
    }
  });
});

/**
 * ERROR HANDLING MIDDLEWARE
 */

// Global error handler - catches all unhandled errors
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong on the server.',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler - catches all undefined routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The route ${req.method} ${req.path} does not exist.`
  });
});

/**
 * SERVER STARTUP
 */

// Start the Express server on the specified port
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 Handit.ai Docs AI Agent started`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Export the Express app for testing purposes
module.exports = app; 