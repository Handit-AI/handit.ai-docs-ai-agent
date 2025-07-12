# Handit.ai Docs AI Agent

Professional multi-node agentic system for Handit.ai documentation assistance. Specialized Copilot that guides users through complete Handit.ai setup with intelligent phase detection and tech-stack specific instructions.

## 🚀 Features

### 6-LLM Specialized Architecture
- **🚦 Router Agent LLM**: Classifies queries as Handit.ai-related or off-topic
- **❓ Context Questioner LLM**: Intelligently asks for tech stack details when needed
- **🔄 Phase Router LLM**: Determines which Handit.ai phase user needs (1, 2, or 3)
- **👀 Observability LLM**: Phase 1 expert (Tracing/SDK setup) with 7-step complete guide
- **📊 Evaluation LLM**: Phase 2 expert (Quality evaluation setup)  
- **🚀 Self-Improving LLM**: Phase 3 expert (Optimization and A/B testing)

### Intelligent Copilot Features
- **Automatic Language Detection**: Responds in user's detected language (Spanish/English)
- **Tech Stack Detection**: Identifies Python/JavaScript, LangChain/OpenAI, local/cloud
- **Phase Prerequisites**: Ensures Phase 1 → Phase 2 → Phase 3 progression
- **Complete Setup Guides**: 7-step implementation with copy-paste code examples
- **Built-in Knowledge Base**: Direct access to complete Handit.ai documentation

### Advanced Technologies
- **Specialized LLM Routing**: Each LLM is an expert in its specific domain
- **Direct Knowledge Access**: Built-in handitKnowledgeBase with all documentation
- **Multi-LLM Processing**: OpenAI GPT with specialized prompts for each expert
- **Conversation Management**: PostgreSQL-based conversation persistence
- **Complete Logging**: All intermediate LLM responses included in API response

## 📋 Complete Setup Instructions

### Prerequisites

