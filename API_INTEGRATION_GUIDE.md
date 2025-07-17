# API Integration Guide

This document explains how to integrate your AI agent with external APIs using the modular API service architecture.

## Overview

The AI agent features a completely modular API integration system that can work with any REST API. It includes:

1. **JSON Configuration**: All API endpoints and actions are defined in `src/config/apiActions.json`
2. **Generic Service**: `src/services/apiService.js` handles all HTTP operations
3. **Smart Detection**: AI automatically determines when to use API vs documentation
4. **Graceful Fallback**: Works perfectly without any API configuration

## Configuration

### Environment Variables

```bash
# Required - External API integration
API_URL=https://api.example.com

# Optional - Default API key (users can provide their own via Authorization header)
API_KEY=your_default_api_key_here
```

### API Actions Configuration

Edit `src/config/apiActions.json` to define your API endpoints:

```json
{
  "baseUrl": {
    "env": "API_URL",
    "description": "Base URL for the API service"
  },
  "authentication": {
    "type": "bearer",
    "tokenEnv": "API_KEY",
    "description": "API authentication using Bearer token"
  },
  "actions": {
    "create_integration_token": {
      "method": "POST",
      "endpoint": "/agents/{agentId}/integration-tokens",
      "description": "Create a new integration token for an agent",
      "parameters": {
        "required": ["agentId"],
        "optional": ["name", "description", "expiresAt"]
      },
      "requestBody": {
        "name": "string",
        "description": "string",
        "expiresAt": "datetime"
      }
    }
  }
}
```

## Current API Actions

The system is pre-configured with these actions:

### Integration Token Management
- `create_integration_token` - Create new integration tokens
- `get_integration_tokens` - List agent integration tokens
- `revoke_integration_token` - Revoke specific tokens
- `get_integration_tokens_list` - Get list of existing integration tokens
- `create_integration_token_new` - Create new integration token with provider
- `get_providers` - Get list of available providers

### Evaluator Management
- `get_evaluators` - List available evaluators
- `get_model_evaluators` - Get evaluators for a model
- `associate_evaluator_to_model` - Associate evaluator with model
- `remove_evaluator_from_model` - Remove evaluator from model
- `get_evaluation_prompts` - Get available evaluators/evaluation prompts
- `get_user_models` - Get user's models/nodes
- `associate_evaluator_to_model_new` - Associate evaluator to model (new endpoint)

### Specialized Flows
- **Evaluator Connection Flow** - Multi-step guided process for connecting evaluators to models

## Usage Examples

### Documentation Mode (Always Available)

```bash
# User asks about setup
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How do I set up integration tokens?",
    "sessionId": "user123"
  }'
```

**Response**: Step-by-step documentation and guidance

### API Mode (When Configured)

```bash
# User requests token creation (with API token in Authorization header)
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_token_here" \
  -d '{
    "question": "Create an integration token for agent abc123",
    "sessionId": "user123"
  }'
```

**Response**: Creates the token via API and provides confirmation

### Evaluator Connection Flow

The system includes a specialized multi-step flow for connecting evaluators to models:

```bash
# User initiates evaluator connection
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_token_here" \
  -d '{
    "question": "I want to connect evaluators to my agent",
    "sessionId": "user123"
  }'
```

**Flow Steps:**
1. **Token Selection** - Choose existing integration token or create new one
2. **Token Creation** (if needed) - Select provider, provide name and token
3. **Evaluator Selection** - Choose which evaluators to associate
4. **Model Selection** - Choose which models to associate evaluators with
5. **Association** - Perform all evaluator-model associations

### API Mode with User Token

Users can provide their own API token via the Authorization header:

```bash
# Using user's own API token
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer user_specific_token" \
  -d '{
    "question": "Show me my integration tokens",
    "sessionId": "user123"
  }'
```

**Note**: The Authorization header is NOT for authenticating with the AI agent endpoint itself, but for providing an API token that the agent will use when making calls to the external API on behalf of the user.

## Adding New Actions

### 1. Update Configuration

Add your new action to `src/config/apiActions.json`:

```json
{
  "your_new_action": {
    "method": "POST",
    "endpoint": "/your-endpoint/{id}",
    "description": "Description of your action",
    "parameters": {
      "required": ["id"],
      "optional": ["optionalParam"]
    },
    "requestBody": {
      "data": "string"
    }
  }
}
```

### 2. Test Integration

```bash
# Test the new action
curl -X GET http://localhost:3000/api/ai/test-api
```

### 3. Update AI Evaluation

The system automatically picks up new actions from the JSON configuration. No code changes needed!

## Smart Action Detection

The AI evaluates user requests and automatically determines if API action is needed:

### API-worthy requests:
- "create a token for agent xyz"
- "show me evaluators for model abc"
- "list my models"
- "get providers"

### Specialized flow requests:
- "connect evaluators to my agent"
- "associate evaluators with my models"
- "set up evaluation for my AI"

### Documentation requests:
- "how do I create tokens?"
- "what are evaluators?"
- "explain the integration process"

## Example Conversations

### 1. Setup Help (Documentation Mode)

**User**: "How do I set up integration tokens?"

**Agent**: "I'll help you set up integration tokens step by step. First, let me explain what integration tokens are..."

### 2. Evaluator Connection Flow (API Mode)

**User**: "I want to connect evaluators to my agent"

**Agent**: "I found these existing integration tokens:
1. Production Token (OpenAI)
2. Development Token (Anthropic)

Would you like to:
1. Use one of these existing tokens
2. Create a new token

