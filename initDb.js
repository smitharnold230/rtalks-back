const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const initializeDatabase = async () => {
  console.log('🔧 Database initialization starting...');
  
  // Priority: DATABASE_URL (Render/Railway) > DB_URL (legacy) > individual variables
  let connectionConfig;
  
  if (process.env.DATABASE_URL) {
    connectionConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
    console.log('📡 Using DATABASE_URL for database connection');
  } else if (process.env.DB_URL) {
    connectionConfig = {
      connectionString: process.env.DB_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
    console.log('📡 Using DB_URL for database connection');
  } else {
    connectionConfig = {
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'rtalks_db',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
    console.log('📡 Using individual database variables for connection');
  }
  
  const pool = new Pool(connectionConfig);

  try {
    console.log('📊 Creating database schema...');
    
    // Create tables
    await pool.query(`
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

      CREATE TABLE IF NOT EXISTS stats (
        id SERIAL PRIMARY KEY,
        attendees INTEGER DEFAULT 0,
        partners INTEGER DEFAULT 0,
        speakers INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

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

      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS site_content (
        id SERIAL PRIMARY KEY,
        section VARCHAR(100) NOT NULL UNIQUE,
        title VARCHAR(500),
        subtitle VARCHAR(500),
        description TEXT,
        content_data JSONB,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

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

      CREATE TABLE IF NOT EXISTS contact_forms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        email VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS contact_info (
        id SERIAL PRIMARY KEY,
        section VARCHAR(50) NOT NULL UNIQUE,
        phone_numbers JSONB,
        email VARCHAR(255),
        location JSONB,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Database schema created successfully');

    // Insert initial data only if tables are empty
    const eventCount = await pool.query('SELECT COUNT(*) FROM events');
    if (parseInt(eventCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO events (title, description, date, time, location, price) 
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        'R-TALKS SUMMIT 2025',
        'TALENT ACQUISITION LEADER\'S KNOWLEDGE SUMMIT',
        '2025-03-15',
        '09:00:00',
        'Virtual Event',
        2999.00
      ]);
      console.log('📅 Default event created');
    }

    const statsCount = await pool.query('SELECT COUNT(*) FROM stats');
    if (parseInt(statsCount.rows[0].count) === 0) {
      await pool.query('INSERT INTO stats (attendees, partners, speakers) VALUES ($1, $2, $3)', [500, 20, 50]);
      console.log('📈 Default stats created');
    }
    
    // Check if admin exists, if not create default admin
    const adminCount = await pool.query('SELECT COUNT(*) FROM admins');
    if (parseInt(adminCount.rows[0].count) === 0) {
      // Generate hash for password 'admin123'
      const passwordHash = await bcrypt.hash('admin123', 10);
      await pool.query(
        'INSERT INTO admins (email, password_hash) VALUES ($1, $2)',
        ['admin@rtalks.com', passwordHash]
      );
      console.log('👤 Default admin user created (admin@rtalks.com / admin123)');
    }

    // Insert default homepage content
    const contentCount = await pool.query('SELECT COUNT(*) FROM site_content');
    if (parseInt(contentCount.rows[0].count) === 0) {
      const defaultContent = [
        {
          section: 'hero',
          title: 'Buy Event Tickets',
          subtitle: 'RAISE - TALENT ACQUISITION LEADER\'S KNOWLEDGE SUMMIT',
          description: 'Join us for the biggest R programming conference of the year. Learn from industry experts and connect with fellow developers.',
          content_data: JSON.stringify({
            buttons: [
              { text: 'Browse Events', action: 'scrollToTickets' }
            ]
          })
        },
        {
          section: 'event_info',
          title: 'Our Event Passes',
          subtitle: '',
          description: 'Choose the pass that best suits your professional goals and aspirations.',
          content_data: JSON.stringify({
            packages: [
              {
                name: 'Professional Pass',
                category: 'Aspiring Professional',
                price: 299,
                features: [
                  'Certificate of Participation',
                  'Internship & Placement Prospects',
                  'Career Guidance'
                ]
              },
              {
                name: 'Executive Pass',
                category: 'Executive',
                price: 2999,
                features: [
                  'AI & Digital Tools in HR',
                  'Industry Networking',
                  'Talent Acquisition Strategies'
                ]
              },
              {
                name: 'Leadership Pass',
                category: 'Leadership',
                price: 4999,
                features: [
                  'Institutional Growth Insights',
                  'Corporate Collaborations',
                  'Workforce Trend Analysis'
                ]
              }
            ]
          })
        }
      ];

      for (const content of defaultContent) {
        await pool.query(
          'INSERT INTO site_content (section, title, subtitle, description, content_data) VALUES ($1, $2, $3, $4, $5)',
          [content.section, content.title, content.subtitle, content.description, content.content_data]
        );
      }
      console.log('📝 Default homepage content created');
    }

    // Insert default packages into new packages table
    const packagesCount = await pool.query('SELECT COUNT(*) FROM event_packages');
    if (parseInt(packagesCount.rows[0].count) === 0) {
      const defaultPackages = [
        {
          name: 'Professional Pass',
          category: 'Aspiring Professional',
          price: 299,
          features: JSON.stringify([
            'Certificate of Participation',
            'Internship & Placement Prospects',
            'Career Guidance'
          ]),
          package_type: 'professional',
          display_order: 1
        },
        {
          name: 'Executive Pass',
          category: 'Executive',
          price: 2999,
          features: JSON.stringify([
            'AI & Digital Tools in HR',
            'Industry Networking',
            'Talent Acquisition Strategies'
          ]),
          package_type: 'executive',
          display_order: 2
        },
        {
          name: 'Leadership Pass',
          category: 'Leadership',
          price: 4999,
          features: JSON.stringify([
            'Institutional Growth Insights',
            'Corporate Collaborations',
            'Workforce Trend Analysis'
          ]),
          package_type: 'leadership',
          display_order: 3
        }
      ];

      for (const pkg of defaultPackages) {
        await pool.query(
          'INSERT INTO event_packages (name, category, price, features, package_type, display_order) VALUES ($1, $2, $3, $4, $5, $6)',
          [pkg.name, pkg.category, pkg.price, pkg.features, pkg.package_type, pkg.display_order]
        );
      }
      console.log('🎫 Default event packages created');
    }

    // Insert default speakers
    const speakersCount = await pool.query('SELECT COUNT(*) FROM speakers');
    if (parseInt(speakersCount.rows[0].count) === 0) {
      const defaultSpeakers = [
        {
          name: 'Dr. Sarah Johnson',
          title: 'Chief People Officer',
          company: 'TechCorp Global',
          bio: 'Leading expert in digital transformation and talent acquisition with 15+ years of experience.',
          image_url: 'https://randomuser.me/api/portraits/women/1.jpg',
          display_order: 1
        },
        {
          name: 'Michael Chen',
          title: 'Director of Talent Strategy',
          company: 'Innovation Labs',
          bio: 'Specialist in AI-driven recruitment and modern workplace culture development.',
          image_url: 'https://randomuser.me/api/portraits/men/1.jpg',
          display_order: 2
        },
        {
          name: 'Rachel Martinez',
          title: 'VP of Human Resources',
          company: 'Future Enterprises',
          bio: 'Pioneer in remote work strategies and inclusive hiring practices.',
          image_url: 'https://randomuser.me/api/portraits/women/2.jpg',
          display_order: 3
        },
        {
          name: 'David Kumar',
          title: 'Head of Recruitment',
          company: 'StartupHub',
          bio: 'Expert in scaling tech teams and building high-performance cultures.',
          image_url: 'https://randomuser.me/api/portraits/men/2.jpg',
          display_order: 4
        }
      ];

      for (const speaker of defaultSpeakers) {
        await pool.query(
          'INSERT INTO speakers (name, title, company, bio, image_url, display_order) VALUES ($1, $2, $3, $4, $5, $6)',
          [speaker.name, speaker.title, speaker.company, speaker.bio, speaker.image_url, speaker.display_order]
        );
      }
      console.log('🎤 Default speakers created');
    }

    // Insert default contact information
    const contactInfoCount = await pool.query('SELECT COUNT(*) FROM contact_info');
    if (parseInt(contactInfoCount.rows[0].count) === 0) {
      const defaultContactInfo = {
        section: 'main',
        phone_numbers: JSON.stringify([
          '+91 99406 25080',
          '+91 78100 78717',
          '+91 63699 97015',
          '+91 99522 47355'
        ]),
        email: 'manikandan@aicraise.com',
        location: JSON.stringify({
          venue: 'Rathinam Grand Hall',
          area: 'Eachanari - 021',
          building: 'Rathinam Tech Park',
          address: 'Pollachi Main Rd, Eachanari',
          city: 'Coimbatore, Tamil Nadu 641021'
        })
      };

      await pool.query(
        'INSERT INTO contact_info (section, phone_numbers, email, location) VALUES ($1, $2, $3, $4)',
        [defaultContactInfo.section, defaultContactInfo.phone_numbers, defaultContactInfo.email, defaultContactInfo.location]
      );
      console.log('📞 Default contact information created');
    }

    console.log('');
    console.log('🎉 Database initialization completed successfully!');
    console.log('🔑 Admin Login: admin@rtalks.com / admin123');
    console.log('📊 Database ready for production use');
    console.log('');
    
  } catch (err) {
    console.error('❌ Database initialization failed:', err);
    throw err;
  } finally {
    await pool.end();
  }
};

// If this file is run directly (not imported), execute initialization
if (require.main === module) {
  initializeDatabase().catch(console.error);
}

module.exports = initializeDatabase;