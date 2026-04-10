require('dotenv').config();
const express = require('express');
const path    = require('path');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

const pages = {
  '/':              'ims_landing.html',
  '/app':           'ims_qhse_9.html',
  '/dashboard':     'ims_qhse_9.html',
  '/mobile':        'ims_mobile.html',
  '/mobile-login':  'ims_mobile_login.html',
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