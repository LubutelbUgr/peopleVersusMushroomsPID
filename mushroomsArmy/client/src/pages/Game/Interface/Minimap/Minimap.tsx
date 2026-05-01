import React, { useEffect, useRef, useMemo } from 'react';
import { GameState } from '../../types';
import './Minimap.css';

interface MinimapProps {
  gameState: GameState | null;
}

const getTerrainColor = (tile: number | undefined): string => {
  switch (tile) {
    case 0: return '#2ecc71'; 
    case 1: return '#7fd3ff'; 
    case 2: return '#8b5a2b'; 
    default: return '#1f2d24'; 
  }
};

const Minimap: React.FC<MinimapProps> = ({ gameState }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const dots = useMemo(() => {
    if (!gameState) return [];

    const MAP_SIZE = 100;
    const ownBuildingTypes = ['vzryvomor', 'sporovaya_bashnya'];
    const clamp = (v: number) => Math.max(0, Math.min(100, v));

    const unitDots = gameState.units
      .filter((u) => u.hp > 0)
      .map((u) => ({
        guid: u.guid,
        color: '#42d96b', 
        x: clamp(((u.x + 0.5) / MAP_SIZE) * 100),
        y: clamp(((u.y + 0.5) / MAP_SIZE) * 100),
      }));

    const buildingDots = gameState.buildings
      .filter((b) => b.hp > 0 && b.isAlive !== false)
      .map((b) => ({
        guid: b.guid,
        color: ownBuildingTypes.includes(b.type) ? '#ffd966' : '#f05252',
        x: clamp(((b.x + (b.sizeX ?? 1) / 2) / MAP_SIZE) * 100),
        y: clamp(((b.y + (b.sizeY ?? 1) / 2) / MAP_SIZE) * 100),
      }));

    return [...unitDots, ...buildingDots];
  }, [gameState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !gameState) return;

    const { width, height } = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    if (canvas.width !== width * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, width, height);

    const map = gameState.map || [];
    const rows = map.length;
    const cols = map[0]?.length ?? 0;

    if (rows > 0 && cols > 0) {
      const cellW = width / cols;
      const cellH = height / rows;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const tile = map[y][x];
          if (tile !== null) {
            ctx.fillStyle = getTerrainColor(tile);
            ctx.fillRect(x * cellW, y * cellH, Math.ceil(cellW), Math.ceil(cellH));
          }
        }
      }
    }
  }, [gameState?.map]);

  return (
    <div className="game-minimap">
      <div className="minimap-field">
        <canvas ref={canvasRef} className="minimap-canvas" />

        {dots.map((dot) => (
          <div
            className="minimap-dot"
            key={dot.guid}
            style={{
              backgroundColor: dot.color,
              left: `${dot.x}%`,
              top: `${dot.y}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default React.memo(Minimap);