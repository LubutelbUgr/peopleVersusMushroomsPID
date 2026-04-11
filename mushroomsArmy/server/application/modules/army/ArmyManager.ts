import BaseManager from '../BaseManager';
import CONFIG from '../../../config';

const { GAME_STATE, GAME_OVER } = CONFIG.SOCKET;

interface ArmyManagerOptions {
    mediator: any;
    db: any;
    io: any;
    answer: any;
    common: any;
}

class ArmyManager extends BaseManager {
    private army: { [guid: string]: any };

    constructor(options: ArmyManagerOptions) {
        super(options);

        this.army = {};

        // Подписки на события медиатора
        this.mediator.subscribe(this.EVENTS.START_GAME, (data: any) => this.eventStartGame(data));
        
        // РЕГИСТРИРУЕМ НОВЫЕ ТРИГГЕРЫ
        this.mediator.set(this.TRIGGERS.TAKE_DAMAGE_HANDLER, (data: any) => this.handleTakeDamage(data));
        this.mediator.set(this.TRIGGERS.DESTROY_ARMY, (guid: string) => this.destroyArmy(guid));
    }

    /* ПРИВАТНЫЕ МЕТОДЫ */
    private updateArmyCallback(guid: string, data: any): void {
        const user = this.mediator.get(this.TRIGGERS.GET_USER_BY_GUID, guid);
        if (!user) return;

        this.io.to(user.socketId).emit(GAME_STATE, this.answer.good(data));

        // Проверяем: если все юниты мертвы — game over
        const army = this.army[guid];
        if (army && army.getAliveUnits().length === 0) {
            this.io.to(user.socketId).emit(GAME_OVER, this.answer.good({ message: 'Все юниты погибли' }));
            this.destroyArmy(guid);
        }
    }

    private destroyArmy(guid: string): void {
        const army = this.army[guid];
        if (army && army.destructor) {
            army.destructor();
        }
        delete this.army[guid];
        console.log(`[ArmyManager] Армия уничтожена для игрока ${guid}`);
    }

    // НОВЫЙ ОБРАБОТЧИК ДЛЯ TAKE_DAMAGE_HANDLER
    private handleTakeDamage(data: any): any {
        const { sourceGuid, targetGuid, amount, damageType } = data;
        const army = this.army[targetGuid];
        
        if (!army) {
            return { success: false, error: 'Army not found' };
        }
        
        // Здесь будет логика нанесения урона юниту
        // Пока возвращаем успех
        return { success: true, damage: amount, type: damageType };
    }

    /* СОБЫТИЯ */
    private eventStartGame({ guid, map, buildings }: { guid: string; map: (number | null)[][]; buildings: any[] }): void {
        const user = this.mediator.get(this.TRIGGERS.GET_USER_BY_GUID, guid);
        if (!user) return;

        // Если у игрока уже есть армия — уничтожаем старую
        if (this.army[guid]) {
            this.destroyArmy(guid);
        }

        // заменить any на Army когда класс будет создан (таска B4)
        // Раскомментировать после создания класса Army
        // this.army[guid] = new Army({
        //     map,
        //     buildings,
        //     common: this.common,
        //     guid,
        //     callbacks: {
        //         update: (guid: string, data: any) => this.updateArmyCallback(guid, data)
        //     }
        // });

        console.log(`[ArmyManager] Армия создана для игрока ${guid}`);
    }
}

export default ArmyManager;