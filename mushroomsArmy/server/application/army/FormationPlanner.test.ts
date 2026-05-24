import { describe, expect, it } from '@jest/globals';
import FormationPlanner, { FormationUnitCounts } from './FormationPlanner';
import { TMap } from './Army';

/** 100×100 walkable map (все тайлы = 0). */
const makeMap = (rows: number = 100, cols: number = 100, tile: number = 0): TMap =>
    Array.from({ length: rows }, () => Array.from({ length: cols }, () => tile));

/** Стандартный конструктор: база в правом нижнем углу 15×15. */
const standardOpts = (overrides: Partial<ConstructorParameters<typeof FormationPlanner>[0]> = {}) => {
    const map = overrides.map ?? makeMap();
    const rows = map.length;
    const cols = map[0].length;
    return {
        map,
        baseCenter:    { x: cols - 8, y: rows - 8 },
        baseWallTopY:  rows - 15,
        baseWallLeftX: cols - 15,
        ...overrides,
    };
};

const shellDist = (s: { x: number; y: number }, baseTopY: number, baseLeftX: number) =>
    Math.max(baseTopY - s.y, baseLeftX - s.x);

/** Unique shells (sorted asc) present among the given slots. */
const distinctShells = (slots: { x: number; y: number }[], baseTopY: number, baseLeftX: number) => {
    const ss = new Set<number>();
    slots.forEach(s => ss.add(shellDist(s, baseTopY, baseLeftX)));
    return Array.from(ss).sort((a, b) => a - b);
};

