import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import io from "socket.io-client";
import useAutoLogout from "../hooks/useAutoLogout";
import AutoLogoutWarning from "../components/AutoLogoutWarning";
import "./GamePage.css";

const socket = io("http://localhost:3000");

function GamePage() {
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [players, setPlayers] = useState([]);
  const [buzzedPlayer, setBuzzedPlayer] = useState(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Hook de déconnexion automatique (30 minutes d'inactivité, avertissement à 25 minutes)
  const { showWarning, warningCountdown, handleStayConnected, handleLogoutNow } = useAutoLogout(30, 5);

  useEffect(() => {
    // Vérifier l'authentification au chargement
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    const gameState = localStorage.getItem('gameState');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setIsAuthenticated(true);
        
        // Restaurer l'état du jeu si l'utilisateur était en jeu
        if (gameState) {
          const parsedGameState = JSON.parse(gameState);
          if (parsedGameState.hasJoined) {
            setHasJoined(true);
          }
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
      console.log("✅ Connecté au serveur");
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      console.log("❌ Déconnecté du serveur");
    });

    // Gestion des joueurs en ligne
    socket.on("playersUpdate", (playersList) => {
      setPlayers(playersList);
    });

    // Gestion du buzzer
    socket.on("playerBuzzed", (player) => {
      setBuzzedPlayer(player);
    });

    // Reset du buzzer
    socket.on("buzzerReset", () => {
      setBuzzedPlayer(null);
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

  const joinGame = () => {
    if (isAuthenticated && user && isConnected) {
      socket.emit("joinGame", user.username);
      setHasJoined(true);
      
      // Sauvegarder l'état du jeu
      localStorage.setItem('gameState', JSON.stringify({
        hasJoined: true,
        username: user.username
      }));
    }
  };

  const buzz = () => {
    if (isConnected && hasJoined) {
      socket.emit("buzz");
    }
  };

  const resetBuzzer = () => {
    if (isConnected) {
      socket.emit("resetBuzzer");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('gameState');
    setUser(null);
    setIsAuthenticated(false);
    setHasJoined(false);
    setBuzzedPlayer(null);
    setPlayers([]);
    navigate('/');
  };

  const returnToHome = () => {
    setHasJoined(false);
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
      <div className="buzzer-container">
        <div className="buzzer-header">
        <h1>🎯 DEV BATTLE ARENA</h1>
        <div className="header-controls">
          <button onClick={returnToHome} className="home-button">
            🏠 Accueil
          </button>
          {isAuthenticated && user && (
            <div className="user-info">
              <span className="user-name">👤 {user.username}</span>
              <button onClick={handleLogout} className="logout-button">
                🚪 Déconnexion
              </button>
            </div>
          )}
          <div className="connection-status">
            <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '🟢 Connecté' : '🔴 Déconnecté'}
            </span>
          </div>
        </div>
      </div>

      {!hasJoined ? (
        <div className="join-section">
          <h2>Rejoindre la partie</h2>
          {isAuthenticated && user ? (
            <div className="join-form">
              <p className="welcome-message">
                Bienvenue, <strong>{user.username}</strong> !
              </p>
              <button 
                onClick={joinGame}
                disabled={!isConnected}
                className="join-button"
              >
                🎮 Rejoindre la partie
              </button>
            </div>
          ) : (
            <div className="auth-required">
              <p>Vous devez être connecté pour rejoindre la partie.</p>
              <button onClick={returnToHome} className="auth-button">
                🔐 Se connecter
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="game-section">
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
                <button onClick={resetBuzzer} className="reset-button">
                  🔄 Reset
                </button>
              </div>
            )}
          </div>

          <div className="players-section">
            <h2>Joueurs en ligne ({players.length})</h2>
            <div className="players-list">
              {players.map((player) => (
                <div 
                  key={player.id} 
                  className={`player-item ${player.buzzed ? 'buzzed' : ''}`}
                >
                  <span className="player-name">{player.name}</span>
                  {player.buzzed && <span className="buzzed-indicator">🔔</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

export default GamePage;
