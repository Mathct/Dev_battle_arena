const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuration de la base de données
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dev_battle_arena_db',
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

// Fonction pour créer la table games
async function createGamesTable() {
  try {
    const connection = await pool.getConnection();
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS games (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        admin_id INT NOT NULL,
        status ENUM('created', 'active', 'finished') DEFAULT 'created',
        game_mode ENUM('individual', 'team') DEFAULT 'individual',
        max_teams INT DEFAULT 2,
        timer_duration INT NULL,
        special_rules JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP NULL,
        finished_at TIMESTAMP NULL,
        FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await connection.execute(createTableQuery);
    console.log('✅ Table games créée ou vérifiée avec succès');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la création de la table games:', error.message);
    return false;
  }
}

// Fonction pour créer la table teams
async function createTeamsTable() {
  try {
    const connection = await pool.getConnection();
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS teams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        game_id INT NOT NULL,
        name VARCHAR(50) NOT NULL,
        color VARCHAR(7) DEFAULT '#3498db',
        score INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await connection.execute(createTableQuery);
    console.log('✅ Table teams créée ou vérifiée avec succès');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la création de la table teams:', error.message);
    return false;
  }
}

// Fonction pour créer la table team_members
async function createTeamMembersTable() {
  try {
    const connection = await pool.getConnection();
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS team_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        team_id INT NOT NULL,
        user_id INT NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_team_member (team_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await connection.execute(createTableQuery);
    console.log('✅ Table team_members créée ou vérifiée avec succès');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la création de la table team_members:', error.message);
    return false;
  }
}

// Fonction pour créer la table user_stats
async function createUserStatsTable() {
  try {
    const connection = await pool.getConnection();
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS user_stats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        total_games_played INT DEFAULT 0,
        total_buzzes INT DEFAULT 0,
        correct_answers INT DEFAULT 0,
        wrong_answers INT DEFAULT 0,
        total_points INT DEFAULT 0,
        average_response_time DECIMAL(10,2) DEFAULT 0,
        best_streak INT DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_stats (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await connection.execute(createTableQuery);
    console.log('✅ Table user_stats créée ou vérifiée avec succès');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la création de la table user_stats:', error.message);
    return false;
  }
}

module.exports = {
  pool,
  createDatabase,
  testConnection,
  createUsersTable,
  createGamesTable,
  createTeamsTable,
  createTeamMembersTable,
  createUserStatsTable
};
