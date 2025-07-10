/**
 * AI Service - Main RAG (Retrieval-Augmented Generation) implementation
 * @module services/aiService
 * @requires @pinecone-database/pinecone
 * @requires openai
 * @requires ../config/pinecone
 */

import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import { initializePinecone } from '../config/pinecone.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * AI Service class for handling RAG operations
 */
export class AIService {
    constructor() {
        this.pineconeClient = null;
        this.pineconeIndex = null;
        this.openaiClient = null;
        this.initialized = false;
    }

    /**
     * Initialize the AI service with Pinecone and OpenAI clients
     * @async
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            console.log('🚀 Initializing AI Service...');
            
            // Initialize Pinecone
            const pineconeConfig = await initializePinecone();
            this.pineconeClient = pineconeConfig.client;
            this.pineconeIndex = pineconeConfig.index;
            
            // Initialize OpenAI
            this.openaiClient = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });
            
            this.initialized = true;
            console.log('✅ AI Service initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing AI Service:', error);
            throw error;
        }
    }

    /**
     * Generate embedding for a given text using OpenAI
     * @async
     * @param {string} text - Text to embed
     * @returns {Promise<number[]>} Embedding vector
     */
    async generateEmbedding(text) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const response = await this.openaiClient.embeddings.create({
                model: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002',
                input: text
            });
            
            return response.data[0].embedding;
        } catch (error) {
            console.error('❌ Error generating embedding:', error);
            throw error;
        }
    }

    /**
     * Search for relevant documents in Pinecone vector store
     * @async
     * @param {string} query - Search query
     * @param {Object} [options={}] - Search options
     * @param {number} [options.topK=5] - Number of results to return
     * @param {number} [options.minScore=0.7] - Minimum similarity score
     * @returns {Promise<Array>} Array of relevant documents with metadata
     */
    async searchRelevantDocuments(query, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const { topK = 10, minScore = 0.7 } = options;
            
            // Generate embedding for the query
            const queryEmbedding = await this.generateEmbedding(query);
            
            // Search in Pinecone
            const searchResponse = await this.pineconeIndex.query({
                vector: queryEmbedding,
                topK: topK,
                includeMetadata: true,
                includeValues: false
            });
            
            // Filter results by minimum score and format response
            const relevantDocs = searchResponse.matches
                .filter(match => match.score >= minScore)
                .map(match => ({
                    id: match.id,
                    score: match.score,
                    text: match.metadata.text,
                    metadata: match.metadata
                }));
            
            console.log(`🔍 Found ${relevantDocs.length} relevant documents for query: "${query}"`);
            
            return relevantDocs;
        } catch (error) {
            console.error('❌ Error searching documents:', error);
            throw error;
        }
    }

    /**
     * Generate AI response using RAG (Retrieval-Augmented Generation)
     * @async
     * @param {string} question - User question
     * @param {Object} [options={}] - Generation options
     * @param {string} [options.language='es'] - Response language
     * @param {string} [options.context=''] - Additional context
     * @returns {Promise<Object>} Generated response with sources
     */
    async generateResponse(question, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const { language = 'es', context = '' } = options;
            
            // Step 1: Retrieve relevant documents
            const relevantDocs = await this.searchRelevantDocuments(question);
            
            if (relevantDocs.length === 0) {
                return {
                    answer: language === 'es' 
                        ? 'Lo siento, no encontré información relevante sobre tu pregunta en la documentación de Handit.ai.'
                        : 'Sorry, I couldn\'t find relevant information about your question in the Handit.ai documentation.',
                    sources: [],
                    confidence: 'low'
                };
            }
            
            // Step 2: Prepare context from retrieved documents
            const retrievedContext = relevantDocs
                .map((doc, index) => `[${index + 1}] ${doc.text}`)
                .join('\n\n');
            
            // Step 3: Create system prompt
            const systemPrompt = language === 'es' 
                ? `Eres un asistente experto en Handit.ai. Responde preguntas basándote únicamente en la información proporcionada del contexto.

CONTEXTO DE DOCUMENTACIÓN:
${retrievedContext}

INSTRUCCIONES:
- Responde en español de manera clara y precisa
- Usa solo la información del contexto proporcionado
- Si no tienes información suficiente, dilo claramente
- Incluye ejemplos de código cuando sea relevante
- Sé específico sobre los pasos de configuración cuando aplique`
                : `You are an expert assistant for Handit.ai. Answer questions based only on the provided context information.

DOCUMENTATION CONTEXT:
${retrievedContext}

INSTRUCTIONS:
- Respond in English clearly and precisely
- Use only information from the provided context
- If you don't have sufficient information, state it clearly
- Include code examples when relevant
- Be specific about setup steps when applicable`;
            
            // Step 4: Add user context if provided
            const userMessage = context 
                ? `Contexto adicional: ${context}\n\nPregunta: ${question}`
                : question;
            
            // Step 5: Generate response using OpenAI
            const completion = await this.openaiClient.chat.completions.create({
                model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.3,
                max_tokens: 1000
            });
            
            const answer = completion.choices[0].message.content;
            
            // Step 6: Determine confidence based on relevance scores
            const avgScore = relevantDocs.reduce((sum, doc) => sum + doc.score, 0) / relevantDocs.length;
            const confidence = avgScore >= 0.85 ? 'high' : avgScore >= 0.75 ? 'medium' : 'low';
            
            return {
                answer,
                sources: relevantDocs.map(doc => ({
                    text: doc.text.substring(0, 200) + '...',
                    score: doc.score,
                    metadata: doc.metadata
                })),
                confidence,
                totalSources: relevantDocs.length
            };
            
        } catch (error) {
            console.error('❌ Error generating response:', error);
            throw error;
        }
    }

    /**
     * Health check for AI services
     * @async
     * @returns {Promise<Object>} Health status
     */
    async healthCheck() {
        try {
            const health = {
                status: 'healthy',
                services: {
                    pinecone: 'unknown',
                    openai: 'unknown',
                    initialized: this.initialized
                },
                timestamp: new Date().toISOString()
            };
            
            if (this.initialized) {
                // Test Pinecone connection
                try {
                    await this.pineconeIndex.describeIndexStats();
                    health.services.pinecone = 'operational';
                } catch (error) {
                    health.services.pinecone = 'error';
                    health.status = 'degraded';
                }
                
                // Test OpenAI connection
                try {
                    await this.openaiClient.models.list();
                    health.services.openai = 'operational';
                } catch (error) {
                    health.services.openai = 'error';
                    health.status = 'degraded';
                }
            }
            
            return health;
        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

// Export singleton instance
export const aiService = new AIService();
