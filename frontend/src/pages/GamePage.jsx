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
  const [buzzedPlayer, setBuzzedPlayer] = useState(() => {
    // Récupérer l'état du buzzer depuis le localStorage au chargement
    const savedBuzzedPlayer = localStorage.getItem('buzzedPlayer');
    return savedBuzzedPlayer ? JSON.parse(savedBuzzedPlayer) : null;
  });
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasJoinedGame, setHasJoinedGame] = useState(false);
  const [gameState, setGameState] = useState(0);
  const [buzzersEnabled, setBuzzersEnabled] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
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
        
        // Rediriger les admins vers la page admin
        if (parsedUser.role === 'admin') {
          console.log("👑 Redirection vers la page admin");
          navigate('/admin');
          return;
        }
        
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

    // Écouter les changements d'état du jeu
    socket.on("gameStateChanged", (data) => {
      setGameState(data.gameState);
      console.log("🎮 État du jeu changé:", data.gameState);
    });

    // Écouter les changements d'état des buzzers
    socket.on("buzzersStateChanged", (data) => {
      console.log("🔔 Événement buzzersStateChanged reçu:", data);
      setBuzzersEnabled(data.enabled);
      console.log("🔔 État des buzzers changé:", data.enabled);
    });

    // Écouter le chrono depuis l'admin
    socket.on("countdownUpdate", (data) => {
      console.log("⏱️ Chrono reçu:", data.countdown);
      console.log("⏱️ Mise à jour du countdown state:", data.countdown);
      setCountdown(data.countdown);
    });


    // Nettoyage
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("playerBuzzed");
      socket.off("buzzerReset");
      socket.off("gameStateChanged");
      socket.off("buzzersStateChanged");
      socket.off("countdownUpdate");
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

  // Gestion du compte à rebours
  useEffect(() => {
    let interval;
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 0.01) {
            return 0;
          }
          return prev - 0.01;
        });
      }, 10); // Mise à jour toutes les 10ms pour les centièmes
    }
    return () => clearInterval(interval);
  }, [countdown]);

  // Rejoindre automatiquement quand l'utilisateur est défini et connecté
  useEffect(() => {
    if (isAuthenticated && user && isConnected && !hasJoinedGame) {
      // Petit délai pour s'assurer que la connexion est stable
      setTimeout(() => {
        // Les joueurs normaux rejoignent le jeu
        socket.emit('joinGame', user.username, false);
        setHasJoinedGame(true);
        console.log("🎮 Rejoint automatiquement la partie");
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
    if (!isConnected) {
      console.log("❌ Pas connecté au serveur");
      return;
    }
    
    if (!buzzersEnabled) {
      console.log("❌ Les buzzers ne sont pas activés");
      return;
    }
    
    console.log("🔔 Tentative de buzzer...");
    socket.emit("buzz");
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
    
    // Forcer un refresh de la page pour s'assurer que la déconnexion est bien détectée
    window.location.href = '/';
  };

  const returnToHome = () => {
    // Ne pas fermer la connexion Socket.IO, juste naviguer
    setBuzzedPlayer(null);
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
        buzzerNotification={buzzedPlayer}
        countdown={countdown}
      />
      <div className="game-main-content">

      {isAuthenticated && user ? (
        <>
          {gameState === 0 ? (
            <div className="waiting-info">
              <h2>⏳ En attente du lancement de la partie ...</h2>
            </div>
          ) : (
            <>
              <h2 className="buzzer-title">Votre Buzzer</h2>
              <button 
                onClick={buzz}
                disabled={!isConnected || buzzedPlayer || !buzzersEnabled}
                className={`buzzer-button ${buzzedPlayer || !buzzersEnabled ? 'disabled' : ''}`}
              >
                {!buzzersEnabled ? 'BUZZER DÉSACTIVÉ' : 'BUZZER'}
              </button>
            </>
          )}
        </>
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
