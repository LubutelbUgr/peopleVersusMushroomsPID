const Entity = require("./Entity");

class Unit extends Entity {
    constructor({ x, y, type, guid, role, hp = 1, visibility = 1, visible }) {
        super({ x, y, type });
        this.guid = guid;
        this.role = role;
        //добавлено
        //Без поля юнит на карте без здоровья: смерть по входящему пакету один раз сработает,
        //  но после update()/get() hp не сохранится.
        this.hp = hp;
        this.visibility = visibility ?? visible ?? 1;
        //
    }

    get() {
        return {
            ...super.get(),
            guid: this.guid,
            role: this.role,
            hp: this.hp,
            visibility: this.visibility,
        };
    }

    update({ x, y, type, hp, visibility, visible }) {
        this.x = x;
        this.y = y;
        if (type !== undefined) this.type = type;
        if (hp !== undefined) this.hp = hp;
        if (visibility !== undefined || visible !== undefined) {
            this.visibility = visibility ?? visible;
        }
    }
    
    getSelf() {
        return {
            ...this.get(),
            visibility: this.visibility,
        };
    }

    getVisibleRange() {
        return {
            x: [this.x - this.visibility, this.x + this.visibility],
            y: [this.y - this.visibility, this.y + this.visibility],
        }
    }
}

module.exports = Unit;