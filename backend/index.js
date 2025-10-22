// Fichier principal du serveur backend
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const http = require('http');
const { createDatabase, testConnection, createUsersTable } = require('./config/database');

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

// Stockage des joueurs connectés (clé = nom d'utilisateur)
const players = new Map();
let buzzedPlayer = null;

// Gestion des connexions Socket.IO
io.on('connection', (socket) => {
  console.log(`Utilisateur connecté: ${socket.id}`);
  console.log(`Total utilisateurs connectés: ${io.engine.clientsCount}`);
  
  // Rejoindre le jeu
  socket.on('joinGame', (playerName) => {
    // Utiliser le nom d'utilisateur comme clé unique
    const player = {
      id: socket.id,
      name: playerName,
      buzzed: false
    };
    
    if (players.has(playerName)) {
      console.log(`🔄 ${playerName} s'est reconnecté (remplacement)`);
    } else {
      console.log(`🎮 ${playerName} a rejoint le jeu`);
    }
    
    players.set(playerName, player);
    
    // Notifier tous les clients de la mise à jour des joueurs
    io.emit('playersUpdate', Array.from(players.values()));
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
      io.emit('playersUpdate', Array.from(players.values()));
    } else if (player && player.buzzed) {
      console.log(`${player.name} a déjà buzzé dans cette manche`);
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
    io.emit('playersUpdate', Array.from(players.values()));
  });

  // Gérer la déconnexion
  socket.on('disconnect', () => {
    // Trouver le joueur par socket.id
    const player = Array.from(players.values()).find(p => p.id === socket.id);
    if (player) {
      console.log(`${player.name} a quitté le jeu`);
      players.delete(player.name);
      
      // Si le joueur qui a buzzé se déconnecte, reset
      if (buzzedPlayer && buzzedPlayer.id === socket.id) {
        buzzedPlayer = null;
        io.emit('buzzerReset');
      }
      
      // Mettre à jour la liste des joueurs
      io.emit('playersUpdate', Array.from(players.values()));
    }
    
    console.log(`Total utilisateurs connectés: ${io.engine.clientsCount}`);
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

    // Créer la table users si elle n'existe pas
    const tableCreated = await createUsersTable();
    if (!tableCreated) {
      console.error('❌ Impossible de créer la table users');
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
