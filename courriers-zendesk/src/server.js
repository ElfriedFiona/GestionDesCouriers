require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const courriers = require('./routes/courriers');
const { errorMiddleware } = require('./errors');

const app = express();
app.use(helmet());
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));
app.use('/api', courriers);
app.use('/api', (req, res) => res.status(404).json({ erreur: 'Route inconnue' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(errorMiddleware);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur sur http://localhost:${PORT}`));
