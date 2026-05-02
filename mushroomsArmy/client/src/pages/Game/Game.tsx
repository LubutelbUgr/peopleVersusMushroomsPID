import React, { useEffect, useRef, useState, useContext } from 'react';
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

  const GET_STORE = mediator.getTriggerTypes().GET_STORE;
  const user = mediator.get(GET_STORE, 'user') as TUser | null;
  const username = user?.name || 'Игрок';

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const widthCSS = canvas.clientWidth;
    const heightCSS = canvas.clientHeight;
    if (widthCSS === 0 || heightCSS === 0) return;

    drawGame(ctx, gameStateRef.current, widthCSS, heightCSS);
  };

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
  }, []);

  useEffect(() => {
    if (!mediator) return;

    const EVENT_NAME = CONFIG.MEDIATOR.EVENTS.GAME_STATE_UPDATED;
    const handler = (newState: GameState) => {
      gameStateRef.current = newState;
      redrawCanvas();
    };

    mediator.subscribe(EVENT_NAME, handler);

    return () => {
      mediator.unsubscribe(EVENT_NAME, handler);
    };
  }, [mediator]);

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
    server.lobbyStart();
    setIsGameOver(false);
  };

  return (
  <div className="game-page">
    <Header 
    username={username} 
    onExit={handleExitToLobby} 
    />

    <div className="game-canvas-wrapper">
      <canvas ref={canvasRef} className="game-canvas" />
    </div>

    <Footer />

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