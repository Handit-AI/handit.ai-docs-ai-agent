/**
 * Text Processing Utility Module
 * @module utils/textProcessor
 * 
 * Simple text processing without external dependencies
 */

/**
 * Utility class for processing and chunking text for vector storage
 * @class TextProcessor
 */
class TextProcessor {
    /**
     * Sanitize text to remove problematic Unicode characters for vector storage
     * @static
     * @param {string} text - Text to sanitize
     * @returns {string} Sanitized text
     */
    static sanitizeText(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }
        
        let sanitized = text;
        
        // Replace problematic emojis with text equivalents
        sanitized = sanitized
            .replace(/🚀/g, '[ROCKET]')
            .replace(/✅/g, '[CHECK]')
            .replace(/🎉/g, '[CELEBRATION]')
            .replace(/❌/g, '[X]')
            .replace(/🔧/g, '[WRENCH]')
            .replace(/📝/g, '[MEMO]')
            .replace(/🔍/g, '[SEARCH]')
            .replace(/⚡/g, '[LIGHTNING]')
            .replace(/🛠️/g, '[TOOLS]')
            .replace(/🔄/g, '[REFRESH]')
            .replace(/📊/g, '[CHART]')
            .replace(/🎯/g, '[TARGET]')
            .replace(/🔐/g, '[LOCK]')
            .replace(/🌟/g, '[STAR]')
            .replace(/💡/g, '[BULB]')
            .replace(/⭐/g, '[STAR]')
            .replace(/🏆/g, '[TROPHY]')
            .replace(/🚨/g, '[ALERT]')
            .replace(/💻/g, '[COMPUTER]')
            .replace(/📱/g, '[PHONE]')
            .replace(/🔗/g, '[LINK]');
        
        // Remove any remaining problematic Unicode characters
        // This regex removes characters that are not basic Latin, common punctuation, or safe Unicode ranges
        sanitized = sanitized.replace(/[\u{D800}-\u{DFFF}]/gu, ''); // Remove surrogate pairs
        sanitized = sanitized.replace(/[\u{FDD0}-\u{FDEF}]/gu, ''); // Remove non-characters
        sanitized = sanitized.replace(/[\u{FFFE}\u{FFFF}]/gu, ''); // Remove specific non-characters
        
        // Remove any other potentially problematic characters while preserving basic text
        sanitized = sanitized.replace(/[^\u0000-\u007F\u00A0-\u00FF\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF\u2000-\u206F\u20A0-\u20CF\u2100-\u214F]/g, '');
        
        // Clean up extra whitespace
        sanitized = sanitized.replace(/\s+/g, ' ').trim();
        