Please respond with "use existing" or "create new", or specify the number of the token you'd like to use."

**User**: "use existing 1"

**Agent**: "Great! Using Production Token (OpenAI).

Available evaluators:
1. Content Safety Evaluator - Checks for harmful content
2. Accuracy Evaluator - Measures response accuracy
3. Bias Detection - Detects potential bias in responses

Please select the evaluators you want by their numbers (e.g., "1, 3" or "1-3" for range):"

**User**: "1, 2"

**Agent**: "Excellent! You've selected: Content Safety Evaluator, Accuracy Evaluator

Your models:
1. Customer Support Bot - Main customer service AI
2. Content Generator - Marketing content AI

Please select the models by their numbers (e.g., "1, 2" or "all"):"

**User**: "all"

**Agent**: "🎉 **Evaluator Connection Complete!**

**Successful Associations:**
✅ Content Safety Evaluator → Customer Support Bot
✅ Content Safety Evaluator → Content Generator
✅ Accuracy Evaluator → Customer Support Bot
✅ Accuracy Evaluator → Content Generator

Summary: 4 successful, 0 failed out of 4 total associations.

✨ All evaluators have been successfully connected to your models! They will now evaluate your AI agent's performance."

### 3. Simple API Actions (API Mode)

**User**: "List my models"

**Agent**: "Here are your models:
1. Customer Support Bot (ID: model_123)
2. Content Generator (ID: model_456)
3. Data Analyzer (ID: model_789)"

### 4. Fallback Behavior

**User**: "Connect evaluators" (but no API token provided)

**Agent**: "To connect evaluators to your models, I need your API token. Please include your API token in the Authorization header of your request."

## Error Handling

### API Not Configured
- Gracefully falls back to documentation mode
- User gets helpful setup instructions
- No disruption to core functionality

### API Errors
- Meaningful error messages
- Automatic fallback to documentation
- Detailed logging for debugging

## Testing

### Health Check
```bash
curl -X GET http://localhost:3000/api/ai/health
```

### API Integration Test
```bash
curl -X GET http://localhost:3000/api/ai/test-api
```

### Response Format
```json
{
  "apiAvailable": true,
  "health": {
    "healthy": true,
    "message": "API is healthy"
  },
  "availableActions": [
    {
      "name": "create_integration_token",
      "description": "Create a new integration token for an agent",
      "method": "POST",
      "endpoint": "/agents/{agentId}/integration-tokens",
      "parameters": {
        "required": ["agentId"],
        "optional": ["name", "description", "expiresAt"]
      }
    }
  ]
}
```

## Deployment Configuration

### Cloud Build Secrets

Add these secrets to your Cloud Build configuration:

```yaml
- '--set-secrets'
- 'API_KEY=AGENT_API_KEY:latest'
- '--set-secrets'
- 'API_URL=AGENT_API_URL:latest'
```

### Google Secret Manager

```bash
# Create API secrets
gcloud secrets create API_KEY --data-file=- <<< "your_api_key"
gcloud secrets create API_URL --data-file=- <<< "https://api.example.com"
```

## Token Management

The system supports multiple ways to provide API tokens:

### 1. Environment Variable (Default)
```bash
API_KEY=default_api_key_here
```

### 2. User-Provided Token (Per Request)
```bash
# Users send their token in Authorization header
curl -X POST /api/ai/chat \
  -H "Authorization: Bearer user_token_here" \
  -d '{"question": "create token", "sessionId": "123"}'
```

### 3. Token Priority
1. **User-provided token** (Authorization header) - Takes precedence
2. **Environment token** (API_KEY) - Fallback default
3. **No token** - API calls will fail gracefully, falls back to documentation

### 4. API-Only Mode (No Environment Tokens)
The system can work with just `API_URL` configured and no `API_KEY`:

```bash
# Only API_URL is configured
API_URL=https://api.example.com
# API_KEY is not set

# Users must provide their own tokens
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Authorization: Bearer user_token" \
  -d '{"question": "create token for agent xyz"}'
```

This is perfect for multi-tenant scenarios where each user has their own API credentials.

## Architecture Benefits

### 1. Modular Design
- Easy to add new APIs
- No hard dependencies
- Clean separation of concerns

### 2. Configuration-Driven
- No code changes for new endpoints
- JSON-based action definitions
- Environment-specific configurations

### 3. Flexible Authentication
- Per-user API tokens
- Default fallback tokens
- Graceful degradation

### 4. Robust Error Handling
- Graceful degradation
- Comprehensive logging
- User-friendly error messages

### 5. Open Source Friendly
- Works without any API
- Optional enhancements
- Community-extensible

## Security Considerations

### 1. API Key Management
- Store keys in environment variables
- Use secret management systems
- Rotate keys regularly

### 2. Request Validation
- Parameter validation
- Input sanitization
- Rate limiting

### 3. Error Information
- Don't expose internal errors
- Sanitize error messages
- Log detailed errors securely

## Migration from Previous Versions

If you're upgrading from the old Handit-specific API:

1. Update environment variables:
   - `HANDIT_API_URL` → `API_URL`
   - `HANDIT_API_KEY` → `API_KEY`

2. Update secret names in deployment:
   - `AGENT_HANDIT_API_URL` → `AGENT_API_URL`
   - `AGENT_HANDIT_API_KEY` → `AGENT_API_KEY`

3. The system automatically uses the new configuration

## Contributing

To add support for new APIs:

1. Fork the repository
2. Update `src/config/apiActions.json`
3. Test with your API
4. Submit a pull request

The modular design makes it easy to extend without breaking existing functionality. 