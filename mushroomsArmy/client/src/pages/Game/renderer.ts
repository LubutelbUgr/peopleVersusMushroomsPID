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
import sporovaya_bashnyaAttack from '../../assets/buildings/sporovaya_bashnya/attack.png';
import sporovaya_bashnyaDestroyed from '../../assets/buildings/sporovaya_bashnya/destroyed.png';
import {
  getVzryvomorFrameKey,
  stepVzryvomorAnimation,
  VZRYVOMOR_FRAME_MS,
} from './vzryvomorAnimation';

// ── КОНСТАНТЫ И КЭШ ────────────────────────────────────────────────────────
const unitImages: Record<string, HTMLImageElement> = {};
const buildingImages: Record<string, HTMLImageElement> = {};
const activeProjectiles = new Map<string, Projectile & { duration: number }>();
const buildingAnimState: Record<string, { frame: number; lastFrameTime: number }> = {};

const VZRYVOMOR_FRAME_SRCS: string[] = [
  vzryvomorFrame0, vzryvomorFrame1, vzryvomorFrame2, vzryvomorFrame3,
  vzryvomorFrame4, vzryvomorFrame5, vzryvomorFrame6, vzryvomorFrame7,
  vzryvomorFrame8, vzryvomorFrame9, vzryvomorFrame10,
];
const VZRYVOMOR_FRAME_COUNT = VZRYVOMOR_FRAME_SRCS.length;

// ── ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ────────────────────────────────────────────────

function getBuildingImage(key: string, src: string | undefined): HTMLImageElement | undefined {
  if (src === undefined) return buildingImages[key];
  if (!buildingImages[key]) {
    const img = new Image();
    img.src = src;
    buildingImages[key] = img;
  }
  return buildingImages[key];
}

function isImageDrawable(img: HTMLImageElement | undefined): img is HTMLImageElement {
  return img !== undefined && img.complete && img.naturalWidth > 0;
}

function tryDrawImageScaled(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
): boolean {
  try {
    ctx.drawImage(img, dx, dy, dw, dh);
    return true;
  } catch {
    return false;
  }
}

function updateVzryvomorAnimation(guid: string, isExploding: boolean): number {
  const now = Date.now();
  const { next, frameIndex } = stepVzryvomorAnimation(
    buildingAnimState[guid],
    isExploding,
    now,
    VZRYVOMOR_FRAME_COUNT,
    VZRYVOMOR_FRAME_MS
  );
  if (next === undefined) {
    delete buildingAnimState[guid];
  } else {
    buildingAnimState[guid] = next;
  }
  return frameIndex;
}

function getUnitImage(unit: Unit): HTMLImageElement | undefined {
  if (!unitImages[unit.type]) {
    const src = unit.type === 'sporomet' ? sporometSrc : 
                unit.type === 'champigneb' ? champignebSrc : 
                unit.type === 'eblekar' ? eblekarSrc : undefined;
    if (!src) return undefined;
    const img = new Image();
    img.src = src;
    unitImages[unit.type] = img;
  }
  return unitImages[unit.type];
}

// ── ПРЕДЗАГРУЗКА ───────────────────────────────────────────────────────────
VZRYVOMOR_FRAME_SRCS.forEach((src, i) => getBuildingImage(getVzryvomorFrameKey(i), src));
getBuildingImage('sporovaya_bashnya:idle', sporovayaBashnyaIdle);
getBuildingImage('sporovaya_bashnya:attack', sporovaya_bashnyaAttack);
getBuildingImage('sporovaya_bashnya:destroyed', sporovaya_bashnyaDestroyed);

