import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CLIENT_ID = Deno.env.get('LW_CLIENT_ID')!;
const CLIENT_SECRET = Deno.env.get('LW_CLIENT_SECRET')!;
const SERVICE_ACCOUNT = Deno.env.get('LW_SERVICE_ACCOUNT')!;
const BOT_ID = Deno.env.get('LW_BOT_ID')!;
const CHANNEL_ID = Deno.env.get('LW_CHANNEL_ID')!;
const PRIVATE_KEY_PEM = Deno.env.get('LW_PRIVATE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function createJWT(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { iss: CLIENT_ID, sub: SERVICE_ACCOUNT, iat: now, exp: now + 3600 };

  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(PRIVATE_KEY_PEM),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(signingInput));
  return `${signingInput}.${base64url(sig)}`;
}

async function getAccessToken(): Promise<string> {
  const jwtToken = await createJWT();
  const body = new URLSearchParams({
    assertion: jwtToken,
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'bot',
  });
  const res = await fetch('https://auth.worksmobile.com/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`トークン取得失敗: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function sendMessage(bodyData: any) {
  const token = await getAccessToken();

  const { requester, recipient, recipientLineworksId, content, type, requesterLineworksId, customMessage } = bodyData;

  let textMessage = '';
  let mentionTag = '';

  if (type === 'complete') {
      textMessage = `✅ ${recipient} さんが依頼を完了しました！\n\n「${customMessage}」\n\n元の依頼内容：${content}`;
      if (requesterLineworksId && requesterLineworksId.trim() !== '') {
          mentionTag = `<m userNo="${requesterLineworksId.trim()}">${requester}</m>\n`;
      }
  } else {
      textMessage = `📋 新しい依頼が届きました\n\n依頼者：${requester}\n受託者：${recipient}\n内容：${content}`;
      if (recipientLineworksId && recipientLineworksId.trim() !== '') {
          mentionTag = `<m userNo="${recipientLineworksId.trim()}">${recipient}</m>\n`;
      }
  }

  const message = {
    content: {
      type: 'text',
      text: mentionTag + textMessage,
    },
  };

  const res = await fetch(
    `https://www.worksapis.com/v1.0/bots/${BOT_ID}/channels/${CHANNEL_ID}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    },
  );
  console.log('LINE WORKS送信結果:', res.status);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const bodyData = await req.json();
    await sendMessage(bodyData);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('エラー:', err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
