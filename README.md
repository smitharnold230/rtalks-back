# R-Talks Backend API 🚀

> Production-ready Node.js backend API for the R-Talks event ticket booking platform with PostgreSQL database, Razorpay payments, and comprehensive admin management.

## ✨ Features

- 🔒 **Secure JWT Authentication** for admin access
- 💳 **Razorpay Hosted Payment Page** integration
- 📊 **PostgreSQL Database** with connection pooling
- 🛡️ **Production Security** (Helmet, CORS, Rate Limiting)
- 📱 **RESTful API** with comprehensive endpoints
- 🎤 **Dynamic Content Management** (Speakers, Packages, Content)
- 📧 **Contact Form** submissions and management
- 🚀 **Production Optimized** with error handling and logging
- 📈 **Performance** with compression and caching
- 🔄 **Graceful Shutdown** handling

## 🛠️ Tech Stack

- **Runtime**: Node.js ≥18.0.0
- **Framework**: Express.js
- **Database**: PostgreSQL with connection pooling
- **Authentication**: JWT with secure cookies
- **Payments**: Razorpay (Hosted Payment Page)
- **Security**: Helmet.js, CORS, Rate Limiting, Input Validation
- **Performance**: Compression, Static File Caching
- **File Upload**: Multer with size limits

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18.0.0
- PostgreSQL database
- Razorpay account (optional for testing)

### Installation

1. **Clone or extract the backend repository**
   ```bash
   cd rtalks-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the server (Database auto-initialization included!)**
   ```bash
   # Development (auto-restart) - includes automatic DB initialization
   npm run dev
   
   # Production - includes automatic DB initialization
   npm start
   ```
   
   **🎉 New Feature**: Database initialization now happens automatically when you run `npm start` or `npm run dev`!

5. **Manual database initialization (Optional)**
   ```bash
   # Only needed if you want to reset the database manually
   npm run init-db
   ```

6. **Test the API**
   - **Health Check**: http://localhost:3000/api/health
   - **API Documentation**: See endpoints section below

## 📋 Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Database (use DATABASE_URL for production)
DATABASE_URL=postgresql://username:password@hostname:5432/database_name

# Server
NODE_ENV=production
PORT=3000

# Security
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Razorpay
RAZORPAY_KEY_ID=rzp_live_your_key_id
RAZORPAY_KEY_SECRET=your_secret_key

# Frontend URL (for payment callbacks)
FRONTEND_URL=https://yourdomain.com
```

## 🔌 API Endpoints

### Public Endpoints

```
GET    /api/health              # Health check
GET    /api/config              # Public configuration
GET    /api/event               # Event details
GET    /api/stats               # Event statistics
GET    /api/packages            # Active ticket packages
GET    /api/speakers            # Active speakers
GET    /api/contact-info        # Contact information
POST   /api/orders              # Create new ticket order
POST   /api/contact             # Submit contact form
POST   /api/verify-payment      # Verify Razorpay payment
GET    /api/payment-success     # Payment callback handler
POST   /api/razorpay-webhook    # Razorpay webhook
POST   /api/upload/speaker-image # Upload speaker images
```

### Admin Endpoints (JWT Protected)

```
POST   /api/admin/login         # Admin login
GET    /api/admin/check-auth    # Check authentication
POST   /api/admin/logout        # Admin logout
GET    /api/admin/stats         # Admin dashboard stats
PUT    /api/admin/event         # Update event details
GET    /api/admin/orders        # Get orders list
GET    /api/admin/content       # Get site content
PUT    /api/admin/content/:section # Update site content
GET    /api/admin/packages      # Get all packages
POST   /api/admin/packages      # Create new package
PUT    /api/admin/packages/:id  # Update package
DELETE /api/admin/packages/:id  # Delete package
GET    /api/admin/speakers      # Get all speakers
POST   /api/admin/speakers      # Create new speaker
PUT    /api/admin/speakers/:id  # Update speaker
DELETE /api/admin/speakers/:id  # Delete speaker
GET    /api/admin/contact-forms # Get contact submissions
GET    /api/admin/contact-forms/export # Export contact forms
DELETE /api/admin/contact-forms/:id # Delete contact form
GET    /api/admin/contact-info  # Get contact information
PUT    /api/admin/contact-info  # Update contact information
```

## 💳 Payment Integration

This backend uses **Razorpay's Hosted Payment Page** for secure payments:

### Payment Flow
1. Frontend submits order via `POST /api/orders`
2. Backend creates Razorpay Payment Link
3. Customer redirected to Razorpay's secure payment page
4. Payment callback updates order status
5. Customer redirected back to frontend with status

