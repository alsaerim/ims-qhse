require('dotenv').config();
const express = require('express');
const path    = require('path');

const app = express();
app.set('trust proxy', 1); // Railway terminates TLS; x-forwarded-proto tells us the original scheme
app.disable('x-powered-by');

// One canonical address: www and plain http on isoradar.com go to https://isoradar.com.
// Railway's own *.up.railway.app address and localhost are left alone.
const CANONICAL_HOST = 'isoradar.com';
app.use((req, res, next) => {
  const host = (req.headers.host || '').toLowerCase().split(':')[0];
  if (host === CANONICAL_HOST || host === 'www.' + CANONICAL_HOST) {
    if (host !== CANONICAL_HOST || req.protocol !== 'https') {
      return res.redirect(301, 'https://' + CANONICAL_HOST + req.originalUrl);
    }
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.get('/admin', (req, res) => res.sendFile(__dirname + '/public/ims_admin.html'));
app.use(express.static(path.join(__dirname, 'public')));

const pages = {
  '/':                 'ims_landing.html',
  '/en':               'ims_landing_en.html',
  '/app':              'ims_qhse_9.html',
  '/dashboard':        'ims_qhse_9.html',
  '/mobile':           'ims_mobile.html',
  '/mobile-login':     'ims_mobile_login.html',
  '/advisory-council': 'ims_advisory_council.html',
};

app.get('{*path}', (req, res) => {
  const page = pages[req.path];
  if (page) return res.sendFile(path.join(__dirname, 'public', page));
  res.sendFile(path.join(__dirname, 'public', 'ims_landing.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('IMS QHSE Frontend running on port ' + PORT);
});