const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const Razorpay = require('razorpay');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const adminRoutes = require('./routes/admin');
const initializeDatabase = require('./initDb');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all requests
app.use(limiter);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" }
}));

// Compression middleware
app.use(compression());

// CORS configuration for separated frontend/backend architecture
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [
      // ✅ Add your custom domain
      'https://www.rtalks.in',
      'https://www.rtalks.in/admin',
      // Vercel deployments
      'https://rtalks-frontend.vercel.app',
      'https://rtalks-frontend-git-main-smitharnold230.vercel.app',
      'https://rtalks-frontend-smitharnold230.vercel.app',
      // Development URLs
      'http://localhost:3000',
      'http://localhost:5000',
      'http://127.0.0.1:3000'
    ]
  : ['http://localhost:3000', 'http://localhost:5000', 'http://127.0.0.1:3000'];

const corsOptions = {
  origin: allowedOrigins, // Allow specified origins
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie', 'Authorization'],
  preflightContinue: false,
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'speaker-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir, {
  maxAge: process.env.NODE_ENV === 'production' ? '1y' : 0
}));

// Admin routes
app.use('/api/admin', adminRoutes);

// PostgreSQL connection with enhanced configuration
let pool;
try {
  // Priority: DATABASE_URL (Render/Railway) > DB_URL (legacy) > individual variables
  let connectionConfig;
  
  if (process.env.DATABASE_URL) {
    connectionConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
    console.log('Using DATABASE_URL for database connection');
  } else if (process.env.DB_URL) {
    connectionConfig = {
      connectionString: process.env.DB_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
    console.log('Using DB_URL for database connection');
  } else {
    connectionConfig = {
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'rtalks_db',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
    console.log('Using individual database variables for connection');
  }
  
  // Add connection pool configuration for production
  const poolConfig = {
    ...connectionConfig,
    max: 20, // Maximum number of clients
    idleTimeoutMillis: 30000, // How long a client can be idle before closing
    connectionTimeoutMillis: 2000, // How long to wait for a connection
  };
  
  pool = new Pool(poolConfig);
  
  // Test the connection
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('Database connection error:', err.message);
      console.log('Server will continue without database functionality');
    } else {
      console.log('Database connected successfully at:', res.rows[0].now);
    }
  });
  
  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client:', err);
  });
  
} catch (error) {
  console.error('Failed to initialize database pool:', error.message);
  console.log('Server will continue without database functionality');
  pool = null;
}

// Initialize Razorpay
let razorpay = null;
try {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && 
      process.env.RAZORPAY_KEY_ID !== 'your_key_id' && 
      process.env.RAZORPAY_KEY_SECRET !== 'your_key_secret') {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    console.log('Razorpay initialized successfully');
  } else {
    console.warn('Razorpay not configured - using test mode');
  }
} catch (error) {
  console.error('Failed to initialize Razorpay:', error.message);
}

// Helper function to check if database is connected
const checkDbConnection = (req, res, next) => {
  if (!pool) {
    return res.status(503).json({ 
      error: 'Database connection not available',
      message: 'The service is temporarily unavailable. Please try again later.',
      code: 'DB_CONNECTION_ERROR'
    });
  }
  next();
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: pool ? 'connected' : 'disconnected',
    service: 'rtalks-backend',
    version: '1.0.0'
  });
});

// Get Razorpay public key and configuration
app.get('/api/config', (req, res) => {
  res.json({
    razorpayKeyId: process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'your_key_id' 
      ? process.env.RAZORPAY_KEY_ID 
      : 'rzp_test_demo_key',
    testMode: !razorpay || process.env.RAZORPAY_KEY_ID === 'your_key_id',
    useHostedPage: true // Indicate we're using hosted payment page
  });
});

// Get event details
app.get('/api/event', checkDbConnection, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM events ORDER BY date DESC LIMIT 1');
    
    if (result.rows.length === 0) {
      return res.json({
        title: 'R-Talks Summit 2025',
        description: 'Event details will be updated soon',
        date: new Date('2025-03-15').toISOString().split('T')[0],
        time: '09:00:00',
        location: 'Virtual Event',
        price: 0
      });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Event fetch error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch event details',
      message: 'Unable to load event information. Please try again later.',
      code: 'EVENT_FETCH_ERROR'
    });
  }
});

// Get event stats
app.get('/api/stats', checkDbConnection, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stats');
    
    if (result.rows.length === 0) {
      // Return default stats if none exist
      return res.json({
        attendees: 500,
        partners: 20,
        speakers: 50
      });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Stats fetch error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch statistics',
      message: 'Unable to load event statistics. Default values may be displayed.',
      code: 'STATS_FETCH_ERROR'
    });
  }
});

