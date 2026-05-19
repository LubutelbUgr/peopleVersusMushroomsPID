const Entity = require("./Entity");


//у них
// class Building extends Unit {
//     constructor({ x, y, type, guid, role, size = 1, visibility = 1 }) {
//         super({ x, y, type, guid, role, visibility });

//         this.size = size;
//     }

// здание на карте — не точечный юнит: у него площадь,
//  hp и обновление без удаления; старый вариант этого не покрывал.
class Building extends Entity {
    constructor({ x, y, type, guid, role, hp = 1, size = 1, sizeX, sizeY, visibility = 1, visible }) {
        super({ x, y, type });
        this.guid = guid;
        this.role = role;
        this.hp = hp;
        this.sizeX = sizeX ?? size;
        this.sizeY = sizeY ?? size;
        this.visibility = visibility ?? visible ?? 1;
    }

    get() {
        return {
            ...super.get(),
            guid: this.guid,
            role: this.role,
            hp: this.hp,
            sizeX: this.sizeX,
            sizeY: this.sizeY,
            visibility: this.visibility,
        };
    }

    getSelf() {
        return {
            ...this.get(),
        };
    }

    getPos() {
        return {
            x: [this.x, this.x + this.sizeX],
            y: [this.y, this.y + this.sizeY]
        }
    }

    getVisibleRange() {
        return {
            x: [this.x - this.visibility, this.x + this.visibility + this.sizeX],
            y: [this.y - this.visibility, this.y + this.visibility + this.sizeY],
        }
    }

    update({ x, y, type, hp, size, sizeX, sizeY, visibility, visible }) {
        this.x = x;
        this.y = y;
        if (type !== undefined) this.type = type;
        if (hp !== undefined) this.hp = hp;
        this.sizeX = sizeX ?? size ?? this.sizeX;
        this.sizeY = sizeY ?? size ?? this.sizeY;
        if (visibility !== undefined || visible !== undefined) {
            this.visibility = visibility ?? visible;
        }
    }
}

module.exports = Building;