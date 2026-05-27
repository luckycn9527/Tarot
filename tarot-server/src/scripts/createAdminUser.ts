import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { hashAdminUsername } from '../utils/adminAuth.js';

dotenv.config();

async function main() {
  const username = process.argv[2];
  const password = process.argv[3];
  const displayName = process.argv[4] || '系统管理员';

  if (!username || !password) {
    console.error('Usage: npx tsx src/scripts/createAdminUser.ts <username> <password> [displayName]');
    process.exit(1);
  }

  const usernameHash = hashAdminUsername(username);
  const passwordHash = await bcrypt.hash(password, 12);

  await pool.execute(
    `INSERT INTO admin_users (username_hash, password_hash, display_name, is_active)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       password_hash = VALUES(password_hash),
       display_name = VALUES(display_name),
       is_active = 1`,
    [usernameHash, passwordHash, displayName],
  );

  console.log('✅ admin user upserted:', displayName);
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ create admin failed:', e);
  process.exit(1);
});
