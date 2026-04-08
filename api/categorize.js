export const config = { runtime: 'edge' };

export default async function handler(req) {
  if(req.method !== 'POST'){
    return new Response('Method not allowed', { status: 405 });
  }

  const { descripcion, categorias } = await req.json();
  if(!descripcion || !categorias?.length){
    return new Response(JSON.stringify({ categoria_id: null }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if(!apiKey){
    return new Response(JSON.stringify({ error: 'No API key' }), { status: 500 });
  }

  const catList = categorias.map(c => `- id: "${c.id}", nombre: "${c.nombre}", tipo: "${c.tipo}"`).join('\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `Sos un asistente de finanzas personales para usuarios argentinos. 
Dada la descripción de un gasto/ingreso, elegí la categoría más apropiada de la lista.

Descripción: "${descripcion}"

Categorías disponibles:
${catList}

Respondé ÚNICAMENTE con el id de la categoría más apropiada, sin explicación, sin comillas, solo el UUID. Si no hay ninguna adecuada respondé "null".`
      }]
    })
  });

  const data = await response.json();
  const rawId = data.content?.[0]?.text?.trim();
  const categoria_id = rawId === 'null' || !rawId ? null : rawId;

  return new Response(JSON.stringify({ categoria_id }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
