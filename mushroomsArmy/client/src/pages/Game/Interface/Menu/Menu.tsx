import React, { useState, useRef, useEffect } from 'react';
import './Game.css'; // Общие стили (сетка)
import './Header.css'; // Стили хедера
import './Menu.css'; // Тот самый CSS, что мы обсудили

const Game: React.FC = () => {
    // Состояние: открыто меню или нет
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    // Состояние: размер интерфейса (из макета)
    const [uiSize, setUiSize] = useState<'small' | 'large'>('small');
    
    const menuRef = useRef<HTMLDivElement>(null);

    // Закрываем меню, если кликнули в любое другое место (например, по карте)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={`game-screen ${uiSize}`}>
            {/* HEADER */}
            <header className="game-header">
                <div className="nick">ник</div>
                <div className="title">Армия грибов</div>
                
                {/* Блок меню */}
                <div className="menu-wrapper" ref={menuRef}>
                    <button 
                        className="menu-trigger" 
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        меню
                    </button>

                    {/* Выпадающая панель */}
                    <div className={`menu-dropdown ${isMenuOpen ? 'show' : ''}`}>
                        <div className="menu-inner">
                            <p className="menu-title">меню</p>
                            
                            <div className="menu-section">
                                <span>размер интерфейса</span>
                                <div className="size-buttons">
                                    <button onClick={() => setUiSize('small')}>маленький</button>
                                    <button onClick={() => setUiSize('large')}>большой</button>
                                </div>
                            </div>

                            <button className="btn-exit" onClick={() => console.log('Выход из игры')}>
                                ВЫХОД
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* MAP AREA */}
            <main className="map-area">
                <div className="map-placeholder">только КАРТА</div>
                {/* Здесь будет ваш рендерер или канвас */}
            </main>

            {/* FOOTER */}
            <footer className="game-footer">
                <div>ресурсы</div>
                <div>армия</div>
                <div>юниты</div>
                <div>статистика</div>
            </footer>
        </div>
    );
};

export default Game;