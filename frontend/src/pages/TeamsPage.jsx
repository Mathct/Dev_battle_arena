import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import useAutoLogout from "../hooks/useAutoLogout";
import AutoLogoutWarning from "../components/AutoLogoutWarning";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "./TeamsPage.css";

function TeamsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
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
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('gameState');
    setUser(null);
    setIsAuthenticated(false);
    
    // Forcer un refresh de la page pour s'assurer que la déconnexion est bien détectée
    window.location.href = '/';
  };

  const returnToHome = () => {
    navigate('/');
  };

  const goToAdmin = () => {
    navigate('/admin');
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
        isConnected={true}
      />
      <div className="teams-main-content">
        {isAuthenticated && user ? (
          <div className="teams-section">
            <div className="teams-header">
              <h1>Gestion des Équipes</h1>
            </div>

            <div className="teams-controls">
              <button onClick={goToAdmin} className="teams-btn admin-btn">
                Retour à l'Admin
              </button>
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

export default TeamsPage;
