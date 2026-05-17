import { Formation } from '../types';

// Toggle через Menu-чекбокс «Показывать формацию» (по умолчанию выкл — отладочное).
export const formationDisplay = { show: false };

/**
 * Рисует визуализацию формации поверх юнитов:
 *   - bbox-рамка (золотая пунктирная) вокруг всех слотов всех эшелонов,
 *   - круг-маркер для каждого слота (цвет по типу),
 *   - заполненная точка в центре формации.
 *
 * Вызывается из renderer.drawGame изнутри camera-translate блока (мир-координаты).
 */
export function drawFormation(
    ctx: CanvasRenderingContext2D,
    formation: Formation | null,
    cellW: number,
    cellH: number,
): void {
    if (!formationDisplay.show) return;
    if (!formation) return;

    const all = [
        ...formation.slots.champigneb,
        ...formation.slots.sporomet,
        ...formation.slots.eblekar,
    ];
    if (all.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of all) {
        if (s.x < minX) minX = s.x;
        if (s.x > maxX) maxX = s.x;
        if (s.y < minY) minY = s.y;
        if (s.y > maxY) maxY = s.y;
    }

    const PAD = 1.5;
    ctx.save();

    // Bounding-box формации — золотая пунктирная рамка
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(
        (minX - PAD) * cellW,
        (minY - PAD) * cellH,
        (maxX - minX + 2 * PAD) * cellW,
        (maxY - minY + 2 * PAD) * cellH,
    );

    // Маркеры слотов — пустые круги, цвет по типу эшелона
    ctx.setLineDash([]);
    ctx.lineWidth = 1.5;
    const slotColor: Record<keyof Formation['slots'], string> = {
        champigneb: 'rgba(255, 80, 80, 0.6)',   // красный — фронтовой пояс
        sporomet:   'rgba(80, 140, 255, 0.6)',  // синий  — стрелки
        eblekar:    'rgba(255, 150, 200, 0.6)', // розовый — хилеры
    };
    for (const type of Object.keys(slotColor) as (keyof Formation['slots'])[]) {
        ctx.strokeStyle = slotColor[type];
        for (const s of formation.slots[type]) {
            ctx.beginPath();
            ctx.arc(
                s.x * cellW + cellW / 2,
                s.y * cellH + cellH / 2,
                cellW * 0.45,
                0,
                Math.PI * 2,
            );
            ctx.stroke();
        }
    }

    // Центр формации — золотая точка
    ctx.fillStyle = 'rgba(255, 215, 0, 0.95)';
    ctx.beginPath();
    ctx.arc(
        formation.center.x * cellW + cellW / 2,
        formation.center.y * cellH + cellH / 2,
        cellW * 0.35,
        0,
        Math.PI * 2,
    );
    ctx.fill();

    ctx.restore();
}
