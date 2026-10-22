# Local Open-Weight Model Setup Guide (Ollama)

ThreadSherpa is engineered to run completely on local open-weight models using [Ollama](https://ollama.com). It does not require paid proprietary model APIs for core reasoning, embedding generation, or structured tool calling.

---

## 1. Install Ollama

### macOS
```bash
brew install ollama
brew services start ollama
```

### Linux
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Windows
Download the Windows installer from [ollama.com/download](https://ollama.com/download).

---

## 2. Pull Recommended Models

ThreadSherpa uses two models:
1. **Instruction & Structured Reasoning Model**: `gemma4:e4b-it-qat` (or `gemma4:12b`)
2. **Semantic Embedding Model**: `embeddinggemma-2:270m`

Execute the following commands in your terminal:

```bash
# Pull reasoning model (7.5B Q4_0, context 131k, tool-capable)
ollama pull gemma4:e4b-it-qat

# Pull embedding model (768-dimensional embeddings)
ollama pull embeddinggemma-2:270m
```

---

## 3. Verify Local Ollama Installation

Test that Ollama is responding locally on port 11434:

```bash
# Check installed models
curl -s http://localhost:11434/api/tags

# Test embedding generation
curl -s http://localhost:11434/api/embeddings -d '{
  "model": "embeddinggemma-2:270m",
  "prompt": "Test embedding generation"
}'
```

---

## 4. Configure ThreadSherpa Environment

Set the following variables in your `.env` file:

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:e4b-it-qat
OLLAMA_EMBEDDING_MODEL=embeddinggemma-2:270m
OLLAMA_TIMEOUT_MS=60000
```
