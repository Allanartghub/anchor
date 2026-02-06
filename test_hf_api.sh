#!/bin/bash
# Test HuggingFace API with correct format

curl -X POST https://router.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2 \
  -H "Authorization: Bearer $HF_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": "You are a helpful assistant. User: Hello. Assistant:",
    "parameters": {
      "max_length": 200,
      "temperature": 0.7
    }
  }' | jq .
