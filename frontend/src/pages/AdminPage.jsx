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
  const [teams, setTeams] = useState({ team1: [], team2: [] });
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [buzzersEnabled, setBuzzersEnabled] = useState(false);
  
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
        
        // Charger les équipes et les scores
        fetchTeams(token);
        fetchScores(token);
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

    // Écouter les changements d'état des buzzers
    socket.on("buzzersStateChanged", (data) => {
      setBuzzersEnabled(data.enabled);
      console.log("🔔 État des buzzers reçu (Admin):", data.enabled);
    });

    // Nettoyage
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("playersUpdate");
      socket.off("playerBuzzed");
      socket.off("buzzerReset");
      socket.off("gameStateChanged");
      socket.off("buzzersStateChanged");
    };
  }, [navigate]);

  // Charger l'état du jeu et des buzzers au démarrage
  useEffect(() => {
    const loadGameState = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/game/state');
        if (response.ok) {
          const data = await response.json();
          setGameState(data.gameState);
          setBuzzersEnabled(data.buzzersEnabled || false);
          console.log("🎮 État du jeu chargé:", data.gameState, "Buzzers:", data.buzzersEnabled);
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
      
      // Désactiver les buzzers après reset
      setBuzzersEnabled(false);
      if (socket && socket.connected) {
        socket.emit('buzzersStateChanged', { enabled: false });
        console.log("🔔 Buzzers désactivés après reset");
      }
    } else {
      console.log("❌ Pas connecté au serveur");
    }
  };

  const startGame = async () => {
    // Vérifier si les équipes sont vides
    if (teams.team1.length === 0 && teams.team2.length === 0) {
      alert('❌ Impossible de démarrer la partie : Aucune équipe n\'est assignée. Veuillez d\'abord assigner des joueurs aux équipes.');
      return;
    }

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
        setGameState(1);
        setBuzzersEnabled(false); // Désactiver les buzzers au démarrage
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
        setGameState(0);
        setBuzzersEnabled(false); // Désactiver les buzzers à l'arrêt
        
        // Notifier tous les joueurs que les buzzers sont désactivés
        if (socket && socket.connected) {
          socket.emit('buzzersStateChanged', { enabled: false });
          console.log("🔔 Buzzers désactivés envoyés à tous les joueurs");
        }
        
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

  // Fonction pour récupérer les équipes assignées
  const fetchTeams = async (token) => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/teams', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setTeams(data.teams);
        console.log('✅ Équipes chargées dans AdminPage:', data.teams);
      } else {
        console.error('❌ Erreur lors du chargement des équipes:', data.message);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la requête des équipes:', error);
    }
  };

  // Fonction pour récupérer les scores des équipes
  const fetchScores = async (token) => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/scores', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setScores(data.scores);
        console.log('✅ Scores chargés dans AdminPage:', data.scores);
      } else {
        console.error('❌ Erreur lors du chargement des scores:', data.message);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la requête des scores:', error);
    }
  };

  // Fonction pour mettre à jour le score d'une équipe
  const updateScore = async (teamName, newScore) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`http://localhost:3000/api/auth/scores/${teamName}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ score: newScore })
      });

      const data = await response.json();

      if (data.success) {
        setScores(prev => ({
          ...prev,
          [teamName]: newScore
        }));
        console.log('✅ Score mis à jour:', data.message);
      } else {
        console.error('❌ Erreur lors de la mise à jour du score:', data.message);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la requête de mise à jour:', error);
    }
  };

  // Fonction pour réinitialiser tous les scores
  const resetScores = async () => {
    const confirmed = window.confirm('Êtes-vous sûr de vouloir réinitialiser tous les scores à 0 ?');
    if (!confirmed) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      // Mettre à jour les scores des deux équipes à 0
      await updateScore('team1', 0);
      await updateScore('team2', 0);
      
      console.log('✅ Tous les scores ont été réinitialisés à 0');
    } catch (error) {
      console.error('❌ Erreur lors de la réinitialisation des scores:', error);
      alert('Erreur lors de la réinitialisation des scores');
    }
  };

  const validateResponse = async () => {
    if (!buzzedPlayer) return;

    // Trouver l'équipe du joueur qui a buzzé
    let playerTeam = null;
    if (teams.team1.find(player => player.username === buzzedPlayer.name)) {
      playerTeam = 'team1';
    } else if (teams.team2.find(player => player.username === buzzedPlayer.name)) {
      playerTeam = 'team2';
    }

    if (!playerTeam) {
      console.error('❌ Impossible de trouver l\'équipe du joueur');
      return;
    }

    // Incrémenter le score de l'équipe
    const newScore = scores[playerTeam] + 1;
    await updateScore(playerTeam, newScore);

    // Reset du buzzer après validation
    resetBuzzer();
    
    console.log(`✅ Réponse validée ! ${buzzedPlayer.name} (${playerTeam}) gagne 1 point`);
  };

  const rejectResponse = () => {
    if (!buzzedPlayer) return;
    
    // Reset du buzzer après refus
    resetBuzzer();
    
    console.log(`❌ Réponse refusée pour ${buzzedPlayer.name}`);
  };

  const toggleBuzzers = () => {
    const newState = !buzzersEnabled;
    setBuzzersEnabled(newState);
    
    // Envoyer l'état des buzzers à tous les clients
    if (socket && socket.connected) {
      socket.emit('buzzersStateChanged', { enabled: newState });
      console.log(`🔔 État des buzzers envoyé: ${newState ? 'activés' : 'désactivés'}`);
    } else {
      console.log('❌ Socket non connecté');
    }
    
    console.log(`🔔 Buzzers ${newState ? 'activés' : 'désactivés'}`);
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
        buzzerControl={{
          enabled: buzzersEnabled,
          onToggle: toggleBuzzers,
          gameState: gameState,
          buzzedPlayer: buzzedPlayer
        }}
      />
      <div className="admin-main-content">
        {isAuthenticated && user ? (
          <div className="admin-section">
            <div className="game-status-container">
              <div className="game-controls">
                <h2>Contrôle de la Partie</h2>
                <div className="game-state-info">
                  <p>État actuel: <span className={`state-indicator ${gameState === 1 ? 'active' : 'waiting'}`}>
                    {gameState === 1 ? '🎮 Partie en cours' : '⏳ En attente'}
                  </span></p>
                </div>
                <div className="game-buttons">
                  {gameState === 0 ? (
                    <button 
                      onClick={startGame} 
                      className={`start-game-btn ${teams.team1.length === 0 && teams.team2.length === 0 ? 'disabled' : ''}`}
                      disabled={teams.team1.length === 0 && teams.team2.length === 0}
                    >
                      {teams.team1.length === 0 && teams.team2.length === 0 ? '❌ Aucune équipe assignée' : '🚀 Démarrer la Partie - Afficher les buzzers'}
                    </button>
                  ) : (
                    <div className="game-controls-active">
                      <button onClick={stopGame} className="stop-game-btn">
                        🛑 Arrêter la Partie
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {buzzedPlayer ? (
                <div className="buzzed-info">
                  <h2>🎉 {buzzedPlayer.name} a buzzé</h2>
                  <div className="buzzed-player-card">
                    <div className="buzzer-actions">
                      <button onClick={validateResponse} className="validate-response-btn">
                        ✅ Valider réponse
                      </button>
                      <button onClick={rejectResponse} className="reject-response-btn">
                        ❌ Refuser réponse
                      </button>
                    </div>
                    <button onClick={resetBuzzer} className="reset-button admin-reset">
                      🔄 Reset Buzzer
                    </button>
                  </div>
                </div>
              ) : (
                <div className="waiting-info">
                  <h2>⏳ En attente</h2>
                  <p>Aucun joueur n'a encore buzzé...</p>
                </div>
              )}
            </div>

            {/* Section équipes - toujours visible */}
            <div className="teams-display">
              <div className="teams-header">
                <h2>Équipes</h2>
                <div className="teams-actions">
                  <button onClick={goToTeams} className="teams-btn">
                    Gestion des Équipes
                  </button>
                  <button onClick={resetScores} className="reset-scores-btn">
                    Réinitialiser les Scores
                  </button>
                </div>
              </div>
              
              {/* Affichage des équipes si elles existent */}
              {(teams.team1.length > 0 || teams.team2.length > 0) && (
                <div className="teams-container">
                  <div className="team-display team-1">
                    <div className="team-header">
                      <h3>Équipe 1</h3>
                      <div className="score-display">
                        <span className="score-value">{scores.team1}</span>
                        <div className="score-controls">
                          <button 
                            className="score-btn minus"
                            onClick={() => updateScore('team1', Math.max(0, scores.team1 - 1))}
                          >
                            -
                          </button>
                          <button 
                            className="score-btn plus"
                            onClick={() => updateScore('team1', scores.team1 + 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="team-players">
                      {teams.team1.length === 0 ? (
                        <p className="empty-team">Aucun joueur</p>
                      ) : (
                        teams.team1.map((player) => (
                          <div key={player.id} className={`team-player ${buzzedPlayer && buzzedPlayer.name === player.username ? 'buzzed' : ''}`}>
                            {player.username}
                            {buzzedPlayer && buzzedPlayer.name === player.username && (
                              <span className="buzzed-indicator">🔔</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  <div className="team-display team-2">
                    <div className="team-header">
                      <h3>Équipe 2</h3>
                      <div className="score-display">
                        <span className="score-value">{scores.team2}</span>
                        <div className="score-controls">
                          <button 
                            className="score-btn minus"
                            onClick={() => updateScore('team2', Math.max(0, scores.team2 - 1))}
                          >
                            -
                          </button>
                          <button 
                            className="score-btn plus"
                            onClick={() => updateScore('team2', scores.team2 + 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="team-players">
                      {teams.team2.length === 0 ? (
                        <p className="empty-team">Aucun joueur</p>
                      ) : (
                        teams.team2.map((player) => (
                          <div key={player.id} className={`team-player ${buzzedPlayer && buzzedPlayer.name === player.username ? 'buzzed' : ''}`}>
                            {player.username}
                            {buzzedPlayer && buzzedPlayer.name === player.username && (
                              <span className="buzzed-indicator">🔔</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Message si pas d'équipes */}
              {teams.team1.length === 0 && teams.team2.length === 0 && (
                <div className="no-teams-message">
                  <p>Aucune équipe assignée. Cliquez sur "Gestion des Équipes" pour créer les équipes.</p>
                </div>
              )}
            </div>

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
