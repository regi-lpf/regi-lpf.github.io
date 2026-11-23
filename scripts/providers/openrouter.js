/**
 * Conector para a API do OpenRouter.
 * Suporta modelos com Structured Outputs (ex: google/gemini-2.5-flash, openai/gpt-4o-mini).
 */
export async function generateStructuredSummary(messages, jsonSchema) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('Variável de ambiente OPENROUTER_API_KEY não definida.');
  }

  const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://regi-lpf.github.io',
      'X-Title': 'Reginaldo Filho Portfolio Enricher'
    },
    body: JSON.stringify({
      model,
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
    throw new Error(`Erro no OpenRouter (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Resposta vazia retornada pelo OpenRouter.');
  }

  return JSON.parse(content);
}
