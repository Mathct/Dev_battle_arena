import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import io from "socket.io-client";
import useAutoLogout from "../hooks/useAutoLogout";
import AutoLogoutWarning from "../components/AutoLogoutWarning";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "./AdminPage.css";

const socket = io("http://localhost:3000");

function AdminPage() {
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [players, setPlayers] = useState([]);
  const [buzzedPlayer, setBuzzedPlayer] = useState(() => {
    // Récupérer l'état du buzzer depuis le localStorage au chargement
    const savedBuzzedPlayer = localStorage.getItem('buzzedPlayer');
    return savedBuzzedPlayer ? JSON.parse(savedBuzzedPlayer) : null;
  });
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasJoinedGame, setHasJoinedGame] = useState(false);
  const [gameState, setGameState] = useState(0);
  
  // Hook de déconnexion automatique (30 minutes d'inactivité, avertissement à 25 minutes)
  const { showWarning, warningCountdown, handleStayConnected, handleLogoutNow } = useAutoLogout(30, 5);

  useEffect(() => {
    // Vérifier l'authentification au chargement
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setIsAuthenticated(true);
        
        // Vérifier que l'utilisateur est bien un admin
        if (parsedUser.role !== 'admin') {
          console.log("❌ Accès refusé - rôle non admin");
          navigate('/game');
          return;
        }
      } catch (error) {
        console.error('Erreur lors du parsing des données utilisateur:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('gameState');
        navigate('/');
      }
    } else {
      // Rediriger vers la page d'accueil si pas connecté
      navigate('/');
    }

    // Vérifier l'état initial de la connexion
    setIsConnected(socket.connected);
    
    // Gestion de la connexion
    socket.on("connect", () => {
      setIsConnected(true);
      console.log("✅ Connecté au serveur (Admin)");
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      console.log("❌ Déconnecté du serveur (Admin)");
    });

    // Gestion des joueurs en ligne
    socket.on("playersUpdate", (playersList) => {
      console.log("📋 Liste des joueurs reçue (Admin):", playersList);
      setPlayers(playersList);
      
      // Vérifier si un joueur a buzzé dans la liste
      const buzzedPlayerInList = playersList.find(player => player.buzzed);
      if (buzzedPlayerInList) {
        console.log("🔔 Joueur buzzé détecté dans la liste des joueurs:", buzzedPlayerInList);
        setBuzzedPlayer(buzzedPlayerInList);
        localStorage.setItem('buzzedPlayer', JSON.stringify(buzzedPlayerInList));
      }
    });

    // Gestion du buzzer
    socket.on("playerBuzzed", (player) => {
      setBuzzedPlayer(player);
      localStorage.setItem('buzzedPlayer', JSON.stringify(player));
      console.log("🔔 État du buzzer reçu (Admin):", player);
    });

    // Reset du buzzer
    socket.on("buzzerReset", () => {
      setBuzzedPlayer(null);
      localStorage.removeItem('buzzedPlayer');
      console.log("🔄 Buzzer reset reçu (Admin)");
    });

    // Écouter les changements d'état du jeu
    socket.on("gameStateChanged", (data) => {
      setGameState(data.gameState);
      console.log("🎮 État du jeu changé (Admin):", data.gameState);
    });

    // Nettoyage
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("playersUpdate");
      socket.off("playerBuzzed");
      socket.off("buzzerReset");
      socket.off("gameStateChanged");
    };
  }, [navigate]);

  // Charger l'état du jeu au démarrage
  useEffect(() => {
    const loadGameState = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/game/state');
        if (response.ok) {
          const data = await response.json();
          setGameState(data.gameState);
        }
      } catch (error) {
        console.error('Erreur lors du chargement de l\'état du jeu:', error);
      }
    };
    
    loadGameState();
  }, []);

  // Rejoindre automatiquement en mode admin quand l'utilisateur est défini et connecté
  useEffect(() => {
    if (isAuthenticated && user && isConnected && !hasJoinedGame) {
      // Petit délai pour s'assurer que la connexion est stable
      setTimeout(() => {
        // Les admins se connectent au serveur mais ne rejoignent pas le jeu
        socket.emit('joinGame', user.username, true);
        setHasJoinedGame(true);
        console.log("👑 Admin connecté au serveur (mode surveillance)");
      }, 200);
    }
  }, [isAuthenticated, user, isConnected, hasJoinedGame]);

  // Éviter les reconnexions multiples
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated && user && isConnected) {
        // Ne pas rejoindre automatiquement si on revient sur l'onglet
        console.log("👁️ Onglet visible - pas de reconnexion (Admin)");
      }
    };

    const handleBeforeUnload = () => {
      // Fermer la connexion Socket.IO quand l'utilisateur quitte la page
      socket.disconnect();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isAuthenticated, user, isConnected]);

  const resetBuzzer = () => {
    if (isConnected) {
      console.log("🔄 Reset du buzzer par l'admin");
      socket.emit("resetBuzzer");
    } else {
      console.log("❌ Pas connecté au serveur");
    }
  };

  const startGame = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/game/state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ gameState: 1 })
      });

      if (response.ok) {
        console.log("🎮 Partie démarrée par l'admin");
      } else {
        alert('Erreur lors du démarrage de la partie');
      }
    } catch (error) {
      console.error('Erreur lors du démarrage de la partie:', error);
      alert('Erreur lors du démarrage de la partie');
    }
  };

  const stopGame = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/game/state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ gameState: 0 })
      });

      if (response.ok) {
        console.log("🛑 Partie arrêtée par l'admin");
      } else {
        alert('Erreur lors de l\'arrêt de la partie');
      }
    } catch (error) {
      console.error('Erreur lors de l\'arrêt de la partie:', error);
      alert('Erreur lors de l\'arrêt de la partie');
    }
  };

  const handleLogout = () => {
    // Fermer explicitement la connexion Socket.IO
    socket.disconnect();
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('gameState');
    localStorage.removeItem('buzzedPlayer');
    setUser(null);
    setIsAuthenticated(false);
    setBuzzedPlayer(null);
    setPlayers([]);
    
    // Forcer un refresh de la page pour s'assurer que la déconnexion est bien détectée
    window.location.href = '/';
  };

  const returnToHome = () => {
    // Ne pas fermer la connexion Socket.IO, juste naviguer
    setBuzzedPlayer(null);
    setPlayers([]);
    // Nettoyer l'état du jeu du localStorage
    localStorage.removeItem('gameState');
    navigate('/');
  };

  const goToTeams = () => {
    navigate('/teams');
  };


  return (
    <>
      <AutoLogoutWarning
        isVisible={showWarning}
        onConfirm={handleLogoutNow}
        onCancel={handleStayConnected}
        remainingTime={warningCountdown}
      />
      <Header 
        user={user}
        onLogout={handleLogout}
        onReturnHome={returnToHome}
        isConnected={isConnected}
      />
      <div className="admin-main-content">
        {isAuthenticated && user ? (
          <div className="admin-section">
            <div className="admin-controls">
              <button onClick={goToTeams} className="teams-btn">
                👥 Gestion des Équipes
              </button>
            </div>

            <div className="game-controls">
              <h2>Contrôle de la Partie</h2>
              <div className="game-state-info">
                <p>État actuel: <span className={`state-indicator ${gameState === 1 ? 'active' : 'waiting'}`}>
                  {gameState === 1 ? '🎮 Partie en cours' : '⏳ En attente'}
                </span></p>
              </div>
              <div className="game-buttons">
                {gameState === 0 ? (
                  <button onClick={startGame} className="start-game-btn">
                    🚀 Démarrer la Partie
                  </button>
                ) : (
                  <button onClick={stopGame} className="stop-game-btn">
                    🛑 Arrêter la Partie
                  </button>
                )}
              </div>
            </div>

            {buzzedPlayer && (
              <div className="buzzed-info">
                <h2>🎉 Joueur qui a buzzé</h2>
                <div className="buzzed-player-card">
                  <span className="buzzed-player-name">{buzzedPlayer.name}</span>
                  <button onClick={resetBuzzer} className="reset-button admin-reset">
                    🔄 Reset Buzzer
                  </button>
                </div>
              </div>
            )}

            {!buzzedPlayer && (
              <div className="waiting-info">
                <h2>⏳ En attente</h2>
                <p>Aucun joueur n'a encore buzzé...</p>
              </div>
            )}

            <div className="players-section">
              <h2>Joueurs en ligne ({players.length})</h2>
              <div className="players-list">
                {players
                  .filter(player => 
                    player && 
                    player.name && 
                    typeof player.name === 'string' && 
                    player.name.trim() !== '' &&
                    player.name.trim().length > 0
                  )
                  .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
                  .map((player) => (
                  <div 
                    key={player.id || player.name} 
                    className={`player-item ${player.buzzed ? 'buzzed' : ''}`}
                  >
                    <span className="player-name">{player.name}</span>
                    {player.buzzed && <span className="buzzed-indicator">🔔</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="auth-required">
            <p>Vous devez être connecté en tant qu'administrateur pour accéder à cette page.</p>
            <button onClick={returnToHome} className="auth-button">
              🔐 Se connecter
            </button>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}

export default AdminPage;
