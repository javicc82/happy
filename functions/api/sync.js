export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'GET') {
    try {
      if (!env.HAPPY_KV) return new Response(JSON.stringify({ error: "KV binding not found. Check wrangler config." }), { status: 500 });
      
      const data = await env.HAPPY_KV.get("family_state", "json");
      
      if (data) {
        return new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({}), { headers: { 'Content-Type': 'application/json' }});
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  if (request.method === 'POST') {
    try {
      if (!env.HAPPY_KV) return new Response(JSON.stringify({ error: "KV binding not found." }), { status: 500 });

      const payload = await request.text();
      // Guardar el JSON puro tal cual en KV para máxima velocidad de lectura/escritura
      await env.HAPPY_KV.put("family_state", payload);
      
      return new Response(JSON.stringify({ success: true }));
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  return new Response('Method Not Allowed', { status: 405 });
}
