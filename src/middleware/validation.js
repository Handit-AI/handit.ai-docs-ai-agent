/**
 * Validation Middleware for AI endpoints
 * @module middleware/validation
 */

/**
 * Validate question for legacy conversation (minimal validation)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function validateQuestion(req, res, next) {
    // Skip validation - allow any question to pass through
    next();
}

/**
 * Rate limiting middleware for AI endpoints
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function rateLimitAI(req, res, next) {
    const clientIP = req.ip || req.connection.remoteAddress;
    const timestamp = Date.now();
    
    // Simple in-memory rate limiting (in production, use Redis or similar)
    if (!global.rateLimitStore) {
        global.rateLimitStore = new Map();
    }
    
    const key = `${clientIP}`;
    const windowMs = 60 * 1000; // 1 minute window
    const maxRequests = 30; // 30 requests per minute
    
    const requestLog = global.rateLimitStore.get(key) || [];
    
    // Remove old requests outside the window
    const recentRequests = requestLog.filter(time => timestamp - time < windowMs);
    
    if (recentRequests.length >= maxRequests) {
        return res.status(429).json({
            error: 'Too many requests. Please try again later.',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil(windowMs / 1000)
        });
    }
    
    // Add current request
    recentRequests.push(timestamp);
    global.rateLimitStore.set(key, recentRequests);
    
    // Clean up old entries periodically
    if (global.rateLimitStore.size > 1000) {
        const cutoff = timestamp - windowMs;
        for (const [k, requests] of global.rateLimitStore.entries()) {
            const validRequests = requests.filter(time => time > cutoff);
            if (validRequests.length === 0) {
                global.rateLimitStore.delete(k);
            } else {
                global.rateLimitStore.set(k, validRequests);
            }
        }
    }
    
    // Add rate limit headers
    res.set({
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Remaining': Math.max(0, maxRequests - recentRequests.length),
        'X-RateLimit-Reset': new Date(timestamp + windowMs).toISOString()
    });
    
    next();
}

/**
 * Log requests for monitoring and debugging
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function logRequest(req, res, next) {
    const timestamp = new Date().toISOString();
    const clientIP = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || 'Unknown';
    const method = req.method;
    const url = req.originalUrl;
    
    console.log(`📝 [${timestamp}] ${method} ${url} - IP: ${clientIP} - UA: ${userAgent.substring(0, 50)}...`);
    
    // Log request body for AI endpoints (excluding sensitive data)
    if (req.body && (req.body.message || req.body.question)) {
        const content = req.body.message || req.body.question;
        console.log(`📝 Content: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);
    }
    
    next();
}

module.exports = {
    validateQuestion,
    rateLimitAI,
    logRequest
};
