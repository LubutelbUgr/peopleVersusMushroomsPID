# Спецификация: FormationPlanner

Статус: **draft**, ветка `ArmyStateManager_batalova_kuznetsova`.
Модель: **L-кольца** (после рефакторинга от ring/rows-модели).
Единственный источник правды по геометрии и поведению формации. При расхождении
кода и спеки — побеждает спека; код правится.

---

## 1. Контекст и термины

### 1.1 Сцена
- **Карта** — `TMap` (двумерный массив тайлов). Тайлы `{0, 2}` walkable, остальные — нет.
- **База игрока** — квадрат `15×15` в правом нижнем углу карты.
  - `baseWallTopY`  — y верхней стены базы (`mapRows - 15`).
  - `baseWallLeftX` — x левой стены базы (`mapCols - 15`).
  - `baseCenter`    — центр базы (`{x: cols-8, y: rows-8}` для дефолтной разметки).
- **Враги** заходят сверху и слева; нижнего/правого фронта нет (карта обрезана базой).

### 1.2 Юниты
Юниты делятся на **в формации** и **вне формации**.

| Тип        | В формации? | Роль                                            |
|------------|:-----------:|-------------------------------------------------|
| champigneb |     да      | передовая (мобильный камикадзе впереди sporomet)|
| sporomet   |     да      | стрелки (range, за champignebs)                 |
| eblekar    |     да      | медики (на самой внутренней L, под защитой)     |
| pizdoglyad |    **нет**  | разведчик; вне формации                         |
| vzryvomor  |    **нет**  | стационарная стена; ставится через wall trigger |

`FormationPlanner` оперирует **только** `{champigneb, sporomet, eblekar}`.
Pizdoglyad и vzryvomor управляются другими механизмами и не имеют слотов
в формации.

### 1.3 Глоссарий геометрии
- **shell-distance** (Chebyshev до угла стены): `d(x, y) = max(baseWallTopY - y, baseWallLeftX - x)`.
  - `d ≥ 1` означает: точка снаружи угла стены.
  - `d ≤ 0` — внутри базы или её границы; формация туда не ходит.
- **L(d)** — множество клеток на shell-distance ровно `d`. Геометрически это
  L-образная полоса, огибающая угол базы:
  - **TOP-сегмент**: `y = baseWallTopY - d`, `x ∈ [baseWallLeftX - d, mapCols - 1]`
  - **LEFT-сегмент**: `x = baseWallLeftX - d`, `y ∈ [baseWallTopY - d + 1, mapRows - 1]`
  - **apex** (вершина L) — клетка `(baseWallLeftX - d, baseWallTopY - d)`,
    точка, где TOP и LEFT сегменты встречаются. Часть TOP-сегмента (не считается
    дважды).
- **L-индекс** `i(d) = floor((d - MIN_D) / L_STEP)` — порядковый номер L
  (0 для самой внутренней с `d = MIN_D`). Используется для чередования смещения
  (см. §2). Для валидных L (`d ∈ {1, 4, 7, ...}`) это целое число.
- **wave-fill** — порядок обхода клеток L: от apex наружу, попеременно вдоль
  TOP и LEFT сегментов (см. §3.3).

---

## 2. Геометрия слотов (инварианты)

### 2.1 Параметры решётки
Константы (фиксированы в коде):
```
L_STEP      = 3   # расстояние между соседними L (между L(d) и L(d+L_STEP))
SLOT_STEP   = 4   # расстояние между соседними слотами на одной L
SLOT_OFFSET = 2   # полшага SLOT_STEP, для треугольной упаковки
MIN_D       = 1   # минимальное d (clearance от стены базы)
```
Количество одновременно активных L жёстко = 3 (зашито в §3.4, см. также §2.2).

