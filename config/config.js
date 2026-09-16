require('dotenv').config();

/**
 * Sequelize CLI / Sequelize 連線設定,三個環境都直接讀 DATABASE_URL,
 * 不把帳密寫死在這份檔案裡。
 */
const base = {
  use_env_variable: 'DATABASE_URL',
  dialect: 'postgres',
};

module.exports = {
  development: base,
  test: base,
  production: base,
};
