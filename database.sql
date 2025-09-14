-- R-Talks Backend Database Schema
-- This file contains the complete database schema for the R-Talks event platform

-- Create database
CREATE DATABASE rtalks_db;

-- Connect to database
\c rtalks_db;

-- Events table - stores main event information
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    time TIME NOT NULL,
    location VARCHAR(255),
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stats table - stores event statistics
CREATE TABLE IF NOT EXISTS stats (
    id SERIAL PRIMARY KEY,
    attendees INTEGER DEFAULT 0,
    partners INTEGER DEFAULT 0,
    speakers INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table - stores customer ticket orders
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    package_name VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    payment_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admins table - stores admin user credentials
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Site content table - stores dynamic content for the website
CREATE TABLE IF NOT EXISTS site_content (
    id SERIAL PRIMARY KEY,
    section VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(500),
    subtitle VARCHAR(500),
    description TEXT,
    content_data JSONB,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Event packages table - stores ticket packages
CREATE TABLE IF NOT EXISTS event_packages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255),
    price DECIMAL(10,2) NOT NULL,
    features JSONB,
    package_type VARCHAR(50) NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Speakers table - stores speaker information
CREATE TABLE IF NOT EXISTS speakers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    company VARCHAR(255),
    bio TEXT,
    image_url VARCHAR(500),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contact forms table - stores contact form submissions
CREATE TABLE IF NOT EXISTS contact_forms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contact info table - stores business contact information
CREATE TABLE IF NOT EXISTS contact_info (
    id SERIAL PRIMARY KEY,
    section VARCHAR(50) NOT NULL UNIQUE,
    phone_numbers JSONB,
    email VARCHAR(255),
    location JSONB,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_event_packages_active ON event_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_event_packages_order ON event_packages(display_order);
CREATE INDEX IF NOT EXISTS idx_speakers_active ON speakers(is_active);
CREATE INDEX IF NOT EXISTS idx_speakers_order ON speakers(display_order);
CREATE INDEX IF NOT EXISTS idx_contact_forms_created_at ON contact_forms(created_at);

-- Insert sample data (will be handled by initDb.js in production)
-- This is just for reference

-- Default event
INSERT INTO events (title, description, date, time, location, price) VALUES 
('R-TALKS SUMMIT 2025', 'TALENT ACQUISITION LEADER''S KNOWLEDGE SUMMIT', '2025-03-15', '09:00:00', 'Virtual Event', 2999.00)
ON CONFLICT DO NOTHING;

-- Default stats
INSERT INTO stats (attendees, partners, speakers) VALUES (500, 20, 50)
ON CONFLICT DO NOTHING;

-- Note: Admin password hash and other sensitive data will be created by initDb.js
-- Default admin credentials: admin@rtalks.com / admin123