# R-Talks Backend Deployment Guide 🚀

This guide covers deploying the R-Talks backend API to various platforms including Render, Railway, and Heroku.

## 🎯 Pre-Deployment Checklist

- [ ] Environment variables configured
- [ ] Database setup completed
- [ ] Razorpay account configured
- [ ] Frontend domain known for CORS
- [ ] All sensitive data moved to environment variables

## 🌐 Render Deployment (Recommended)

### Step 1: Create Render Account
1. Go to [render.com](https://render.com) and sign up
2. Connect your GitHub repository

### Step 2: Create PostgreSQL Database
1. Go to **Dashboard** → **New** → **PostgreSQL**
2. Name: `rtalks-postgres`
3. Plan: **Starter** (free)
4. Region: Choose closest to your users
5. Click **Create Database**
6. **Copy the connection string** for later

### Step 3: Create Web Service
1. Go to **Dashboard** → **New** → **Web Service**
2. Connect your repository containing the backend
3. Configure:
   - **Name**: `rtalks-backend`
   - **Environment**: `Node`
   - **Branch**: `main` (or your main branch)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### Step 4: Environment Variables
Add these environment variables in Render dashboard:

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-make-it-long-and-random
DATABASE_URL=postgresql://user:pass@host:port/db_name
FRONTEND_URL=https://your-frontend-domain.com
ALLOWED_ORIGINS=https://your-frontend-domain.com,https://www.your-frontend-domain.com
RAZORPAY_KEY_ID=rzp_live_your_key_id_here
RAZORPAY_KEY_SECRET=your_razorpay_secret_key_here
APP_NAME="R-Talks Backend API"
```

### Step 5: Deploy and Initialize
1. Click **Create Web Service**
2. Wait for deployment to complete
3. Run database initialization:
   - Go to **Shell** tab in Render dashboard
   - Run: `npm run init-db`

### Step 6: Test Deployment
Visit: `https://your-app-name.onrender.com/api/health`

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "environment": "production",
  "database": "connected"
}
```

## 🚂 Railway Deployment

### Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub

### Step 2: Deploy from GitHub
1. Click **New Project**
2. Select **Deploy from GitHub repo**
3. Choose your backend repository
4. Railway auto-detects Node.js

### Step 3: Add PostgreSQL
1. In your project dashboard, click **New**
2. Select **Database** → **PostgreSQL**
3. Railway provides `DATABASE_URL` automatically

### Step 4: Environment Variables
Add in Railway dashboard:

```env
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key
FRONTEND_URL=https://your-frontend-domain.com
ALLOWED_ORIGINS=https://your-frontend-domain.com
RAZORPAY_KEY_ID=rzp_live_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

### Step 5: Initialize Database
1. Go to your service in Railway
2. Click **Deploy** tab
3. Once deployed, run: `npm run init-db`

## ☁️ Other Platform Deployments

### Heroku
1. Install Heroku CLI
2. Create new app: `heroku create rtalks-backend`
3. Add PostgreSQL: `heroku addons:create heroku-postgresql:mini`
4. Set environment variables: `heroku config:set JWT_SECRET=your-secret`
5. Deploy: `git push heroku main`
6. Initialize DB: `heroku run npm run init-db`

### DigitalOcean App Platform
1. Create new app from GitHub
2. Add managed PostgreSQL database
3. Configure environment variables
4. Deploy and run initialization

### AWS Elastic Beanstalk
1. Create new environment
2. Upload application zip
3. Add RDS PostgreSQL instance
4. Configure environment variables
5. Deploy and initialize

## 🔧 Post-Deployment Configuration

### 1. Custom Domain (Optional)
**Render:**
- Go to **Settings** → **Custom Domains**
- Add your domain (e.g., `api.yourdomain.com`)
- Update DNS with provided CNAME

**Railway:**
- Go to **Settings** → **Domains**
- Add custom domain
- Configure DNS records

### 2. SSL Certificate
Most platforms (Render, Railway, Heroku) provide automatic SSL certificates for custom domains.

### 3. Update Frontend Configuration
Update your frontend's API URL to point to your deployed backend:
```javascript
const API_URL = 'https://your-backend-domain.com/api';
```

### 4. Test All Endpoints
- Health check: `GET /api/health`
- Get packages: `GET /api/packages`
- Admin login: `POST /api/admin/login`
- Create order: `POST /api/orders`

## 🛡️ Security Checklist

- [ ] Strong JWT secret (at least 32 characters)
- [ ] CORS properly configured for your frontend domain
- [ ] Database credentials secured
- [ ] Razorpay keys are production keys
- [ ] No sensitive data in code repository
- [ ] HTTPS enabled for all domains
- [ ] Rate limiting enabled

## 📊 Monitoring & Logs

### Render
- **Logs**: Dashboard → Service → Logs tab
- **Metrics**: Dashboard → Service → Metrics tab
- **Health Check**: Automatic via `/api/health`

### Railway
- **Logs**: Project → Service → Logs
- **Metrics**: Project → Service → Metrics
- **Monitoring**: Built-in uptime monitoring

### Log Levels
Your backend logs these events:
- ✅ Server startup
- 📡 Database connections
- 💳 Payment processing
- ❌ Errors and exceptions
- 🔐 Authentication attempts

## 🚨 Troubleshooting

### Common Issues

**1. Database Connection Failed**
```
Error: Database connection not available
```
**Solution**: Check `DATABASE_URL` environment variable and database status

**2. CORS Errors**
```
Access-Control-Allow-Origin header
```
**Solution**: Add your frontend domain to `ALLOWED_ORIGINS`

**3. JWT Secret Missing**
```
Error: JWT_SECRET environment variable required
```
**Solution**: Set a strong JWT secret in environment variables

**4. Razorpay Integration Issues**
```
Payment configuration error
```
**Solution**: Verify `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`

**5. File Upload Issues**
```
Upload failed
```
**Solution**: Ensure uploads directory exists and has write permissions

### Health Check Failures
If `/api/health` returns errors:
1. Check server logs
2. Verify environment variables
3. Test database connection
4. Ensure all dependencies installed

### Database Issues
```bash
# Test database connection
node -e "const { Pool } = require('pg'); const pool = new Pool({connectionString: process.env.DATABASE_URL}); pool.query('SELECT NOW()', console.log);"

# Reinitialize database
npm run init-db
```

## 📈 Performance Optimization

### Database
- Connection pooling is already configured
- Indexes on commonly queried fields
- Connection timeout handling

### API
- Compression middleware enabled
- Static file caching
- Rate limiting to prevent abuse
- Efficient query patterns

### Monitoring
Set up alerts for:
- Server downtime
- Database connection issues
- High error rates
- Performance degradation

## 🔄 Updates & Maintenance

### Updating the Backend
1. Make changes to your code
2. Commit and push to GitHub
3. Deployment platforms auto-deploy on push
4. Test all endpoints after deployment

### Database Migrations
For schema changes:
1. Update `database.sql`
2. Create migration scripts
3. Run migrations on production database
4. Test thoroughly

### Environment Updates
- Rotate JWT secrets periodically
- Update Razorpay keys when needed
- Review and update CORS origins
- Monitor and update dependencies

---

## 🎉 Deployment Complete!

Your R-Talks backend is now live and ready to serve your frontend application. Make sure to:

1. ✅ Test all API endpoints
2. ✅ Verify admin panel access
3. ✅ Test payment integration
4. ✅ Monitor logs for any issues
5. ✅ Update frontend with new API URL

**Your backend is now production-ready! 🚀**