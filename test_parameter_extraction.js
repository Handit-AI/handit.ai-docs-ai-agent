/**
 * Test script for parameter extraction
 * Run with: node test_parameter_extraction.js
 */

const axios = require('axios');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

async function testParameterExtraction() {
    try {
        console.log('🧪 Testing parameter extraction...');
        
        const modelId = 'test-model-123';
        const modelLogId = 456;
        
        console.log(`📤 Sending request with modelId: ${modelId}, modelLogId: ${modelLogId}`);
        
        const response = await axios.post(
            `${BASE_URL}/api/prompt-version/model/${modelId}/prompt/optimize-from-error`,
            {
                modelLogId: modelLogId
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token'
                }
            }
        );
        
        console.log('✅ Request sent successfully!');
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Parameter extraction test failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
    }
}

async function testWithStringModelLogId() {
    try {
        console.log('\n🧪 Testing with string modelLogId...');
        
        const modelId = 'test-model-456';
        const modelLogId = "789"; // String instead of number
        
        console.log(`📤 Sending request with modelId: ${modelId}, modelLogId: "${modelLogId}" (string)`);
        
        const response = await axios.post(
            `${BASE_URL}/api/prompt-version/model/${modelId}/prompt/optimize-from-error`,
            {
                modelLogId: modelLogId
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token'
                }
            }
        );
        
        console.log('✅ String modelLogId test successful!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ String modelLogId test failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
    }
}

async function testMissingModelLogId() {
    try {
        console.log('\n🧪 Testing with missing modelLogId...');
        
        const modelId = 'test-model-789';
        
        console.log(`📤 Sending request with modelId: ${modelId}, no modelLogId`);
        
        const response = await axios.post(
            `${BASE_URL}/api/prompt-version/model/${modelId}/prompt/optimize-from-error`,
            {},
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token'
                }
            }
        );
        
        console.log('✅ Missing modelLogId test successful!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Missing modelLogId test failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
    }
}

async function runParameterTests() {
    console.log('🚀 Starting parameter extraction tests...\n');
    
    await testParameterExtraction();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await testWithStringModelLogId();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await testMissingModelLogId();
    console.log('\n' + '='.repeat(50) + '\n');
    
    console.log('✨ All parameter tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runParameterTests().catch(console.error);
}

module.exports = { testParameterExtraction, testWithStringModelLogId, testMissingModelLogId }; 