# Handit.ai Docs AI Agent

Professional multi-node agentic system for Handit.ai documentation assistance. Automatically detects user language and context to provide precise solutions.

## 🚀 Features

### Multi-Node Agentic System
- **4-Node LLM Architecture**: Context Analysis → Intent Planning → Knowledge Synthesis → Response Generation
- **Automatic Language Detection**: Responds in user's detected language (Spanish/English)
- **Pinecone RAG Integration**: Semantic search through Handit.ai documentation
- **Conversation History**: Persistent conversations with PostgreSQL
- **Unlimited Response Length**: No token limits on final responses

### Advanced Technologies
- **RAG (Retrieval-Augmented Generation)**: Semantic search with Pinecone vector database
- **Multi-LLM Processing**: OpenAI GPT with specialized prompts for each node
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

### Step 3: Setup Pinecone (Detailed Instructions)

#### 3.1 Create Pinecone Account
1. Go to [Pinecone.io](https://www.pinecone.io/)
2. Click "Sign Up" and create a free account
3. Verify your email address

#### 3.2 Create API Key
1. Log into your Pinecone dashboard
2. Go to "API Keys" in the left sidebar
3. Click "Create API Key"
4. Name it "handit-ai-docs" 
5. Copy the API key (you'll need this for `.env`)

#### 3.3 Create Pinecone Index
1. In Pinecone dashboard, click "Indexes" in sidebar
2. Click "Create Index"
3. Fill in the details:
   - **Index Name**: `handit-ai-docs`
   - **Dimensions**: `1536` (for OpenAI ada-002 embeddings)
   - **Metric**: `cosine`
   - **Pod Type**: `p1.x1` (free tier)
4. Click "Create Index"
5. Wait for index to be ready (shows "Ready" status)

#### 3.4 Get Environment Name
1. In the index details page, note your environment (e.g., `us-east-1-aws`)
2. This will be your `PINECONE_ENVIRONMENT` value

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

# Pinecone Configuration  
PINECONE_API_KEY=your_actual_pinecone_api_key_here
PINECONE_ENVIRONMENT=us-east-1-aws
PINECONE_INDEX_NAME=handit-ai-docs

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

### Step 7: Populate Pinecone with Documentation

You'll need to upload Handit.ai documentation to your Pinecone index. Create a script to do this:

```bash
# Create a population script
touch populate-pinecone.js
```

Example population script (you'll need actual Handit.ai docs):

```javascript
// populate-pinecone.js
const { PineconeClient } = require('@pinecone-database/pinecone');
const { OpenAIApi, Configuration } = require('openai');

async function populatePinecone() {
  // Initialize clients
  const pinecone = new PineconeClient();
  await pinecone.init({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
  });

  const openai = new OpenAIApi(new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  }));

  const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);

  // Sample documentation (replace with actual docs)
  const docs = [
    {
      id: '1',
      text: 'Handit.ai is a platform for AI observability...',
      metadata: { source: 'getting-started', section: 'introduction' }
    },
    // Add more documents here
  ];

  // Generate embeddings and upload
  for (const doc of docs) {
    const embedding = await openai.createEmbedding({
      model: 'text-embedding-ada-002',
      input: doc.text,
    });

    await index.upsert({
      upsertRequest: {
        vectors: [{
          id: doc.id,
          values: embedding.data.data[0].embedding,
          metadata: { text: doc.text, ...doc.metadata }
        }]
      }
    });
  }

  console.log('Pinecone populated successfully!');
}

// Run if this file is executed directly
if (require.main === module) {
  require('dotenv').config();
  populatePinecone().catch(console.error);
}
```

Run the population script:

```bash
node populate-pinecone.js
```

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
🔍 Connected to Pinecone
🤖 AI Service initialized
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
curl -X POST http://localhost:3000/api/ai/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How do I setup Handit.ai?",
    "sessionId": "test-session-123"
  }'
```

Expected response structure:
```json
{
  "answer": "To setup Handit.ai, you need to...",
  "confidence": 0.95,
  "sources": [
    {
      "text": "Documentation content...",
      "score": 0.89
    }
  ],
  "totalSources": 3,
  "sessionId": "test-session-123",
  "technicalContext": {
    "detectedLanguage": "unknown",
    "detectedFramework": "unknown"
  },
  "responseMetadata": {
    "answerType": "complete",
    "coverageLevel": "moderate",
    "includesCodeExamples": false,
    "includesStepByStep": true
  },
  "intermediateResponses": {
    "node1_context_analysis": { /* Full LLM response */ },
    "node2_intent_planning": { /* Full LLM response */ },
    "node3_knowledge_synthesis": { /* Full LLM response */ },
    "node4_response_generation": { /* Full LLM response */ }
  }
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

#### 2. Pinecone Connection Failed
- Verify API key is correct
- Check environment name matches your index
- Ensure index is in "Ready" status

#### 3. OpenAI API Errors
- Verify API key is valid
- Check you have credits in your OpenAI account
- Ensure billing is set up

#### 4. Empty Responses
- Check if Pinecone index has documents
- Verify documents have proper embeddings
- Check minimum score threshold (0.7)

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

### POST `/api/ai/ask`
Main endpoint for AI questions.

**Request:**
```json
{
  "question": "How do I install Handit.ai?",
  "sessionId": "optional-session-id",
  "language": "auto"
}
```

**Response:** Complete multi-node response with intermediate LLM outputs

### GET `/api/health`
Health check endpoint.

### GET `/api/ai/conversations/:sessionId`
Get conversation history.

### DELETE `/api/ai/conversations/:sessionId`
Clear conversation history.

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