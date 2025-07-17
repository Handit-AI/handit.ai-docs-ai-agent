# Google Cloud Run Deployment Guide

This guide explains how to deploy the Handit.ai AI Documentation Agent to Google Cloud Run using Cloud Build.

## Prerequisites

1. **Google Cloud Account**: You need a Google Cloud account with billing enabled
2. **Google Cloud SDK**: Install and configure the Google Cloud CLI
3. **Required APIs**: Enable the following APIs in your Google Cloud project:
   - Cloud Run API
   - Cloud Build API
   - Artifact Registry API
   - Secret Manager API

## Setup Steps

### 1. Create Google Cloud Project

```bash
# Create a new project (or use an existing one)
gcloud projects create YOUR_PROJECT_ID

# Set the project as default
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### 2. Create Artifact Registry Repository

```bash
# Create a Docker repository in Artifact Registry
gcloud artifacts repositories create cloud-run-source-deploy \
    --repository-format=docker \
    --location=us-central1 \
    --description="Docker repository for Cloud Run deployments"
```

### 3. Set Up Secrets in Secret Manager

Create secrets for all the environment variables your application needs:

```bash
# Database secrets
gcloud secrets create DATABASE_URL --data-file=- <<< "your_database_url"
gcloud secrets create DB_HOST --data-file=- <<< "your_db_host"
gcloud secrets create DB_PORT --data-file=- <<< "5432"
gcloud secrets create DB_NAME --data-file=- <<< "your_db_name"
gcloud secrets create DB_USER --data-file=- <<< "your_db_user"
gcloud secrets create DB_PASSWORD --data-file=- <<< "your_db_password"

# OpenAI secrets
gcloud secrets create OPENAI_API_KEY --data-file=- <<< "your_openai_api_key"

# Pinecone secrets
gcloud secrets create PINECONE_API_KEY --data-file=- <<< "your_pinecone_api_key"
gcloud secrets create PINECONE_ENVIRONMENT --data-file=- <<< "your_pinecone_environment"
gcloud secrets create PINECONE_INDEX_NAME --data-file=- <<< "handit-ai-docs"
gcloud secrets create PINECONE_NAMESPACE --data-file=- <<< "default"

# API Integration secrets
# Required: API URL for external service integration
gcloud secrets create API_URL --data-file=- <<< "https://api.example.com"
# Optional: Default API key (users can provide their own via Authorization header)
gcloud secrets create API_KEY --data-file=- <<< "your_default_api_key"
```

### 4. Create Cloud Build Trigger

You can create a Cloud Build trigger that automatically deploys when you push to your repository:

```bash
# Connect your repository to Cloud Build (GitHub/GitLab/Bitbucket)
gcloud builds triggers create github \
    --name="handit-ai-docs-agent-deploy" \
    --repo-name="handit.ai-docs-ai-agent" \
    --repo-owner="YOUR_GITHUB_USERNAME" \
    --branch-pattern="^main$" \
    --build-config="cloudbuild.yaml"
```

### 5. Manual Deployment

If you prefer to deploy manually:

```bash
# Build and deploy using Cloud Build
gcloud builds submit --config=cloudbuild.yaml .
```

## Configuration

### Environment Variables

The following environment variables are automatically set by Cloud Run:
- `PORT`: Set to 8080 (Cloud Run default)
- `NODE_ENV`: Set to "production" in the Cloud Build config

### Optional Features

The AI agent includes flexible integration with external APIs:
- `API_URL`: URL to the external API backend (required for API features)
- `API_KEY`: Default API key for authentication (optional - users can provide their own)

**Token Flexibility**: Users can provide their own API tokens via the Authorization header in requests. The system supports:
1. **User tokens** (Authorization header) - Takes precedence
2. **Default token** (API_KEY environment variable) - Fallback
3. **No API integration** - Falls back to documentation mode

**Note**: The agent works perfectly without external API integration. When not configured, it provides documentation and guidance. When configured, it can execute actions like creating integration tokens, managing evaluators, etc.

### Secrets

All sensitive data is stored in Google Secret Manager and automatically injected into your Cloud Run service.

### Resource Allocation

The current configuration allocates:
- **Memory**: 2GB
- **CPU**: 1 vCPU
- **Timeout**: 900 seconds (default)

You can adjust these in the `cloudbuild.yaml` file.

## Monitoring and Debugging

### View Logs

```bash
# View Cloud Run logs
gcloud logs tail projects/YOUR_PROJECT_ID/logs/run.googleapis.com%2Frequests

# View Cloud Build logs
gcloud builds log BUILD_ID
```

### Health Check

Your deployed service will be available at:
```
https://handit-ai-docs-agent-RANDOM_HASH-uc.a.run.app
```

Check the health endpoint:
```
https://handit-ai-docs-agent-RANDOM_HASH-uc.a.run.app/api/health
```

## Customization

### Modify the Service Name

Edit the `_SERVICE_NAME` substitution in `cloudbuild.yaml`:

```yaml
substitutions:
  _SERVICE_NAME: your-custom-service-name
```

### Change Region

Edit the `_DEPLOY_REGION` substitution in `cloudbuild.yaml`:

```yaml
substitutions:
  _DEPLOY_REGION: us-east1  # or your preferred region
```

### Add More Environment Variables

Add additional secrets or environment variables in the deploy step of `cloudbuild.yaml`:

```yaml
- '--set-secrets'
- 'NEW_SECRET=NEW_SECRET:latest'
- '--set-env-vars=NEW_ENV_VAR=value'
```

## Database Setup

If you're using Cloud SQL for PostgreSQL:

1. Create a Cloud SQL instance
2. Create a database and user
3. Update the `DATABASE_URL` secret with the Cloud SQL connection string
4. Make sure to enable the Cloud SQL Admin API

## Troubleshooting

### Common Issues

1. **Build fails**: Check that all required APIs are enabled
2. **Secrets not found**: Verify secrets exist in Secret Manager
3. **Service won't start**: Check logs for missing environment variables
4. **Database connection fails**: Verify database credentials and network access

### Useful Commands

```bash
# Check service status
gcloud run services describe handit-ai-docs-agent --region=us-central1

# Update service manually
gcloud run services update handit-ai-docs-agent --region=us-central1

# Delete service
gcloud run services delete handit-ai-docs-agent --region=us-central1
```

## Security Considerations

1. **Secrets**: Never commit secrets to your repository
2. **IAM**: Use least privilege principle for service accounts
3. **Network**: Consider using VPC connectors for database access
4. **Authentication**: Implement proper authentication for your API endpoints

## Cost Optimization

1. **CPU allocation**: Only allocate CPU during requests
2. **Memory**: Right-size memory allocation based on usage
3. **Concurrency**: Adjust concurrency settings based on your workload
4. **Minimum instances**: Set to 0 for cost savings (cold starts acceptable)

## Next Steps

1. Set up monitoring and alerting
2. Implement CI/CD pipeline
3. Add automated testing
4. Configure custom domain
5. Set up SSL certificates 