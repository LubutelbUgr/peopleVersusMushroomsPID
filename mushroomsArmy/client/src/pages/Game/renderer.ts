import { GameState, MapTile, Projectile, TerrainType, Unit } from './types';
import sporometSrc from '../../assets/units/Sporomet.png';
import champignebSrc from '../../assets/units/Champigneb.png';
import eblekarSrc from '../../assets/units/Eblekar.png';
import vzryvomorFrame0 from '../../assets/buildings/vzryvomor/frame_0.png';
import vzryvomorFrame1 from '../../assets/buildings/vzryvomor/frame_1.png';
import vzryvomorFrame2 from '../../assets/buildings/vzryvomor/frame_2.png';
import vzryvomorFrame3 from '../../assets/buildings/vzryvomor/frame_3.png';
import vzryvomorFrame4 from '../../assets/buildings/vzryvomor/frame_4.png';
import vzryvomorFrame5 from '../../assets/buildings/vzryvomor/frame_5.png';
import vzryvomorFrame6 from '../../assets/buildings/vzryvomor/frame_6.png';
import vzryvomorFrame7 from '../../assets/buildings/vzryvomor/frame_7.png';
import vzryvomorFrame8 from '../../assets/buildings/vzryvomor/frame_8.png';
import vzryvomorFrame9 from '../../assets/buildings/vzryvomor/frame_9.png';
import vzryvomorFrame10 from '../../assets/buildings/vzryvomor/frame_10.png';
import sporovayaBashnyaIdle from '../../assets/buildings/sporovaya_bashnya/idle.png';
import sporovayaBashnyaAttack from '../../assets/buildings/sporovaya_bashnya/attack.png';
import sporovayaBashnyaDestroyed from '../../assets/buildings/sporovaya_bashnya/destroyed.png';
import champignebExplFrame0 from '../../assets/units/champigneb_explosion/frame_0.png';
import champignebExplFrame1 from '../../assets/units/champigneb_explosion/frame_1.png';
import champignebExplFrame2 from '../../assets/units/champigneb_explosion/frame_2.png';
import champignebExplFrame3 from '../../assets/units/champigneb_explosion/frame_3.png';
import champignebExplFrame4 from '../../assets/units/champigneb_explosion/frame_4.png';
import {
  getVzryvomorFrameKey,
  stepVzryvomorAnimation,
  VZRYVOMOR_FRAME_MS,
} from './vzryvomorAnimation';

// --- КОНСТАНТЫ -------------------------------------------------------------
const TILE_SIZE = 64; 
const CHAMPIGNEB_EXPL_DURATION = 1000;
const CHAMPIGNEB_EXPLOSION_FRAME_COUNT = 5;

// --- КЭШ И СОСТОЯНИЯ -------------------------------------------------------
const unitImages: Record<string, HTMLImageElement> = {};
const buildingImages: Record<string, HTMLImageElement> = {};
const activeProjectiles = new Map<string, Projectile & { duration: number }>();
const buildingAnimState: Record<string, { frame: number; lastFrameTime: number }> = {};
const champignebExplosions = new Map<string, { x: number; y: number; startTime: number }>();
const prevChampignebHp = new Map<string, number>();

const CHAMPIGNEB_EXPL_FRAME_SRCS = [
  champignebExplFrame0, champignebExplFrame1, champignebExplFrame2, 
  champignebExplFrame3, champignebExplFrame4
];
const champignebExplImages = CHAMPIGNEB_EXPL_FRAME_SRCS.map(src => {
  const img = new Image(); img.src = src; return img;
});

const VZRYVOMOR_FRAME_SRCS = [
  vzryvomorFrame0, vzryvomorFrame1, vzryvomorFrame2, vzryvomorFrame3, vzryvomorFrame4,
  vzryvomorFrame5, vzryvomorFrame6, vzryvomorFrame7, vzryvomorFrame8, vzryvomorFrame9, vzryvomorFrame10
];

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ------------------------------------------------

function getBuildingImage(key: string, src: string | undefined): HTMLImageElement | undefined {
  if (src === undefined) return buildingImages[key];
  if (!buildingImages[key]) {
    const img = new Image(); img.src = src; buildingImages[key] = img;
  }
  return buildingImages[key];
}

