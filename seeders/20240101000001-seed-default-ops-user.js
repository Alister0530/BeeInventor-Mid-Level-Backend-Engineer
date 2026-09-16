'use strict';

require('dotenv').config();
const bcrypt = require('bcrypt');

const OPS_EMAIL = process.env.SEED_OPS_EMAIL || 'ops@example.com';
const OPS_PASSWORD = process.env.SEED_OPS_PASSWORD;
const OPS_NAME = process.env.SEED_OPS_NAME || 'Default Ops';

if (!OPS_PASSWORD) {
  console.warn(
    '[seed] SEED_OPS_PASSWORD 未設定,使用預設密碼 "changeme123"(僅供本機測試,正式環境請務必在 .env 設定)'
  );
}

module.exports = {
  async up(queryInterface) {
    const passwordHash = await bcrypt.hash(OPS_PASSWORD || 'changeme123', 12);

    // email 的唯一性是 partial unique index(WHERE deleted_at IS NULL),
    // ON CONFLICT 的推斷條件必須完全比照該 index 的 WHERE 子句,才能對應到它,
    // 否則 Postgres 會報「there is no unique or exclusion constraint matching
    // the ON CONFLICT specification」
    await queryInterface.sequelize.query(
      `INSERT INTO users (user_id, email, password, name, role, created_at, updated_at)
       VALUES (gen_random_uuid(), :email, :password, :name, 'ops', now(), now())
       ON CONFLICT (email) WHERE deleted_at IS NULL DO NOTHING;`,
      {
        replacements: { email: OPS_EMAIL, password: passwordHash, name: OPS_NAME },
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DELETE FROM users WHERE email = :email;', {
      replacements: { email: OPS_EMAIL },
    });
  },
};
