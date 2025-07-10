/**
 * Knowledge Base Validation Script
 * @module scripts/validateKnowledgeBase
 * 
 * This script validates the Handit.ai knowledge base for potential issues
 * before uploading to Pinecone vector store.
 */

import { handitKnowledgeBase } from '../config/pinecone.js';
import { TextProcessor } from '../utils/textProcessor.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Validate knowledge base for common issues
 * @async
 * @function validateKnowledgeBase
 */
async function validateKnowledgeBase() {
    console.log('🔍 Validating Handit.ai Knowledge Base...');
    console.log(`📊 Total documents to validate: ${handitKnowledgeBase.length}`);
    
    let totalIssues = 0;
    let totalChunks = 0;
    const issues = [];
    
    for (let docIndex = 0; docIndex < handitKnowledgeBase.length; docIndex++) {
        const document = handitKnowledgeBase[docIndex];
        console.log(`\n📄 Validating document ${docIndex + 1}/${handitKnowledgeBase.length}...`);
        
        // Basic document validation
        if (!document.text || typeof document.text !== 'string') {
            const issue = `Document ${docIndex + 1}: Missing or invalid text field`;
            issues.push(issue);
            console.error(`❌ ${issue}`);
            totalIssues++;
            continue;
        }
        
        // Check for problematic Unicode characters
        const originalText = document.text;
        const sanitizedText = TextProcessor.sanitizeText(originalText);
        
        if (originalText !== sanitizedText) {
            const issue = `Document ${docIndex + 1}: Contains problematic Unicode characters`;
            issues.push(issue);
            console.warn(`⚠️ ${issue}`);
            
            // Show what was changed
            const changes = findUnicodeChanges(originalText, sanitizedText);
            changes.forEach(change => {
                console.log(`   🔄 Replaced: "${change.original}" → "${change.sanitized}"`);
            });
            totalIssues++;
        }
        
        // Check JSON serializability
        try {
            JSON.stringify(document);
        } catch (error) {
            const issue = `Document ${docIndex + 1}: Not JSON serializable - ${error.message}`;
            issues.push(issue);
            console.error(`❌ ${issue}`);
            totalIssues++;
            continue;
        }
        
        // Validate chunking
        try {
            const processedChunks = await TextProcessor.processDocument(document);
            totalChunks += processedChunks.length;
            
            console.log(`✂️ Document splits into ${processedChunks.length} chunks`);
            
            // Validate each chunk
            for (let chunkIndex = 0; chunkIndex < processedChunks.length; chunkIndex++) {
                const chunk = processedChunks[chunkIndex];
                
                // Check chunk size
                if (chunk.text.length > 8000) {
                    const issue = `Document ${docIndex + 1}, Chunk ${chunkIndex + 1}: Too large (${chunk.text.length} chars)`;
                    issues.push(issue);
                    console.warn(`⚠️ ${issue}`);
                    totalIssues++;
                }
                
                // Check for empty chunks
                if (!chunk.text || chunk.text.trim().length === 0) {
                    const issue = `Document ${docIndex + 1}, Chunk ${chunkIndex + 1}: Empty chunk`;
                    issues.push(issue);
                    console.warn(`⚠️ ${issue}`);
                    totalIssues++;
                }
                
                // Validate chunk metadata
                try {
                    JSON.stringify(chunk.metadata);
                } catch (error) {
                    const issue = `Document ${docIndex + 1}, Chunk ${chunkIndex + 1}: Metadata not serializable`;
                    issues.push(issue);
                    console.warn(`⚠️ ${issue}`);
                    totalIssues++;
                }
            }
            
        } catch (error) {
            const issue = `Document ${docIndex + 1}: Chunking failed - ${error.message}`;
            issues.push(issue);
            console.error(`❌ ${issue}`);
            totalIssues++;
        }
    }
    
    // Summary report
    console.log('\n' + '='.repeat(60));
    console.log('📋 VALIDATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`📊 Documents validated: ${handitKnowledgeBase.length}`);
    console.log(`📦 Total chunks: ${totalChunks}`);
    console.log(`⚠️ Total issues found: ${totalIssues}`);
    
    if (totalIssues === 0) {
        console.log('\n✅ Knowledge base validation PASSED!');
        console.log('🚀 Ready to upload to Pinecone vector store.');
        return true;
    } else {
        console.log('\n❌ Knowledge base validation FAILED!');
        console.log('\n🔧 Issues to fix:');
        issues.forEach((issue, index) => {
            console.log(`   ${index + 1}. ${issue}`);
        });
        console.log('\n💡 Recommendation: Fix these issues before uploading to Pinecone.');
        return false;
    }
}

/**
 * Find specific Unicode changes made during sanitization
 * @param {string} original - Original text
 * @param {string} sanitized - Sanitized text
 * @returns {Array} Array of changes
 */
function findUnicodeChanges(original, sanitized) {
    const changes = [];
    
    // Check for emoji replacements
    const emojiReplacements = [
        { emoji: '🚀', replacement: '[ROCKET]' },
        { emoji: '✅', replacement: '[CHECK]' },
        { emoji: '🎉', replacement: '[CELEBRATION]' },
        { emoji: '❌', replacement: '[X]' },
        { emoji: '🔧', replacement: '[WRENCH]' },
        { emoji: '📝', replacement: '[MEMO]' },
        { emoji: '🔍', replacement: '[SEARCH]' },
        { emoji: '⚡', replacement: '[LIGHTNING]' },
        { emoji: '🛠️', replacement: '[TOOLS]' },
        { emoji: '🔄', replacement: '[REFRESH]' },
        { emoji: '📊', replacement: '[CHART]' },
        { emoji: '🎯', replacement: '[TARGET]' }
    ];
    
    emojiReplacements.forEach(({ emoji, replacement }) => {
        if (original.includes(emoji) && sanitized.includes(replacement)) {
            changes.push({
                original: emoji,
                sanitized: replacement,
                type: 'emoji_replacement'
            });
        }
    });
    
    return changes;
}

/**
 * Export a clean version of the knowledge base
 * @async
 * @function exportCleanKnowledgeBase
 */
async function exportCleanKnowledgeBase() {
    console.log('\n🧹 Creating clean version of knowledge base...');
    
    const cleanKnowledgeBase = [];
    
    for (const document of handitKnowledgeBase) {
        const cleanDocument = {
            text: TextProcessor.sanitizeText(document.text),
            metadata: document.metadata ? { ...document.metadata } : {}
        };
        
        cleanKnowledgeBase.push(cleanDocument);
    }
    
    console.log('💾 Clean knowledge base created in memory.');
    console.log('📊 Statistics:');
    console.log(`   - Documents: ${cleanKnowledgeBase.length}`);
    
    const totalChars = cleanKnowledgeBase.reduce((sum, doc) => sum + doc.text.length, 0);
    console.log(`   - Total characters: ${totalChars.toLocaleString()}`);
    
    return cleanKnowledgeBase;
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    validateKnowledgeBase()
        .then(async (isValid) => {
            if (isValid) {
                console.log('\n🎯 Running additional cleanup...');
                await exportCleanKnowledgeBase();
            }
            process.exit(isValid ? 0 : 1);
        })
        .catch((error) => {
            console.error('❌ Validation failed with error:', error);
            process.exit(1);
        });
} 