/**
 * 将 TS 静态数据同步到管理后台 DB 配置表（仅插入不存在的行，不覆盖已修改的配置）
 * 用法: npx tsx src/scripts/seedAdminConfig.ts
 */
import { pool } from '../config/database.js';
import { tarotCards } from '../data/tarotCards.js';
import { readers } from '../data/readers.js';

async function main() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let cardInserted = 0;
    for (const c of tarotCards) {
      const [existing] = await conn.execute(
        'SELECT id FROM tarot_cards_config WHERE id = ?',
        [c.id],
      );
      if ((existing as any[]).length === 0) {
        await conn.execute(
          `INSERT INTO tarot_cards_config
            (id, name, name_en, upright_keywords, reversed_keywords, yes_no_tendency, is_active)
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [c.id, c.name, c.nameEn, c.uprightKeywords, c.reversedKeywords, c.yesNoTendency],
        );
        cardInserted++;
      }
    }
    console.log(`tarot_cards_config: ${cardInserted} inserted, ${tarotCards.length - cardInserted} already existed`);

    let promptInserted = 0;
    for (const r of readers) {
      const [existing] = await conn.execute(
        'SELECT id FROM reader_prompts_config WHERE reader_code = ?',
        [r.id],
      );
      if ((existing as any[]).length === 0) {
        await conn.execute(
          `INSERT INTO reader_prompts_config (reader_code, system_prompt, greeting)
           VALUES (?, ?, ?)`,
          [r.id, r.systemPrompt, r.greeting],
        );
        promptInserted++;
      }
    }
    console.log(`reader_prompts_config: ${promptInserted} inserted, ${readers.length - promptInserted} already existed`);

    await conn.commit();
    console.log('✅ Admin config seed completed');
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
