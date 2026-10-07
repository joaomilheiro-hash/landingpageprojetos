const https = require('https');

const SUPABASE_URL = 'ejpfafkbqakcydoemfce.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcGZhZmticWFrY3lkb2VtZmNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNDk3MTQsImV4cCI6MjA5MzcyNTcxNH0.FOQWBUCZu90j4nQPN5OeExdbdRwuP4iimckv5Bf1yaQ';

const TIPO_LABEL = {
  'loja-habitacao':     'Converter loja/garagem em habitação',
  'obras-sem-licenca':  'Regularizar obras sem licença',
  'obra-parada':        'Obra parada ou recusada pela Câmara',
  'ampliacao':          'Ampliação ou remodelação com licença',
  'licenca-utilizacao': 'Obter licença de utilização',
  'outro':              'Outro caso',
};

const TO = [
  'brunocamara@brunocamaraarquitectos.com',
  'joaocamara@brunocamaraarquitectos.com',
  'joaomilheiro@brunocamaraarquitectos.com',
  'mab-cm@mabimagination.com',
];

function post(hostname, path, headers, data) {
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify(data);
    var opts = {
      hostname: hostname,
      path: path,
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, headers),
    };
    var req = https.request(opts, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() { resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }); });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://projetos.brunocamaraarquitectos.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var b = req.body || {};
  var name = (b.name || '').trim();
  var phone = (b.phone || '').trim();
  var email = (b.email || '').trim() || null;
  var project_type = b.project_type || '';

  if (!name || !phone || !project_type) {
    return res.status(400).json({ error: 'Campos obrigatórios em falta' });
  }

  // 1. Gravar no Supabase
  var sbRes = await post(
    SUPABASE_URL,
    '/rest/v1/leads',
    { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Prefer': 'return=minimal' },
    { name: name, phone: phone, email: email, project_type: project_type, message: null }
  );

  if (sbRes.status < 200 || sbRes.status >= 300) {
    console.error('Supabase error ' + sbRes.status + ':', sbRes.body);
    return res.status(502).json({ error: 'Erro ao guardar pedido' });
  }

  // 2. Enviar email via Resend
  var tipo = TIPO_LABEL[project_type] || project_type;
  var html = [
    '<table style="font-family:sans-serif;font-size:15px;color:#111;max-width:560px">',
    '<tr><td style="padding:24px 0 8px;font-size:18px;font-weight:600">Novo pedido de avaliação</td></tr>',
    '<tr><td style="border-top:1px solid #e5e5e5;padding:16px 0 0"></td></tr>',
    '<tr><td style="padding:4px 0"><strong>Nome</strong></td></tr>',
    '<tr><td style="padding:0 0 12px;color:#444">' + name + '</td></tr>',
    '<tr><td style="padding:4px 0"><strong>Telefone</strong></td></tr>',
    '<tr><td style="padding:0 0 12px;color:#444">' + phone + '</td></tr>',
    email ? '<tr><td style="padding:4px 0"><strong>Email</strong></td></tr><tr><td style="padding:0 0 12px;color:#444">' + email + '</td></tr>' : '',
    '<tr><td style="padding:4px 0"><strong>Tipo de situação</strong></td></tr>',
    '<tr><td style="padding:0 0 24px;color:#444">' + tipo + '</td></tr>',
    '<tr><td style="border-top:1px solid #e5e5e5;padding:16px 0 0;font-size:13px;color:#888">projetos.brunocamaraarquitectos.com</td></tr>',
    '</table>',
  ].join('');

  if (process.env.RESEND_API_KEY) {
    var emailRes = await post(
      'api.resend.com',
      '/emails',
      { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
      { from: 'leads@projetos.brunocamaraarquitectos.com', to: TO, subject: 'Novo pedido — ' + name + ' — ' + tipo, html: html }
    );
    if (emailRes.status < 200 || emailRes.status >= 300) {
      console.error('Resend error ' + emailRes.status + ':', emailRes.body);
    }
  } else {
    console.error('RESEND_API_KEY não configurada');
  }

  return res.status(200).json({ ok: true });
};
