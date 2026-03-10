const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupDatabase() {
  try {
    console.log('جاري انشاء الجداول...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'engineer',
        department VARCHAR(100),
        phone VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('تم جدول users');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        client_name VARCHAR(255),
        city VARCHAR(100),
        status VARCHAR(50) DEFAULT 'active',
        iso_9001 BOOLEAN DEFAULT false,
        iso_45001 BOOLEAN DEFAULT false,
        iso_14001 BOOLEAN DEFAULT false,
        avg_compliance NUMERIC(5,2) DEFAULT 0,
        open_ncs INTEGER DEFAULT 0,
        manager_id UUID REFERENCES users(id),
        description TEXT,
        start_date TIMESTAMPTZ,
        end_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('تم جدول projects');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS inspections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ref_number VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        type VARCHAR(50),
        status VARCHAR(50) DEFAULT 'pending',
        result VARCHAR(20),
        compliance_score NUMERIC(5,2),
        iso_standard VARCHAR(20),
        project_id UUID REFERENCES projects(id),
        assigned_to UUID REFERENCES users(id),
        location_name VARCHAR(255),
        scheduled_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('تم جدول inspections');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS nonconformances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ref_number VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50),
        status VARCHAR(50) DEFAULT 'open',
        category VARCHAR(50),
        iso_standard VARCHAR(20),
        project_id UUID REFERENCES projects(id),
        assigned_to UUID REFERENCES users(id),
        location VARCHAR(255),
        due_date TIMESTAMPTZ,
        detected_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('تم جدول nonconformances');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS rca_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ref_number VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(255),
        status VARCHAR(50) DEFAULT 'open',
        methodology VARCHAR(50) DEFAULT '5_whys',
        nc_id UUID REFERENCES nonconformances(id),
        project_id UUID REFERENCES projects(id),
        assigned_to UUID REFERENCES users(id),
        why_1 TEXT,
        why_2 TEXT,
        why_3 TEXT,
        why_4 TEXT,
        why_5 TEXT,
        root_cause TEXT,
        target_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('تم جدول rca_tickets');

    await pool.query(`
      INSERT INTO users (email, password_hash, full_name, role, department)
      VALUES (
        'admin@ims-qhse.com',
        '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.',
        'مدير النظام',
        'admin',
        'IT'
      ) ON CONFLICT (email) DO NOTHING
    `);
    console.log('تم انشاء مستخدم Admin');

    console.log('');
    console.log('تم انشاء جميع الجداول بنجاح!');
    process.exit(0);
  } catch (err) {
    console.error('خطا:', err.message);
    process.exit(1);
  }
}

setupDatabase();
