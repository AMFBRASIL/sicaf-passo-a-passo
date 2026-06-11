/**
 * Conexão com MySQL via Knex.
 */
const config = require('../config');

let db = null;

function initDatabase() {
  try {
    const knex = require('knex');
    db = knex({
      client: 'mysql2',
      connection: {
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
        charset: 'utf8mb4',
      },
      pool: {
        min: config.db.poolMin,
        max: config.db.poolMax,
      },
    });
    console.log(`  ✔ MySQL configurado (${config.db.host}/${config.db.database})`);
    return true;
  } catch (e) {
    console.log(`  ⚠ MySQL não disponível: ${e.message.substring(0, 60)}`);
    return false;
  }
}

function getDb() {
  return db;
}

async function closeDatabase() {
  if (db) {
    await db.destroy();
    db = null;
  }
}

module.exports = { initDatabase, getDb, closeDatabase };
