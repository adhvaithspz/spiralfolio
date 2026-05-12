export default {
  async fetch(request, env, ctx) {

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const event = body.event;
    console.log('Event received: ' + event);

    // ── Zoom validation ────────────────────────────────────────
    if (event === 'endpoint.url_validation') {
      const plainToken  = body.payload.plainToken;
      const secretToken = env.ZOOM_WEBHOOK_SECRET_TOKEN;

      const encoder   = new TextEncoder();
      const cryptoKey = await crypto.subtle.importKey(
        'raw', encoder.encode(secretToken),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const signature      = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(plainToken));
      const encryptedToken = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      console.log('Validation challenge handled successfully');

      return new Response(JSON.stringify({ plainToken, encryptedToken }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ── Forward to Apps Script ─────────────────────────────────
    const appsScriptUrl = env.APPS_SCRIPT_URL;
    console.log('Forwarding to Apps Script: ' + appsScriptUrl);
    console.log('Event type: ' + event);

    if (!appsScriptUrl) {
      console.error('APPS_SCRIPT_URL is not set!');
      return new Response(JSON.stringify({ status: 'error', reason: 'no apps script url' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const bodyString = JSON.stringify(body);

    ctx.waitUntil(
      fetch(appsScriptUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    bodyString,
        redirect: 'follow'
      })
      .then(res => {
        console.log('Apps Script responded with status: ' + res.status);
        return res.text().then(text => {
          console.log('Apps Script response body: ' + text.substring(0, 200));
        });
      })
      .catch(err => {
        console.error('Forward to Apps Script FAILED: ' + err.message);
      })
    );

    return new Response(JSON.stringify({ status: 'queued', event: event }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};