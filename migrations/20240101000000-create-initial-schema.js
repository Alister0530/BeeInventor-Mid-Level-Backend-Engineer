'use strict';

const fs = require('fs');
const path = require('path');

/**
 * 直接讀取並執行 schema.sql,schema.sql 是唯一的 schema 真實來源,
 * 不用 migration 跟 schema.sql 兩邊分開維護、內容跑掉(見 Question2.md「Migration 與 Seed」)。
 * down() 沒辦法從 schema.sql 自動反推,只能手動寫反向操作。
 */
module.exports = {
  async up(queryInterface) {
    const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
    await queryInterface.sequelize.query(schemaSql);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`SELECT cron.unschedule('partman-maintenance');`);
    await queryInterface.sequelize.query(`
      DELETE FROM partman.part_config WHERE parent_table IN ('public.outbox', 'public.audit_logs');
    `);
    await queryInterface.sequelize.query('DROP EXTENSION IF EXISTS pg_partman CASCADE;');
    await queryInterface.sequelize.query('DROP SCHEMA IF EXISTS partman CASCADE;');
    await queryInterface.sequelize.query('DROP EXTENSION IF EXISTS pg_cron CASCADE;');

    // schema.sql 用 VARCHAR + CHECK(不是 Postgres 原生 ENUM 型別),
    // 所以這裡不需要額外清 ENUM type,直接依外鍵相依順序反向刪表即可
    await queryInterface.dropTable('audit_logs');
    await queryInterface.dropTable('refresh_tokens');
    await queryInterface.dropTable('outbox');
    await queryInterface.dropTable('documents');
    await queryInterface.dropTable('users');
  },
};
