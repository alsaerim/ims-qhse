const express = require('express');
const path    = require('path');
const fs      = require('fs');
const app     = express();
const PORT    = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static files from /public ──────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Helper: send HTML file ──────────────────
function sendPage(res, filename) {
  const filePath = path.join(__dirname, 'public', filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    console.error(`❌ File not found: ${filename}`);
    res.status(404).send(`
      <html dir="rtl"><body style="font-family:sans-serif;padding:40px;text-align:center;">
        <h2>⚠️ الملف غير موجود</h2>
        <p style="color:#64748b;">الملف <strong>${filename}</strong> غير موجود في مجلد public/</p>
        <a href="/" style="color:#1e40af;">← العودة للرئيسية</a>
      </body></html>
    `);
  }
}

// ── Page Routes ─────────────────────────────
app.get('/',             (req, res) => sendPage(res, 'ims_landing.html'));
app.get('/dashboard',    (req, res) => sendPage(res, 'ims_qhse_9.html'));
app.get('/mobile',       (req, res) => sendPage(res, 'ims_mobile.html'));
app.get('/mobile-login', (req, res) => sendPage(res, 'ims_mobile_login.html'));
app.get('/advisory',     (req, res) => sendPage(res, 'advisory_council.html'));

// Legacy redirects (in case old links exist)
app.get('/ims_landing.html',          (req, res) => res.redirect('/'));
app.get('/ims_qhse_integrated.html',  (req, res) => res.redirect('/dashboard'));
app.get('/ims_qhse_9.html',           (req, res) => res.redirect('/dashboard'));
app.get('/ims_mobile.html',           (req, res) => res.redirect('/mobile'));
app.get('/ims_mobile_login.html',     (req, res) => res.redirect('/mobile-login'));
app.get('/advisory_council.html',     (req, res) => res.redirect('/advisory'));

// ── Auth API ────────────────────────────────
const DEMO_USERS = {
  'admin@ims-qhse.com':     { id:'usr-admin', role:'admin',    full_name:'مدير النظام',   token:'demo-token' },
  'manager@ims-qhse.com':   { id:'usr-mgr',   role:'manager',  full_name:'أحمد العمري',   token:'demo-token' },
  'engineer@ims-qhse.com':  { id:'usr-eng',   role:'engineer', full_name:'محمد الزهراني', token:'demo-token' },
  'auditor@ims-qhse.com':   { id:'usr-aud',   role:'auditor',  full_name:'سارة القحطاني', token:'demo-token' },
  'engineer2@ims-qhse.com': { id:'usr-eng2',  role:'engineer', full_name:'فهد الدوسري',   token:'demo-token' },
};

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = DEMO_USERS[email?.toLowerCase()];
  if (!user) return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة' });
  res.json({ success: true, user, token: 'demo-token' });
});

app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== 'demo-token') return res.status(401).json({ error: 'غير مصرح' });
  res.json({ id:'usr-admin', role:'admin', full_name:'مدير النظام', email:'admin@ims-qhse.com' });
});

app.post('/api/auth/logout', (req, res) => res.json({ success: true }));

// ── Health Check ────────────────────────────
app.get('/health', (req, res) => {
  const publicDir = path.join(__dirname, 'public');
  const files = fs.existsSync(publicDir) ? fs.readdirSync(publicDir) : [];
  res.json({
    status: 'ok',
    port: PORT,
    time: new Date().toISOString(),
    public_files: files,
  });
});

// ── 404 Catch-all ───────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  // For any unknown HTML route → go to landing
  sendPage(res, 'ims_landing.html');
});

// ── Start Server ────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ IMS QHSE server started`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`📁 Serving from: ${path.join(__dirname, 'public')}`);

  // List available files
  const publicDir = path.join(__dirname, 'public');
  if (fs.existsSync(publicDir)) {
    const files = fs.readdirSync(publicDir);
    console.log(`📄 Files in public/: ${files.join(', ')}`);
  } else {
    console.warn(`⚠️  public/ folder not found!`);
  }
});