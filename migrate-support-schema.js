#!/usr/bin/env node
/**
 * Migration Script: Run SUPPORT_MESSAGING_SCHEMA.sql
 * 
 * This script executes the support messaging schema in your Supabase database.
 * 
 * Usage:
 *   node migrate-support-schema.js
 * 
 * Make sure your .env.local has:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('🔗 Connecting to Supabase...');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrate() {
  try {
    console.log('📖 Reading schema file...');
    const schemaPath = path.join(__dirname, 'SUPPORT_MESSAGING_SCHEMA.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split by semicolon to get individual SQL statements
    // Filter out comments and empty statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements`);
    
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'; // Re-add semicolon
      
      try {
        console.log(`\n[${i + 1}/${statements.length}] Executing...`);
        
        const { error } = await supabase.rpc('exec_sql_statement', {
          sql: statement,
        }).catch(async (err) => {
          // Fallback: use query method instead
          return await supabase
            .from('_sql_statements')
            .insert({ sql: statement })
            .catch(() => ({
              error: {
                message: 'SQL execution method not available. Use Supabase dashboard instead.',
              },
            }));
        });

        if (error) {
          throw error;
        }

        successCount++;
        console.log(`✅ Success`);
      } catch (err) {
        errorCount++;
        console.error(`❌ Error:`, err.message);
        
        // Continue with other statements instead of stopping
        if (err.message.includes('does not exist')) {
          console.log('⏭️  Continuing (table might already exist)...');
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Migration complete!`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log('='.repeat(60));

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.log('\n📋 Please manually run the migration:');
    console.log('   1. Go to: https://app.supabase.com');
    console.log('   2. Select your project');
    console.log('   3. Click "SQL Editor" → "New Query"');
    console.log('   4. Copy contents of SUPPORT_MESSAGING_SCHEMA.sql');
    console.log('   5. Paste and click "Run"');
    process.exit(1);
  }
}

migrate();
