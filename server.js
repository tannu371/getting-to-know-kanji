const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'orders.db');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));

// Initialize SQLite DB
const db = new sqlite3.Database(DB_FILE);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    customer_email TEXT,
    amount INTEGER,
    currency TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`);
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Serve static files (your single-file HTML + /public assets)
app.use(express.static(path.join(__dirname, 'public')));

// Create a Stripe Checkout session
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { quantity = 1 } = req.body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Getting to Know Kanji — Physical + PDF bundle',
            images: [ (process.env.SITE_URL || '') + '/images/Getting to known-1.jpg' ]
          },
          unit_amount: 690, // $6.90 in cents
        },
        quantity: parseInt(quantity, 10),
      }],
      success_url: (process.env.SITE_URL || 'http://localhost:3000') + '/?success=true',
      cancel_url: (process.env.SITE_URL || 'http://localhost:3000') + '/?canceled=true',
    });
    res.json({ id: session.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Secure sample download (returns the sample PDF)
app.get('/download-sample', (req, res) => {
  const file = path.join(__dirname, 'public', 'sample', 'Vocabulary With Kanjis-sample.pdf');
  if (fs.existsSync(file)) {
    res.download(file, 'Vocabulary-With-Kanjis-sample.pdf', (err) => {
      if (err) console.error('Download error', err);
    });
  } else {
    res.status(404).send('Sample not found');
  }
});

// Contact form endpoint (sends email via SMTP)
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: 'Missing fields' });

  // Use SMTP transporter (configure via .env)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: `"Website Contact" <${process.env.SMTP_FROM}>`,
      to: process.env.CONTACT_RECEIVER,
      subject: `New contact from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Email error', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Stripe webhook to record orders in SQLite
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const sessionId = session.id;
    const email = (session.customer_details && session.customer_details.email) || null;
    const amount_total = session.amount_total || null;
    const currency = session.currency || null;

    db.run(`INSERT INTO orders (session_id, customer_email, amount, currency) VALUES (?,?,?,?)`,
      [sessionId, email, amount_total, currency], (err) => {
        if (err) console.error('DB insert error', err);
        else console.log('Order recorded:', sessionId);
      });
  }

  res.json({ received: true });
});

// Fallback: serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));