### Benefits
- ✅ **PCI Compliant** - Razorpay handles all payment data
- ✅ **Mobile Optimized** - Works perfectly on all devices
- ✅ **Secure** - No sensitive payment data on your servers
- ✅ **Simple Integration** - Minimal frontend code required

## 🛡️ Security Features

- **Helmet.js**: Security headers and protection
- **CORS**: Configurable cross-origin resource sharing
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: Express-validator for all inputs
- **JWT Authentication**: Secure admin authentication
- **SQL Injection Protection**: Parameterized queries
- **File Upload Security**: Type and size validation
- **Environment-based Configuration**: Separate dev/prod settings

## 📊 Database Schema

The backend includes these main tables:
- `events` - Main event information
- `orders` - Customer ticket orders
- `event_packages` - Ticket packages/tiers
- `speakers` - Speaker profiles
- `contact_forms` - Contact form submissions
- `admins` - Admin user accounts
- `site_content` - Dynamic website content
- `contact_info` - Business contact information
- `stats` - Event statistics

## 🎯 Available Scripts

```bash
# Development with auto-restart
npm run dev

# Production
npm start

# Initialize/Reset Database
npm run init-db

# Install Dependencies
npm install
```

## 📁 Project Structure

```
rtalks-backend/
├── routes/                # API route handlers
│   └── admin.js          # Admin routes
├── uploads/              # File upload directory
├── server.js             # Main server file
├── initDb.js             # Database initialization
├── database.sql          # Database schema
├── package.json          # Dependencies and scripts
├── .env.example          # Environment template
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

## 🚀 Deployment

### Render Deployment

1. **Create New Web Service**
   - Connect your repository
   - Set build command: `npm install`
   - Set start command: `npm start`

2. **Environment Variables**
   ```
   NODE_ENV=production
   DATABASE_URL=postgresql://user:pass@host:5432/db
   JWT_SECRET=your-long-random-secret
   RAZORPAY_KEY_ID=rzp_live_xxxxx
   RAZORPAY_KEY_SECRET=your_secret
   FRONTEND_URL=https://your-frontend-domain.com
   ALLOWED_ORIGINS=https://your-frontend-domain.com
   ```

3. **Database Setup**
   - Create PostgreSQL database on Render
   - Run database initialization: `npm run init-db`

### Railway Deployment

1. **Create New Project**
   - Import from GitHub
   - Railway auto-detects Node.js

2. **Add PostgreSQL Database**
   - Add PostgreSQL service
   - Use provided DATABASE_URL

3. **Set Environment Variables**
   ```
   NODE_ENV=production
   JWT_SECRET=your-secret-key
   RAZORPAY_KEY_ID=rzp_live_xxxxx
   RAZORPAY_KEY_SECRET=your_secret
   FRONTEND_URL=https://your-frontend.vercel.app
   ```

## 🔧 Configuration

### CORS Configuration
Update `ALLOWED_ORIGINS` in your environment variables:
```env
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,https://your-app.vercel.app
```

### Database Connection
The backend supports multiple database connection methods:
1. `DATABASE_URL` (recommended for production)
2. `DB_URL` (legacy support)
3. Individual variables (`DB_USER`, `DB_PASSWORD`, etc.)

### File Uploads
- Maximum file size: 5MB
- Allowed types: Images only
- Storage: Local filesystem (`/uploads/`)
- Endpoint: `POST /api/upload/speaker-image`

## 🔍 Monitoring

### Health Check
```bash
curl https://your-api-domain.com/api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-03-15T10:30:00.000Z",
  "environment": "production",
  "database": "connected",
  "service": "rtalks-backend",
  "version": "1.0.0"
}
```

### Logging
- Server startup information
- Database connection status
- Payment processing logs
- Error tracking with stack traces (development)
- Graceful shutdown logging

## 🛠️ Development

### Database Management
```bash
# Reset database with fresh data
npm run init-db

# Manual database connection test
node -e "const pool = require('./server'); pool.query('SELECT NOW()', console.log);"
```

### Testing Payments
- Set `RAZORPAY_KEY_ID=your_key_id` to enable live payments
- Leave empty or use dummy values for test mode
- Test mode simulates successful payments

### Admin Access
- Default admin: `admin@rtalks.com` / `admin123`
- Change credentials in production via database or environment variables

## 📞 Support

For issues or questions:
- Check the health endpoint: `/api/health`
- Review server logs for error details
- Verify environment variables are set correctly
- Ensure database connection is working
- Check CORS configuration for frontend integration

## 📄 License

MIT License - feel free to use this backend for your own projects.

---

**Built with ❤️ for the R-Talks community**