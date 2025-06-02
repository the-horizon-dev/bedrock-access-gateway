# OpenAI-Compatible Bedrock Gateway

An OpenAI-compatible API gateway for AWS Bedrock's Anthropic Claude models. This service provides a drop-in replacement for OpenAI's API, allowing you to use Anthropic's Claude models through AWS Bedrock with your existing OpenAI-compatible tools and libraries.

## Features

- 🔄 **OpenAI API Compatibility**: Drop-in replacement for OpenAI's Chat Completions API
- 🤖 **Anthropic Claude Models**: Access to Claude 3 (Opus, Sonnet, Haiku), Claude 2, and Claude Instant
- 🌊 **Streaming Support**: Real-time streaming responses via Server-Sent Events
- 🔐 **API Key Authentication**: Secure access with Bearer token authentication
- 🚀 **Serverless Ready**: Deploy on AWS Lambda or run as a container
- 📊 **Model Mapping**: Automatic mapping from OpenAI model names to Anthropic equivalents

## Model Mapping

| OpenAI Model | Anthropic Model |
|--------------|-----------------|
| gpt-4o | claude-v2 |
| gpt-4 | claude-v2 |
| gpt-4-turbo | claude-3-sonnet |
| gpt-4-turbo-preview | claude-3-sonnet |

You can also use Anthropic model IDs directly:
- `claude-3-opus-20240229-v1:0`
- `claude-3-sonnet-20240229-v1:0`
- `claude-3-haiku-20240307-v1:0`

## API Endpoints

### Chat Completions
```bash
POST /v1/chat/completions
```

Compatible with OpenAI's chat completions endpoint. Supports both streaming and non-streaming responses.

### Models
```bash
GET /v1/models
GET /v1/models/{model_id}
```

List available models or get details about a specific model.

### Embeddings
```bash
POST /v1/embeddings
```

Generate embeddings using AWS Bedrock's embedding models.

## Quick Start

### Environment Variables

```bash
API_KEY=your-secret-api-key
AWS_REGION=us-east-1
NODE_ENV=production
CORS_ORIGIN=*
```

### Using with OpenAI Python SDK

```python
from openai import OpenAI

client = OpenAI(
    api_key="your-secret-api-key",
    base_url="https://your-gateway-url.com/v1"
)

response = client.chat.completions.create(
    model="gpt-4",  # Maps to Claude 2
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"}
    ],
    stream=True
)

for chunk in response:
    print(chunk.choices[0].delta.content, end="")
```

### Using with LangChain

```python
from langchain.chat_models import ChatOpenAI

llm = ChatOpenAI(
    openai_api_key="your-secret-api-key",
    openai_api_base="https://your-gateway-url.com/v1",
    model_name="gpt-4-turbo"  # Maps to Claude 3 Sonnet
)

response = llm.invoke("Tell me a joke")
print(response.content)
```

### Using with curl

```bash
curl https://your-gateway-url.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-api-key" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

## Deployment

### AWS Lambda

1. Build the Lambda deployment package:
```bash
cd src/fastify-api
npm install
npm run build:ts
zip -r ../../deployment.zip dist/ node_modules/ package.json
```

2. Deploy using CloudFormation:
```bash
aws cloudformation create-stack \
  --stack-name bedrock-gateway \
  --template-body file://deployment/BedrockProxy.template \
  --parameters ParameterKey=ApiKey,ParameterValue=your-secret-key \
  --capabilities CAPABILITY_IAM
```

### Docker

1. Build the Docker image:
```bash
cd src/fastify-api
docker build -t bedrock-gateway .
```

2. Run the container:
```bash
docker run -p 3000:3000 \
  -e API_KEY=your-secret-key \
  -e AWS_REGION=us-east-1 \
  -e AWS_ACCESS_KEY_ID=your-access-key \
  -e AWS_SECRET_ACCESS_KEY=your-secret-key \
  bedrock-gateway
```

## IAM Permissions

The service requires the following AWS IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:ListFoundationModels"
      ],
      "Resource": "*"
    }
  ]
}
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build:ts
```

## License

MIT
```

## 6. Update Docker Support

### File: `src/fastify-api/Dockerfile`
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy TypeScript config and source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm install -g typescript
RUN tsc

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production

# Run the application
CMD ["node", "dist/index.js"]