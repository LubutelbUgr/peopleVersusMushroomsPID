import React, { useEffect, useRef, useState } from 'react';
import './Menu.css';

type MenuProps = {
  onExit: () => void;
};

const Menu: React.FC<MenuProps> = ({ onExit }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [uiSize, setUiSize] = useState<'small' | 'large'>('small');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    document.body.dataset.gameUiSize = uiSize;

    return () => {
      delete document.body.dataset.gameUiSize;
    };
  }, [uiSize]);

  return (
    <div className="menu-wrapper" ref={menuRef}>
      <button
        className="menu-trigger"
        onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
        type="button"
      >
        меню
      </button>

      <div className={`menu-dropdown ${isMenuOpen ? 'show' : ''}`}>
        <div className="menu-inner">
          <p className="menu-title">меню</p>

          <div className="menu-section">
            <span>размер интерфейса</span>
            <div className="size-buttons">
              <button onClick={() => setUiSize('small')} type="button">
                маленький
              </button>
              <button onClick={() => setUiSize('large')} type="button">
                большой
              </button>
            </div>
          </div>

          <button className="btn-exit" onClick={onExit} type="button">
            выход
          </button>
        </div>
      </div>
    </div>
  );
};

export default Menu;
