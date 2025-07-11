/**
 * Pinecone Knowledge Base Initialization Script
 * @module scripts/initPinecone
 * @requires @pinecone-database/pinecone
 * @requires openai
 * @requires dotenv
 * @requires ../config/pinecone
 * @requires ../utils/textProcessor
 * 
 * This script initializes the Pinecone vector database with Handit.ai documentation data.
 * It processes documents into chunks, generates embeddings, and stores them in Pinecone.
 * 
 * Process flow:
 * 1. Initialize Pinecone client
 * 2. Create embeddings using OpenAI SDK
 * 3. Process documents into chunks
 * 4. Store vectors in Pinecone with metadata
 */



const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');
const { handitKnowledgeBase, initializePinecone } = require('../config/pinecone');
const { TextProcessor } = require('../utils/textProcessor');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Initializes the knowledge base in Pinecone
 * @async
 * @function initializeKnowledgeBase
 * @throws {Error} If initialization fails
 * @returns {Promise<void>}
 * 
 * @example
 * // Initialize the knowledge base
 * await initializeKnowledgeBase();
 */
async function initializeKnowledgeBase() {
    try {
        // Initialize Pinecone with namespace
        console.log('🚀 Initializing Pinecone...');
        const pineconeConfig = await initializePinecone();
        const index = pineconeConfig.index;
        const namespace = pineconeConfig.namespace;
        
        console.log(`📂 Using namespace: ${namespace}`);
        
        console.log('🔄 Creating OpenAI client...');
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        console.log('📝 Processing and adding documents to knowledge base...');
        console.log('🧹 Auto-correcting any issues found...');
        
        let totalAutoCorrections = 0;
        let totalSuccessfulChunks = 0;
        
        for (let docIndex = 0; docIndex < handitKnowledgeBase.length; docIndex++) {
            const document = handitKnowledgeBase[docIndex];
            
            // Auto-validate and correct document
            const correctionResults = await autoCorrectDocument(document, docIndex);
            if (correctionResults.corrections > 0) {
                totalAutoCorrections += correctionResults.corrections;
                console.log(`🔧 Auto-corrected ${correctionResults.corrections} issues in document ${docIndex + 1}`);
            }
            
            // Process document into chunks (now clean)
            const processedChunks = await TextProcessor.processDocument(correctionResults.cleanDocument);
            
            console.log(`✂️ Processing document ${docIndex + 1}/${handitKnowledgeBase.length} with ${processedChunks.length} chunks...`);
            
            // Prepare records for batch upsert with additional validation
            const records = [];
            
            for (let chunkIndex = 0; chunkIndex < processedChunks.length; chunkIndex++) {
                const chunk = processedChunks[chunkIndex];
                
                // Validate chunk text
                if (!chunk.text || chunk.text.trim().length === 0) {
                    console.warn(`⚠️ Skipping empty chunk ${chunkIndex} in document ${docIndex}`);
                    continue;
                }
                
                // Additional text validation - be more aggressive with large chunks
                if (chunk.text.length > 6000) {
                    console.warn(`⚠️ Chunk ${chunkIndex} is very large (${chunk.text.length} chars), truncating...`);
                    chunk.text = chunk.text.substring(0, 5500) + '\n\n[Content truncated for vector storage]';
                }
                
                try {
                    // Validate that text can be JSON serialized
                    JSON.stringify(chunk.text);
                    
                    // Generate embedding using OpenAI SDK
                    const embeddingResponse = await openai.embeddings.create({
                        model: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002',
                        input: chunk.text
                    });
                    
                    // Validate embedding
                    if (!embeddingResponse.data || !embeddingResponse.data[0] || !embeddingResponse.data[0].embedding) {
                        console.warn(`⚠️ Failed to generate embedding for chunk ${chunkIndex}`);
                        continue;
                    }
                    
                    // Create sanitized metadata
                    const sanitizedMetadata = {};
                    for (const [key, value] of Object.entries(chunk.metadata || {})) {
                        if (value !== null && value !== undefined) {
                            // Ensure metadata values are JSON serializable
                            try {
                                JSON.stringify(value);
                                sanitizedMetadata[key] = value;
                            } catch (metaError) {
                                console.warn(`⚠️ Skipping non-serializable metadata key: ${key}`);
                            }
                        }
                    }
                    
                    const record = {
                        id: `handit-doc-${docIndex}-chunk-${chunkIndex}-${Date.now()}`,
                        values: embeddingResponse.data[0].embedding,
                        metadata: {
                            text: chunk.text,
                            docIndex: docIndex,
                            chunkIndex: chunkIndex,
                            originalLength: chunk.text.length,
                            timestamp: new Date().toISOString(),
                            ...sanitizedMetadata
                        }
                    };
                    
                    // Final validation of the complete record
                    JSON.stringify(record);
                    records.push(record);
                    
                } catch (error) {
                    console.error(`❌ Error processing chunk ${chunkIndex} in document ${docIndex}:`, error.message);
                    console.log(`Problematic text preview: "${chunk.text.substring(0, 100)}..."`);
                    continue;
                }
            }

            // Upsert records in smaller batches if we have any valid records
            if (records.length > 0) {
                console.log(`📤 Upserting ${records.length} valid records for document ${docIndex + 1}...`);
                
                // Split into smaller batches to avoid size limits
                const batchSize = Math.min(5, records.length); // Max 5 records per batch for safety
                const batches = [];
                for (let i = 0; i < records.length; i += batchSize) {
                    batches.push(records.slice(i, i + batchSize));
                }
                
                console.log(`   📦 Splitting into ${batches.length} batches of max ${batchSize} records each`);
                
                for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                    const batch = batches[batchIndex];
                    
                    // Calculate approximate batch size
                    const batchSizeBytes = JSON.stringify(batch).length;
                    const batchSizeMB = (batchSizeBytes / (1024 * 1024)).toFixed(2);
                    
                    console.log(`   📤 Uploading batch ${batchIndex + 1}/${batches.length} (${batch.length} records, ~${batchSizeMB}MB)...`);
                    
                    // Skip batch if it's too large - more conservative limit
                    if (batchSizeBytes > 2000000) { // 2MB safety margin
                        console.warn(`   ⚠️ Batch ${batchIndex + 1} too large (${batchSizeMB}MB), splitting further...`);
                        
                        // Split this batch in half and try again
                        const halfSize = Math.ceil(batch.length / 2);
                        const firstHalf = batch.slice(0, halfSize);
                        const secondHalf = batch.slice(halfSize);
                        
                        try {
                            await index.upsert(firstHalf);
                            console.log(`   ✅ First half uploaded (${firstHalf.length} records)`);
                            totalSuccessfulChunks += firstHalf.length;
                            
                            await new Promise(resolve => setTimeout(resolve, 500));
                            
                            await index.upsert(secondHalf);
                            console.log(`   ✅ Second half uploaded (${secondHalf.length} records)`);
                            totalSuccessfulChunks += secondHalf.length;
                        } catch (splitError) {
                            console.error(`   ❌ Error with split batches: ${splitError.message}`);
                            // Try individual records as last resort
                            for (const record of batch) {
                                try {
                                    await index.upsert([record]);
                                    totalSuccessfulChunks++;
                                    await new Promise(resolve => setTimeout(resolve, 200));
                                } catch (individualError) {
                                    console.error(`   ❌ Failed individual record: ${individualError.message}`);
                                }
                            }
                        }
                        continue;
                    }
                    
                    try {
                        await index.upsert(batch);
                        console.log(`   ✅ Batch ${batchIndex + 1} uploaded successfully`);
                        totalSuccessfulChunks += batch.length;
                        
                        // Small delay between batches to avoid rate limits
                        if (batchIndex < batches.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    } catch (batchError) {
                        console.error(`   ❌ Error uploading batch ${batchIndex + 1}:`, batchError.message);
                        
                        // If it's still a size error, try with smaller chunks
                        if (batchError.message.includes('message length too large')) {
                            console.log(`   🔄 Retrying with individual records...`);
                            for (const record of batch) {
                                try {
                                    await index.upsert([record]);
                                    totalSuccessfulChunks++;
                                    await new Promise(resolve => setTimeout(resolve, 200));
                                } catch (individualError) {
                                    console.error(`   ❌ Failed to upload individual record: ${individualError.message}`);
                                }
                            }
                        }
                    }
                }
                
                console.log(`✅ Successfully uploaded ${totalSuccessfulChunks} chunks total for document ${docIndex + 1}`);
            } else {
                console.warn(`⚠️ No valid records to upload for document ${docIndex + 1}`);
            }
            
            // Add delay between documents to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ Handit.ai knowledge base initialized successfully!');
        console.log('='.repeat(60));
        
        // Display comprehensive stats
        const stats = await pineconeConfig.baseIndex.describeIndexStats();
        console.log('📊 Final Statistics:');
        console.log(`   📁 Documents processed: ${handitKnowledgeBase.length}`);
        console.log(`   📦 Total chunks uploaded: ${totalSuccessfulChunks}`);
        console.log(`   🔧 Auto-corrections applied: ${totalAutoCorrections}`);
        console.log(`   📂 Namespace: ${namespace}`);
        console.log(`   🎯 Total vectors in index: ${stats.totalVectorCount}`);
        console.log(`   📏 Vector dimension: ${stats.dimension}`);
        
        if (totalAutoCorrections > 0) {
            console.log(`\n🎉 Auto-correction successful! Fixed ${totalAutoCorrections} issues automatically.`);
        }
        console.log('\n🚀 Your Handit.ai agent is ready to answer questions!');
        
    } catch (error) {
        console.error('❌ Error initializing knowledge base:', error);
        console.error('Error details:', error.message);
        process.exit(1);
    }
}

/**
 * Auto-correct document issues before processing
 * @async
 * @param {Object} document - Document to correct
 * @param {number} docIndex - Document index for logging
 * @returns {Promise<Object>} Clean document and correction count
 */
async function autoCorrectDocument(document, docIndex) {
    let corrections = 0;
    const issues = [];
    
    // Create a working copy
    const cleanDocument = {
        text: document.text || '',
        metadata: document.metadata ? { ...document.metadata } : {}
    };
    
    // 1. Fix missing or invalid text
    if (!cleanDocument.text || typeof cleanDocument.text !== 'string') {
        cleanDocument.text = `Document ${docIndex + 1} content`;
        corrections++;
        issues.push('Fixed missing/invalid text');
    }
    
    // 2. Sanitize Unicode characters (emojis, etc.)
    const originalText = cleanDocument.text;
    cleanDocument.text = TextProcessor.sanitizeText(originalText);
    
    if (originalText !== cleanDocument.text) {
        corrections++;
        issues.push('Sanitized Unicode characters');
        
        // Log specific changes for transparency
        const emojiReplacements = [
            { emoji: '🚀', replacement: '[ROCKET]' },
            { emoji: '✅', replacement: '[CHECK]' },
            { emoji: '🎉', replacement: '[CELEBRATION]' },
            { emoji: '❌', replacement: '[X]' },
            { emoji: '🔧', replacement: '[WRENCH]' },
            { emoji: '📝', replacement: '[MEMO]' },
            { emoji: '🔍', replacement: '[SEARCH]' },
            { emoji: '⚡', replacement: '[LIGHTNING]' }
        ];
        
        const foundReplacements = emojiReplacements.filter(({ emoji }) => 
            originalText.includes(emoji)
        );
        
        if (foundReplacements.length > 0) {
            const replacementList = foundReplacements
                .map(({ emoji, replacement }) => `${emoji}→${replacement}`)
                .join(', ');
            console.log(`   🔄 Replaced emojis: ${replacementList}`);
        }
    }
    
    // 3. Ensure text is not too long for embedding
    if (cleanDocument.text.length > 10000) {
        const truncatedLength = 9500;
        cleanDocument.text = cleanDocument.text.substring(0, truncatedLength) + '\n\n[Content truncated for processing]';
        corrections++;
        issues.push(`Truncated text (was ${originalText.length} chars, now ${cleanDocument.text.length})`);
    }
    
    // 4. Clean up metadata
    const cleanMetadata = {};
    for (const [key, value] of Object.entries(cleanDocument.metadata)) {
        if (value !== null && value !== undefined) {
            try {
                // Test JSON serialization
                JSON.stringify(value);
                cleanMetadata[key] = value;
            } catch (error) {
                corrections++;
                issues.push(`Removed non-serializable metadata: ${key}`);
            }
        }
    }
    cleanDocument.metadata = cleanMetadata;
    
    // 5. Test final JSON serialization
    try {
        JSON.stringify(cleanDocument);
    } catch (error) {
        // Fallback: create minimal valid document
        cleanDocument.text = `Handit.ai documentation content ${docIndex + 1}`;
        cleanDocument.metadata = { 
            category: 'documentation',
            corrected: true,
            originalIssue: error.message 
        };
        corrections++;
        issues.push('Applied fallback correction for JSON serialization');
    }
    
    // Log issues if any were found and corrected
    if (issues.length > 0) {
        console.log(`   🔧 Document ${docIndex + 1} auto-corrections:`);
        issues.forEach(issue => console.log(`      • ${issue}`));
    }
    
    return {
        cleanDocument,
        corrections,
        issues
    };
}

// Run the initialization
initializeKnowledgeBase(); 