function isImageDrawable(img: HTMLImageElement | undefined): img is HTMLImageElement {
  return img !== undefined && img.complete && img.naturalWidth > 0;
}

function tryDrawImageScaled(ctx: CanvasRenderingContext2D, img: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) {
  try { ctx.drawImage(img, dx, dy, dw, dh); return true; } catch { return false; }
}

function updateVzryvomorAnimation(guid: string, isExploding: boolean): number {
  const now = Date.now();
  const { next, frameIndex } = stepVzryvomorAnimation(
    buildingAnimState[guid], isExploding, now, VZRYVOMOR_FRAME_SRCS.length, VZRYVOMOR_FRAME_MS
  );
  if (next === undefined) delete buildingAnimState[guid];
  else buildingAnimState[guid] = next;
  return frameIndex;
}

function getUnitImage(unit: Unit): HTMLImageElement | undefined {
  if (!unitImages[unit.type]) {
    const srcs: Record<string, string> = { sporomet: sporometSrc, champigneb: champignebSrc, eblekar: eblekarSrc };
    const src = srcs[unit.type];
    if (!src) return undefined;
    const img = new Image(); img.src = src; unitImages[unit.type] = img;
  }
  return unitImages[unit.type];
}

// Предзагрузка
VZRYVOMOR_FRAME_SRCS.forEach((src, i) => getBuildingImage(getVzryvomorFrameKey(i), src));
getBuildingImage('sporovaya_bashnya:idle', sporovayaBashnyaIdle);
getBuildingImage('sporovaya_bashnya:attack', sporovayaBashnyaAttack);
getBuildingImage('sporovaya_bashnya:destroyed', sporovayaBashnyaDestroyed);

// --- ОСНОВНОЙ РЕНДЕР -------------------------------------------------------

