import React, { useEffect, useState } from 'react';
import './Menu.css';

interface MenuProps {
  isOpen: boolean;
  onExit: () => void;
}

const Menu: React.FC<MenuProps> = ({ isOpen, onExit }) => {
  // Состояние размера (маленький по умолчанию)
  const [uiSize, setUiSize] = useState<'small' | 'large'>('small');

  // При изменении uiSize обновляем атрибут у body
  useEffect(() => {
    document.body.dataset.gameUiSize = uiSize;
  }, [uiSize]);

  if (!isOpen) return null;

  return (
    <div className="menu-dropdown">
      <div className="menu-content">
        {/* <p className="menu-title"></p> */}

        <div className="menu-section">
          <p className="section-title">РАЗМЕР ИНТЕРФЕЙСА</p>

          <div className="size-toggle-buttons">
            <button 
              className={uiSize === 'small' ? 'active' : ''} 
              onClick={() => setUiSize('small')}
            >
              МАЛЕНЬКИЙ
            </button>


            <button 
              className={uiSize === 'large' ? 'active' : ''} 
              onClick={() => setUiSize('large')}
            >
              БОЛЬШОЙ
            </button>


            
          </div>
        </div>

        <button className="btn-exit-lobby" onClick={onExit}>
          ВЫХОД
        </button>
      </div>
    </div>
  );
};

export default Menu;