Тройка `(L_STEP, SLOT_STEP, SLOT_OFFSET) = (3, 4, 2)` подобрана так, чтобы соседи
на трёх соседних L и в одной L были (приблизительно) равноудалены:
расстояние = `sqrt(SLOT_OFFSET² + L_STEP²) = sqrt(13) ≈ 3.6`, что близко к
`SLOT_STEP = 4`.

### 2.2 Какие L используются формацией
Формация занимает **ровно 3 активные L подряд**:
```
L(d_start), L(d_start + L_STEP), L(d_start + 2·L_STEP)
```
где `d_start ≥ 1` — минимальный, при котором три L **вмещают всех текущих
юнитов формации** (sum of counts). Подбор `d_start` per-tick без гистерезиса
(см. §3.2).

- **Inner L (внутренняя)** = `L(d_start)` — ближайшая из 3 активных к базе
- **Middle L (средняя)** = `L(d_start + L_STEP)`
- **Outer L (внешняя)** = `L(d_start + 2·L_STEP)` — дальняя из 3 активных

L с `d < d_start` (геометрически ближе к базе чем inner) — **пустые**. По мере
роста армии всё трио сдвигается **наружу как одно целое**; при убыли — обратно
к базе. «Inner/middle/outer» — это позиция В ТРОЙКЕ активных, не геометрия.

Если 3 L даже на максимально-возможной позиции `d_start = max(baseWallTopY, baseWallLeftX) - 2·L_STEP`
не вмещают всех юнитов — излишки **остаются без слота** (сидят в base zone,
см. §3.4). Расширение до 4+ L не делается.

### 2.3 Lattice-клетки на L(d)
Не каждая клетка на L(d) — слот. Слоты разбросаны вдоль L через `SLOT_STEP`,
с чередующимся смещением по L-индексу `i(d)`.

**TOP-сегмент L(d)** (`y = baseWallTopY - d`): клетка `(x, y)` — слот, если:
1. `(x - xShift(d)) % SLOT_STEP === 0`, где
   `xShift(d) = (i(d) & 1) ? SLOT_OFFSET : 0`
2. `x ∈ [baseWallLeftX - d, mapCols - 1]`
3. `map[y][x] ∈ {0, 2}` (walkable)

**LEFT-сегмент L(d)** (`x = baseWallLeftX - d`): клетка `(x, y)` — слот, если:
1. `(y - yShift(d)) % SLOT_STEP === 0`, где
   `yShift(d) = (i(d) & 1) ? SLOT_OFFSET : 0`
2. `y ∈ [baseWallTopY - d + 1, mapRows - 1]`
3. `map[y][x] ∈ {0, 2}`

**Apex** — часть TOP-сегмента (x = baseWallLeftX - d, y = baseWallTopY - d).
Является ли apex слотом — определяется TOP-правилом. Пример для карты 100×100
(`baseWallTopY = baseWallLeftX = 85`):
- `d=1`: apex `(84, 84)`, `i=0`, xShift=0, `84 % 4 = 0` → apex **является** слотом
- `d=4`: apex `(81, 81)`, `i=1`, xShift=2, `(81-2) % 4 = 3` → apex **не** слот
- `d=7`: apex `(78, 78)`, `i=2`, xShift=0, `78 % 4 = 2` → apex **не** слот

Это нормально: wave-fill начинается с lattice-клетки ближайшей к apex, не обязательно с apex.

### 2.4 Инварианты
1. Ни один слот не лежит внутри базы (`x ≥ baseWallLeftX AND y ≥ baseWallTopY`).
2. Слоты на разных L различимы: TOP и LEFT сегменты разных L не пересекаются.
3. Apex L(d) принадлежит ровно одному сегменту (TOP) — нет двойного учёта.
4. Между двумя соседними слотами на одной L по 3 пустых клетки (расстояние = `SLOT_STEP`).
5. Между соседними слотами на L(d) и L(d+L_STEP) — диагональ ≈ 3.6 (триангулярная упаковка).

---

## 3. Размещение слотов (`updateForCounts`)

