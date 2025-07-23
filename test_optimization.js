/**
 * Test script for optimization endpoint
 * Run with: node test_optimization.js
 */

const axios = require('axios');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

async function testOptimization() {
    try {
        console.log('🧪 Testing optimization endpoint...');
        
        const modelId = 'test-model-123';
        const modelLogId = 456;
        
        const response = await axios.post(
            `${BASE_URL}/api/prompt-version/model/${modelId}/prompt/optimize-from-error`,
            {
                modelLogId: modelLogId
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token' // Optional
                }
            }
        );
        
        console.log('✅ Optimization test successful!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Optimization test failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
    }
}

async function testHealth() {
    try {
        console.log('🏥 Testing health endpoint...');
        
        const response = await axios.get(`${BASE_URL}/api/health`);
        console.log('Health response:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Health test failed:', error.message);
    }
}

async function testVersion() {
    try {
        console.log('📋 Testing version endpoint...');
        
        const response = await axios.get(`${BASE_URL}/api/ai/version`);
        console.log('Version response:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Version test failed:', error.message);
    }
}

async function runTests() {
    console.log('🚀 Starting optimization tests...\n');
    
    await testHealth();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await testVersion();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await testOptimization();
    console.log('\n' + '='.repeat(50) + '\n');
    
    console.log('✨ All tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { testOptimization, testHealth, testVersion }; 