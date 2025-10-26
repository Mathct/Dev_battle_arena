import { useNavigate } from "react-router";
import "./Header.css";

function Header({ user, onLogout, onReturnHome, isConnected, buzzerNotification }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      // Fallback si pas de fonction fournie
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('gameState');
      navigate('/');
    }
  };

  const handleReturnHome = () => {
    if (onReturnHome) {
      onReturnHome();
    } else {
      navigate('/');
    }
  };

  return (
    <header className="game-header">
      <div className="header-left">
        <img 
          src="/logo.png" 
          alt="DEV BATTLE ARENA" 
          className="header-logo"
          onClick={handleReturnHome}
        />
      </div>
      
      {/* Notification de buzzer au centre */}
      {buzzerNotification && (
        <div className="buzzer-notification">
          <span className="buzzer-notification-text">
            🔔 {buzzerNotification.name} a buzzé !
          </span>
        </div>
      )}
      
      <div className="header-right">
        <div className="header-controls">
          <div className="connection-status">
            <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '🟢 SERVEUR ACTIF' : '🔴 SERVEUR HORS LIGNE'}
            </span>
          </div>
          
          {user && (
            <div className="user-section">
              <span className="user-name">{user.username}</span>
              <button onClick={handleLogout} className="header-btn logout-btn">
                DÉCONNEXION
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