### 3.1 Сигнатура
```ts
updateForCounts(
  counts: { sporomet?: number; eblekar?: number; champigneb?: number },
  opts?: { fillOrder?: 'inner-first' | 'outer-first' },
) : Record<FormationUnitType, FormationSlotPos[]>
```
`counts[T]` — желаемое количество юнитов типа T. Возвращает массивы координат
по типам. Если валидных клеток меньше чем `sum(counts)` — возвращает столько,
сколько влезло.

`opts.fillOrder` (default `'inner-first'`) — порядок прохода main L (см. §3.4).

### 3.2 Type-rank constraint и приоритет L
Каждый тип имеет **ранг** — это перечень активных L, на которые ему вообще
разрешено вставать:

| Тип        | Rank (разрешённые активные L)                | Почему                                |
|------------|----------------------------------------------|---------------------------------------|
| eblekar    | только **inner**                              | медик под защитой, никогда не на передовой |
| sporomet   | inner + **middle**                            | стрелок, защищён фронтом              |
| champigneb | inner + middle + **outer**                    | передовая, может быть везде           |

Внутри каждой активной L приоритет:
- **inner**:  `[eblekar, sporomet, champigneb]`
- **middle**: `[sporomet, champigneb]` (ebl исключён по рангу)
- **outer**:  `[champigneb]` (sporo и ebl исключены по рангу)

Правило выбора типа для слота: первый тип из priority с `remaining[type] > 0`.

**Mixing** работает естественно ВНУТРИ rank-ограничения: например на inner L
если ebl-ов мало, sporomet/champigneb доливают остаток inner L. Но: если
champigneb-ов мало на outer L, **средняя L им не помогает** (sporo/ebl не
могут на outer по рангу), outer L просто остаётся частично пустой.

**Излишки типов** (rank не позволяет идти на следующую L, и приоритетная L
переполнена) — `remaining[type] > 0` после всех 3 L. Эти юниты получают
`formationTarget = null` и стоят на месте (см. §3.4).

### 3.3 Wave-fill: порядок обхода слотов внутри L
Внутри одной L слоты заполняются **от apex наружу попеременно по TOP и LEFT**.

Алгоритм:
1. Собрать lattice-слоты TOP-сегмента в массив `top[]`, отсортированный
   по расстоянию от apex (увеличивая `x`). `top[0]` — ближайший к apex.
2. Собрать lattice-слоты LEFT-сегмента в массив `left[]`, по расстоянию
   от apex (увеличивая `y`). `left[0]` — ближайший к apex.
3. Если apex — слот, он входит в `top[0]`.
4. Идти волнами: `top[0], left[0], top[1], left[1], top[2], left[2], ...`,
   останавливаясь когда сегмент исчерпан (длиннее сегмент продолжает один).

Это даёт расширение формации **из угла наружу симметрично** по обоим направлениям.
Если юнитов мало, они стоят у угла; чем больше юнитов — тем дальше тянется L.

### 3.4 Алгоритм заполнения

**Шаг 1: подобрать `d_start`.**
```
total = counts.eblekar + counts.sporomet + counts.champigneb
d_start = 1
while True:
    cap = |lShellCells(d_start)| + |lShellCells(d_start + L_STEP)| + |lShellCells(d_start + 2·L_STEP)|
    if cap >= total: break
    // Не сдвигаемся за границу: outer L должен оставаться в карте.
    if d_start + 2·L_STEP >= max(baseWallTopY, baseWallLeftX): break  // truncate
    d_start += L_STEP
```
Условие выхода `>= max` (а не `>`) гарантирует outer L = `d_start + 2·L_STEP`
строго < `max`, т.е. apex outer L внутри карты (если apex_y = baseWallTopY - outer_d
≥ 0, и аналогично для apex_x).

**Шаг 2: заполнить 3 активные L по порядку `fillOrder`.**

