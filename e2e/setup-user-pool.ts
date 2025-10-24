/**
 * Setup script to create a pool of reusable test users
 * This eliminates the need to create users during test execution,
 * preventing Supabase rate limit alerts and speeding up tests 5-10x.
 * 
 * Usage: npm run e2e:setup-pool
 * 
 * This script:
 * - Creates 20 test users (10 sellers + 10 buyers)
 * - Creates them sequentially with 2s delay to avoid rate limiting
 * - Saves credentials to e2e/.test-user-pool.json
 * - Pool persists indefinitely (no need to recreate unless cleanup)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = "https://slthyxqruhfuyfmextwr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsdGh5eHFydWhmdXlmbWV4dHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxODIxMzcsImV4cCI6MjA3Mzc1ODEzN30.QFrsO1ThBjlQ_WRFGSHz-Pc3Giot1ijgUqSHVLykGW0";

const POOL_SIZE = 10; // 10 sellers + 10 buyers = 20 total users
const CREATION_DELAY_MS = 2000; // 2s between each user creation

interface TestUser {
  id: string;
  email: string;
  password: string;
  role: 'seller' | 'buyer';
}

interface UserPool {
  sellers: TestUser[];
  buyers: TestUser[];
  createdAt: string;
  poolSize: number;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createSingleUser(role: 'seller' | 'buyer', index: number): Promise<TestUser> {
  const email = `test-pool-${role}-${String(index).padStart(2, '0')}@gmail.com`;
  const password = 'Test123!@#$%';

  console.log(`[${new Date().toISOString()}] Creating ${role} ${index}/${POOL_SIZE}: ${email}...`);

  try {
    const { data, error } = await supabase.functions.invoke('test-create-user', {
      body: { email, password, role },
    });

    if (error) throw error;
    if (!data?.user_id) throw new Error('No user ID returned');

    console.log(`✅ Created ${role} ${index}: ${data.user_id}`);

    return {
      id: data.user_id,
      email: data.email || email,
      password,
      role,
    };
  } catch (error: any) {
    console.error(`❌ Failed to create ${role} ${index}:`, error.message);
    throw error;
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function setupUserPool(): Promise<void> {
  console.log('='.repeat(60));
  console.log('🚀 RivvLock E2E User Pool Setup');
  console.log('='.repeat(60));
  console.log(`Pool size: ${POOL_SIZE} sellers + ${POOL_SIZE} buyers = ${POOL_SIZE * 2} total users`);
  console.log(`Creation delay: ${CREATION_DELAY_MS}ms between users`);
  console.log(`Estimated duration: ${Math.ceil((POOL_SIZE * 2 * CREATION_DELAY_MS) / 1000 / 60)} minutes`);
  console.log('='.repeat(60));
  console.log('');

  const pool: UserPool = {
    sellers: [],
    buyers: [],
    createdAt: new Date().toISOString(),
    poolSize: POOL_SIZE,
  };

  // Create sellers
  console.log('📦 Creating SELLERS...');
  for (let i = 1; i <= POOL_SIZE; i++) {
    const user = await createSingleUser('seller', i);
    pool.sellers.push(user);
    
    if (i < POOL_SIZE) {
      console.log(`⏳ Waiting ${CREATION_DELAY_MS}ms before next user...`);
      await delay(CREATION_DELAY_MS);
    }
  }

  console.log('');
  console.log('📦 Creating BUYERS...');
  await delay(CREATION_DELAY_MS); // Extra delay between sellers and buyers

  for (let i = 1; i <= POOL_SIZE; i++) {
    const user = await createSingleUser('buyer', i);
    pool.buyers.push(user);
    
    if (i < POOL_SIZE) {
      console.log(`⏳ Waiting ${CREATION_DELAY_MS}ms before next user...`);
      await delay(CREATION_DELAY_MS);
    }
  }

  // Save to file
  const poolFilePath = path.join(process.cwd(), 'e2e', '.test-user-pool.json');
  fs.writeFileSync(poolFilePath, JSON.stringify(pool, null, 2), 'utf-8');

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ User pool created successfully!');
  console.log('='.repeat(60));
  console.log(`📁 Saved to: ${poolFilePath}`);
  console.log(`👥 Total users: ${pool.sellers.length + pool.buyers.length}`);
  console.log(`   - Sellers: ${pool.sellers.length}`);
  console.log(`   - Buyers: ${pool.buyers.length}`);
  console.log('');
  console.log('🎯 Next steps:');
  console.log('   1. Run your E2E tests: npx playwright test');
  console.log('   2. Tests will automatically use the pool (no more rate limits!)');
  console.log('   3. Pool persists indefinitely - no need to recreate');
  console.log('='.repeat(60));
}

// Execute
setupUserPool().catch((error) => {
  console.error('');
  console.error('='.repeat(60));
  console.error('❌ FATAL ERROR: User pool setup failed');
  console.error('='.repeat(60));
  console.error(error);
  console.error('');
  process.exit(1);
});
