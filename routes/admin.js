const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

let pool;
try {
    // Priority: DATABASE_URL (Render/Railway) > DB_URL (legacy) > individual variables
    let connectionConfig;
    
    if (process.env.DATABASE_URL) {
      connectionConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      };
    } else if (process.env.DB_URL) {
      connectionConfig = {
        connectionString: process.env.DB_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      };
    } else {
      connectionConfig = {
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'rtalks_db',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      };
    }
    
    pool = new Pool(connectionConfig);
    
    // Test the connection
    pool.query('SELECT NOW()', (err, res) => {
        if (err) {
            console.error('Database connection error in admin.js:', err.message);
            console.log('Admin routes will continue without database functionality');
        } else {
            console.log('Admin routes database connection successful');
        }
    });
} catch (err) {
    console.error('Error initializing database pool in admin.js:', err.message);
    console.log('Admin routes will continue without database functionality');
}

// Middleware to check if database is connected
const checkDbConnection = (req, res, next) => {
    if (!pool) {
        return res.status(503).json({ error: 'Database connection not available' });
    }
    next();
};

// Middleware to verify admin token
const verifyAdminToken = (req, res, next) => {
    const token = req.cookies.adminToken;
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.adminId = decoded.adminId;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Admin login
router.post('/login', checkDbConnection, async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const result = await pool.query(
            'SELECT * FROM admins WHERE email = $1',
            [email]
        );

        const admin = result.rows[0];
        
        if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { adminId: admin.id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Set token in both cookie and response header for flexibility
        const cookieOptions = {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            path: '/'
        };
        
        res.cookie('adminToken', token, cookieOptions);
        // Also send token in header for non-cookie approaches
        res.set('Authorization', `Bearer ${token}`);
        res.json({ success: true, token: token });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Check auth status
router.get('/check-auth', verifyAdminToken, (req, res) => {
    res.json({ authenticated: true });
});

// Logout
router.post('/logout', (req, res) => {
    res.clearCookie('adminToken');
    res.json({ success: true });
});

// Get admin stats
router.get('/stats', verifyAdminToken, checkDbConnection, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Get total tickets and revenue
        const totalStats = await pool.query(`
            SELECT 
                COUNT(*) as total_tickets,
                SUM(amount) as total_revenue
            FROM orders
            WHERE status = 'completed'
        `);

        // Get today's sales
        const todayStats = await pool.query(`
            SELECT COUNT(*) as today_sales
            FROM orders
            WHERE status = 'completed'
            AND DATE(created_at) = $1
        `, [today]);

        res.json({
            totalTickets: parseInt(totalStats.rows[0].total_tickets) || 0,
            totalRevenue: parseFloat(totalStats.rows[0].total_revenue) || 0,
            todaySales: parseInt(todayStats.rows[0].today_sales) || 0
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update event details
router.put('/event', verifyAdminToken, checkDbConnection, async (req, res) => {
    try {
        const { title, description, date, time, location, price } = req.body;
        
        // First check if any events exist
        const existingEvents = await pool.query('SELECT id FROM events ORDER BY date DESC LIMIT 1');
        
        if (existingEvents.rows.length === 0) {
            // No events exist, insert a new one
            await pool.query(`
                INSERT INTO events (title, description, date, time, location, price)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [title, description, date, time, location, price]);
        } else {
            // Update existing event
            await pool.query(`
                UPDATE events
                SET title = $1, description = $2, date = $3, 
                    time = $4, location = $5, price = $6
                WHERE id = $7
            `, [title, description, date, time, location, price, existingEvents.rows[0].id]);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Update event error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get orders
router.get('/orders', verifyAdminToken, checkDbConnection, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                id, customer_name, customer_email, amount,
                status, created_at
            FROM orders
            ORDER BY created_at DESC
            LIMIT 50
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get site content for admin editing
router.get('/content', verifyAdminToken, checkDbConnection, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM site_content ORDER BY section');
        res.json(result.rows);
    } catch (error) {
        console.error('Content fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update site content
router.put('/content/:section', verifyAdminToken, checkDbConnection, async (req, res) => {
    try {
        const { section } = req.params;
        const { title, subtitle, description, content_data } = req.body;
        
        await pool.query(`
            UPDATE site_content
            SET title = $1, subtitle = $2, description = $3, 
                content_data = $4, updated_at = CURRENT_TIMESTAMP
            WHERE section = $5
        `, [title, subtitle, description, JSON.stringify(content_data), section]);

        res.json({ success: true });
    } catch (error) {
        console.error('Update content error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all packages
router.get('/packages', verifyAdminToken, checkDbConnection, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM event_packages WHERE is_active = true ORDER BY display_order, id');
        res.json(result.rows);
    } catch (error) {
        console.error('Packages fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new package
router.post('/packages', verifyAdminToken, checkDbConnection, async (req, res) => {
    try {
        const { name, category, price, features, package_type } = req.body;
        
        // Get next display order
        const orderResult = await pool.query('SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM event_packages');
        const nextOrder = orderResult.rows[0].next_order;
        
        const result = await pool.query(`
            INSERT INTO event_packages (name, category, price, features, package_type, display_order)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [name, category, price, JSON.stringify(features), package_type, nextOrder]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Create package error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update package
router.put('/packages/:id', verifyAdminToken, checkDbConnection, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, price, features, package_type } = req.body;
        
        await pool.query(`
            UPDATE event_packages
            SET name = $1, category = $2, price = $3, features = $4, 
                package_type = $5, updated_at = CURRENT_TIMESTAMP
            WHERE id = $6
        `, [name, category, price, JSON.stringify(features), package_type, id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Update package error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete package (soft delete)
router.delete('/packages/:id', verifyAdminToken, checkDbConnection, async (req, res) => {
    try {
        const { id } = req.params;
        
        await pool.query('UPDATE event_packages SET is_active = false WHERE id = $1', [id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete package error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update package order
router.put('/packages/:id/order', verifyAdminToken, checkDbConnection, async (req, res) => {
    try {
        const { id } = req.params;
        const { display_order } = req.body;
        
        await pool.query('UPDATE event_packages SET display_order = $1 WHERE id = $2', [display_order, id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Update package order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// SPEAKERS MANAGEMENT

// Get all speakers
router.get('/speakers', verifyAdminToken, checkDbConnection, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM speakers WHERE is_active = true ORDER BY display_order, id');
        res.json(result.rows);
    } catch (error) {
        console.error('Speakers fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new speaker
router.post('/speakers', verifyAdminToken, checkDbConnection, async (req, res) => {
    try {
        const { name, title, company, bio, image_url } = req.body;
        
        // Get next display order
        const orderResult = await pool.query('SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM speakers');
        const nextOrder = orderResult.rows[0].next_order;
        
        const result = await pool.query(`
            INSERT INTO speakers (name, title, company, bio, image_url, display_order)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [name, title, company, bio, image_url, nextOrder]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Create speaker error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update speaker
router.put('/speakers/:id', verifyAdminToken, checkDbConnection, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, title, company, bio, image_url } = req.body;
        
        await pool.query(`
            UPDATE speakers
            SET name = $1, title = $2, company = $3, bio = $4, 
                image_url = $5, updated_at = CURRENT_TIMESTAMP
            WHERE id = $6
        `, [name, title, company, bio, image_url, id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Update speaker error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete speaker (soft delete)
router.delete('/speakers/:id', verifyAdminToken, checkDbConnection, async (req, res) => {
    try {
        const { id } = req.params;
        
        await pool.query('UPDATE speakers SET is_active = false WHERE id = $1', [id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete speaker error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update speaker order
router.put('/speakers/:id/order', verifyAdminToken, checkDbConnection, async (req, res) => {
    try {
        const { id } = req.params;
        const { display_order } = req.body;
        
        await pool.query('UPDATE speakers SET display_order = $1 WHERE id = $2', [display_order, id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Update speaker order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// CONTACT FORMS MANAGEMENT

// Get all contact forms
router.get('/contact-forms', verifyAdminToken, checkDbConnection, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM contact_forms ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Contact forms fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export contact forms to JSON (for Excel conversion)
router.get('/contact-forms/export', verifyAdminToken, checkDbConnection, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                id,
                name,
                phone,
                email,
                message,
                TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as submitted_at
            FROM contact_forms 
            ORDER BY created_at DESC
        `);
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="contact_forms_export.json"');
        res.json(result.rows);
    } catch (error) {
        console.error('Contact forms export error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete contact form
router.delete('/contact-forms/:id', verifyAdminToken, checkDbConnection, async (req, res) => {
    try {
        const { id } = req.params;
        
        await pool.query('DELETE FROM contact_forms WHERE id = $1', [id]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Delete contact form error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// CONTACT INFORMATION MANAGEMENT

// Get contact information
router.get('/contact-info', verifyAdminToken, checkDbConnection, async (req, res) => {
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
    } catch (error) {
        console.error('Contact info fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update contact information
router.put('/contact-info', verifyAdminToken, checkDbConnection, async (req, res) => {
    try {
        const { phone_numbers, email, location } = req.body;
        
        // Check if contact info exists
        const existingResult = await pool.query('SELECT id FROM contact_info WHERE section = $1', ['main']);
        
        if (existingResult.rows.length === 0) {
            // Insert new record
            await pool.query(
                'INSERT INTO contact_info (section, phone_numbers, email, location) VALUES ($1, $2, $3, $4)',
                ['main', JSON.stringify(phone_numbers), email, JSON.stringify(location)]
            );
        } else {
            // Update existing record
            await pool.query(
                'UPDATE contact_info SET phone_numbers = $1, email = $2, location = $3, updated_at = CURRENT_TIMESTAMP WHERE section = $4',
                [JSON.stringify(phone_numbers), email, JSON.stringify(location), 'main']
            );
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Contact info update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;