// ── ОСНОВНОЙ РЕНДЕР ────────────────────────────────────────────────────────

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

  const rows = state.map.length;
  const cols = state.map[0]?.length ?? 0;
  const cellW = cols > 0 ? widthCSS / cols : widthCSS;
  const cellH = cellW;

  ctx.clearRect(0, 0, widthCSS, heightCSS);
  ctx.save();

  // Трансформация камеры
  ctx.translate(camera.x, camera.y);
  ctx.scale(camera.zoom, camera.zoom);

  // 1. Карта
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const terrain = state.map[y]?.[x] ?? null;
      ctx.fillStyle = getTerrainColor(terrain);
      ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
    }
  }

  // 1.5 Сетка
  drawGrid(ctx, widthCSS, heightCSS, cellW, cellH, rows, cols);

  // 2. Слизь
  state.slimePuddles.forEach(puddle => {
    const cx = puddle.x * cellW + cellW / 2;
    const cy = puddle.y * cellH + cellH / 2;
    const radiusPx = puddle.radius * Math.min(cellW, cellH);
    ctx.beginPath();
    ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(76, 175, 80, 0.4)';
    ctx.fill();
  });

  // 3. Здания[cite: 3]
  const activeBuildingGuids = new Set((state.buildings ?? []).map(b => b.guid));
  (state.buildings ?? []).forEach(building => {
    if (building.hp <= 0) return;
    const bx = building.x * cellW;
    const by = building.y * cellH;

    if (building.type === 'vzryvomor') {
      const frameIdx = updateVzryvomorAnimation(building.guid, building.isExploding ?? false);
      const img = getBuildingImage(getVzryvomorFrameKey(frameIdx), VZRYVOMOR_FRAME_SRCS[frameIdx]);
      if (isImageDrawable(img)) tryDrawImageScaled(ctx, img, bx, by, cellW, cellH);
    } else if (building.type === 'sporovaya_bashnya') {
      const key = building.isAttacking ? 'sporovaya_bashnya:attack' : 'sporovaya_bashnya:idle';
      const img = getBuildingImage(key, undefined);
      if (isImageDrawable(img)) tryDrawImageScaled(ctx, img, bx, by, cellW, cellH);
    }
  });

  // Удаляем старые состояния анимаций
  Object.keys(buildingAnimState).forEach(guid => {
    if (!activeBuildingGuids.has(guid)) delete buildingAnimState[guid];
  });

  // 4. Снаряды[cite: 3]
  (state.projectiles ?? []).forEach(proj => {
    if (!activeProjectiles.has(proj.guid)) {
      activeProjectiles.set(proj.guid, { ...proj, duration: getProjectileDuration(proj.type) });
    }
  });

  for (const [guid, p] of activeProjectiles.entries()) {
    const elapsed = (now - p.createdAt) / p.duration;
    if (elapsed >= 1) { activeProjectiles.delete(guid); continue; }

    const curX = p.fromX + (p.toX - p.fromX) * elapsed;
    const curY = p.fromY + (p.toY - p.fromY) * elapsed;
    
    ctx.beginPath();
    ctx.arc(curX * cellW + cellW / 2, curY * cellH + cellH / 2, 4, 0, Math.PI * 2);
    ctx.fillStyle = getProjectileColor(p.type);
    ctx.fill();
  }

  // 5. Юниты
  state.units.forEach(unit => {
    if (unit.hp <= 0) return;
    const cx = unit.x * cellW + cellW / 2;
    const cy = unit.y * cellH + cellH / 2;
    const radius = Math.min(cellW, cellH) * 0.35;
    const img = getUnitImage(unit);

    if (isImageDrawable(img)) {
      tryDrawImageScaled(ctx, img, cx - radius, cy - radius, radius * 2, radius * 2);
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = unit.type === 'sporomet' ? '#4caf50' : '#ff9800';
      ctx.fill();
    }

    // HP Bar
    const barW = radius * 1.8;
    const barH = 4;
    ctx.fillStyle = 'red';
    ctx.fillRect(cx - barW / 2, cy - radius - 6, barW, barH);
    ctx.fillStyle = 'green';
    ctx.fillRect(cx - barW / 2, cy - radius - 6, barW * (unit.hp / unit.maxHp), barH);
  });

  ctx.restore();
}

// ── ХЕЛПЕРЫ ЦВЕТОВ И СЕТКИ ─────────────────────────────────────────────────

function getTerrainColor(type: MapTile | undefined): string {
  if (type === 0) return '#2ecc71';
  if (type === 1) return '#7fd3ff';
  if (type === 2) return '#8b5a2b';
  return '#9e9e9e';
}

function getProjectileDuration(type: Projectile['type']): number {
  return type === 'sporovaya_bashnya' ? 500 : 400;
}

function getProjectileColor(type: Projectile['type']): string {
  return type === 'sporomet' ? '#4caf50' : type === 'sporovaya_bashnya' ? '#f1c40f' : '#ffffff';
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, cw: number, ch: number, r: number, c: number) {
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(204, 204, 204, 0.5)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= c; i++) { ctx.moveTo(i * cw, 0); ctx.lineTo(i * cw, h); }
  for (let i = 0; i <= r; i++) { ctx.moveTo(0, i * ch); ctx.lineTo(w, i * ch); }
  ctx.stroke();
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(0, 0, w, h);
  drawGrid(ctx, w, h, w / 100, h / 100, 100, 100);
}