const SUPABASE_URL = 'https://ejpfafkbqakcydoemfce.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcGZhZmticWFrY3lkb2VtZmNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNDk3MTQsImV4cCI6MjA5MzcyNTcxNH0.FOQWBUCZu90j4nQPN5OeExdbdRwuP4iimckv5Bf1yaQ';

const TIPO_LABEL = {
  'loja-habitacao':    'Converter loja/garagem em habitação',
  'obras-sem-licenca': 'Regularizar obras sem licença',
  'obra-parada':       'Obra parada ou recusada pela Câmara',
  'ampliacao':         'Ampliação ou remodelação com licença',
  'licenca-utilizacao':'Obter licença de utilização',
  'outro':             'Outro caso',
};

const TO = [
  'brunocamara@brunocamaraarquitectos.com',
  'joaocamara@brunocamaraarquitectos.com',
  'joaomilheiro@brunocamaraarquitectos.com',
  'mab-cm@mabimagination.com',
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://projetos.brunocamaraarquitectos.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, phone, email, project_type } = req.body || {};

  if (!name || !phone || !project_type) {
    return res.status(400).json({ error: 'Campos obrigatórios em falta' });
  }

  // 1. Gravar no Supabase
  const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ name, phone, email: email || null, project_type, message: null }),
  });

  if (!sbRes.ok) {
    const detail = await sbRes.text();
    console.error('Supabase error:', detail);
    return res.status(502).json({ error: 'Erro ao guardar pedido' });
  }

  // 2. Enviar email via Resend
  const tipo = TIPO_LABEL[project_type] || project_type;
  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'leads@projetos.brunocamaraarquitectos.com',
      to: TO,
      subject: `Novo pedido — ${name} — ${tipo}`,
      html: `
        <table style="font-family:sans-serif;font-size:15px;color:#111;max-width:560px;border-collapse:collapse">
          <tr><td style="padding:24px 0 8px;font-size:18px;font-weight:600">Novo pedido de avaliação</td></tr>
          <tr><td style="border-top:1px solid #e5e5e5;padding:16px 0 0"></td></tr>
          <tr><td style="padding:4px 0"><strong>Nome</strong></td></tr>
          <tr><td style="padding:0 0 12px;color:#444">${name}</td></tr>
          <tr><td style="padding:4px 0"><strong>Telefone</strong></td></tr>
          <tr><td style="padding:0 0 12px;color:#444">${phone}</td></tr>
          ${email ? `<tr><td style="padding:4px 0"><strong>Email</strong></td></tr><tr><td style="padding:0 0 12px;color:#444">${email}</td></tr>` : ''}
          <tr><td style="padding:4px 0"><strong>Tipo de situação</strong></td></tr>
          <tr><td style="padding:0 0 24px;color:#444">${tipo}</td></tr>
          <tr><td style="border-top:1px solid #e5e5e5;padding:16px 0 0;font-size:13px;color:#888">projetos.brunocamaraarquitectos.com</td></tr>
        </table>`,
    }),
  });

  if (!emailRes.ok) {
    console.error('Resend error:', await emailRes.text());
    // Não falhar — o lead já foi gravado
  }

  return res.status(200).json({ ok: true });
}
