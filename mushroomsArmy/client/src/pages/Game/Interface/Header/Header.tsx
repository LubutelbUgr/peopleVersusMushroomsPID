import React, { useState } from 'react';
import './Header.css';
import Menu from '../Menu/Menu'; 

interface HeaderProps {
  username: string;
  onExit: () => void;
}

const Header: React.FC<HeaderProps> = ({ username, onExit }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="game-header">
      <div className="header-left">
        <span className="user-nickname">{username}</span>
      </div>
      
      <div className="header-center">
        <h1 className="game-title">Армия грибов</h1>
      </div>
      
      <div className="header-right">
        {/* Твоя кнопка со стилями из Header.css */}
        <button 
          id="header-menu-btn" 
          className="menu-button" 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          МЕНЮ
        </button>

        {/* Передаем состояние и функцию закрытия внутрь Menu */}
        <Menu 
          isOpen={isMenuOpen} 
          onClose={() => setIsMenuOpen(false)} 
          onExit={onExit} 
        />
      </div>
    </header>
  );
};

export default Header;