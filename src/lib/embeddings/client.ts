/**
 * Cliente mínimo del endpoint de embeddings de OpenRouter (compatible con el formato de
 * OpenAI). Se usa `fetch` directo (inyectable para tests) en lugar del AI SDK porque los
 * embeddings no forman parte del pipeline de generación: son una utilidad transversal
 * (deduplicación temática y enlazado interno) y el contrato es trivial.
 */

const EMBEDDINGS_ENDPOINT = "https://openrouter.ai/api/v1/embeddings";

interface EmbeddingsResponse {
  data?: Array<{ embedding?: number[] }>;
}

export async function embedTexts(params: {
  apiKey: string;
  model: string;
  texts: string[];
  fetchFn?: typeof fetch;
}): Promise<number[][]> {
  const fetchFn = params.fetchFn ?? fetch;
  const response = await fetchFn(EMBEDDINGS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({ model: params.model, input: params.texts }),
  });

  if (!response.ok) {
    throw new Error(`El endpoint de embeddings respondió ${response.status}`);
  }

  const payload = (await response.json()) as EmbeddingsResponse;
  const vectors = (payload.data ?? []).map((item) => item.embedding ?? []);
  if (vectors.length !== params.texts.length || vectors.some((v) => v.length === 0)) {
    throw new Error("El endpoint de embeddings devolvió una respuesta incompleta");
  }
  return vectors;
}
