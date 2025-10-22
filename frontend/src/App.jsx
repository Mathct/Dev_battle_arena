import { useEffect, useState } from "react";
import io from "socket.io-client";
import HomePage from "./HomePage";
import "./App.css";

const socket = io("http://localhost:3000"); // URL du backend

function App() {
  const [showHomePage, setShowHomePage] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [players, setPlayers] = useState([]);
  const [buzzedPlayer, setBuzzedPlayer] = useState(null);
  const [hasJoined, setHasJoined] = useState(false);

  useEffect(() => {
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
  }, []);

  const joinGame = () => {
    if (playerName.trim() && isConnected) {
      socket.emit("joinGame", playerName.trim());
      setHasJoined(true);
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

  const enterApp = () => {
    setShowHomePage(false);
  };

  const returnToHome = () => {
    setShowHomePage(true);
    setHasJoined(false);
    setPlayerName("");
    setBuzzedPlayer(null);
    setPlayers([]);
  };

  if (showHomePage) {
    return <HomePage onEnterApp={enterApp} />;
  }

  return (
    <div className="buzzer-container">
      <div className="buzzer-header">
        <h1>🎯 DEV BATTLE ARENA</h1>
        <div className="header-controls">
          <button onClick={returnToHome} className="home-button">
            🏠 Accueil
          </button>
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
          <div className="join-form">
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Entrez votre nom..."
              className="player-name-input"
              onKeyPress={(e) => e.key === 'Enter' && joinGame()}
              disabled={!isConnected}
            />
            <button 
              onClick={joinGame}
              disabled={!playerName.trim() || !isConnected}
              className="join-button"
            >
              🎮 Rejoindre
            </button>
          </div>
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
  );
}

export default App;