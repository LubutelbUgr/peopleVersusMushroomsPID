// pages/Game/Game.tsx
import React, { useEffect, useRef, useState, useContext, useCallback } from 'react';
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

  // 1. Состояние камеры
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1.0 });
  
  const TILE_SIZE = 64; 
  const MAP_WIDTH_TILES = 15; 
  const MAP_HEIGHT_TILES = 10;
  
  const MIN_ZOOM = 0.4; 
  const MAX_ZOOM = 5.0; 

  // 2. Функция удержания камеры в границах
  const clampCamera = useCallback((x: number, y: number, zoom: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x, y };

    const mapWidthPx = MAP_WIDTH_TILES * TILE_SIZE * zoom;
    const mapHeightPx = MAP_HEIGHT_TILES * TILE_SIZE * zoom;
    const viewWidth = canvas.clientWidth;
    const viewHeight = canvas.clientHeight;

    let newX = x;
    let newY = y;

    if (mapWidthPx > viewWidth) {
      newX = Math.min(0, Math.max(newX, viewWidth - mapWidthPx));
    } else {
      newX = (viewWidth - mapWidthPx) / 2; 
    }

    if (mapHeightPx > viewHeight) {
      newY = Math.min(0, Math.max(newY, viewHeight - mapHeightPx));
    } else {
      newY = (viewHeight - mapHeightPx) / 2;
    }

    return { x: newX, y: newY };
  }, []);

  const GET_STORE = mediator?.getTriggerTypes().GET_STORE;
  const user = mediator?.get(GET_STORE, 'user') as TUser | null;
  const username = user?.name || 'Игрок';

  // 3. Основная функция отрисовки
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameStateRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const widthCSS = canvas.clientWidth;
    const heightCSS = canvas.clientHeight;

    const aliveCount = gameStateRef.current.units.filter((unit) => unit.hp > 0).length;
    setAliveUnitsCount(aliveCount);

    // Передаем камеру в рендерер
    drawGame(ctx, gameStateRef.current, widthCSS, heightCSS, camera);
  }, [camera]);

  // Ресайз
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      if (displayWidth === 0 || displayHeight === 0) return;

      if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        redrawCanvas();
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [redrawCanvas]);

  // 4. Управление (Колесико + WASD)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); 
      setCamera((prev) => {
        const zoomSpeed = 0.001; 
        const delta = -e.deltaY * zoomSpeed;
        const newZoom = Math.min(Math.max(prev.zoom + delta, MIN_ZOOM), MAX_ZOOM);
        const { x, y } = clampCamera(prev.x, prev.y, newZoom);
        return { x, y, zoom: newZoom };
      });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const moveSpeed = 30;
      setCamera((prev) => {
        let dx = 0;
        let dy = 0;

        if (e.code === 'KeyW' || e.code === 'ArrowUp') dy = moveSpeed;
        if (e.code === 'KeyS' || e.code === 'ArrowDown') dy = -moveSpeed;
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') dx = moveSpeed;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') dx = -moveSpeed;

        if (dx === 0 && dy === 0) return prev;

        const { x, y } = clampCamera(prev.x + dx, prev.y + dy, prev.zoom);
        return { ...prev, x, y };
      });
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [clampCamera]);

  // 5. Подписки
  useEffect(() => {
    if (!mediator) return;
    const EVENT_NAME = CONFIG.MEDIATOR.EVENTS.GAME_STATE_UPDATED;
    const handler = (newState: GameState) => {
      gameStateRef.current = newState;
      redrawCanvas();
    };
    mediator.subscribe(EVENT_NAME, handler);
    return () => mediator.unsubscribe(EVENT_NAME, handler);
  }, [mediator, redrawCanvas]);

  useEffect(() => {
    if (!mediator) return;
    const GAME_OVER_EVENT = CONFIG.MEDIATOR.EVENTS.GAME_OVER;
    const handler = () => setIsGameOver(true);
    mediator.subscribe(GAME_OVER_EVENT, handler);
    return () => mediator.unsubscribe(GAME_OVER_EVENT, handler);
  }, [mediator]);

  const handleExitToLobby = () => {
    setIsGameOver(false);
    setPage(PAGES.LOBBY);
  };

  const handleRestartGame = () => {
    server?.lobbyStart();
    setIsGameOver(false);
  };

  return (
  <div className="game-page">
    {/* Хедер закреплен сверху (position: fixed в CSS) */}
    <Header 
    username={username} 
    onExit={handleExitToLobby} 
    />

    {/* Основная игровая область */}
    <div className="game-canvas-wrapper">
      <canvas ref={canvasRef} className="game-canvas" />
    </div>

    {/* ФУТЕР: Теперь он в коде, ошибка импорта исчезнет.
        Он сам прилипнет к низу благодаря вашим стилям .game-footer-wrapper */}
    <Footer />

    {/* Модальное окно окончания игры */}
    {isGameOver && (
      <div className="game-overlay">
        <div className="game-overlay-content">
          <h2>Игра окончена</h2>
          <div className="game-overlay-actions">
            <button type="button" onClick={handleRestartGame}>
              Начать заново
            </button>
            <button type="button" onClick={handleExitToLobby}>
              В лобби
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
  );
};

export default Game;