Before starting, you need:
- **Node.js 18+** - [Download here](https://nodejs.org/)
- **PostgreSQL 12+** - [Download here](https://www.postgresql.org/download/)
- **OpenAI API Key** - [Get it here](https://platform.openai.com/api-keys)
- **Pinecone Account** - [Sign up here](https://www.pinecone.io/)

### Step 1: Clone and Install

```bash
# 1. Clone the repository
git clone https://github.com/handit-ai/docs-ai-agent.git
cd docs-ai-agent

# 2. Install dependencies
npm install
```

### Step 2: Setup PostgreSQL Database

#### Option A: Local PostgreSQL Installation

```bash
# Install PostgreSQL (macOS with Homebrew)
brew install postgresql
brew services start postgresql

# Create database and user
psql postgres
```

```sql
-- In PostgreSQL console:
CREATE DATABASE handit_ai;
CREATE USER handit_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE handit_ai TO handit_user;
\q
```

#### Option B: Using Docker

```bash
# Run PostgreSQL in Docker
docker run --name handit-postgres \
  -e POSTGRES_DB=handit_ai \
  -e POSTGRES_USER=handit_user \
  -e POSTGRES_PASSWORD=your_secure_password \
  -p 5432:5432 \
  -d postgres:13

# Verify it's running
docker ps
```

### Step 3: Setup Pinecone (Optional - For Future Extensions)

The system now uses a built-in knowledge base (`handitKnowledgeBase`) with all Handit.ai documentation. Pinecone setup is optional but recommended for future extensibility.

#### 3.1 Create Pinecone Account (Optional)
1. Go to [Pinecone.io](https://www.pinecone.io/)
2. Click "Sign Up" and create a free account
3. Verify your email address

#### 3.2 Create API Key (Optional)
1. Log into your Pinecone dashboard
2. Go to "API Keys" in the left sidebar
3. Click "Create API Key"
4. Name it "handit-ai-docs" 
5. Copy the API key (you'll need this for `.env`)

#### 3.3 Create Pinecone Index (Optional)
1. In Pinecone dashboard, click "Indexes" in sidebar
2. Click "Create Index"
3. Fill in the details:
   - **Index Name**: `handit-ai-docs`
   - **Dimensions**: `1536` (for OpenAI ada-002 embeddings)
   - **Metric**: `cosine`
   - **Pod Type**: `p1.x1` (free tier)
4. Click "Create Index"
5. Wait for index to be ready (shows "Ready" status)

**Note**: The system works without Pinecone as it uses the built-in `handitKnowledgeBase`.

### Step 4: Setup OpenAI

#### 4.1 Create OpenAI Account
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Add payment method (required for API access)

#### 4.2 Create API Key
1. Go to [API Keys page](https://platform.openai.com/api-keys)
2. Click "Create new secret key"
3. Name it "handit-ai-docs"
4. Copy the key (starts with `sk-`)

### Step 5: Environment Configuration

```bash
# Copy the example environment file
cp env.example .env
```

Edit `.env` file with your actual credentials:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your_actual_openai_api_key_here
OPENAI_MODEL=gpt-4
EMBEDDING_MODEL=text-embedding-ada-002

# Pinecone Configuration (Optional)
PINECONE_API_KEY=your_actual_pinecone_api_key_here
PINECONE_ENVIRONMENT=us-east-1-aws
PINECONE_INDEX_NAME=handit-ai-docs
PINECONE_NAMESPACE=HANDIT

# PostgreSQL Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=handit_ai
DB_USER=handit_user
DB_PASSWORD=your_secure_password

# Server Configuration
PORT=3000
NODE_ENV=development
```

### Step 6: Database Setup

```bash
# Create database tables
npm run db:setup
```

If you don't have this script, manually create the tables:

```sql
-- Connect to your database
psql -h localhost -U handit_user -d handit_ai

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  role VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conversations_session_id ON conversations(session_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
```

### Step 7: Built-in Knowledge Base

The system includes a comprehensive built-in knowledge base (`handitKnowledgeBase`) located in `src/config/pinecone.js`. This contains all Handit.ai documentation including:

- **Phase 1 (Observability)**: SDK installation, tracing setup, code examples
- **Phase 2 (Evaluation)**: Quality evaluation, evaluators, metrics  
- **Phase 3 (Self-Improving)**: Optimization, A/B testing, Release Hub
- **Setup guides**: Complete step-by-step instructions for Python and JavaScript
- **Examples**: Copy-paste ready code implementations

#### Knowledge Base Structure
```javascript
// Located in src/config/pinecone.js
const handitKnowledgeBase = [
  {
    text: "Complete documentation content...",
    metadata: {
      category: "setup|evaluation|optimization", 
      phase: "overview|phase_1|phase_2|phase_3",
      language: "python|javascript"
    }
  }
  // 14+ comprehensive documents
];
```

**No additional setup required** - the knowledge base is ready to use!

### Step 8: Start the Server

```bash
# Start the development server
npm run dev

# Or start production server
npm start
```

You should see:

```
🚀 Server running on port 3000
📊 Connected to PostgreSQL
🔍 Connected to Pinecone (optional)
🤖 AI Service initialized
📚 Knowledge Base loaded (14 documents)
🎯 6-LLM Agentic System ready
```

### Step 9: Test the API

#### Test Health Endpoint

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-07-11T02:00:00.000Z",
  "services": {
    "database": "connected",
    "pinecone": "connected",
    "openai": "connected"
  }
}
```

#### Test AI Chat Endpoint

```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I setup Handit.ai tracing?",
    "sessionId": "test-session-123"
  }'
```

Expected response structure:
```json
{
  "answer": "Te guiaré paso a paso para configurar Handit.ai exitosamente...",
  "sessionId": "test-session-123",
  "requiresUserInput": true,
  "nextAction": "wait_for_step_confirmation",
  "detectedLanguage": "spanish",
  "phase": "observability",
  "userTechStack": {
    "language": "python",
    "framework": "langchain", 
    "environment": "local"
  },
  "nodeType": "observability_llm_response",
  "routingDecisions": {
    "routerAgent": "HANDIT_AI",
    "contextQuestioner": "no_questions_needed",
    "phaseRouter": "OBSERVABILITY"
  },
  "sources": [
    {
      "text": "Phase 1: AI Observability setup guide...",
      "metadata": {
        "category": "setup",
        "phase": "phase_1",
        "language": "python"
      }
    }
  ],
  "totalSources": 14
}
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Check connection with credentials
psql -h localhost -U handit_user -d handit_ai
```

#### 2. Pinecone Connection Failed (Optional Service)
- Verify API key is correct (if using Pinecone)
- Check environment name matches your index
- **Note**: System works without Pinecone using built-in knowledge base

#### 3. OpenAI API Errors
- Verify API key is valid
- Check you have credits in your OpenAI account
- Ensure billing is set up
- Check model name in .env (default: gpt-4)

#### 4. Empty or Incorrect Responses
- Check knowledge base is loaded (`handitKnowledgeBase` in logs)
- Verify all 6 LLMs are responding correctly
- Check language detection is working
- Ensure phase routing is functioning

#### 5. LLM Routing Issues
- Check router agent decisions in logs
- Verify phase router is selecting correct expert
- Ensure tech stack detection is working
- Check conversation history integration

### Debugging

Enable debug logging:

```bash
# Set debug environment
DEBUG=* npm run dev

# Or specific modules
DEBUG=ai:*,pinecone:* npm run dev
```

Check logs:
```bash
# View server logs
tail -f logs/server.log

# View error logs  
tail -f logs/error.log
```

## 📊 API Endpoints

### POST `/api/ai/chat`
Main endpoint for AI assistance with 6-LLM specialized routing.

**Request:**
```json
{
  "message": "How do I setup Handit.ai observability?",
  "sessionId": "optional-session-id"
}
```

**Response:** Specialized response from appropriate expert LLM with routing decisions

**Key Features:**
- **Automatic routing** to correct phase expert (Observability/Evaluation/Self-Improving)
- **Language detection** (Spanish/English) with consistent responses
- **Tech stack detection** (Python/JavaScript, LangChain/OpenAI)
- **Complete 7-step guides** with copy-paste code examples
- **Prerequisite handling** (Phase 1 → Phase 2 → Phase 3)

### GET `/api/health`
Health check endpoint with service status.

### GET `/api/ai/conversations/:sessionId`
Get conversation history.

### DELETE `/api/ai/conversations/:sessionId`
Clear conversation history.

### System Capabilities
- **6 Specialized LLMs**: Router → Context Questioner → Phase Router → Expert LLMs
- **Built-in Knowledge Base**: 14+ comprehensive Handit.ai documents
- **Smart Questioning**: Only asks for tech stack when actually needed
- **Complete Implementation**: Full code examples with start_tracing, track_node, end_tracing

## 🚀 Production Deployment

### Environment Variables for Production

```bash
# Production environment
NODE_ENV=production
PORT=3000

# Database (use connection pooling)
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=handit_ai_prod
DB_USER=handit_user
DB_PASSWORD=secure_password
DB_SSL=true

# Pinecone (production index)
PINECONE_INDEX_NAME=handit-ai-docs-prod

# Rate limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
```

### Docker Deployment

```bash
# Build Docker image
docker build -t handit-ai-docs .

# Run container
docker run -p 3000:3000 \
  --env-file .env.production \
  handit-ai-docs
```

### Performance Monitoring

```bash
# Install PM2 for production
npm install -g pm2

# Start with PM2
pm2 start src/server.js --name handit-ai-docs

# Monitor
pm2 monit

# View logs
pm2 logs handit-ai-docs
```

## 🔒 Security Considerations

- Always use HTTPS in production
- Implement proper API key rotation
- Set up database connection pooling
- Use environment-specific Pinecone indexes
- Enable request logging and monitoring
- Implement proper error handling (don't expose sensitive info)

## 📈 Scaling

- Use Redis for caching
- Implement database read replicas
- Use CDN for static assets
- Monitor Pinecone query costs
- Implement proper logging and metrics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details. 