Порядок прохода L (опция `opts.fillOrder`, default `'inner-first'`):
- `'inner-first'`: inner → middle → outer
- `'outer-first'`: outer → middle → inner

Для каждой L:
1. Получить wave-ordered массив lattice-слотов L (см. §3.3).
2. Для каждого слота: первый тип из priority L (см. §3.2) с `remaining[type] > 0`
   занимает слот, `remaining[type]--`.
3. Если `priority L` пуст по всем типам или все `remaining = 0` — переход к следующей L.

**Шаг 3: излишки.**
Юниты с `remaining[type] > 0` после прохода всех 3 L получают `formationTarget = null`
(это решение `ArmyStateManager`-а, не планнера). В `Unit.makeDecision` они выбирают
fallback `stay` — стоят на текущей позиции (обычно в base zone, где их заспавнили).

При малом числе юнитов формация **компактная у стены** (d_start=MIN_D=1):
- ebls на inner L(d_start), доливают sporo/champ (mixing)
- если ebl + sporo + champ ≤ inner capacity — формация на одной L
- иначе по обычным правилам §3.2

При большой армии формация **сдвигается наружу**: d_start растёт пока 3 L не вмещают.
Inner L при этом — НЕ L(MIN_D) а L(d_start) с возможно большим d_start. Геометрически
«у самой стены» больше нет формации; защита базы — vzryvomor стены и sporovaya bashnya.

`fillOrder` опционален и **сейчас не используется** `ArmyStateManager`-ом —
вызов идёт без `opts`, default `'inner-first'`. Параметр зарезервирован для
будущего управления по фазе игры (см. §6.2); сам планнер не знает о фазах.

### 3.5 Инварианты возврата
1. `result[T].length ≤ counts[T] ?? 0` для каждого T.
2. Каждый `(x, y) ∈ result` уникален между всеми типами.
3. Каждый `(x, y)` — валидный lattice-слот (§2.3), не в базе.
4. **Rank инвариант**: 
   - `result.eblekar` ⊂ slots inner L
   - `result.sporomet` ⊂ slots inner ∪ middle L
   - `result.champigneb` ⊂ slots inner ∪ middle ∪ outer L
5. Все слоты — на одной из 3 активных L (т.е. shell ∈ `{d_start, d_start+L_STEP, d_start+2·L_STEP}`).

---

## 4. Поведение юнитов (вне FormationPlanner, но завязано на слоты)

### 4.1 Контур управления
Формация управляет юнитами **косвенно** — через поле `Unit.formationTarget`.
Планнер не отдаёт команд напрямую; он лишь говорит «каждый юнит → его слот».
Юнит сам идёт к своему `formationTarget` с помощью встроенного pathfinding
(EasyStar поверх walkable тайлов).

Контур одного тика `ArmyStateManager.updateFormationAndWalls`:
1. Подсчитать живых юнитов по типам → `counts`.
2. `planner.updateForCounts(counts)` → массивы слотов `slots[T]` (rank-валидные).
3. `assignFormationTargets(slots)` (stable, см. §4.2) → каждому живому юниту
   проставлено `formationTarget = {x,y}` или `null` для overflow.
4. Собрать `unitPositions` — координаты тех, кто **осел** (Chebyshev ≤ SETTLE_RADIUS
   от своего `formationTarget`, см. §5). Юниты без слота и в transit — не включаются.
5. `planner.checkWallTrigger(unitPositions)` → возможные новые позиции vzryvomor.

Параллельно на каждом тике юнита (`Unit.update`):
- `makeDecision` выбирает действие: enemy (в leashRadius если задан) > formation > stay.
  - При «formation» цель = `formationTarget`.
  - При `formationTarget === null` цель отсутствует — fallback 'stay' (юнит стоит).
- Шаг к цели делается через EasyStar (учитывает walkable тайлы).

