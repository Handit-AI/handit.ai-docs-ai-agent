-- Migration: 001_create_conversations.sql
-- Description: Create tables for conversation history and AI agent context
-- Date: 2024-01-XX

-- Enable UUID extension for better unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL, -- Better than IP for privacy/reliability
    client_ip INET, -- Still store IP for analytics if needed
    user_agent TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_messages INTEGER DEFAULT 0,
    context_summary TEXT, -- AI-generated summary of the conversation
    tags TEXT[], -- Array of tags for categorization
    status VARCHAR(20) DEFAULT 'active', -- active, archived, deleted
    metadata JSONB DEFAULT '{}', -- Additional flexible data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create messages table for conversation history
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text', -- text, markdown, code, etc.
    tokens_used INTEGER, -- Track token usage for analytics
    processing_time_ms INTEGER, -- Response time tracking
    context_used TEXT[], -- What knowledge base chunks were used
    evaluation_scores JSONB, -- Store evaluation metrics
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create knowledge_usage table to track which chunks are most useful
CREATE TABLE IF NOT EXISTS knowledge_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    chunk_id VARCHAR(255) NOT NULL, -- Reference to Pinecone chunk
    relevance_score FLOAT, -- Similarity score from vector search
    used_in_response BOOLEAN DEFAULT false, -- Whether it was actually used
    user_feedback INTEGER, -- User rating of response quality (1-5)
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_client_ip ON conversations(client_ip);
CREATE INDEX IF NOT EXISTS idx_conversations_started_at ON conversations(started_at);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_content_type ON messages(content_type);

CREATE INDEX IF NOT EXISTS idx_knowledge_usage_message_id ON knowledge_usage(message_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_usage_chunk_id ON knowledge_usage(chunk_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_usage_relevance_score ON knowledge_usage(relevance_score);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic updated_at updates
CREATE TRIGGER update_conversations_updated_at 
    BEFORE UPDATE ON conversations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to update last_activity and total_messages
CREATE OR REPLACE FUNCTION update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET 
        last_activity = CURRENT_TIMESTAMP,
        total_messages = total_messages + 1
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update conversation stats when new message is added
CREATE TRIGGER update_conversation_stats_trigger
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_stats();

-- Insert initial system message template
INSERT INTO conversations (session_id, client_ip, user_agent, context_summary, tags, status) 
VALUES ('system', '127.0.0.1', 'Migration Script', 'System initialization conversation', ARRAY['system', 'migration'], 'archived')
ON CONFLICT (session_id) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE conversations IS 'Stores conversation sessions with metadata and analytics';
COMMENT ON TABLE messages IS 'Stores individual messages within conversations';
COMMENT ON TABLE knowledge_usage IS 'Tracks which knowledge base chunks are used and their effectiveness';

COMMENT ON COLUMN conversations.session_id IS 'Unique session identifier (UUID recommended)';
COMMENT ON COLUMN conversations.client_ip IS 'Client IP address for analytics (stored securely)';
COMMENT ON COLUMN conversations.context_summary IS 'AI-generated summary of conversation context';
COMMENT ON COLUMN conversations.tags IS 'Array of tags for categorization and filtering';

COMMENT ON COLUMN messages.role IS 'Message role: user, assistant, or system';
COMMENT ON COLUMN messages.content IS 'The actual message content';
COMMENT ON COLUMN messages.tokens_used IS 'Number of tokens used for this message';
COMMENT ON COLUMN messages.context_used IS 'Array of knowledge base chunk IDs used';
COMMENT ON COLUMN messages.evaluation_scores IS 'JSON object with evaluation metrics';

COMMENT ON COLUMN knowledge_usage.chunk_id IS 'Reference to Pinecone vector chunk ID';
COMMENT ON COLUMN knowledge_usage.relevance_score IS 'Similarity score from vector search';
COMMENT ON COLUMN knowledge_usage.used_in_response IS 'Whether chunk was actually used in response'; 