export function drawGame(
  ctx: CanvasRenderingContext2D,
  state: GameState | null,
  widthCSS: number,
  heightCSS: number,
  camera: { x: number, y: number, zoom: number }
) {
  if (!state) {
    drawPlaceholder(ctx, widthCSS, heightCSS);
    return;
  }

  const now = Date.now();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, widthCSS, heightCSS);
  
  ctx.save();
  // ПРИМЕНЕНИЕ КАМЕРЫ
  ctx.translate(camera.x, camera.y);
  ctx.scale(camera.zoom, camera.zoom);

  const cellW = TILE_SIZE;
  const cellH = TILE_SIZE;
  const rows = state.map.length;
  const cols = state.map[0]?.length ?? 0;

  // 1. Карта
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      ctx.fillStyle = getTerrainColor(state.map[y]?.[x]);
      ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
    }
  }

  drawGrid(ctx, cols * cellW, rows * cellH, cellW, cellH, rows, cols);

  // 2. Слизь
  state.slimePuddles.forEach(puddle => {
    ctx.beginPath();
    ctx.arc(puddle.x * cellW + cellW/2, puddle.y * cellH + cellH/2, puddle.radius * cellW, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(76, 175, 80, 0.4)';
    ctx.fill();
  });

  // 3. Здания
  const activeVzryvomorGuids = new Set((state.buildings ?? []).filter(b => b.type === 'vzryvomor').map(b => b.guid));
  state.buildings?.forEach(building => {
    if (building.hp <= 0) return;
    const bx = building.x * cellW;
    const by = building.y * cellH;
    const hpPercent = building.hp / building.maxHp;

    if (building.type === 'vzryvomor') {
      const fi = updateVzryvomorAnimation(building.guid, building.isExploding === true);
      const img = getBuildingImage(getVzryvomorFrameKey(fi), VZRYVOMOR_FRAME_SRCS[fi]);
      if (isImageDrawable(img)) tryDrawImageScaled(ctx, img, bx, by, cellW, cellH);
    } else if (building.type === 'sporovaya_bashnya') {
      const destroyed = building.hp <= 0;
      const key = destroyed ? 'sporovaya_bashnya:destroyed' : (building.isAttacking ? 'sporovaya_bashnya:attack' : 'sporovaya_bashnya:idle');
      const img = getBuildingImage(key, undefined);
      if (isImageDrawable(img)) tryDrawImageScaled(ctx, img, bx, by, cellW * (building.sizeX ?? 2), cellH * (building.sizeY ?? 2));
    }

    // HP Bar зданий
    ctx.fillStyle = '#d32f2f';
    ctx.fillRect(bx, by - 6, cellW, 4);
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(bx, by - 6, cellW * hpPercent, 4);
  });

  // 4. Снаряды
  state.projectiles?.forEach(p => {
    if (!activeProjectiles.has(p.guid)) activeProjectiles.set(p.guid, { ...p, duration: getProjectileDuration(p.type) });
  });
  for (const [guid, p] of activeProjectiles.entries()) {
    const elapsed = (now - p.createdAt) / p.duration;
    if (elapsed >= 1) { activeProjectiles.delete(guid); continue; }
    const curX = (p.fromX + (p.toX - p.fromX) * elapsed) * cellW + cellW/2;
    const curY = (p.fromY + (p.toY - p.fromY) * elapsed) * cellH + cellH/2;
    ctx.beginPath(); ctx.arc(curX, curY, 4, 0, Math.PI * 2);
    ctx.fillStyle = getProjectileColor(p.type); ctx.fill();
  }

  // 5. Взрывы шампиньебов
  state.units.forEach(unit => {
    if (unit.type !== 'champigneb') return;
    const prevHp = prevChampignebHp.get(unit.guid) ?? unit.hp;
    if (unit.hp <= 0 && prevHp > 0 && !champignebExplosions.has(unit.guid)) {
      champignebExplosions.set(unit.guid, { x: unit.x, y: unit.y, startTime: now });
    }
    prevChampignebHp.set(unit.guid, unit.hp);
  });

  for (const [guid, entry] of champignebExplosions.entries()) {
    const elapsed = now - entry.startTime;
    if (elapsed >= CHAMPIGNEB_EXPL_DURATION) { champignebExplosions.delete(guid); continue; }
    const fi = Math.min(Math.floor((elapsed / CHAMPIGNEB_EXPL_DURATION) * CHAMPIGNEB_EXPLOSION_FRAME_COUNT), CHAMPIGNEB_EXPLOSION_FRAME_COUNT - 1);
    const size = cellW * 2;
    const img = champignebExplImages[fi];
    if (isImageDrawable(img)) tryDrawImageScaled(ctx, img, entry.x * cellW + cellW/2 - size/2, entry.y * cellH + cellH/2 - size/2, size, size);
  }

  // 6. Юниты
  state.units.forEach(unit => {
    if (unit.hp <= 0) return;
    const cx = unit.x * cellW + cellW / 2;
    const cy = unit.y * cellH + cellH / 2;
    const radius = cellW * 0.35;
    const img = getUnitImage(unit);

    if (isImageDrawable(img)) {
      tryDrawImageScaled(ctx, img, cx - radius, cy - radius, radius * 2, radius * 2);
    } else {
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = unit.type === 'sporomet' ? '#4caf50' : '#ff9800'; ctx.fill();
    }

    // HP Bar юнитов
    ctx.fillStyle = '#d32f2f'; ctx.fillRect(cx - radius, cy - radius - 8, radius * 2, 4);
    ctx.fillStyle = '#4caf50'; ctx.fillRect(cx - radius, cy - radius - 8, (radius * 2) * (unit.hp / unit.maxHp), 4);
  });

  ctx.restore();
}

// --- ХЕЛПЕРЫ ---------------------------------------------------------------

function getTerrainColor(type: MapTile | undefined): string {
  switch (type) {
    case 0: return '#2ecc71';
    case 1: return '#7fd3ff';
    case 2: return '#8b5a2b';
    default: return '#9e9e9e';
  }
}

function getProjectileDuration(type: Projectile['type']): number {
  return type === 'sporovaya_bashnya' ? 500 : 400;
}

function getProjectileColor(type: Projectile['type']): string {
  return type === 'sporomet' ? '#4caf50' : '#f1c40f';
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, cw: number, ch: number, rows: number, cols: number) {
  ctx.beginPath(); ctx.strokeStyle = 'rgba(204, 204, 204, 0.5)'; ctx.lineWidth = 0.5;
  for (let x = 0; x <= cols; x++) { ctx.moveTo(x * cw, 0); ctx.lineTo(x * cw, h); }
  for (let y = 0; y <= rows; y++) { ctx.moveTo(0, y * ch); ctx.lineTo(w, y * ch); }
  ctx.stroke();
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#2ecc71'; ctx.fillRect(0, 0, w, h);
}