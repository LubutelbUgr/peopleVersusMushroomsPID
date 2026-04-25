import Unit from './Units';

describe('Unit', () => {
    let unit: Unit;

    beforeEach(() => {
        unit = new Unit({
            guid: 'test-1',
            type: 'soldier',
            x: 10,
            y: 10,
            hp: 100,
            maxHp: 100,
            speed: 5,
            attackRange: 10,
            fireDamageMultiplier: 2
        });
    });

    // ТЕСТ 1: Проверка инициализации юнита
    test('Юнит должен правильно инициализироваться', () => {
        expect(unit.guid).toBe('test-1');
        expect(unit.type).toBe('soldier');
        expect(unit.x).toBe(10);
        expect(unit.y).toBe(10);
        expect(unit.hp).toBe(100);
        expect(unit.maxHp).toBe(100);
        expect(unit.speed).toBe(5);
        expect(unit.attackRange).toBe(10);
        expect(unit.isAlive).toBe(true);
        expect(unit.fireDamageMultiplier).toBe(2);
    });

    // ТЕСТ 2: Физический урон
    test('Физический урон должен правильно уменьшать здоровье', () => {
        unit.takeDamage(10, 'physical');
        expect(unit.hp).toBe(90);
        
        unit.takeDamage(25, 'physical');
        expect(unit.hp).toBe(65);
        
        unit.takeDamage(30, 'physical');
        expect(unit.hp).toBe(35);
        
        expect(unit.isAlive).toBe(true);
        expect(unit.hp).toBeLessThan(100);
    });

    // ТЕСТ 3: Огненный урон с множителем
    test('Огненный урон должен применять множитель правильно', () => {
        unit.takeDamage(10, 'fire');
        expect(unit.hp).toBe(80);
        
        unit.takeDamage(15, 'fire');
        expect(unit.hp).toBe(50);
        
        expect(unit.hp).toBe(50);
        expect(unit.isAlive).toBe(true);
        expect(unit.fireDamageMultiplier).toBe(2);
    });

    // ТЕСТ 4: Смерть юнита при достижении 0 здоровья
    test('Юнит должен умирать когда здоровье достигает нуля', () => {
        unit.takeDamage(100, 'physical');
        expect(unit.hp).toBe(0);
        expect(unit.isAlive).toBe(false);
        
        unit.takeDamage(10, 'physical');
        expect(unit.hp).toBe(0);
        expect(unit.isAlive).toBe(false);
        
        expect(unit.hp).toBe(0);
    });

    // ТЕСТ 5: getState возвращает правильное состояние
    test('getState должен возвращать правильное состояние юнита', () => {
        const state = unit.getState();
        expect(state.guid).toBe('test-1');
        expect(state.type).toBe('soldier');
        expect(state.x).toBe(10);
        expect(state.y).toBe(10);
        expect(state.hp).toBe(100);
        expect(state.maxHp).toBe(100);
    });

    // ТЕСТ 6: Мёртвый юнит не получает урон
    test('Мёртвый юнит не должен получать урон', () => {
        unit.takeDamage(100, 'physical');
        expect(unit.isAlive).toBe(false);
        
        unit.takeDamage(50, 'physical');
        expect(unit.hp).toBe(0);
        
        unit.takeDamage(30, 'fire');
        expect(unit.hp).toBe(0);
        
        expect(unit.isAlive).toBe(false);
        expect(unit.hp).toBe(0);
    });

    // ТЕСТ 7: Здоровье не может быть отрицательным
    test('Здоровье никогда не должно быть ниже нуля', () => {
        unit.takeDamage(150, 'physical');
        expect(unit.hp).toBe(0);
        expect(unit.hp).not.toBeLessThan(0);
        expect(unit.isAlive).toBe(false);
        
        unit.takeDamage(50, 'fire');
        expect(unit.hp).toBe(0);
        expect(unit.hp).not.toBeLessThan(0);
    });

    // ТЕСТ 8: Огонь снимает яд с юнита
    test('Огненный урон должен очищать эффекты яда', () => {
        unit.poisonEffects.push({ duration: 10, damagePerSecond: 5, sourceGuid: 'test' });
        expect(unit.poisonEffects.length).toBe(1);
        
        unit.takeDamage(10, 'fire');
        expect(unit.poisonEffects.length).toBe(0);
        expect(unit.hp).toBe(80);
        expect(unit.isAlive).toBe(true);
    });

    // ТЕСТ 9: Нулевой урон не меняет здоровье
    test('Нулевой урон не должен изменять здоровье', () => {
        unit.takeDamage(0, 'physical');
        expect(unit.hp).toBe(100);
        
        unit.takeDamage(0, 'fire');
        expect(unit.hp).toBe(100);
        
        unit.takeDamage(0, 'poison');
        expect(unit.hp).toBe(100);
        
        expect(unit.isAlive).toBe(true);
        expect(unit.hp).toBe(100);
    });

    // ТЕСТ 10: getState после смерти
    test('getState после смерти должен показывать правильные значения', () => {
        unit.takeDamage(100, 'physical');
        expect(unit.isAlive).toBe(false);
        
        const state = unit.getState();
        expect(state.hp).toBe(0);
        expect(state.maxHp).toBe(100);
        expect(state.guid).toBe('test-1');
        expect(state.type).toBe('soldier');
        expect(state.x).toBe(10);
        expect(state.y).toBe(10);
    });
});