// Get site content
app.get('/api/content/:section?', checkDbConnection, async (req, res) => {
  try {
    let query = 'SELECT * FROM site_content';
    let params = [];
    
    if (req.params.section) {
      query += ' WHERE section = $1';
      params.push(req.params.section);
    }
    
    query += ' ORDER BY section';
    
    const result = await pool.query(query, params);
    
    if (req.params.section) {
      res.json(result.rows[0] || null);
    } else {
      res.json(result.rows);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get active packages for public display
app.get('/api/packages', checkDbConnection, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM event_packages WHERE is_active = true ORDER BY display_order, id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get active speakers for public display
app.get('/api/speakers', checkDbConnection, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM speakers WHERE is_active = true ORDER BY display_order, id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get contact information for public display
app.get('/api/contact-info', checkDbConnection, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contact_info WHERE section = $1', ['main']);
    
    if (result.rows.length === 0) {
      // Return default structure if no data exists
      return res.json({
        phone_numbers: [],
        email: '',
        location: {}
      });
    }
    
    const contactInfo = result.rows[0];
    res.json({
      phone_numbers: Array.isArray(contactInfo.phone_numbers) ? contactInfo.phone_numbers : JSON.parse(contactInfo.phone_numbers || '[]'),
      email: contactInfo.email || '',
      location: typeof contactInfo.location === 'object' ? contactInfo.location : JSON.parse(contactInfo.location || '{}')
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload speaker image endpoint
app.post('/api/upload/speaker-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ 
      success: true, 
      imageUrl: imageUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Validation middleware for order creation
const validateOrder = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email format'),
  body('phone').matches(/^[\+]?[1-9][\d]{0,15}$/).withMessage('Invalid phone number format'),
  body('package').isIn(['Professional', 'Executive', 'Leadership']).withMessage('Invalid package selection'),
  body('price').isFloat({ min: 0.01 }).withMessage('Invalid price')
];

// Create order
app.post('/api/orders', checkDbConnection, validateOrder, async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Please check your input data',
      code: 'VALIDATION_ERROR',
      details: errors.array()
    });
  }

  const { name, email, phone, package: ticketPackage, price } = req.body;
  
  let client;
  try {
    client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create order in database
      const orderResult = await client.query(
        'INSERT INTO orders (customer_name, customer_email, customer_phone, package_name, amount, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [name, email, phone, ticketPackage, price, 'pending']
      );

      let paymentLink = null;
      let razorpayOrderId = null;
      
      // Create Razorpay payment link for hosted page
      if (razorpay) {
        try {
          const paymentLinkData = {
            amount: price * 100, // Convert to paise
            currency: 'INR',
            accept_partial: false,
            description: `R-Talks ${ticketPackage} Ticket`,
            customer: {
              name: name,
              email: email,
              contact: phone
            },
            notify: {
              sms: true,
              email: true
            },
            reminder_enable: true,
            notes: {
              order_id: orderResult.rows[0].id,
              package: ticketPackage
            },
            callback_url: `${process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000'}/payment-success?order_id=${orderResult.rows[0].id}`,
            callback_method: 'get'
          };
          
          const paymentLinkResponse = await razorpay.paymentLink.create(paymentLinkData);
          paymentLink = paymentLinkResponse.short_url;
          razorpayOrderId = paymentLinkResponse.id;
          
          // Update order with payment link ID
          await client.query(
            'UPDATE orders SET payment_id = $1 WHERE id = $2',
            [razorpayOrderId, orderResult.rows[0].id]
          );
        } catch (razorpayError) {
          console.error('Razorpay payment link creation failed:', razorpayError);
          // Continue without Razorpay for testing
        }
      }

      await client.query('COMMIT');
      
      res.json({
        orderId: orderResult.rows[0].id,
        paymentLink: paymentLink,
        razorpayOrderId: razorpayOrderId,
        amount: price,
        testMode: !razorpay,
        useHostedPage: true
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('Order creation error:', err);
    
    // Handle specific database errors
    if (err.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        error: 'Duplicate order',
        message: 'An order with these details already exists',
        code: 'DUPLICATE_ORDER_ERROR'
      });
    }
    
    res.status(500).json({ 
      error: 'Unable to process your request. Please try again.',
      message: 'Order creation failed. Please check your details and try again.',
      code: 'ORDER_CREATION_ERROR',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    if (client) client.release();
  }
});

// Verify payment
app.post('/api/verify-payment', checkDbConnection, async (req, res) => {
  const { orderId, paymentId, signature } = req.body;
  
  try {
    // Verify payment signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (expectedSignature === signature) {
      await pool.query(
        'UPDATE orders SET status = $1, payment_id = $2 WHERE id = $3',
        ['completed', paymentId, orderId]
      );
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Invalid signature' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Contact form validation
const validateContact = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email format'),
  body('phone').matches(/^[\+]?[1-9][\d]{0,15}$/).withMessage('Invalid phone number format'),
  body('message').trim().isLength({ min: 10, max: 1000 }).withMessage('Message must be between 10 and 1000 characters')
];

// Contact form submission endpoint
app.post('/api/contact', checkDbConnection, validateContact, async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Please check your input data',
      code: 'VALIDATION_ERROR',
      details: errors.array()
    });
  }

  try {
    const { name, phone, email, message } = req.body;
    
    // Insert contact form data
    const query = `
      INSERT INTO contact_forms (name, phone, email, message)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    
    const result = await pool.query(query, [name, phone, email, message]);
    
    res.json({ 
      success: true, 
      message: 'Contact form submitted successfully',
      id: result.rows[0].id
    });
  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({ error: 'Failed to submit contact form' });
  }
});

// Payment success callback from Razorpay hosted page
app.get('/api/payment-success', async (req, res) => {
  const { order_id, razorpay_payment_id, razorpay_payment_link_id, razorpay_payment_link_reference_id, razorpay_payment_link_status, razorpay_signature } = req.query;
  
  const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
  
  try {
    if (razorpay_payment_link_status === 'paid' && order_id) {
      // Update order status to completed
      await pool.query(
        'UPDATE orders SET status = $1, payment_id = $2 WHERE id = $3',
        ['completed', razorpay_payment_id || razorpay_payment_link_id, order_id]
      );
      
      // Redirect to frontend success page
      res.redirect(`${frontendUrl}/?payment=success&order=${order_id}`);
    } else {
      // Payment failed or cancelled
      res.redirect(`${frontendUrl}/?payment=failed&order=${order_id}`);
    }
  } catch (error) {
    console.error('Payment callback error:', error);
    res.redirect(`${frontendUrl}/?payment=error&order=${order_id}`);
  }
});

// Razorpay webhook for payment notifications
app.post('/api/razorpay-webhook', async (req, res) => {
  try {
    const { event, payload } = req.body;
    
    if (event === 'payment_link.paid') {
      const { payment_link, payment } = payload;
      const orderId = payment_link.notes?.order_id;
      
      if (orderId) {
        await pool.query(
          'UPDATE orders SET status = $1, payment_id = $2 WHERE id = $3',
          ['completed', payment.id, orderId]
        );
      }
    }
    
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Your origin is not allowed to access this resource',
      code: 'CORS_ERROR'
    });
  }
  
  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large',
      message: 'Please upload a file smaller than 5MB',
      code: 'FILE_SIZE_ERROR'
    });
  }
  
  // Database errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return res.status(503).json({
      error: 'Service temporarily unavailable',
      message: 'Database connection failed. Please try again later.',
      code: 'DB_CONNECTION_ERROR'
    });
  }
  
  // JSON parsing errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'Please check your request format',
      code: 'JSON_PARSE_ERROR'
    });
  }
  
  // Default error response
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    message: 'Something went wrong. Please try again later.',
    code: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler for API routes (must be after all route definitions)
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    message: `The endpoint ${req.path} does not exist`,
    code: 'ENDPOINT_NOT_FOUND'
  });
});

// Add this after your CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cookie');
    res.header('Access-Control-Expose-Headers', 'Set-Cookie');
    next();
});

// Start server with database initialization
async function startServer() {
  try {
    // Initialize database first
    console.log('🔧 Initializing database...');
    await initializeDatabase();
    console.log('✅ Database initialization completed');
    
    // Start the server
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 R-Talks Backend Server running on port ${port}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Health check: http://localhost:${port}/api/health`);
      console.log(`💾 Database: ${pool ? '✅ Connected & Initialized' : '❌ Disconnected'}`);
      console.log(`💳 Razorpay: ${razorpay ? '✅ Configured' : '⚠️ Test Mode'}`);
    });
    
    return server;
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.log('⚠️ Starting server without database initialization...');
    
    // Start server anyway (for development/testing)
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 R-Talks Backend Server running on port ${port}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Health check: http://localhost:${port}/api/health`);
      console.log(`💾 Database: ${pool ? '⚠️ Connected (Init Failed)' : '❌ Disconnected'}`);
      console.log(`💳 Razorpay: ${razorpay ? '✅ Configured' : '⚠️ Test Mode'}`);
    });
    
    return server;
  }
}

// Start the server
startServer().then(server => {
  // Store server reference for graceful shutdown
  global.server = server;

}).catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown(signal) {
  console.log(`\n📥 Received ${signal}. Starting graceful shutdown...`);
  
  const server = global.server;
  if (server) {
    server.close(() => {
      console.log('🔄 HTTP server closed.');
      
      if (pool) {
        pool.end(() => {
          console.log('🗄️ Database pool closed.');
          console.log('✅ Graceful shutdown completed.');
          process.exit(0);
        });
      } else {
        console.log('✅ Graceful shutdown completed.');
        process.exit(0);
      }
    });

    // Force close after 30 seconds
    setTimeout(() => {
      console.error('⚠️ Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  } else {
    console.log('✅ Server not running, exiting...');
    process.exit(0);
  }
}

module.exports = app;