Свойства разделения ответственности:
- Планнер **не знает** позиций юнитов, путей, скорости. Чистая функция `counts → slots`.
- `ArmyStateManager` — единственный, кто мутирует `unit.formationTarget`.
- Юнит **не знает** что он в формации — реагирует только на enemy/ally/target. Если
  целей нет, стоит на месте.
- Pathfinding и движение — внутренняя логика `Unit`, не часть формации.

Жизненный цикл `formationTarget` у юнита:
- **Spawn**: `formationTarget = null`. На ближайшем тике `assignFormationTargets`
  поставит слот (если есть свободный в `slots[T]`).
- **В формации**: каждый тик `assignFormationTargets` проверяет валидность; если
  слот остался в новом `slots[T]` — сохраняет, иначе сбрасывает в null и переназначает.
- **Death**: юнит исчезает из `army.units`; следующий тик пересчитает `counts` без него,
  d_start может контракнуться.

### 4.2 formationTarget + stable assignment
`Unit.formationTarget: {x, y} | null` — координата слота от планнера.
`ArmyStateManager` после каждого `updateForCounts` назначает targets юнитам
по **stable algorithm** (минимизирует ре-таргетинг при изменении d_start):

```
для каждого type T:
    new_slots = planner.slots[T]   (rank-валидны по построению)
    alive_units = units.filter(alive && type == T)

    # Шаг 1: сохранить юнитов, чей текущий target всё ещё в new_slots
    claimed_slots = Set()
    for u in alive_units:
        if u.formationTarget && u.formationTarget ∈ new_slots && u.formationTarget ∉ claimed_slots:
            claimed_slots.add(u.formationTarget)
        else:
            u.formationTarget = null  # будет переназначен

    # Шаг 2: оставшимся юнитам выдать неназначенные слоты в wave-order
    free_slots = [s for s in new_slots if s ∉ claimed_slots]
    unassigned = [u for u in alive_units if u.formationTarget is null]
    for i, u in enumerate(unassigned):
        u.formationTarget = i < len(free_slots) ? free_slots[i] : null
```

Свойства:
- При **стабильном d_start**: новички получают свободные слоты, существующие — на местах.
- При **shift d_start** (рост/убыль армии): юниты, чей target оказался не в новом
  активном наборе, переназначаются. Остальные стоят на своих местах.
- **Rank инвариант сохранён** автоматически: планнер выдаёт `slots[ebl]` ⊂ inner L,
  поэтому юниты-ebl могут получить только inner-слоты. Никаких «медиков на outer».
- **Overflow** (`formationTarget = null`): юнит стоит на месте per Unit.makeDecision
  fallback (обычно в base zone).

### 4.3 makeDecision — приоритет целей
| Тип        | Приоритет целей                                    | Параметры          |
|------------|----------------------------------------------------|--------------------|
| sporomet   | enemy > formation > stay                           | —                  |
| champigneb | enemy(в radius leashRadius) > formation > stay     | `leashRadius = 20` |
| eblekar    | wounded ally > formation > stay                    | (не атакует)       |

«stay» = стоит на текущей позиции. Никаких walk-к-центру-карты, если нет цели.

### 4.4 Champigneb leash
Champigneb игнорирует противников дальше `leashRadius = 20` от своего
`formationTarget` (или текущей позиции в transit). Без этого передовая
размазывается по карте и теряет функцию.

---

## 5. Wall trigger (Vzryvomor стена)

### 5.1 Назначение
Vzryvomor — стационарные взрывающиеся стены. Ставятся автоматически когда
формация «осваивает» новый кольцевой слой территории. Защитная отсечка
для подходящих врагов.

### 5.2 Сигнатура
```ts
checkWallTrigger(unitPositions: ReadonlyArray<{x, y}>): FormationSlotPos[] | null
```
- `unitPositions` — **фактические** координаты живых **осевших** юнитов формации
  (champigneb | sporomet | eblekar), переданные `ArmyStateManager`-ом.
  Не слоты! Стена строится тогда, когда юниты физически дошли, а не сразу на спавне.
