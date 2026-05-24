import { TMap } from './Army';

export type FormationUnitType = 'sporomet' | 'eblekar' | 'champigneb';

export type FormationSlotPos = { x: number; y: number };

export type FormationUnitCounts = Partial<Record<FormationUnitType, number>>;

export type FormationFillOrder = 'inner-first' | 'outer-first';

export type FormationPlannerOptions = {
    map: TMap;
    baseCenter: { x: number; y: number };
    baseWallTopY: number;
    baseWallLeftX: number;
};

const WALKABLE_TILES = new Set<number>([0, 2]);

// Параметры решётки — см. spec/formation.md §2.1.
// SLOT_OFFSET = SLOT_STEP/2 даёт треугольную упаковку.
const SLOT_STEP          = 4;
const L_STEP             = 3;
const SLOT_OFFSET        = 2;
const MIN_D              = 1;
const WALL_TRIGGER_RINGS = 5;
// Шаг между лекарями вдоль плеча L: stride 2 × SLOT_STEP 4 = 8 клеток.
// При переполнении пакуем плотнее (offset=1 → шаг 4 клетки), излишки дропаем.
const EBLEKAR_SLOT_STRIDE = 2;

// Авторитетная семантика — в spec/formation.md (L-кольца вокруг угла базы,
// 3 активные L подряд, type-rank, wave-fill).
export class FormationPlanner {
    private readonly _center: Readonly<{ x: number; y: number }>;
    private readonly map: TMap;
    private readonly baseWallTopY: number;
    private readonly baseWallLeftX: number;
    private readonly mapRows: number;
    private readonly mapCols: number;

    private lastWallRingIdx: number = 0;
    private lastBuiltSlots: Record<FormationUnitType, FormationSlotPos[]> = {
        sporomet:   [],
        eblekar:    [],
        champigneb: [],
    };

    constructor(opts: FormationPlannerOptions) {
        this._center       = Object.freeze({ ...opts.baseCenter });
        this.map           = opts.map;
        this.baseWallTopY  = opts.baseWallTopY;
        this.baseWallLeftX = opts.baseWallLeftX;
        this.mapRows       = this.map.length;
        this.mapCols       = this.map[0]?.length ?? 0;
    }

    public get center(): Readonly<{ x: number; y: number }> {
        return this._center;
    }

    public updateForCounts(
        counts: FormationUnitCounts,
        opts: { fillOrder?: FormationFillOrder } = {},
    ): Record<FormationUnitType, FormationSlotPos[]> {
        const fillOrder: FormationFillOrder = opts.fillOrder ?? 'inner-first';

        const result: Record<FormationUnitType, FormationSlotPos[]> = {
            sporomet:   [],
            eblekar:    [],
            champigneb: [],
        };
        const remaining: Record<FormationUnitType, number> = {
            sporomet:   counts.sporomet   ?? 0,
            eblekar:    counts.eblekar    ?? 0,
            champigneb: counts.champigneb ?? 0,
        };
        const total = this.totalRemaining(remaining);
        if (total === 0) {
            this.lastBuiltSlots = result;
            return result;
        }

        const maxD = Math.max(this.baseWallTopY, this.baseWallLeftX);
        let dStart = MIN_D;
        let innerCells = this.lShellCells(dStart);
        let middleCells = this.lShellCells(dStart + L_STEP);
        let outerCells = this.lShellCells(dStart + 2 * L_STEP);
        // Формация расширяется по двум причинам:
        // (1) общая ёмкость 3 L < total — иначе юнитам не хватит слотов;
        // (2) inner L не вмещает всех лекарей со stride 2 — иначе либо часть лекарей
        //     останутся без слота (одинокий медик на передовой), либо stride сожмётся
        //     до 4 клеток (см. distributeEblekars offset=1) и они кучкуются.
        const eblekarStrideCapacity = (cellsCount: number): number => Math.ceil(cellsCount / EBLEKAR_SLOT_STRIDE);
        while (
            innerCells.length + middleCells.length + outerCells.length < total
            || eblekarStrideCapacity(innerCells.length) < remaining.eblekar
        ) {
            // outer L должна оставаться в карте: apex outer = max(.) - d_start - 2·L_STEP
            // должен быть ≥ 0.
            if (dStart + 2 * L_STEP >= maxD) break;
            dStart += L_STEP;
            innerCells = this.lShellCells(dStart);
            middleCells = this.lShellCells(dStart + L_STEP);
            outerCells = this.lShellCells(dStart + 2 * L_STEP);
        }

        // Лекари — на inner L (самая внутренняя, тыл формации; передние линии остаются
        // боевым юнитам). Распределяем по обоим плечам с примерным шагом 8 клеток
        // (stride 2 слота). При нехватке места — стираем шаг до 4 (offset=1).
        const innerArms = this.lShellArms(dStart);
        const eblekarCells = this.distributeEblekars(innerArms, remaining.eblekar);
        result.eblekar.push(...eblekarCells);
        remaining.eblekar -= eblekarCells.length;
        const eblekarKeys = new Set(eblekarCells.map(c => `${c.x},${c.y}`));
        const innerCellsForOthers = innerCells.filter(c => !eblekarKeys.has(`${c.x},${c.y}`));

        type LSpec = {
            cells: FormationSlotPos[];
            priority: ReadonlyArray<FormationUnitType>;
        };
        const Ls: LSpec[] = [
            { cells: innerCellsForOthers, priority: ['sporomet', 'champigneb'] },
            { cells: middleCells,         priority: ['sporomet', 'champigneb'] },
            { cells: outerCells,          priority: ['champigneb', 'sporomet'] },
        ];
        if (fillOrder === 'outer-first') Ls.reverse();

        for (const { cells, priority } of Ls) {
            if (this.totalRemaining(remaining) === 0) break;
            this.fillCells(cells, priority, remaining, result);
        }

        this.lastBuiltSlots = result;
        return result;
    }

