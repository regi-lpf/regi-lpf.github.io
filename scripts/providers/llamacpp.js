/**
 * Conector para servidor local llama.cpp (llama-server).
 * Utiliza o endpoint compatível com OpenAI e enforces Structured Outputs via JSON Schema.
 */
export async function generateStructuredSummary(messages, jsonSchema) {
  const endpoint = process.env.LLAMACPP_URL || 'http://127.0.0.1:8080/v1/chat/completions';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages,
      temperature: 0.2,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'portfolio_project_analysis',
          strict: true,
          schema: jsonSchema
        }
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro no llama.cpp (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Resposta vazia retornada pelo llama.cpp.');
  }

  return JSON.parse(content);
}
