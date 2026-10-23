# Local reasoning and embeddings

Install [Ollama](https://ollama.com), then pull:

```bash
ollama pull gemma4:e4b-it-qat
ollama pull embeddinggemma-2:270m
```

These are the defaults. Set `OLLAMA_MODEL` and `OLLAMA_EMBEDDING_MODEL` to models available in `ollama list` if your machine needs a different size. The [Gemma library](https://ollama.com/library/gemma4) and [EmbeddingGemma 2 library](https://ollama.com/library/embeddinggemma-2) document available variants.

Start Ollama, then:

```bash
npm run test:live
npm run demo:live
```

The live tests check model availability, a real embedding response, and schema-validated generation. Structured output includes a JSON shape hint and one repair attempt. Small models can still misunderstand a question or return an unhelpful answer even when the JSON validates.

Embeddings use `/api/embed`. When that endpoint fails, the provider returns an empty vector and the retriever uses keywords. Generated stand-in vectors are never mixed into the semantic index.

Keep reasoning and embeddings on the same configured model versions while evaluating. If you switch embedding models, regenerate stored embeddings; a matching dimension alone does not make two embedding spaces compatible. The supplied Atlas index expects 768 dimensions.

Local inference needs no per-call model API fee. It still uses hardware, memory, electricity, and time. Discord and optional hosted services still use the network. The complete Discord bot does not operate offline.