    public getAllSlots(): Readonly<Record<FormationUnitType, ReadonlyArray<FormationSlotPos>>> {
        return this.lastBuiltSlots;
    }

    public getSlots(type: FormationUnitType): ReadonlyArray<FormationSlotPos> {
        return this.lastBuiltSlots[type];
    }

    // unitPositions — фактические позиции «осевших» юнитов (фильтрация на стороне
    // ArmyStateManager); по слотам считать нельзя, иначе стены строятся на спавне.
    public checkWallTrigger(unitPositions: ReadonlyArray<{ x: number; y: number }>): FormationSlotPos[] | null {
        if (unitPositions.length === 0) return null;
        let outerShell = -1;
        for (const u of unitPositions) {
            const shell = Math.max(this.baseWallTopY - u.y, this.baseWallLeftX - u.x);
            if (shell > outerShell) outerShell = shell;
        }
        if (outerShell < 0) return null;

        const outerRingIdx = Math.floor(outerShell / L_STEP);
        if (outerRingIdx - this.lastWallRingIdx < WALL_TRIGGER_RINGS) return null;

        const newWallRingIdx = this.lastWallRingIdx + WALL_TRIGGER_RINGS;
        this.lastWallRingIdx = newWallRingIdx;
        return this.generateWallL(newWallRingIdx * L_STEP);
    }

    // -- private helpers --

    // Lattice-слоты L(d), разделённые по плечам — каждое плечо в порядке от апекса.
    private lShellArms(d: number): { top: FormationSlotPos[]; left: FormationSlotPos[] } {
        const i = Math.floor((d - MIN_D) / L_STEP);
        const shift = (i & 1) ? SLOT_OFFSET : 0;

        const apexX = this.baseWallLeftX - d;
        const apexY = this.baseWallTopY  - d;

        const top: FormationSlotPos[] = [];
        if (apexY >= 0 && apexY < this.mapRows) {
            const xStart = Math.max(0, apexX);
            for (let x = xStart; x < this.mapCols; x++) {
                if (((x - shift) % SLOT_STEP + SLOT_STEP) % SLOT_STEP !== 0) continue;
                if (!this.isWalkable(x, apexY)) continue;
                top.push({ x, y: apexY });
            }
        }

        const left: FormationSlotPos[] = [];
        if (apexX >= 0 && apexX < this.mapCols) {
            const yStart = Math.max(0, apexY + 1);
            for (let y = yStart; y < this.mapRows; y++) {
                if (((y - shift) % SLOT_STEP + SLOT_STEP) % SLOT_STEP !== 0) continue;
                if (!this.isWalkable(apexX, y)) continue;
                left.push({ x: apexX, y });
            }
        }

        return { top, left };
    }

    // Wave-ordered lattice-слоты L(d): top[0], left[0], top[1], left[1]...
    // (apex входит в top[0] если он lattice-cell). См. §2.3, §3.3.
    private lShellCells(d: number): FormationSlotPos[] {
        const { top, left } = this.lShellArms(d);
        const result: FormationSlotPos[] = [];
        const maxLen = Math.max(top.length, left.length);
        for (let k = 0; k < maxLen; k++) {
            if (k < top.length)  result.push(top[k]);
            if (k < left.length) result.push(left[k]);
        }
        return result;
    }

