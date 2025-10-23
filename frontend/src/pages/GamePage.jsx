import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import io from "socket.io-client";
import useAutoLogout from "../hooks/useAutoLogout";
import AutoLogoutWarning from "../components/AutoLogoutWarning";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "./GamePage.css";

const socket = io("http://localhost:3000");

function GamePage() {
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
        
        // L'utilisateur est automatiquement dans la partie
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
      console.log("✅ Connecté au serveur");
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      console.log("❌ Déconnecté du serveur");
    });

    // Gestion des joueurs en ligne
    socket.on("playersUpdate", (playersList) => {
      console.log("📋 Liste des joueurs reçue:", playersList);
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
      console.log("🔔 État du buzzer reçu:", player);
    });

    // Reset du buzzer
    socket.on("buzzerReset", () => {
      setBuzzedPlayer(null);
      localStorage.removeItem('buzzedPlayer');
      console.log("🔄 Buzzer reset reçu");
    });


    // Nettoyage
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("playersUpdate");
      socket.off("playerBuzzed");
      socket.off("buzzerReset");
    };
  }, [navigate]);

  // Rejoindre automatiquement quand l'utilisateur est défini et connecté
  useEffect(() => {
    if (isAuthenticated && user && isConnected && !hasJoinedGame) {
      // Petit délai pour s'assurer que la connexion est stable
      setTimeout(() => {
        if (user.role === 'admin') {
          // Les admins se connectent au serveur mais ne rejoignent pas le jeu
          socket.emit('joinGame', user.username, true);
          setHasJoinedGame(true);
          console.log("👑 Admin connecté au serveur (mode surveillance)");
        } else {
          // Les joueurs normaux rejoignent le jeu
          socket.emit('joinGame', user.username, false);
          setHasJoinedGame(true);
          console.log("🎮 Rejoint automatiquement la partie");
        }
      }, 200);
    }
  }, [isAuthenticated, user, isConnected, hasJoinedGame]);


  // Éviter les reconnexions multiples
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated && user && isConnected) {
        // Ne pas rejoindre automatiquement si on revient sur l'onglet
        console.log("👁️ Onglet visible - pas de reconnexion");
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

  const buzz = () => {
    if (isConnected) {
      console.log("🔔 Tentative de buzzer...");
      socket.emit("buzz");
    } else {
      console.log("❌ Pas connecté au serveur");
    }
  };

  const resetBuzzer = () => {
    if (isConnected) {
      socket.emit("resetBuzzer");
    }
  };

  const handleLogout = () => {
    // Fermer explicitement la connexion Socket.IO
    socket.disconnect();
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('gameState');
    setUser(null);
    setIsAuthenticated(false);
    setBuzzedPlayer(null);
    setPlayers([]);
    
    // Forcer un refresh de la page pour s'assurer que la déconnexion est bien détectée
    window.location.href = '/';
  };

  const returnToHome = () => {
    // Fermer explicitement la connexion Socket.IO
    socket.disconnect();
    
    setBuzzedPlayer(null);
    setPlayers([]);
    // Nettoyer l'état du jeu du localStorage
    localStorage.removeItem('gameState');
    navigate('/');
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
      <div className="game-main-content">

      {isAuthenticated && user ? (
        <div className="game-section">
          {user.role === 'admin' ? (
            <div className="admin-section">
              <h2>👑 Mode Administrateur</h2>
              <p className="admin-info">Vous êtes en mode administrateur. Vous ne participez pas au jeu mais pouvez gérer le buzzer.</p>
              {buzzedPlayer && (
                <div className="buzzed-info">
                  <p className="buzzed-player">
                    🎉 {buzzedPlayer.name} a buzzé !
                  </p>
                  <button onClick={resetBuzzer} className="reset-button admin-reset">
                    🔄 Reset Buzzer
                  </button>
                </div>
              )}
              {!buzzedPlayer && (
                <div className="waiting-info">
                  <p>⏳ En attente qu'un joueur buzz...</p>
                </div>
              )}
            </div>
          ) : (
            <div className="buzzer-section">
              <h2>Votre Buzzer</h2>
              <button 
                onClick={buzz}
                disabled={!isConnected || buzzedPlayer}
                className={`buzzer-button ${buzzedPlayer ? 'disabled' : ''}`}
              >
                🔔 BUZZER
              </button>
              {buzzedPlayer && (
                <div className="buzzed-info">
                  <p className="buzzed-player">
                    🎉 {buzzedPlayer.name} a buzzé !
                  </p>
                  {user.role === 'admin' && (
                    <button onClick={resetBuzzer} className="reset-button">
                      🔄 Reset
                    </button>
                  )}
                </div>
              )}
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
          <p>Vous devez être connecté pour accéder au jeu.</p>
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

export default GamePage;