        return sanitized;
    }
    /**
     * Split text into chunks with intelligent context preservation
     * @static
     * @async
     * @param {string} text - The text content to split
     * @param {Object} [options={}] - Chunking options
     * @param {number} [options.chunkSize=3000] - Size of each chunk in characters (larger to preserve context)
     * @param {number} [options.chunkOverlap=500] - Number of characters to overlap between chunks
     * @param {boolean} [options.preserveCodeBlocks=true] - Keep code blocks intact
     * @param {boolean} [options.preserveSections=true] - Keep sections with headers intact
     * @returns {Promise<string[]>} Array of text chunks
     * 
     * @example
     * const chunks = await TextProcessor.splitIntoChunks("Long text content", {
     *   chunkSize: 3000,
     *   chunkOverlap: 500,
     *   preserveCodeBlocks: true
     * });
     */
    static async splitIntoChunks(text, options = {}) {
        const chunkSize = options.chunkSize || 2000; // Balanced size for Pinecone compatibility 
        const chunkOverlap = options.chunkOverlap || 300; // Balanced overlap
        const preserveCodeBlocks = options.preserveCodeBlocks !== false;
        const preserveSections = options.preserveSections !== false;
        
        // If text is smaller than chunk size, return as single chunk
        if (text.length <= chunkSize) {
            return [text];
        }
        
        // First, identify and preserve code blocks completely
        const codeBlocks = this.extractCodeBlocks(text);
        if (codeBlocks.length > 0) {
            return this.chunkWithCodeBlockPreservation(text, codeBlocks, chunkSize, chunkOverlap);
        }
        
        // For documents with sections but no code blocks, try to keep complete sections together
        const sectionBreaks = text.split(/\n\n(?=[A-Z#]|Step \d+|Phase \d+)/);
        if (sectionBreaks.length > 1) {
            const largeSections = [];
            let currentSection = '';
            
            for (const section of sectionBreaks) {
                if ((currentSection + section).length <= chunkSize * 1.5) {
                    currentSection += (currentSection ? '\n\n' : '') + section;
                } else {
                    if (currentSection) largeSections.push(currentSection);
                    currentSection = section;
                }
            }
            if (currentSection) largeSections.push(currentSection);
            
            // If we have reasonable-sized sections, use them
            if (largeSections.every(section => section.length >= chunkSize * 0.3)) {
                return largeSections;
            }
        }
        
        // Enhanced separators with priority (higher priority = earlier in array)
        const separators = [
            { pattern: /\n\n(?=[A-Z#])/g, priority: 1, name: 'section_break' }, // Section breaks
            { pattern: /\n\n```/g, priority: 2, name: 'code_block_start' }, // Code block starts
            { pattern: /```\n\n/g, priority: 2, name: 'code_block_end' }, // Code block ends
            { pattern: /\n\n(?=\d+\.|\-|\*)/g, priority: 3, name: 'list_start' }, // List starts
            { pattern: /\n\n(?=Step \d+|Phase \d+)/g, priority: 1, name: 'step_break' }, // Step/Phase breaks
            { pattern: /\.\n\n/g, priority: 4, name: 'paragraph_end' }, // Paragraph ends
            { pattern: /\n\n/g, priority: 5, name: 'double_newline' }, // Double newlines
            { pattern: /\n(?=[A-Z])/g, priority: 6, name: 'sentence_break' }, // Sentence breaks
            { pattern: /\. /g, priority: 7, name: 'sentence_end' }, // Sentence ends
            { pattern: /\n/g, priority: 8, name: 'newline' }, // Single newlines
            { pattern: /; /g, priority: 9, name: 'semicolon' }, // Semicolons
            { pattern: /, /g, priority: 10, name: 'comma' }, // Commas
            { pattern: / /g, priority: 11, name: 'space' } // Spaces
        ];
        
        const chunks = [];
        let currentIndex = 0;
        
        while (currentIndex < text.length) {
            let endIndex = Math.min(currentIndex + chunkSize, text.length);
            
            // Special handling for code blocks - ensure we don't break them
            if (preserveCodeBlocks) {
                const codeBlockStart = text.indexOf('```', currentIndex);
                const codeBlockEnd = codeBlockStart !== -1 ? text.indexOf('```', codeBlockStart + 3) : -1;
                
                // If we're inside or about to hit a code block, include the whole block
                if (codeBlockStart !== -1 && codeBlockStart < endIndex) {
                    if (codeBlockEnd !== -1) {
                        // Include the complete code block regardless of size
                        endIndex = codeBlockEnd + 3;
                        console.log(`📝 Preserving complete code block (${endIndex - currentIndex} chars)`);
                    }
                }
            }
            
            // Find the best breaking point
            if (endIndex < text.length) {
                let bestBreakPoint = -1;
                let bestPriority = Infinity;
                
                // Look for separators in order of priority
                for (const separator of separators) {
                    const searchStart = Math.max(currentIndex, endIndex - Math.floor(chunkSize * 0.3));
                    const searchText = text.slice(searchStart, endIndex);
                    const matches = [...searchText.matchAll(separator.pattern)];
                    
                    if (matches.length > 0) {
                        const lastMatch = matches[matches.length - 1];
                        const absoluteIndex = searchStart + lastMatch.index + lastMatch[0].length;
                        
                        if (absoluteIndex > currentIndex && separator.priority < bestPriority) {
                            bestBreakPoint = absoluteIndex;
                            bestPriority = separator.priority;
                        }
                    }
                }
                
                if (bestBreakPoint > currentIndex) {
                    endIndex = bestBreakPoint;
                }
            }
            
            // Extract the chunk and clean it
            let chunk = text.slice(currentIndex, endIndex).trim();
            
            // Add context preservation for incomplete sentences
            if (endIndex < text.length && !chunk.match(/[.!?]$/)) {
                const nextSentenceEnd = text.slice(endIndex).search(/[.!?]/);
                if (nextSentenceEnd !== -1 && nextSentenceEnd < 100) {
                    // Complete the sentence if it's short
                    endIndex = endIndex + nextSentenceEnd + 1;
                    chunk = text.slice(currentIndex, endIndex).trim();
                }
            }
            
            if (chunk.length > 0) {
                chunks.push(chunk);
            }
            
            // Smart overlap calculation
            let overlapStart = Math.max(currentIndex + 1, endIndex - chunkOverlap);
            
            // If we're in the middle of a paragraph, extend overlap to include full context
            const overlapText = text.slice(overlapStart, endIndex);
            const lastParagraphStart = overlapText.lastIndexOf('\n\n');
            if (lastParagraphStart !== -1 && lastParagraphStart < overlapText.length * 0.7) {
                overlapStart = overlapStart + lastParagraphStart + 2;
            }
            
            currentIndex = overlapStart;
        }
        
        return chunks;
    }

    /**
     * Extract contextual information from text to preserve important sections
     * @static
     * @param {string} text - The text to analyze
     * @returns {Object} Context information including titles, steps, and code blocks
     */
    static extractContextualInfo(text) {
        const context = {
            titles: [],
            steps: [],
            codeBlocks: [],
            lists: []
        };
        
        // Find titles and headers
        const titleMatches = text.matchAll(/^([A-Z][^\n]*:?\n|#{1,6}\s+[^\n]+)/gm);
        for (const match of titleMatches) {
            context.titles.push({
                text: match[0].trim(),
                index: match.index
            });
        }
        
        // Find steps and phases
        const stepMatches = text.matchAll(/(Step \d+|Phase \d+)[:\-\s]*([^\n]*)/gi);
        for (const match of stepMatches) {
            context.steps.push({
                text: match[0].trim(),
                index: match.index
            });
        }
        
        // Find code blocks with improved detection
        const codeMatches = text.matchAll(/```[\s\S]*?```/g);
        for (const match of codeMatches) {
            context.codeBlocks.push({
                text: match[0],
                index: match.index,
                end: match.index + match[0].length,
                language: this.detectCodeLanguage(match[0])
            });
        }
        
        return context;
    }

    /**
     * Extract code blocks from text with their positions
     * @static
     * @param {string} text - The text to analyze
     * @returns {Array} Array of code block objects with positions
     */
    static extractCodeBlocks(text) {
        const codeBlocks = [];
        const regex = /```[\s\S]*?```/g;
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            codeBlocks.push({
                content: match[0],
                start: match.index,
                end: match.index + match[0].length,
                language: this.detectCodeLanguage(match[0])
            });
        }
        
        return codeBlocks;
    }

    /**
     * Detect programming language from code block
     * @static
     * @param {string} codeBlock - The code block to analyze
     * @returns {string} Detected language or 'unknown'
     */
    static detectCodeLanguage(codeBlock) {
        const firstLine = codeBlock.split('\n')[0];
        const languageMatch = firstLine.match(/```(\w+)/);
        return languageMatch ? languageMatch[1] : 'unknown';
    }

    /**
     * Chunk text while preserving complete code blocks
     * @static
     * @param {string} text - The text to chunk
     * @param {Array} codeBlocks - Array of code block objects
     * @param {number} chunkSize - Target chunk size
     * @param {number} chunkOverlap - Overlap between chunks
     * @returns {Array} Array of text chunks with preserved code blocks
     */
    static chunkWithCodeBlockPreservation(text, codeBlocks, chunkSize, chunkOverlap) {
        const chunks = [];
        let currentIndex = 0;
        
        // Sort code blocks by position
        const sortedCodeBlocks = [...codeBlocks].sort((a, b) => a.start - b.start);
        
        for (const codeBlock of sortedCodeBlocks) {
            // Add text before the code block
            if (currentIndex < codeBlock.start) {
                const beforeCodeText = text.slice(currentIndex, codeBlock.start).trim();
                if (beforeCodeText) {
                    // Split the text before code block normally
                    const beforeChunks = this.splitTextSimple(beforeCodeText, chunkSize, chunkOverlap);
                    chunks.push(...beforeChunks);
                }
            }
            
            // Add the complete code block as its own chunk (regardless of size)
            const codeChunk = text.slice(codeBlock.start, codeBlock.end);
            console.log(`📝 Preserving code block: ${codeBlock.language} (${codeChunk.length} chars)`);
            chunks.push(codeChunk);
            
            currentIndex = codeBlock.end;
        }
        
        // Add remaining text after the last code block
        if (currentIndex < text.length) {
            const remainingText = text.slice(currentIndex).trim();
            if (remainingText) {
                const remainingChunks = this.splitTextSimple(remainingText, chunkSize, chunkOverlap);
                chunks.push(...remainingChunks);
            }
        }
        
        return chunks.filter(chunk => chunk && chunk.trim().length > 0);
    }

    /**
     * Simple text splitting without code block considerations
     * @static
     * @param {string} text - Text to split
     * @param {number} chunkSize - Target chunk size
     * @param {number} chunkOverlap - Overlap between chunks
     * @returns {Array} Array of text chunks
     */
    static splitTextSimple(text, chunkSize, chunkOverlap) {
        if (text.length <= chunkSize) {
            return [text];
        }
        
        const chunks = [];
        let currentIndex = 0;
        
        while (currentIndex < text.length) {
            let endIndex = Math.min(currentIndex + chunkSize, text.length);
            
            // Find a good breaking point
            if (endIndex < text.length) {
                const breakPoint = this.findBreakPoint(text, currentIndex, endIndex);
                if (breakPoint > currentIndex) {
                    endIndex = breakPoint;
                }
            }
            
            const chunk = text.slice(currentIndex, endIndex).trim();
            if (chunk) {
                chunks.push(chunk);
            }
            
            currentIndex = Math.max(currentIndex + 1, endIndex - chunkOverlap);
        }
        
        return chunks;
    }

    /**
     * Find optimal breaking point for text
     * @static
     * @param {string} text - The text
     * @param {number} start - Start index
     * @param {number} end - End index
     * @returns {number} Optimal break point
     */
    static findBreakPoint(text, start, end) {
        const searchArea = text.slice(start, end);
        
        // Look for paragraph breaks first
        const paragraphBreak = searchArea.lastIndexOf('\n\n');
        if (paragraphBreak > searchArea.length * 0.5) {
            return start + paragraphBreak + 2;
        }
        
        // Look for sentence endings
        const sentenceEnd = searchArea.lastIndexOf('. ');
        if (sentenceEnd > searchArea.length * 0.7) {
            return start + sentenceEnd + 2;
        }
        
        // Look for line breaks
        const lineBreak = searchArea.lastIndexOf('\n');
        if (lineBreak > searchArea.length * 0.8) {
            return start + lineBreak + 1;
        }
        
        return end;
    }

    /**
     * Process a document into chunks with enhanced context preservation
     * @static
     * @async
     * @param {Object} document - The document to process
     * @param {string} document.text - The document text content
     * @param {Object} document.metadata - The document metadata
     * @param {Object} [options={}] - Processing options
     * @returns {Promise<Array<{text: string, metadata: Object}>} Array of processed chunks with metadata
     * 
     * @example
     * const processedDoc = await TextProcessor.processDocument({
     *   text: "Document content",
     *   metadata: { category: "setup", topic: "python" }
     * });
     */
         static async processDocument(document, options = {}) {
         // Sanitize the document text first
         const sanitizedText = this.sanitizeText(document.text);
         
         // Extract contextual information
         const contextInfo = this.extractContextualInfo(sanitizedText);
         
         // Split into chunks with intelligent context preservation (balanced size)
         const chunks = await this.splitIntoChunks(sanitizedText, {
             chunkSize: options.chunkSize || 2000, // Balanced size for Pinecone limits
             chunkOverlap: options.chunkOverlap || 300, // Reasonable overlap
             preserveCodeBlocks: true,
             preserveSections: true
         });
        
                 return chunks.map((chunk, index) => {
             // Sanitize chunk text
             const sanitizedChunk = this.sanitizeText(chunk);
             
             // Find relevant context for this chunk
             const chunkStart = sanitizedText.indexOf(sanitizedChunk);
             const chunkEnd = chunkStart + sanitizedChunk.length;
            
            // Find the most recent title/section before this chunk
            const relevantTitle = contextInfo.titles
                .filter(title => title.index <= chunkStart)
                .sort((a, b) => b.index - a.index)[0];
            
            // Find relevant steps in this chunk
            const relevantSteps = contextInfo.steps
                .filter(step => step.index >= chunkStart && step.index <= chunkEnd);
            
            // Check if chunk contains code blocks
            const hasCodeBlocks = contextInfo.codeBlocks
                .some(block => block.index >= chunkStart && block.end <= chunkEnd);
            
            // Check if this chunk IS a code block
            const isCodeBlock = contextInfo.codeBlocks
                .some(block => Math.abs(block.index - chunkStart) < 10 && Math.abs(block.end - chunkEnd) < 10);
            
            // Enhanced metadata with context information
            const enhancedMetadata = {
                ...document.metadata,
                chunkIndex: index,
                totalChunks: chunks.length,
                
                // Context preservation metadata
                contextTitle: relevantTitle ? relevantTitle.text : null,
                hasSteps: relevantSteps.length > 0,
                stepCount: relevantSteps.length,
                hasCodeBlocks: hasCodeBlocks,
                
                // Content type detection
                contentType: this.detectContentType(chunk),
                isCodeBlock: isCodeBlock,
                codeLanguage: isCodeBlock ? this.detectCodeLanguage(chunk) : null,
                
                // Quality indicators
                isComplete: this.isCompleteSection(chunk),
                preservesContext: true
            };
            
                         return {
                 text: sanitizedChunk,
                 metadata: enhancedMetadata
             };
        });
    }
    
    /**
     * Detect the type of content in a chunk
     * @static
     * @param {string} chunk - The text chunk to analyze
     * @returns {string} Content type
     */
    static detectContentType(chunk) {
        if (chunk.includes('```')) return 'code_example';
        if (chunk.includes('Step ') || chunk.includes('Phase ')) return 'instructions';
        if (chunk.includes('pip install') || chunk.includes('npm install')) return 'installation';
        if (chunk.includes('import ') || chunk.includes('from ')) return 'code_setup';
        if (chunk.includes('def ') || chunk.includes('function ') || chunk.includes('class ')) return 'code_definition';
        if (chunk.includes('Example') || chunk.includes('example:')) return 'example';
        if (chunk.includes('Error') || chunk.includes('error')) return 'troubleshooting';
        return 'documentation';
    }
    
    /**
     * Check if a chunk represents a complete section
     * @static
     * @param {string} chunk - The text chunk to check
     * @returns {boolean} Whether the chunk is complete
     */
    static isCompleteSection(chunk) {
        // Check for complete sentences
        const endsWithPunctuation = /[.!?]\s*$/.test(chunk.trim());
        
        // Check for complete code blocks
        const codeBlockCount = (chunk.match(/```/g) || []).length;
        const hasCompleteCodeBlocks = codeBlockCount % 2 === 0;
        
        // Check for complete lists
        const hasIncompleteLists = /^\s*[-*]\s/.test(chunk) && !/[-*]\s.*[.!?]\s*$/.test(chunk);
        
        return endsWithPunctuation && hasCompleteCodeBlocks && !hasIncompleteLists;
    }
}

// Export for CommonJS
module.exports = { TextProcessor }; 