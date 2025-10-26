// Fichier principal du serveur backend
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const http = require('http');
const { 
  pool,
  createDatabase, 
  testConnection, 
  createUsersTable,
  createTeamsTable,
  createGameTable,
  createScoresTable
} = require('./config/database');

// Charger les variables d'environnement
dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000; // Port par défaut

// Configuration Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*", // Accepter toutes les origines pour les tests
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes d'authentification
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Route de base
app.get('/', (req, res) => {
  res.json({ 
    message: 'Bienvenue sur l\'API DEV BATTLE ARENA',
    version: '1.0.0',
    status: 'running'
  });
});

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Route API pour les données
app.get('/api/data', (req, res) => {
  res.json({ 
    message: 'Données DEV BATTLE ARENA',
    users: io.engine.clientsCount,
    timestamp: new Date().toISOString()
  });
});

// Route pour obtenir l'état du jeu
app.get('/api/game/state', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute('SELECT game_state FROM game ORDER BY id DESC LIMIT 1');
    connection.release();
    
    const gameState = rows.length > 0 ? rows[0].game_state : 0;
    res.json({ success: true, gameState, buzzersEnabled });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'état du jeu:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Route pour modifier l'état du jeu (admin seulement)
app.post('/api/game/state', async (req, res) => {
  try {
    const { gameState } = req.body;
    
    if (gameState !== 0 && gameState !== 1) {
      return res.status(400).json({ success: false, message: 'État de jeu invalide' });
    }
    
    const connection = await pool.getConnection();
    await connection.execute('UPDATE game SET game_state = ? WHERE id = (SELECT id FROM (SELECT id FROM game ORDER BY id DESC LIMIT 1) as subquery)', [gameState]);
    connection.release();
    
    // Si la partie s'arrête, désactiver les buzzers
    if (gameState === 0) {
      buzzersEnabled = false;
      console.log('🛑 Partie arrêtée - Désactivation des buzzers');
    }
    
    // Notifier tous les clients du changement d'état
    io.emit('gameStateChanged', { gameState });
    
    res.json({ success: true, gameState });
  } catch (error) {
    console.error('Erreur lors de la modification de l\'état du jeu:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Stockage des joueurs connectés (clé = nom d'utilisateur)
const players = new Map();
let buzzedPlayer = null;
let buzzersEnabled = false; // État global des buzzers

// Gestion des connexions Socket.IO
io.on('connection', (socket) => {
  console.log(`Utilisateur connecté: ${socket.id}`);
  console.log(`Total utilisateurs connectés: ${io.engine.clientsCount}`);
  
  // Rejoindre le jeu
  socket.on('joinGame', (playerName, isAdmin = false) => {
    if (isAdmin) {
      // Les admins ne sont pas ajoutés à la liste des joueurs
      console.log(`👑 ${playerName} (Admin) connecté au serveur`);
      // Envoyer la liste actuelle des joueurs à l'admin
      const playersList = Array.from(players.values());
      socket.emit('playersUpdate', playersList);
      
      // Envoyer l'état actuel du buzzer à l'admin
      if (buzzedPlayer) {
        socket.emit('playerBuzzed', buzzedPlayer);
        console.log(`📡 État du buzzer envoyé à l'admin: ${buzzedPlayer.name} a buzzé`);
      }
      
      console.log(`📡 Liste des joueurs envoyée à l'admin:`, playersList.map(p => p.name));
    } else {
      // Utiliser le nom d'utilisateur comme clé unique pour les joueurs normaux
      const player = {
        id: socket.id,
        name: playerName,
        buzzed: false,
        isAdmin: false
      };
      
      if (players.has(playerName)) {
        console.log(`🔄 ${playerName} s'est reconnecté (remplacement)`);
        
        // Récupérer l'ancien joueur pour préserver son état
        const oldPlayer = players.get(playerName);
        if (oldPlayer) {
          player.buzzed = oldPlayer.buzzed; // Préserver l'état buzzed
          console.log(`🔄 ${playerName} - état buzzed préservé: ${player.buzzed}`);
          
          // Si c'est le joueur qui a buzzé qui se reconnecte, mettre à jour buzzedPlayer global
          if (buzzedPlayer && buzzedPlayer.name === playerName) {
            buzzedPlayer.id = socket.id; // Mettre à jour le socket.id
            buzzedPlayer.buzzed = true;
            console.log(`🔄 Mise à jour du buzzedPlayer global pour ${playerName} avec nouveau socket.id: ${socket.id}`);
          }
        }
      } else {
        console.log(`🎮 ${playerName} a rejoint le jeu`);
      }
      
      players.set(playerName, player);
      
      // Notifier tous les clients de la mise à jour des joueurs
      const playersList = Array.from(players.values());
      io.emit('playersUpdate', playersList);
      console.log(`📡 Liste des joueurs envoyée:`, playersList.map(p => ({ name: p.name, buzzed: p.buzzed })));
      
      // Si quelqu'un a buzzé, envoyer l'état à tous les joueurs
      if (buzzedPlayer) {
        io.emit('playerBuzzed', buzzedPlayer);
        console.log(`📡 État du buzzer envoyé à tous les joueurs: ${buzzedPlayer.name} a buzzé`);
        
        // Si c'est le joueur qui a buzzé qui se reconnecte, forcer l'envoi de l'état
        if (buzzedPlayer.name === playerName) {
          setTimeout(() => {
            io.emit('playerBuzzed', buzzedPlayer);
            console.log(`📡 État du buzzer renvoyé après reconnexion de ${playerName}`);
          }, 100);
        }
      }
    }
  });

  // Buzzer
  socket.on('buzz', () => {
    if (buzzedPlayer) {
      console.log(`Tentative de buzzer mais ${buzzedPlayer.name} a déjà buzzé`);
      return;
    }

    // Trouver le joueur par socket.id
    const player = Array.from(players.values()).find(p => p.id === socket.id);
    if (player && !player.buzzed) {
      buzzedPlayer = player;
      player.buzzed = true;
      players.set(player.name, player);
      
      console.log(`${player.name} a buzzé !`);
      
      // Notifier tous les clients
      io.emit('playerBuzzed', player);
      const playersList = Array.from(players.values());
      io.emit('playersUpdate', playersList);
      console.log(`📡 Liste des joueurs envoyée après buzzer:`, playersList.map(p => ({ name: p.name, buzzed: p.buzzed })));
    } else if (player && player.buzzed) {
      console.log(`${player.name} a déjà buzzé dans cette manche`);
    } else {
      console.log(`⚠️ Joueur non trouvé pour socket.id: ${socket.id}`);
      console.log(`📋 Joueurs disponibles:`, Array.from(players.values()).map(p => ({ name: p.name, id: p.id })));
    }
  });

  // Reset du buzzer
  socket.on('resetBuzzer', () => {
    buzzedPlayer = null;
    // Reset tous les joueurs
    players.forEach((player) => {
      player.buzzed = false;
      players.set(player.name, player);
    });
    
    console.log(`Buzzer reset`);
    io.emit('buzzerReset');
    const playersList = Array.from(players.values());
    io.emit('playersUpdate', playersList);
    console.log(`📡 Liste des joueurs envoyée après reset:`, playersList.map(p => ({ name: p.name, buzzed: p.buzzed })));
  });

  // Gestion de l'état des buzzers
  socket.on('buzzersStateChanged', (data) => {
    console.log(`🔔 État des buzzers changé: ${data.enabled ? 'activés' : 'désactivés'}`);
    buzzersEnabled = data.enabled; // Mettre à jour l'état global
    console.log(`📡 Diffusion de l'état des buzzers à tous les clients...`);
    // Diffuser l'état des buzzers à tous les clients
    io.emit('buzzersStateChanged', { enabled: data.enabled });
    console.log(`✅ État des buzzers diffusé avec succès`);
  });



  // Gérer la déconnexion
  socket.on('disconnect', () => {
    console.log(`🔌 Déconnexion détectée pour socket: ${socket.id}`);
    
    // Trouver le joueur par socket.id
    const player = Array.from(players.values()).find(p => p.id === socket.id);
    if (player) {
      console.log(`👋 ${player.name} a quitté le jeu`);
      
      // Si le joueur qui a buzzé se déconnecte, ne pas reset (il peut se reconnecter)
      if (buzzedPlayer && buzzedPlayer.id === socket.id) {
        console.log(`⚠️ Le joueur qui a buzzé (${buzzedPlayer.name}) s'est déconnecté - état préservé`);
        // Ne pas supprimer le joueur de la liste s'il a buzzé
        return;
      }
      
      // Supprimer le joueur de la liste
      players.delete(player.name);
      console.log(`📋 Liste des joueurs après suppression:`, Array.from(players.values()).map(p => p.name));
      
      // Mettre à jour la liste des joueurs
      const playersList = Array.from(players.values());
      io.emit('playersUpdate', playersList);
      console.log(`📡 Liste des joueurs envoyée après déconnexion:`, playersList.map(p => ({ name: p.name, buzzed: p.buzzed })));
    } else {
      console.log(`⚠️ Aucun joueur trouvé avec l'ID socket: ${socket.id}`);
    }
    
    console.log(`📊 Total utilisateurs connectés: ${io.engine.clientsCount}`);
  });
});

// Initialiser la base de données et démarrer le serveur
async function startServer() {
  try {
    // Créer la base de données si elle n'existe pas
    const dbCreated = await createDatabase();
    if (!dbCreated) {
      console.error('❌ Impossible de créer la base de données');
      process.exit(1);
    }

    // Tester la connexion à la base de données
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Impossible de se connecter à la base de données');
      process.exit(1);
    }

    // Créer toutes les tables si elles n'existent pas
    const usersTableCreated = await createUsersTable();
    if (!usersTableCreated) {
      console.error('❌ Impossible de créer la table users');
      process.exit(1);
    }

    const teamsTableCreated = await createTeamsTable();
    if (!teamsTableCreated) {
      console.error('❌ Impossible de créer la table teams');
      process.exit(1);
    }

    const gameTableCreated = await createGameTable();
    if (!gameTableCreated) {
      console.error('❌ Impossible de créer la table game');
      process.exit(1);
    }

    const scoresTableCreated = await createScoresTable();
    if (!scoresTableCreated) {
      console.error('❌ Impossible de créer la table scores');
      process.exit(1);
    }

    // Démarrer le serveur
    server.listen(PORT, () => {
      console.log(`Serveur DEV BATTLE ARENA démarré sur le port ${PORT}`);
      console.log(`URL: http://localhost:${PORT}`);
      console.log(`Environnement: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Système DEV BATTLE ARENA prêt !`);
    });
  } catch (error) {
    console.error('❌ Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
