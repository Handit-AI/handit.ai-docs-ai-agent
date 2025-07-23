/**
 * Test script for conversational optimization flow
 * Run with: node test_conversational_optimization.js
 */

const axios = require('axios');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

async function testConversationalOptimization() {
    try {
        console.log('🧪 Testing conversational optimization...');
        
        const testMessage = "I want to optimize the prompt of agent with id 28, based on the result of the entry with id 17";
        
        console.log(`📤 Sending message: "${testMessage}"`);
        
        const response = await axios.post(
            `${BASE_URL}/api/ai/chat`,
            {
                question: testMessage,
                sessionId: "test-optimization-session"
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token'
                }
            }
        );
        
        console.log('✅ Conversational optimization test successful!');
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        
        // Check for optimization flags
        if (response.data.optimization_completed) {
            console.log('🎯 Optimization completed flag detected!');
        }
        if (response.data.optimization_success) {
            console.log('✅ Optimization success flag detected!');
        }
        
    } catch (error) {
        console.error('❌ Conversational optimization test failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
    }
}

async function testOptimizationWithoutToken() {
    try {
        console.log('\n🧪 Testing optimization without API token...');
        
        const testMessage = "I want to optimize the prompt of agent with id 28, based on the result of the entry with id 17";
        
        console.log(`📤 Sending message without Authorization header: "${testMessage}"`);
        
        const response = await axios.post(
            `${BASE_URL}/api/ai/chat`,
            {
                question: testMessage,
                sessionId: "test-optimization-no-token"
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ No-token test successful!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ No-token test failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
    }
}

async function testNonOptimizationMessage() {
    try {
        console.log('\n🧪 Testing non-optimization message...');
        
        const testMessage = "How do I set up integration tokens?";
        
        console.log(`📤 Sending non-optimization message: "${testMessage}"`);
        
        const response = await axios.post(
            `${BASE_URL}/api/ai/chat`,
            {
                question: testMessage,
                sessionId: "test-non-optimization"
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token'
                }
            }
        );
        
        console.log('✅ Non-optimization test successful!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
        
        // Verify it's NOT an optimization response
        if (!response.data.optimization_completed) {
            console.log('✅ Correctly identified as non-optimization request');
        }
        
    } catch (error) {
        console.error('❌ Non-optimization test failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
    }
}

async function runConversationalTests() {
    console.log('🚀 Starting conversational optimization tests...\n');
    
    await testConversationalOptimization();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await testOptimizationWithoutToken();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await testNonOptimizationMessage();
    console.log('\n' + '='.repeat(50) + '\n');
    
    console.log('✨ All conversational tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runConversationalTests().catch(console.error);
}

module.exports = { testConversationalOptimization, testOptimizationWithoutToken, testNonOptimizationMessage }; 