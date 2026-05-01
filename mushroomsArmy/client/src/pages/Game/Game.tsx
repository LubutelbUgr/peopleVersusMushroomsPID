// pages/Game/Game.tsx
import React, { useEffect, useRef, useState, useContext, useCallback } from 'react'; // <--- ИЗМЕНЕНО: добавлен useCallback
import { MediatorContext, ServerContext } from '../../App';
import CONFIG from '../../config';
import { drawGame } from './renderer';
import { GameState } from './types';
import { PAGES } from '../PageManager';
import { TUser } from '../../services/server/types';
import Footer from './Interface/Footer/Footer';
import Header from './Interface/Header/Header';
import './Game.css';

const Game: React.FC<{ setPage: (page: PAGES) => void }> = ({ setPage }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const mediator = useContext(MediatorContext);
  const server = useContext(ServerContext);
  
  const [isGameOver, setIsGameOver] = useState(false);
  const [aliveUnitsCount, setAliveUnitsCount] = useState(0);

  // --- 1. СОСТОЯНИЕ КАМЕРЫ ---
  const [camera, setCamera] = useState({
    x: 0,
    y: 0,
    zoom: 1.0
  });
  const MIN_ZOOM = 0.4;
  const MAX_ZOOM = 3.0;

  const GET_STORE = mediator.getTriggerTypes().GET_STORE;
  const user = mediator.get(GET_STORE, 'user') as TUser | null;
  const username = user?.name || 'Игрок';

  // --- 2. ФУНКЦИЯ ОТРИСОВКИ ---
  // <--- ИЗМЕНЕНО: теперь useCallback, чтобы не создавать функцию при каждом рендере
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const widthCSS = canvas.clientWidth;
    const heightCSS = canvas.clientHeight;
    if (widthCSS === 0 || heightCSS === 0) return;

    const aliveCount = gameStateRef.current?.units.filter((unit) => unit.hp > 0).length ?? 0;
    setAliveUnitsCount(aliveCount);

    // <--- ИЗМЕНЕНО: вызов раскомментирован и добавлен 5-й аргумент (camera)
    drawGame(ctx, gameStateRef.current, widthCSS, heightCSS, camera);
  }, [camera]); // <--- ИЗМЕНЕНО: зависит от камеры, чтобы перерисовывать при зуме

  // --- 3. ИЗМЕНЕНИЕ РАЗМЕРА ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      
      if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        redrawCanvas();
      }
    };

    resizeCanvas();

    let rafId: number | null = null;
    const handleResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        resizeCanvas();
        rafId = null;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [redrawCanvas]); // <--- ИЗМЕНЕНО: добавлена зависимость от функции отрисовки

  // --- 4. ОБРАБОТКА КОЛЕСИКА ---
  useEffect(() => { // <--- ИЗМЕНЕНО: добавлен весь блок для работы зума
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); 
      setCamera((prev) => {
        const zoomSpeed = 0.1;
        const delta = e.deltaY < 0 ? zoomSpeed : -zoomSpeed;
        const newZoom = Math.min(Math.max(prev.zoom + delta, MIN_ZOOM), MAX_ZOOM);
        return { ...prev, zoom: newZoom };
      });
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (canvas) canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // --- 5. ОБНОВЛЕНИЕ СОСТОЯНИЯ ---
  useEffect(() => {
    if (!mediator) return;
    const EVENT_NAME = CONFIG.MEDIATOR.EVENTS.GAME_STATE_UPDATED;
    const handler = (newState: GameState) => {
      gameStateRef.current = newState;
      redrawCanvas();
    };

    mediator.subscribe(EVENT_NAME, handler);
    return () => mediator.unsubscribe(EVENT_NAME, handler);
  }, [mediator, redrawCanvas]); // <--- ИЗМЕНЕНО: добавлена зависимость redrawCanvas

  // Остальной код (handleExitToLobby, handleRestartGame, return) остается прежним...
  // (прокрути вниз до конца файла)
  
  const handleExitToLobby = () => {
    setIsGameOver(false);
    setPage(PAGES.LOBBY);
  };

  const handleRestartGame = () => {
    server.lobbyStart();
    setIsGameOver(false);
  };

  return (
    <div className="game-page">
      <Header username={username} onExit={handleExitToLobby} />
      <div className="game-canvas-wrapper">
        <canvas ref={canvasRef} className="game-canvas" />
      </div>
      <Footer />
      {isGameOver && (
        <div className="game-overlay">
          <div className="game-overlay-content">
            <h2>Игра окончена</h2>
            <div className="game-overlay-actions">
              <button type="button" onClick={handleRestartGame}>Начать заново</button>
              <button type="button" onClick={handleExitToLobby}>В лобби</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Game;