- Возвращает массив `(x, y)` для расстановки vzryvomor, либо `null`.

«Осевший» = Chebyshev distance от текущей позиции юнита до его `formationTarget` ≤ `SETTLE_RADIUS` (=1). Юниты в transit к слоту и юниты без `formationTarget` (overflow за пределами ёмкости планнера) — **не передаются** в `checkWallTrigger`. Это решение `ArmyStateManager`-а, не планнера; FormationPlanner просто доверяет переданному списку.

### 5.3 Логика
```
outerShell = max( d(u.x, u.y) for u in unitPositions )
outerRingIdx = floor(outerShell / L_STEP)

if outerRingIdx - lastWallRingIdx >= WALL_TRIGGER_RINGS:  # 5
    newRingIdx = lastWallRingIdx + WALL_TRIGGER_RINGS
    lastWallRingIdx = newRingIdx
    return generateWallL( newRingIdx * L_STEP )
return null
```

`generateWallL(shellDist)` строит **сплошную** L (каждую клетку, не lattice-слоты)
на shell-distance `shellDist`, обрезанную по границам карты.

### 5.4 Инварианты
1. Пустой `unitPositions` → `null`.
2. Триггер монотонен: `lastWallRingIdx` только растёт.
3. Повторный вызов сразу после успешного — `null` (пока юниты не продвинулись на ещё `WALL_TRIGGER_RINGS` колец).
4. Стена всегда L-формы.

### 5.5 Settle-detection
Прошлая проблема — триггер срабатывал на юнитов **в transit** (например champigneb
заспавнился вдали от базы и шёл к слоту L(d=1), пять wall triggers выстреливали
подряд) — решена через settle-detection в §5.2. Реализация — фильтр в
`ArmyStateManager.updateFormationAndWalls`.

---

## 6. Open questions (не решены)

1. **Wave-направление адаптивно к атаке**: сейчас wave-fill симметричен из apex.
   Долгосрочно — стартовать с точки L, ближайшей к центру масс врагов
   (формация перестраивается на направление удара). Сейчас не делаем.
2. **Фазы Rest/Combat/Compression(<50)/Attack(>100)**: поведение в каждой фазе
   живёт в `ArmyStateManager`. Нужна отдельная спека `phases.md`?
3. **Фазовая compression при <50**: динамическая контракция формации (d_start
   уменьшается per-tick когда армия сокращается) **уже реализована** через
   стандартный алгоритм §3.4 — демка подтвердила, что после убийства юнитов
   формация контрактнулась. Что осталось OQ — это **фазовое** поведение из
   §6.2 («при <50 живых триггерится спец-режим Compression»), которое может
   отличаться от обычной контракции (например, форсированный d_start=MIN_D
   независимо от capacity, или особая priority типов). Если фазовая семантика
   не нужна — закрыть как resolved-by-§3.4.
4. **Eblekar AI**: «ally > formation > stay». Радиус поиска раненого аллая не зафиксирован.

---

## 7. Out of scope

- **Spawn ratios 40/40/10/10** — сценарий тестового спавна, не функциональность планнера.
- **Pizdoglyad** — разведчик, вне формации.
- **Vzryvomor движение/AI** — стены статичны, ставятся через wall trigger.
- **Map generation, base layout** — приходят как входные `baseWall*/baseCenter`.

---

## 8. Соответствие коду

| Спека         | Файл                                                                          |
|---------------|-------------------------------------------------------------------------------|
| §2, §3        | `application/army/FormationPlanner.ts`                                        |
| §3.5 (тесты)  | `application/army/FormationPlanner.test.ts`                                   |
| §4            | `application/army/entities/Units.ts`, `entities/Champigneb/Champigneb.ts`     |
| §5            | `application/army/FormationPlanner.ts` + вызов из `ArmyStateManager.ts`       |
| §1 (база)     | `application/army/Army.ts` (`generateDefensiveLayout`)                        |
