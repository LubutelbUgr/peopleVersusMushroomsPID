import React, { useEffect, useRef } from 'react';
import { MapTile } from '../../types';
import './Minimap.css';

export type MinimapDot = {
  color: string;
  guid: string;
  x: number;
  y: number;
};

type MinimapProps = {
  dots: MinimapDot[];
  map: MapTile[][];
};

const getTerrainColor = (tile: MapTile | undefined): string => {
  switch (tile) {
    case 0:
      return '#2ecc71';
    case 1:
      return '#7fd3ff';
    case 2:
      return '#8b5a2b';
    case null:
    default:
      return '#575757';
  }
};

const Minimap: React.FC<MinimapProps> = ({ dots, map }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    ctx.clearRect(0, 0, width, height);

    const rows = map.length;
    const cols = map[0]?.length ?? 0;
    if (rows === 0 || cols === 0) {
      ctx.fillStyle = '#1f2d24';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    const cellW = width / cols;
    const cellH = height / rows;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle = getTerrainColor(map[y]?.[x]);
        ctx.fillRect(x * cellW, y * cellH, Math.ceil(cellW), Math.ceil(cellH));
      }
    }
  }, [map]);

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
              color: dot.color,
              left: `${dot.x}%`,
              top: `${dot.y}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default Minimap;