    // Равномерно раскладываем `count` лекарей по плечам inner L:
    // сначала «редкая» сетка (offset=0, шаг = EBLEKAR_SLOT_STRIDE × SLOT_STEP клеток),
    // потом, если ещё остались, в пропуски (offset=1, плотнее). Чередуем top/left, чтобы
    // не забивать одно плечо целиком до перехода на другое.
    private distributeEblekars(
        arms: { top: ReadonlyArray<FormationSlotPos>; left: ReadonlyArray<FormationSlotPos> },
        count: number,
    ): FormationSlotPos[] {
        if (count <= 0) return [];
        const stride = EBLEKAR_SLOT_STRIDE;
        const pick = (arm: ReadonlyArray<FormationSlotPos>, offset: number): FormationSlotPos[] => {
            const out: FormationSlotPos[] = [];
            for (let i = offset; i < arm.length; i += stride) out.push(arm[i]);
            return out;
        };

        const result: FormationSlotPos[] = [];
        let remaining = count;
        for (let offset = 0; offset < stride && remaining > 0; offset++) {
            const topPicks  = pick(arms.top,  offset);
            const leftPicks = pick(arms.left, offset);
            const maxLen = Math.max(topPicks.length, leftPicks.length);
            for (let k = 0; k < maxLen && remaining > 0; k++) {
                if (k < topPicks.length  && remaining > 0) { result.push(topPicks[k]);  remaining--; }
                if (k < leftPicks.length && remaining > 0) { result.push(leftPicks[k]); remaining--; }
            }
        }
        return result;
    }

    private fillCells(
        cells: ReadonlyArray<FormationSlotPos>,
        priority: ReadonlyArray<FormationUnitType>,
        remaining: Record<FormationUnitType, number>,
        result: Record<FormationUnitType, FormationSlotPos[]>,
    ): void {
        for (const cell of cells) {
            for (const type of priority) {
                if (remaining[type] > 0) {
                    result[type].push({ x: cell.x, y: cell.y });
                    remaining[type]--;
                    break;
                }
            }
        }
    }

    private totalRemaining(r: Record<FormationUnitType, number>): number {
        return r.sporomet + r.eblekar + r.champigneb;
    }

    // Сплошная L (каждая клетка, не lattice-слоты) — vzryvomor стена.
    // На клетках воды (tile=1) стена не ставится, а отгибается наружу
    // (вверх для top, влево для left), огибая водоём по внешнему контуру.
    // Горы/туман (tile=2/null) сами блокируют проход — стена просто пропускает столбец.
    private generateWallL(shellDist: number): FormationSlotPos[] {
        const topY  = this.baseWallTopY  - shellDist;
        const leftX = this.baseWallLeftX - shellDist;
        const positions: FormationSlotPos[] = [];

        if (topY >= 0 && topY < this.mapRows) {
            const xStart = Math.max(0, leftX);
            for (let x = xStart; x < this.mapCols; x++) {
                const wallY = this.findWallTopY(x, topY);
                if (wallY !== null) positions.push({ x, y: wallY });
            }
        }
        if (leftX >= 0 && leftX < this.mapCols) {
            const yStart = Math.max(0, topY + 1);
            for (let y = yStart; y < this.mapRows; y++) {
                const wallX = this.findWallLeftX(y, leftX);
                if (wallX !== null) positions.push({ x: wallX, y });
            }
        }
        return positions;
    }

    // Для столбца x: первая клетка-равнина от baseY вверх. Вода (1) пропускается,
    // на горе/тумане столбец считается заблокированным (стена не нужна).
    private findWallTopY(x: number, baseY: number): number | null {
        for (let y = baseY; y >= 0; y--) {
            const tile = this.map[y]?.[x];
            if (tile === 0) return y;
            if (tile !== 1) return null;
        }
        return null;
    }

    // Для строки y: первая клетка-равнина от baseX влево.
    private findWallLeftX(y: number, baseX: number): number | null {
        const row = this.map[y];
        if (row == null) return null;
        for (let x = baseX; x >= 0; x--) {
            const tile = row[x];
            if (tile === 0) return x;
            if (tile !== 1) return null;
        }
        return null;
    }

    private isWalkable(x: number, y: number): boolean {
        const tile = this.map[y]?.[x];
        return tile != null && WALKABLE_TILES.has(tile);
    }
}

export default FormationPlanner;
