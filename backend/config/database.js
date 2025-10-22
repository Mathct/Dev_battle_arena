const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuration de la base de données
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dev_battle_arena',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Configuration sans base de données spécifique pour créer la DB
const dbConfigWithoutDB = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Créer le pool de connexions
const pool = mysql.createPool(dbConfig);

// Fonction pour créer la base de données si elle n'existe pas
async function createDatabase() {
  try {
    const tempPool = mysql.createPool(dbConfigWithoutDB);
    const connection = await tempPool.getConnection();
    
    const dbName = process.env.DB_NAME || 'dev_battle_arena';
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    
    console.log(`✅ Base de données '${dbName}' créée ou vérifiée avec succès`);
    connection.release();
    await tempPool.end();
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la création de la base de données:', error.message);
    return false;
  }
}

// Fonction pour tester la connexion
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Connexion à la base de données réussie');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erreur de connexion à la base de données:', error.message);
    return false;
  }
}

// Fonction pour créer la table users si elle n'existe pas
async function createUsersTable() {
  try {
    const connection = await pool.getConnection();
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('user', 'admin') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await connection.execute(createTableQuery);
    console.log('✅ Table users créée ou vérifiée avec succès');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la création de la table users:', error.message);
    return false;
  }
}

module.exports = {
  pool,
  createDatabase,
  testConnection,
  createUsersTable
};
