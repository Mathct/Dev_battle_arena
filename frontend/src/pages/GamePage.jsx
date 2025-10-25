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


    // Nettoyage
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("playerBuzzed");
      socket.off("buzzerReset");
    };
  }, [navigate]);

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
    if (isConnected) {
      console.log("🔔 Tentative de buzzer...");
      socket.emit("buzz");
    } else {
      console.log("❌ Pas connecté au serveur");
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
      />
      <div className="game-main-content">

      {isAuthenticated && user ? (
        <>

        <div className="waiting-info">
                <h2>⏳ En attente de lancement de la partie ...</h2>
       </div>
        

          <h2 className="buzzer-title">Votre Buzzer</h2>
          <button 
            onClick={buzz}
            disabled={!isConnected || buzzedPlayer}
            className={`buzzer-button ${buzzedPlayer ? 'disabled' : ''}`}
          >
            BUZZER
          </button>
          {buzzedPlayer && (
            <div className="buzzed-info">
              <p className="buzzed-player">
              🔔 {buzzedPlayer.name} a buzzé !
              </p>
            </div>
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
