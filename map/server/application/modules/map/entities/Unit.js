const Entity = require("./Entity");

class Unit extends Entity {
    constructor({ x, y, type, guid, role, hp = 1, visibility = 1 }) {
        super({ x, y, type });
        this.guid = guid;
        this.role = role;
        this.hp = hp;
        this.visibility = visibility;
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

    update({ x, y, hp }) {
        this.x = x;
        this.y = y;
        if (hp !== undefined) this.hp = hp;
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