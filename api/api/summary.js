export const config = { runtime: 'edge' };

export default async function handler(req) {
  if(req.method !== 'POST'){
    return new Response('Method not allowed', { status: 405 });
  }

  const { transacciones, mes, anio, nombre, categorias } = await req.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if(!apiKey){
    return new Response(JSON.stringify({ error: 'No API key' }), { status: 500 });
  }

  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  const mesNombre = MONTHS[mes];

  // Build summary data
  const ingresos = transacciones.filter(t => t.tipo === 'income');
  const egresos = transacciones.filter(t => t.tipo === 'expense');
  const totalInc = ingresos.reduce((s,t) => s + t.monto_ars, 0);
  const totalExp = egresos.reduce((s,t) => s + t.monto_ars, 0);
  const balance = totalInc - totalExp;

  // Group expenses by category
  const byCat = {};
  egresos.forEach(t => {
    const cat = categorias.find(c => c.id === t.categoria_id);
    const nombre = cat?.nombre || 'Otro';
    byCat[nombre] = (byCat[nombre] || 0) + t.monto_ars;
  });
  const topCats = Object.entries(byCat)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 3)
    .map(([n, v]) => `${n}: $${Math.round(v).toLocaleString('es-AR')}`)
    .join(', ');

  const fmt = n => '$' + Math.round(n).toLocaleString('es-AR');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Sos un asistente financiero amigable para una app argentina llamada Wally.
Escribí un resumen breve y personal del mes financiero de ${nombre} en ${mesNombre} ${anio}.

Datos:
- Ingresos totales: ${fmt(totalInc)}
- Egresos totales: ${fmt(totalExp)}
- Balance: ${fmt(balance)} (${balance >= 0 ? 'superávit' : 'déficit'})
- Principales gastos: ${topCats || 'sin datos'}
- Cantidad de movimientos: ${transacciones.length}

Escribí 2-3 oraciones en español argentino (tuteo, vos). Tono amigable y directo, como un amigo que te ayuda con las finanzas. Incluí un emoji al inicio. No uses términos técnicos. No empieces con "En ${mesNombre}". Sé específico con los números.`
      }]
    })
  });

  const data = await response.json();
  const resumen = data.content?.[0]?.text?.trim() || '';

  return new Response(JSON.stringify({ resumen }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
