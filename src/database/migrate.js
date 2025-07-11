/**
 * Database migration script for PostgreSQL
 * Handles running migrations and database setup
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

class DatabaseMigrator {
    constructor() {
        this.pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'handit_ai',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
    }

    async createDatabase() {
        const dbName = process.env.DB_NAME || 'handit_ai';
        const adminPool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: 'postgres', // Connect to default database
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
        });

        try {
            // Check if database exists
            const result = await adminPool.query(
                'SELECT 1 FROM pg_database WHERE datname = $1',
                [dbName]
            );

            if (result.rows.length === 0) {
                console.log(`📦 Creating database: ${dbName}`);
                await adminPool.query(`CREATE DATABASE "${dbName}"`);
                console.log(`✅ Database ${dbName} created successfully`);
            } else {
                console.log(`📦 Database ${dbName} already exists`);
            }
        } catch (error) {
            console.error('❌ Error creating database:', error.message);
            throw error;
        } finally {
            await adminPool.end();
        }
    }

    async createMigrationsTable() {
        const query = `
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;
        
        try {
            await this.pool.query(query);
            console.log('📋 Migrations table ready');
        } catch (error) {
            console.error('❌ Error creating migrations table:', error.message);
            throw error;
        }
    }

    async getAppliedMigrations() {
        try {
            const result = await this.pool.query(
                'SELECT filename FROM migrations ORDER BY applied_at'
            );
            return result.rows.map(row => row.filename);
        } catch (error) {
            console.error('❌ Error getting applied migrations:', error.message);
            return [];
        }
    }

    async runMigration(filename) {
        const migrationPath = path.join(__dirname, 'migrations', filename);
        
        try {
            const sql = fs.readFileSync(migrationPath, 'utf8');
            
            // Execute migration in a transaction
            await this.pool.query('BEGIN');
            
            // Run the migration SQL
            await this.pool.query(sql);
            
            // Record the migration as applied
            await this.pool.query(
                'INSERT INTO migrations (filename) VALUES ($1)',
                [filename]
            );
            
            await this.pool.query('COMMIT');
            
            console.log(`✅ Migration ${filename} applied successfully`);
        } catch (error) {
            await this.pool.query('ROLLBACK');
            console.error(`❌ Error running migration ${filename}:`, error.message);
            throw error;
        }
    }

    async runAllMigrations() {
        const migrationsDir = path.join(__dirname, 'migrations');
        
        if (!fs.existsSync(migrationsDir)) {
            console.log('📁 No migrations directory found');
            return;
        }

        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();

        if (migrationFiles.length === 0) {
            console.log('📁 No migration files found');
            return;
        }

        const appliedMigrations = await this.getAppliedMigrations();
        const pendingMigrations = migrationFiles.filter(
            file => !appliedMigrations.includes(file)
        );

        if (pendingMigrations.length === 0) {
            console.log('✅ All migrations are up to date');
            return;
        }

        console.log(`📋 Running ${pendingMigrations.length} pending migrations:`);
        
        for (const migration of pendingMigrations) {
            await this.runMigration(migration);
        }

        console.log('🎉 All migrations completed successfully!');
    }

    async testConnection() {
        try {
            const result = await this.pool.query('SELECT NOW()');
            console.log('✅ Database connection successful:', result.rows[0].now);
            return true;
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            return false;
        }
    }

    async close() {
        await this.pool.end();
    }
}

// CLI functionality
async function main() {
    const migrator = new DatabaseMigrator();
    
    try {
        console.log('🚀 Starting database migration...');
        
        // Create database if it doesn't exist
        await migrator.createDatabase();
        
        // Test connection
        const connected = await migrator.testConnection();
        if (!connected) {
            process.exit(1);
        }
        
        // Create migrations table
        await migrator.createMigrationsTable();
        
        // Run all pending migrations
        await migrator.runAllMigrations();
        
        console.log('🎉 Migration process completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await migrator.close();
    }
}

// Export for use in other files
module.exports = { DatabaseMigrator };

// Run if called directly
if (require.main === module) {
    main();
} 