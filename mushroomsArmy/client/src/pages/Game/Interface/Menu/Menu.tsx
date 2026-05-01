import React from 'react';
import './Menu.css';

interface MenuProps {
  isOpen: boolean;
  onClose: () => void;
  onExit: () => void;
}

const Menu: React.FC<MenuProps> = ({ isOpen, onClose, onExit }) => {
  if (!isOpen) return null;

  return (
    <div className="menu-dropdown"></div>
  );
};

export default Menu;