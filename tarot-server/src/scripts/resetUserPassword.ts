import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/database.js';

dotenv.config();

/**
 * 管理员重置某个用户的登录密码（忘记密码时使用）。
 * 用法：npx tsx src/scripts/resetUserPassword.ts <email> <newPassword>
 * 注意：密码以 bcrypt 哈希存储，无法找回原密码，只能重置为新密码。
 */
async function main() {
  const emailArg = process.argv[2];
  const newPassword = process.argv[3];

  if (!emailArg || !newPassword) {
    console.error('用法: npx tsx src/scripts/resetUserPassword.ts <email> <newPassword>');
    process.exit(1);
  }
  if (newPassword.length < 6) {
    console.error('❌ 新密码至少 6 位');
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();

  const [users] = await pool.execute<RowDataPacket[]>(
    'SELECT id, email, nickname FROM users WHERE LOWER(email) = ? LIMIT 1',
    [email],
  );
  if (users.length === 0) {
    console.error('❌ 未找到该邮箱的用户:', email);
    process.exit(1);
  }

  const user = users[0];
  const passwordHash = await bcrypt.hash(newPassword, 10);
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [passwordHash, user.id],
  );

  if (result.affectedRows === 0) {
    console.error('❌ 更新失败');
    process.exit(1);
  }

  console.log(`✅ 已重置密码 — 用户: ${user.nickname} <${user.email}> (id=${user.id})`);
  console.log('   请用新密码登录后尽快自行修改。');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ 重置失败:', e);
  process.exit(1);
});
