/**
 * Pinecone Configuration Module
 * @module config/pinecone
 * @requires @pinecone-database/pinecone
 * @requires dotenv
 */

const { Pinecone } = require('@pinecone-database/pinecone');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Initialize Pinecone client and index with namespace support
 * @async
 * @function initializePinecone
 * @returns {Promise<Object>} Object containing Pinecone client, index, and namespace
 * @throws {Error} If initialization fails
 */
const initializePinecone = async () => {
    const client = new Pinecone({ 
        apiKey: process.env.PINECONE_API_KEY,
    });
    
    try {
        const indexName = process.env.PINECONE_INDEX;
        const namespace = process.env.PINECONE_NAMESPACE || 'HANDIT';
        
        // Get index instance
        const baseIndex = client.index(indexName);
        
        // Get namespaced index
        const index = baseIndex.namespace(namespace);
        
        console.log(`🔌 Connected to Pinecone index: ${indexName} with namespace: ${namespace}`);
        
        return {
            client,
            index,
            baseIndex,
            namespace,
            indexName
        };
    } catch (error) {
        console.error('❌ Error initializing Pinecone:', error);
        throw error;
    }
};

/**
 * Sample knowledge base data for Handit.ai
 * @type {Array<Object>}
 * @property {string} text - The content text
 * @property {Object} metadata - Metadata for the content
 * @property {string} metadata.category - Content category
 * @property {string} metadata.intent - Expected user intent
 * @property {string} metadata.topic - Specific topic
 */
