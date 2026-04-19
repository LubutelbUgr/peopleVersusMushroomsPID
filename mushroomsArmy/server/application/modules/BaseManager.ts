import { Server as SocketIOServer } from 'socket.io';
import Common from './common/Common';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const GLOBAL_CONFIG = require('../../../../global/globalConfig');

export type TManagerOptions = {
    mediator: any;
    db: any;
    io: SocketIOServer;
    answer: any;
    common: Common;
}

class BaseManager {
    protected answer: any;
    protected mediator: any;
    protected db: any;
    protected io: SocketIOServer;
    protected common: Common;
    protected EVENTS: { [key: string]: string };
    protected TRIGGERS: { [key: string]: string };

    constructor(options: TManagerOptions) {
        const { mediator, db, io, answer, common } = options;

        this.answer = answer;
        this.mediator = mediator;
        this.db = db;
        this.io = io;
        this.common = common;

        this.EVENTS = this.mediator.getEventTypes();
        this.TRIGGERS = this.mediator.getTriggerTypes();
    }

    async send<T, K = undefined>(
        url: string,
        data: T | null = null,
        method = 'POST'
    ): Promise<K | null> {
        console.log('send to', url, data);
        try {
            const params: RequestInit = {
                method,
                headers: {
                    'Content-Type': 'application/json;charset=utf-8'
                },
            };

            if (data) {
                params.body = JSON.stringify(data);
            }

            const res = await fetch(url, params);
            const answer = await res.json() as any;

            console.log('answer', answer);

            if (answer && answer.result === 'ok') {
                return answer.data;
            }

            return null;
        } catch (error) {
            console.error(`[BaseManager] Ошибка запроса к ${url}:`, error);
            return null;
        }
    }

    sendToMap<T, K = undefined>(
        urlPath: string,
        mapGuid: string,
        armyGuid: string,
        data: T | null = null,
        extraPath?: string
    ): Promise<K | null> {
        const extra = extraPath ? `/${extraPath}` : '';
        return this.send(
            `${GLOBAL_CONFIG.MAP.URL}${urlPath}/${mapGuid}/${armyGuid}${extra}`,
            data,
        );
    }

    sendToMushroomsEconomy<T, K = undefined>(
        urlPath: string,
        data: T | null = null
    ): Promise<K | null> {
        return this.send(`${GLOBAL_CONFIG.MUSHROOMS_ECONOMY.URL}${urlPath}`, data);
    }

    sendToPeopleArmy<T, K = undefined>(
        urlPath: string,
        data: T | null = null
    ): Promise<K | null> {
        return this.send(`${GLOBAL_CONFIG.PEOPLE_ARMY.URL}${urlPath}`, data);
    }

    sendToPeopleEconomy<T, K = undefined>(
        urlPath: string,
        data: T | null = null
    ): Promise<K | null> {
        return this.send(`${GLOBAL_CONFIG.PEOPLE_ECONOMY.URL}${urlPath}`, data);
    }
}

export default BaseManager;