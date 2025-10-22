import { useState } from "react";
import "./HomePage.css";

function HomePage({ onEnterApp }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="homepage-container">
      {/* Bouton d'entrée */}
      <div className="enter-section">
        <button 
          className={`enter-button ${isHovered ? 'hovered' : ''}`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={onEnterApp}
        >
          <span className="button-text">ENTRER DANS L'ARÈNE</span>
        </button>
      </div>
    </div>
  );
}

export default HomePage;