const handitKnowledgeBase = [
    {
        text: `Handit.ai Overview

Handit.ai is an AI-powered platform that helps teams build and deploy intelligent applications at scale. It is the Open Source Engine that Auto-Improves Your AI.

Handit evaluates every agent decision, auto-generates better prompts and datasets, A/B-tests the fix, and lets you control what goes live.

Key Features:
- Easy to use: Integrates into your stack in minutes
- Auto-optimization: Deploys top-performing models and prompts instantly
- Live monitoring: Tracks performance and failures in real time
- Auto-evaluation: Grades outputs with LLM-as-Judge and custom KPIs on live data
- A/B testing: Automatically surfaces the best variant by ROI
- Impact metrics: Links AI tweaks to cost savings, conversions, and user satisfaction
- Proven results: ASPE.ai saw +62.3% accuracy and +97.8% success rate in 48 hours

Watch how to transform your AI from static to self-improving in minutes with our 5-minute demo.`
    },
    {
        text: `AI Application Challenges and Solutions

Common AI Pipeline Problems:
Many developers face recurring issues with AI applications. Prompts need constant tweaking, AI responses can be unpredictable, and systems sometimes produce unexpected outputs or fail completely. These issues often manifest as:
- Inconsistent AI behavior
- Prompts requiring frequent manual adjustments
- Unexpected or inappropriate AI responses
- Difficult to debug AI failures
- Manual monitoring and fixing processes

Handit.ai Solution:
Handit.ai is the open-source solution for AI pipeline reliability. It provides live monitoring, automated A/B testing, and AI-as-Judge evaluations on real traffic. The platform spots failures and resolves them automatically before they impact users.

Benefits:
- Eliminates manual prompt debugging
- Prevents unexpected AI behavior
- Automates quality control
- Provides real-time failure detection
- Enables continuous AI improvement`
    },
    {
        text: `Real-Time Monitoring Capabilities

Handit.ai provides comprehensive real-time monitoring for AI systems:

Core Monitoring Features:
- Continuously ingest logs from every model, prompt, and agent in your stack
- Instantly visualize performance trends with interactive dashboards
- Detect anomalies and drift automatically
- Set custom alerts for drift or failures in real-time

Benefits:
- Ingest logs from models, prompts, and agents in seconds
- Visualize performance trends with interactive dashboards
- Detect anomalies and drift automatically
- Set custom real-time alerts for failures and threshold breaches

The monitoring system provides complete visibility into your AI operations, allowing you to track performance trends, identify issues early, and maintain system reliability.`
    },
    {
        text: `Evaluation and Quality Assessment

Handit.ai offers comprehensive evaluation capabilities for AI systems:

Evaluation Features:
- Run evaluation pipelines on production traffic
- Use custom LLM-as-Judge prompts for quality assessment
- Set business KPI thresholds for accuracy, latency, and other metrics
- Get automated quality scores in real time
- Results feed directly into optimization workflows with no manual grading required

Key Benefits:
- Execute LLM-as-Judge prompts on live traffic
- Enforce business KPI thresholds for accuracy, latency, and other metrics
- Receive automated quality scores in real time
- Feed results directly into optimization workflows automatically

The evaluation system enables continuous quality monitoring and improvement of AI applications without manual intervention.`
    },
    {
        text: `Prompt Management and AI CI/CD

Handit.ai provides comprehensive prompt management and continuous integration/deployment for AI:

Experimentation:
- Test different model versions, prompts, or agent configurations
- Use A/B traffic routing with no manual work required
- Compare prompt versions side-by-side
- Promote your favorite to production and deploy with a single click

Automatic Optimization:
- Handit collects performance and ROI metrics in real time
- Automatically promotes the winning variant without human intervention
- Identifies top performers based on ROI metrics

Collaboration and Version Control:
- Built-in version control for managing templates
- Tag and categorize prompts for better organization
- View performance trends over time
- Centralize prompt templates and version histories
- Roll back or fork proven prompts instantly for quick iteration

Benefits:
- Launch experiments across model versions, prompts, or agent configs
- Automatically route traffic and gather performance data
- Compare ROI metrics to identify top performers
- Promote winning variants without manual effort
- Track prompt performance trends over time
- Enable team collaboration on prompt development`
    },
    {
        text: `Getting Started with Handit.ai

Quick Integration:
Handit.ai is designed for easy integration into existing technology stacks. The platform can be integrated in minutes, allowing teams to start benefiting from AI optimization immediately.

Key Integration Points:
- Real-time monitoring integration
- Evaluation hub for running assessments
- Prompt version management
- Experiment tracking and deployment

Access Points:
- Evaluation Hub for running evaluations
- Prompt Versions for experiment management and deployments
- AI Agent Tracing Dashboard for monitoring
- Error Detection and Analysis tools

Support and Resources:
For assistance, users can check GitHub Issues or contact the support team directly. The platform is open source and community-driven.

The quickstart guide provides step-by-step instructions for initial setup and configuration.`,
        metadata: {
            category: "getting_started",
            intent: "onboarding_inquiry",
            topic: "integration_setup",
            phase: "general"
        }
    },
    {
        text: `Handit.ai Setup Overview: The Complete Journey

Here's what we'll accomplish in three phases:

Phase 1: AI Observability 
Set up comprehensive tracing to see inside your AI agents and understand what they're doing

Phase 2: Quality Evaluation 
Add automated evaluation to continuously assess performance across multiple quality dimensions

Phase 3: Self-Improving AI 
Enable automatic optimization that generates better prompts, tests them, and provides proven improvements

The Result: Complete visibility into performance with automated optimization recommendations based on real production data.

Prerequisites
Before we start, make sure you have:
- A Handit.ai Account, you can create one in the [Handit.ai Site](https://dashboard.handit.ai/auth/custom/sign-up)`,
        metadata: {
            category: "setup",
            intent: "setup_overview",
            topic: "complete_journey",
            phase: "overview"
        }
    },
    {
        text: `Phase 1: AI Observability
        
This is the Python Setup fot Observability.

Let's add comprehensive tracing to see exactly what your AI is doing.

Step 1: Install the SDK
pip install -U "handit-sdk>=1.16.0"

Step 2: Get Your Integration Token
1. Log into your Handit.ai Dashboard [https://dashboard.handit.ai/]
2. Go to Settings → Integrations
3. Copy your integration token

Step 3: Add Basic Tracing
Now, let's set up your main agent function, LLM calls and tool usage with tracing. You'll need to set up four key components:

1. Initialize Handit.ai service
2. Set up your start tracing
3. Track LLMs calls, tools in your workflow
4. Set up your end tracing


First you need to to create a handit_service.py file to initialize the Handit.ai tracker, like this example:

"""
Handit.ai service initialization and configuration.
This file creates a singleton tracker instance that can be imported across your application.
"""
import os
from dotenv import load_dotenv
from handit import HanditTracker
 
# Load environment variables from .env file
load_dotenv()
 
# Create a singleton tracker instance
tracker = HanditTracker()  # Creates a global tracker instance for consistent tracing across the app
 
# Configure with your API key from environment variables
tracker.config(api_key=os.getenv("HANDIT_API_KEY"))  # Sets up authentication for Handit.ai services`,
        metadata: {
            category: "setup",
            intent: "technical_setup",
            topic: "observability_python",
            phase: "phase_1",
            language: "python"
        }
    },
    {
        text: `Phase 1: AI Observability - Python Set up your start tracing, Track LLMs calls, tools in your workflow, Set up your end tracing Example

This example uses three main Handit.ai tracing functions:

startTracing({ agentName }): Starts a new trace session
- agentName: The name of your AI Application

trackNode({ input, output, nodeName, agentName, nodeType, executionId }): Records individual operations
- input: The input data for the operation (e.g., user message)
- output: The result of the operation (e.g., generated response)
- nodeName: Unique identifier for this operation (e.g., "response_generator")
- agentName: The name of your AI Application
- nodeType: Type of operation ("llm" for language model, "tool" for functions)
- executionId: ID from startTracing to link operations together

endTracing({ executionId, agentName }): Ends the trace session
- executionId: The ID from startTracing to end
- agentName: Must match the name used in startTracing

Complete example:

"""
Simple customer service agent with Handit.ai tracing.
"""
from typing import Dict, Any
from handit_service import tracker
from langchain.chat_models import ChatOpenAI
 
class CustomerServiceAgent:
    def __init__(self):
        # Initialize LLM for response generation
        self.llm = ChatOpenAI(model="gpt-4")
 
    async def generate_response(self, user_message: str) -> Dict[str, Any]:
        """
        Generate a response using LLM.
        """
        prompt = f"Generate a helpful response to: {user_message}"
        try:
            response = await self.llm.agenerate([prompt])
            return response.generations[0][0].text
        except Exception as e:
            raise
 
    async def process_customer_request(self, user_message: str, execution_id: str) -> Dict[str, Any]:
        """
        Process a customer request with Handit.ai tracing.
        """
        try:
            # Generate response
            response = await self.generate_response(user_message)
            # Track the response generation
            tracker.track_node(
                input=user_message,           # The original user message
                output=response,              # The generated response
                node_name="response_generator", # Unique identifier for this operation
                agent_name="customer_service_agent", # Name of this AI Application
                node_type="llm",              # Indicates this is a language model operation
                execution_id=execution_id     # Links this operation to the current trace session
            )
            
            return {
                "response": response
            }
            
        except Exception as e:
            raise
 
async def main():
    """Example of using the CustomerServiceAgent with Handit.ai tracing."""
    # Initialize the agent
    agent = CustomerServiceAgent()
    
    # Start a new trace session
    tracing_response = tracker.start_tracing(
        agent_name="customer_service_agent"  # Identifies this agent in the Handit.ai dashboard
    )
    execution_id = tracing_response.get("executionId")  # Unique ID for this trace session
    
    try:
        # Process a customer request
        result = await agent.process_customer_request(
            user_message="I can't access my account",
            execution_id=execution_id
        )
        print(f"Response: {result['response']}")
    except Exception as e:
        print(f"Error processing request: {e}")
    finally:
        # End the trace session
        tracker.end_tracing(
            execution_id=execution_id,           # The ID of the trace session to end
            agent_name="customer_service_agent"  # Must match the name used in start_tracing
        )

Important: Each node in your workflow should have a unique node_name to properly track its execution in the dashboard.

Phase 1 Complete! 🎉 You now have full observability with every operation, timing, input, output, and error visible in your dashboard.`,
        metadata: {
            category: "setup",
            intent: "code_implementation",
            topic: "observability_python_example",
            phase: "phase_1",
            language: "python"
        }
    },
    {
        text: `Phase 1: AI Observability - JavaScript Setup

This is the JavaScript Setup fot Observability.

Step 1: Install the SDK
npm install @handit.ai/node

Step 2: Get Your Integration Token
1. Log into your Handit.ai Dashboard [https://dashboard.handit.ai/]
2. Go to Settings → Integrations
3. Copy your integration token

Step 3: Add Basic Tracing
Now, let's set up your main agent function, LLM calls and tool usage with tracing. You'll need to set up four key components:

1. Initialize Handit.ai service
2. Set up your start tracing
3. Track LLMs calls, tools in your workflow
4. Set up your end tracing

Create a handit_service.js file to initialize the Handit.ai tracker:

/**
 * Handit.ai service initialization.
 */
import { config } from '@handit.ai/node';
 
// Configure Handit.ai with your API key
config({ 
    apiKey: process.env.HANDIT_API_KEY  // Sets up authentication for Handit.ai services
});`,
        metadata: {
            category: "setup",
            intent: "technical_setup",
            topic: "observability_javascript",
            phase: "phase_1",
            language: "javascript"
        }
    },
    {
        text: `Phase 1: AI Observability - JavaScript Implementation Example

The example uses three main Handit.ai tracing functions:

startTracing({ agentName }): Starts a new trace session
- agentName: The name of your AI Application

trackNode({ input, output, nodeName, agentName, nodeType, executionId }): Records individual operations
- input: The input data for the operation (e.g., user message)
- output: The result of the operation (e.g., generated response)
- nodeName: Unique identifier for this operation (e.g., "response_generator")
- agentName: Name of your agent AI Application
- nodeType: Type of operation ("llm" for language model, "tool" for functions)
- executionId: ID from startTracing to link operations together

endTracing({ executionId, agentName }): Ends the trace session
- executionId: The ID from startTracing to end
- agentName: Must match the name used in startTracing

Complete example:

/**
 * Simple customer service agent with Handit.ai tracing.
 */
import { startTracing, trackNode, endTracing } from '@handit.ai/node';
import { ChatOpenAI } from 'langchain/chat_models';
 
class CustomerServiceAgent {
    constructor() {
        // Initialize LLM for response generation
        this.llm = new ChatOpenAI({ model: 'gpt-4' });
    }
 
    async generateResponse(userMessage) {
        const prompt = \`Generate a helpful response to: \${userMessage}\`;
        try {
            const response = await this.llm.generate([prompt]);
            return response.generations[0][0].text;
        } catch (error) {
            throw error;
        }
    }
 
    async processCustomerRequest(userMessage, executionId) {
        try {
            // Generate response
            const response = await this.generateResponse(userMessage);
            // Track the response generation
            await trackNode({
                input: userMessage,           // The original user message
                output: response,             // The generated response
                nodeName: 'response_generator', // Unique identifier for this operation
                agentName: 'customer_service_agent', // Name of this AI Application
                nodeType: 'llm',              // Indicates this is a language model operation
                executionId                   // Links this operation to the current trace session
            });
            
            return {
                response
            };
            
        } catch (error) {
            throw error;
        }
    }
}
 
async function main() {
    // Initialize the agent
    const agent = new CustomerServiceAgent();
    
    // Start a new trace session
    const tracingResponse = await startTracing({ 
        agentName: 'customer_service_agent'  // Identifies this agent in the Handit.ai dashboard
    });
    const executionId = tracingResponse.executionId;  // Unique ID for this trace session
    
    try {
        // Process a customer request
        const result = await agent.processCustomerRequest(
            "I can't access my account",
            executionId
        );
        console.log('Response:', result.response);
    } catch (error) {
        console.error('Error processing request:', error);
    } finally {
        // End the trace session
        await endTracing({ 
            executionId,                         // The ID of the trace session to end
            agentName: 'customer_service_agent'  // Must match the name used in startTracing
        });
    }
}

Important: Each node in your workflow should have a unique node_name to properly track its execution in the dashboard.

Phase 1 Complete! 🎉 You now have full observability with every operation, timing, input, output, and error visible in your dashboard.`,
        metadata: {
            category: "setup",
            intent: "code_implementation",
            topic: "observability_javascript_example",
            phase: "phase_1",
            language: "javascript"
        }
    },
    {
        text: `Phase 2: Quality Evaluation Setup

Now let's add automated evaluation to continuously assess quality across multiple dimensions.

Step 1: Connect Evaluation Models
1. Go to Settings → Model Tokens
2. Add your OpenAI or other model credentials
3. These models will act as "judges" to evaluate responses

Step 2: Create Focused Evaluators
Create separate evaluators for each quality aspect. Critical principle: One evaluator = one quality dimension.

1. Go to Evaluation → Evaluation Suite
2. Click Create New Evaluator

Example Evaluator 1: Response Completeness

You are evaluating whether an AI response completely addresses the user's question.

Focus ONLY on completeness - ignore other quality aspects.

User Question: {input}
AI Response: {output}

Rate on a scale of 1-10:
1-2 = Missing major parts of the question
3-4 = Addresses some parts but incomplete
5-6 = Addresses most parts adequately  
7-8 = Addresses all parts well
9-10 = Thoroughly addresses every aspect

Output format:
Score: [1-10]
Reasoning: [Brief explanation]

Example Evaluator 2: Accuracy Check

You are checking if an AI response contains accurate information.

Focus ONLY on factual accuracy - ignore other aspects.

User Question: {input}
AI Response: {output}

Rate on a scale of 1-10:
1-2 = Contains obvious false information
3-4 = Contains questionable claims
5-6 = Mostly accurate with minor concerns
7-8 = Accurate information
9-10 = Completely accurate and verifiable

Output format:
Score: [1-10]
Reasoning: [Brief explanation]

Step 3: Associate Evaluators to Your LLM Nodes
1. Go to Agent Performance
2. Select your LLM node (e.g., "response-generator")
3. Click on Manage Evaluators on the menu
4. Add your evaluators

Step 4: Monitor Results
View real-time evaluation results in:
- Tracing tab: Individual evaluation scores
- Agent Performance: Quality trends over time

Phase 2 Complete! 🎉 Continuous evaluation is now running across multiple quality dimensions with real-time insights into performance trends.`,
        metadata: {
            category: "setup",
            intent: "evaluation_setup",
            topic: "quality_evaluation",
            phase: "phase_2"
        }
    },
    {
        text: `Phase 3: Self-Improving AI Setup

Finally, let's enable automatic optimization that generates better prompts and provides proven improvements.

Step 1: Connect Optimization Models
1. Go to Settings → Model Tokens
2. Select optimization model tokens
3. Self-improving AI automatically activates once configured

Automatic Activation: Once optimization tokens are configured, the system automatically begins analyzing evaluation data and generating optimizations. No additional setup required!

Step 2: Monitor Optimization Results
The system is now automatically generating and testing improved prompts. Monitor results in two places:

Agent Performance Dashboard:
- View agent performance metrics
- Compare current vs optimized versions
- See improvement percentages

Release Hub:
1. Go to Optimization → Release Hub
2. View detailed prompt comparisons
3. See statistical confidence and recommendations

Step 3: Deploy Optimizations
1. Review Recommendations in Release Hub
2. Compare Performance between current and optimized prompts
3. Mark as Production for prompts you want to deploy
4. Fetch via SDK in your application

Fetch Optimized Prompts:

Python example:

from handit import HanditTracker
 
# Initialize tracker
tracker = HanditTracker(api_key="your-api-key")
 
# Fetch current production prompt
optimized_prompt = tracker.fetch_optimized_prompt(
    model_id="response-generator"
)
 
# Use in your LLM calls
response = your_llm_client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": optimized_prompt},
        {"role": "user", "content": user_query}
    ]
)

JavaScript example:

import { HanditClient } from '@handit/sdk';
 
const handit = new HanditClient({ apiKey: 'your-api-key' });
 
// Fetch current production prompt
const optimizedPrompt = await handit.fetchOptimizedPrompt({ 
  modelId: 'response-generator' 
});
 
// Use in your LLM calls
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: optimizedPrompt },
    { role: 'user', content: userQuery }
  ]
});

Phase 3 Complete! 🎉 You now have a self-improving AI that automatically detects quality issues, generates better prompts, tests them in the background, and provides proven improvements.`,
        metadata: {
            category: "setup",
            intent: "optimization_setup",
            topic: "self_improving_ai",
            phase: "phase_3"
        }
    },
    {
        text: `Handit.ai Setup Complete - What You've Accomplished

Congratulations! You now have a complete AI observability and optimization system:

✅ Full Observability
- Complete visibility into operations
- Real-time monitoring of all LLM calls and tools
- Detailed execution traces with timing and error tracking

✅ Continuous Evaluation
- Automated quality assessment across multiple dimensions
- Real-time evaluation scores and trends
- Quality insights to identify improvement opportunities

✅ Self-Improving AI
- Automatic detection of quality issues
- AI-generated prompt optimizations
- Background A/B testing with statistical confidence
- Production-ready improvements delivered via SDK

Your AI system now automatically monitors itself, evaluates its performance, and continuously improves without manual intervention. The complete setup provides end-to-end visibility and optimization for maximum AI performance.`,
        metadata: {
            category: "setup",
            intent: "completion_summary",
            topic: "final_accomplishments",
            phase: "complete"
        }
    }
];

module.exports = {
    initializePinecone,
    handitKnowledgeBase
}; 