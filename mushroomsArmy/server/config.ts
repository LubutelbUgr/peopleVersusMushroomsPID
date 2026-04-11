interface Config {
    NAME: string;
    PORT: number;
    CORS: {
        origin: string;
    };
    DATABASE: {
        NAME: string;
    };
    MEDIATOR: {
        EVENTS: {
            START_GAME: string;
            ARMY_UPDATE: string;
            UNIT_DIED: string;
            UNIT_EXPLODED: string;
        };
        TRIGGERS: {
            GET_USER_BY_GUID: string;
            TAKE_DAMAGE_HANDLER: string;  // НОВЫЙ
            DESTROY_ARMY: string;          // НОВЫЙ
        };
    };
    SOCKET: {
        REGISTRATION: string;
        LOGIN: string;
        LOGOUT: string;
        LOBBY_START: string;
        VALIDATE_TOKEN: string;
        GAME_STATE: string;      
        GAME_OVER: string; 
    };
}

const CONFIG: Config = {
    NAME: 'Mushroom Army server',
    PORT: 3003,
    CORS: {
        origin: "*",
    },

    DATABASE: {
        NAME: 'mushroomsArmy.db',
    },

    MEDIATOR: {
        EVENTS: {
            START_GAME: 'START_GAME',
            ARMY_UPDATE: 'ARMY_UPDATE',
            UNIT_DIED: 'UNIT_DIED',
            UNIT_EXPLODED: 'UNIT_EXPLODED'
        },
        TRIGGERS: {
            GET_USER_BY_GUID: 'GET_USER_BY_GUID',
            TAKE_DAMAGE_HANDLER: 'TAKE_DAMAGE_HANDLER',  // НОВЫЙ
            DESTROY_ARMY: 'DESTROY_ARMY',                 // НОВЫЙ
        },
    },
    SOCKET: {
        REGISTRATION: 'registration',
        LOGIN: 'login',
        LOGOUT: 'logout',
        LOBBY_START: 'lobby:start',
        VALIDATE_TOKEN: 'auth:validate',
        GAME_STATE: 'game:state',    
        GAME_OVER: 'game:over' 
    }
};

export default CONFIG;