describe('FormationPlanner — 3 активные L подряд, type-rank constraint', () => {

    describe('конструктор и getters', () => {
        it('создаётся; getAllSlots возвращает пустые массивы до updateForCounts', () => {
            const p = new FormationPlanner(standardOpts());
            const all = p.getAllSlots();
            expect(all.sporomet).toEqual([]);
            expect(all.eblekar).toEqual([]);
            expect(all.champigneb).toEqual([]);
        });

        it('center это базовый центр (immutable)', () => {
            const p = new FormationPlanner(standardOpts({ baseCenter: { x: 92, y: 92 } }));
            expect(p.center).toEqual({ x: 92, y: 92 });
        });
    });

    describe('updateForCounts — общие инварианты', () => {
        it('пустые counts → все массивы пустые', () => {
            const p = new FormationPlanner(standardOpts());
            const slots = p.updateForCounts({});
            expect(slots.sporomet).toEqual([]);
            expect(slots.eblekar).toEqual([]);
            expect(slots.champigneb).toEqual([]);
        });

        it('5 sporomet → ровно 5 sporomet-слотов, остальные пусты', () => {
            const p = new FormationPlanner(standardOpts());
            const slots = p.updateForCounts({ sporomet: 5 });
            expect(slots.sporomet.length).toBe(5);
            expect(slots.eblekar.length).toBe(0);
            expect(slots.champigneb.length).toBe(0);
        });

        it('все слоты ВНЕ базовой 15×15 зоны', () => {
            const opts = standardOpts();
            const p = new FormationPlanner(opts);
            const slots = p.updateForCounts({ sporomet: 50, eblekar: 50, champigneb: 50 });
            const all = [...slots.sporomet, ...slots.eblekar, ...slots.champigneb];
            for (const s of all) {
                const inBase = s.x >= opts.baseWallLeftX && s.y >= opts.baseWallTopY;
                expect(inBase).toBe(false);
            }
        });

        it('никаких дубликатов координат', () => {
            const p = new FormationPlanner(standardOpts());
            const slots = p.updateForCounts({ sporomet: 50, eblekar: 50, champigneb: 50 });
            const all = [...slots.sporomet, ...slots.eblekar, ...slots.champigneb];
            const keys = new Set(all.map(s => `${s.x},${s.y}`));
            expect(keys.size).toBe(all.length);
        });

        it('фильтрует non-walkable тайлы (вода=1)', () => {
            const map = makeMap();
            for (let x = 0; x < 100; x++) map[80][x] = 1;
            const p = new FormationPlanner(standardOpts({ map }));
            const slots = p.updateForCounts({ sporomet: 100, eblekar: 100, champigneb: 100 });
            const all = [...slots.sporomet, ...slots.eblekar, ...slots.champigneb];
            for (const s of all) {
                expect(map[s.y][s.x]).not.toBe(1);
            }
        });
    });

    describe('3 активные L подряд', () => {
        it('малый армия (3+3+3): d_start = 1, формация занимает {1, 4, 7}', () => {
            const opts = standardOpts();
            const p = new FormationPlanner(opts);
            const slots = p.updateForCounts({ sporomet: 3, eblekar: 3, champigneb: 3 });
            const all = [...slots.sporomet, ...slots.eblekar, ...slots.champigneb];
            const shells = distinctShells(all, opts.baseWallTopY, opts.baseWallLeftX);
            // Все слоты на одной из 3 активных L
            for (const s of shells) {
                expect([1, 4, 7]).toContain(s);
            }
        });

        it('армия > capacity 3-L при d_start=1: d_start сдвигается наружу', () => {
            const opts = standardOpts();
            const p = new FormationPlanner(opts);
            // 30+30+30 = 90 юнитов. d_start=1 вместит ~27. Должен сдвинуться.
            const slots = p.updateForCounts({ sporomet: 30, eblekar: 30, champigneb: 30 });
            const all = [...slots.sporomet, ...slots.eblekar, ...slots.champigneb];
            const shells = distinctShells(all, opts.baseWallTopY, opts.baseWallLeftX);
            // ровно 3 уникальных shell с шагом 3
            expect(shells.length).toBeLessThanOrEqual(3);
            if (shells.length === 3) {
                expect(shells[1] - shells[0]).toBe(3);
                expect(shells[2] - shells[1]).toBe(3);
            }
            // Inner shell > 1 (сдвинулся)
            expect(shells[0]).toBeGreaterThan(1);
        });

        it('армия = 0: пустой результат', () => {
            const p = new FormationPlanner(standardOpts());
            const slots = p.updateForCounts({});
            expect(slots.sporomet.length).toBe(0);
            expect(slots.eblekar.length).toBe(0);
            expect(slots.champigneb.length).toBe(0);
        });
    });

    describe('type-rank constraint', () => {
        it('eblekar только на inner L (= d_start) — тыл формации, передние линии для боевых', () => {
            const opts = standardOpts();
            const p = new FormationPlanner(opts);
            const slots = p.updateForCounts({ eblekar: 100, sporomet: 100, champigneb: 100 });
            const all = [...slots.sporomet, ...slots.eblekar, ...slots.champigneb];
            const shells = distinctShells(all, opts.baseWallTopY, opts.baseWallLeftX);
            const dStart = shells[0];
            for (const e of slots.eblekar) {
                expect(shellDist(e, opts.baseWallTopY, opts.baseWallLeftX)).toBe(dStart);
            }
        });

        it('sporomet только на inner или middle L', () => {
            const opts = standardOpts();
            const p = new FormationPlanner(opts);
            const slots = p.updateForCounts({ eblekar: 100, sporomet: 100, champigneb: 100 });
            const all = [...slots.sporomet, ...slots.eblekar, ...slots.champigneb];
            const shells = distinctShells(all, opts.baseWallTopY, opts.baseWallLeftX);
            const dStart = shells[0];
            const middle = dStart + 3;
            for (const s of slots.sporomet) {
                const sh = shellDist(s, opts.baseWallTopY, opts.baseWallLeftX);
                expect([dStart, middle]).toContain(sh);
            }
        });

        it('champigneb может быть на любой из 3 активных L', () => {
            const opts = standardOpts();
            const p = new FormationPlanner(opts);
            // 9 champ — d_start=1 вмещает (cap=27). Активные shells={1,4,7}.
            const slots = p.updateForCounts({ champigneb: 9 });
            const shells = distinctShells(
                slots.champigneb, opts.baseWallTopY, opts.baseWallLeftX);
            // Все слоты на одной из {1,4,7}
            expect(shells.every(s => s === 1 || s === 4 || s === 7)).toBe(true);
            // Champ priority в inner=3rd, middle=2nd, outer=1st. Inner-first:
            // inner заполняется первым (ebl=sporo=0, champ доливает). 7 inner
            // слотов → 7 champ. 2 champ → middle (priority [sporo,champ], sporo=0).
            expect(slots.champigneb.length).toBe(9);
        });

        it('eblekar расширяет формацию чтобы все вошли с stride 2 (никаких сирот)', () => {
            const opts = standardOpts();
            const p = new FormationPlanner(opts);
            const slots = p.updateForCounts({ eblekar: 30 });
            // Все 30 на одной L (inner)
            expect(slots.eblekar.length).toBe(30);
            const shells = distinctShells(slots.eblekar, opts.baseWallTopY, opts.baseWallLeftX);
            expect(shells.length).toBe(1);
        });

        it('если даже max d_start не вмещает eblekar — лишние сбрасываются', () => {
            const opts = standardOpts();
            const p = new FormationPlanner(opts);
            // Сверх-обилие лекарей — формация упирается в maxD
            const slots = p.updateForCounts({ eblekar: 1000 });
            expect(slots.eblekar.length).toBeLessThan(1000);
            expect(slots.eblekar.length).toBeGreaterThan(0);
        });
    });

    describe('priority внутри L (mixing в пределах rank)', () => {
        it('eblekar — на inner L; sporo — на inner или middle', () => {
            const opts = standardOpts();
            const p = new FormationPlanner(opts);
            const slots = p.updateForCounts({ eblekar: 3, sporomet: 3 });
            // 6 units, d_start=1 (вмещает). Inner L = L(d=1).
            for (const e of slots.eblekar) {
                expect(shellDist(e, opts.baseWallTopY, opts.baseWallLeftX)).toBe(1);
            }
            for (const s of slots.sporomet) {
                expect(shellDist(s, opts.baseWallTopY, opts.baseWallLeftX)).toBeLessThanOrEqual(4);
            }
        });

        it('outer L: champigneb приоритетно, ebl никогда (sporo — fallback если champ не хватает)', () => {
            const opts = standardOpts();
            const p = new FormationPlanner(opts);
            // Армия маленькая (3+3+3), d_start=1, outer L = L(d=7).
            const slots = p.updateForCounts({ sporomet: 3, eblekar: 3, champigneb: 3 });
            // Eblekar никогда на outer (rank=inner only)
            const eblOnOuter = slots.eblekar.filter(e =>
                shellDist(e, opts.baseWallTopY, opts.baseWallLeftX) === 7);
            expect(eblOnOuter.length).toBe(0);
            expect(slots.champigneb.length).toBe(3);
        });

        it('outer L: sporomet идёт на 1-ю линию если нет champignebs', () => {
            const opts = standardOpts();
            const p = new FormationPlanner(opts);
            // Много спорометов, ни одного champ — sporomets должны добраться до outer
            const slots = p.updateForCounts({ sporomet: 100, eblekar: 0, champigneb: 0 });
            const shells = distinctShells(slots.sporomet, opts.baseWallTopY, opts.baseWallLeftX);
            expect(shells.length).toBe(3); // sporo занял все 3 L
        });
    });

    describe('fillOrder', () => {
        it('inner-first (default): ebl на самой внутренней L (3-я линия)', () => {
            const opts = standardOpts();
            const p = new FormationPlanner(opts);
            const slots = p.updateForCounts({ eblekar: 3, sporomet: 3, champigneb: 3 });
            const shells = distinctShells(
                [...slots.eblekar, ...slots.sporomet, ...slots.champigneb],
                opts.baseWallTopY, opts.baseWallLeftX);
            const dStart = shells[0];
            for (const e of slots.eblekar) {
                expect(shellDist(e, opts.baseWallTopY, opts.baseWallLeftX)).toBe(dStart);
            }
        });

        it('outer-first: ebl всё равно на inner (rank ebl=inner, не зависит от fillOrder)', () => {
            const opts = standardOpts();
            const p = new FormationPlanner(opts);
            const slots = p.updateForCounts(
                { eblekar: 3, sporomet: 3, champigneb: 3 },
                { fillOrder: 'outer-first' },
            );
            const shells = distinctShells(
                [...slots.eblekar, ...slots.sporomet, ...slots.champigneb],
                opts.baseWallTopY, opts.baseWallLeftX);
            const dStart = shells[0];
            for (const e of slots.eblekar) {
                expect(shellDist(e, opts.baseWallTopY, opts.baseWallLeftX)).toBe(dStart);
            }
        });
    });

    describe('eblekar равномерное распределение по inner L', () => {
        it('11 eblekar на 100×100 → распределены по обоим плечам, шаг ≥ 8 клеток на каждом плече', () => {
            const opts = standardOpts();
            const p = new FormationPlanner(opts);
            // Достаточно sporo+champ чтобы dStart разъехался → плечи длинные.
            const slots = p.updateForCounts({
                eblekar: 11, sporomet: 200, champigneb: 200,
            });

            expect(slots.eblekar.length).toBe(11);

            // Группируем по плечам: top — общая y, left — общая x.
            const yCounts = new Map<number, number>();
            const xCounts = new Map<number, number>();
            for (const e of slots.eblekar) {
                yCounts.set(e.y, (yCounts.get(e.y) ?? 0) + 1);
                xCounts.set(e.x, (xCounts.get(e.x) ?? 0) + 1);
            }
            // Должны быть представлены оба плеча (а не один столбик как раньше).
            const topShare  = [...yCounts.values()].reduce((a, b) => Math.max(a, b), 0);
            const leftShare = [...xCounts.values()].reduce((a, b) => Math.max(a, b), 0);
            expect(topShare).toBeGreaterThan(0);
            expect(leftShare).toBeGreaterThan(0);

            // На каждом плече соседи разнесены минимум на 8 клеток (stride 2 × SLOT_STEP 4).
            const checkSpacing = (coords: number[]): void => {
                const sorted = [...coords].sort((a, b) => a - b);
                for (let i = 1; i < sorted.length; i++) {
                    expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(8);
                }
            };
            const apexY = opts.baseWallTopY - 1;
            const apexX = opts.baseWallLeftX - 1;
            // dStart может быть > 1 — собираем по фактическим строкам/столбцам плеч.
            const armYs = [...yCounts.keys()];
            const armXs = [...xCounts.keys()];
            for (const armY of armYs) {
                const xs = slots.eblekar.filter(e => e.y === armY).map(e => e.x);
                if (xs.length > 1) checkSpacing(xs);
            }
            for (const armX of armXs) {
                const ys = slots.eblekar.filter(e => e.x === armX).map(e => e.y);
                if (ys.length > 1) checkSpacing(ys);
            }
            expect(apexY).toBeLessThan(opts.baseWallTopY);
            expect(apexX).toBeLessThan(opts.baseWallLeftX);
        });
    });

    describe('generateWallL — огибание воды', () => {
        const advanceAndCheck = (p: FormationPlanner, counts: FormationUnitCounts) => {
            const slots = p.updateForCounts(counts);
            const positions = [...slots.sporomet, ...slots.eblekar, ...slots.champigneb];
            return p.checkWallTrigger(positions);
        };

        // На 100×100 standardOpts: baseWallTopY=baseWallLeftX=85.
        // checkWallTrigger срабатывает на shellDist = WALL_TRIGGER_RINGS·L_STEP = 15,
        // → top-плечо стены лежит на y=70, x∈[70..99]; left-плечо — на x=70, y∈[71..99].
        it('стена не ставится на воду; столбец с водой получает клетку выше', () => {
            const map = makeMap();
            // Полоса воды в строке y=70, x∈[75..85] — внутри top-плеча стены.
            for (let x = 75; x <= 85; x++) map[70][x] = 1;

            const opts = standardOpts({ map });
            const p = new FormationPlanner(opts);
            const wall = advanceAndCheck(p, { sporomet: 200, eblekar: 200, champigneb: 200 });
            expect(wall).not.toBe(null);

            for (const w of wall!) {
                expect(map[w.y][w.x]).not.toBe(1);
            }

            // Все 11 столбцов воды покрыты стеной выше воды (y<70).
            const topWalls = wall!.filter(w => w.x >= 75 && w.x <= 85);
            expect(topWalls.length).toBe(11);
            for (const w of topWalls) {
                expect(w.y).toBeLessThan(70);
            }
        });

        it('столбец полностью заблокирован горой → стена не ставится в этом столбце', () => {
            const map = makeMap();
            // В столбце x=80 от верха до строки стены — гора. Стена в этом столбце не нужна.
            for (let y = 0; y <= 80; y++) map[y][80] = 2;

            const opts = standardOpts({ map });
            const p = new FormationPlanner(opts);
            const wall = advanceAndCheck(p, { sporomet: 200, eblekar: 200, champigneb: 200 });
            expect(wall).not.toBe(null);

            for (const w of wall!) {
                expect(map[w.y][w.x]).not.toBe(2);
            }
            const onCol80 = wall!.filter(w => w.x === 80);
            expect(onCol80.length).toBe(0);
        });
    });

    describe('checkWallTrigger', () => {
        const advanceAndCheck = (p: FormationPlanner, counts: FormationUnitCounts) => {
            const slots = p.updateForCounts(counts);
            const positions = [
                ...slots.sporomet,
                ...slots.eblekar,
                ...slots.champigneb,
            ];
            return p.checkWallTrigger(positions);
        };

        it('null если позиций нет', () => {
            const p = new FormationPlanner(standardOpts());
            expect(p.checkWallTrigger([])).toBe(null);
        });

        it('срабатывает когда outer ring достаточно велик', () => {
            const p = new FormationPlanner(standardOpts());
            const wall = advanceAndCheck(p, { sporomet: 200, eblekar: 200, champigneb: 200 });
            expect(wall).not.toBe(null);
            expect(wall!.length).toBeGreaterThan(0);
        });

        it('стена имеет L-форму (TOP-сегмент И LEFT-сегмент)', () => {
            const opts = standardOpts();
            const p = new FormationPlanner(opts);
            const wall = advanceAndCheck(p, { sporomet: 200, eblekar: 200, champigneb: 200 });
            expect(wall).not.toBe(null);
            const hasTop = wall!.some(w => w.y < opts.baseWallTopY);
            const hasLeft = wall!.some(w => w.x < opts.baseWallLeftX);
            expect(hasTop).toBe(true);
            expect(hasLeft).toBe(true);
        });
    });
});
