const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/api/auth',            require('./routes/auth'));
app.use('/api/projects',        require('./routes/projects'));
app.use('/api/inspections',     require('./routes/inspections'));
app.use('/api/nonconformances', require('./routes/nonconformances'));
app.use('/api/rca',             require('./routes/rca'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', system: 'IMS-QHSE', version: '1.0.0' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});