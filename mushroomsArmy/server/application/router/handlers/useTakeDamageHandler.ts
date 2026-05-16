import { Request, Response } from 'express';
import CONFIG from '../../../config';
import { IAnswer, IMediator } from '../../types/global';

export const useTakeDamageHandler = (mediator: IMediator, answer: IAnswer) =>
    (req: Request, res: Response): void => {
        const { armyGuid, unitGuid, amount } = req.body;

        if (!armyGuid || Array.isArray(armyGuid) || !unitGuid || amount === undefined) {
            res.json(answer.bad(242));
            return;
        }

        if (typeof amount !== 'number' || amount < 0 || !isFinite(amount)) {
            res.json(answer.bad(242));
            return;
        }

        const result = mediator.get(CONFIG.MEDIATOR.TRIGGERS.TAKE_DAMAGE_HANDLER, { armyGuid, unitGuid, amount });
        res.json(result ? answer.good(true) : answer.bad(242));
    };

export const useTakeEconomyDamageHandler = (mediator: IMediator, answer: IAnswer) =>
    (req: Request, res: Response): void => {
        // Забираем поля в формате экономики людей: guid (здания), damage (урон), economyGuid (их сервиса)
        const { guid, damage, economyGuid } = req.body;

        // Валидация входящих данных
        if (!guid || !economyGuid || damage === undefined) {
            res.json(answer.bad(242)); // Или твой код ошибки для невалидных данных
            return;
        }

        if (typeof damage !== 'number' || damage < 0 || !isFinite(damage)) {
            res.json(answer.bad(242));
            return;
        }

        // Передаем событие в медиатор нашей грибной армии. 
        // Прежде чем это заработает, нужно будет добавить триггер TAKE_ECONOMY_DAMAGE в CONFIG
        const result = mediator.get(CONFIG.MEDIATOR.TRIGGERS.TAKE_ECONOMY_DAMAGE, { 
            buildingGuid: guid, 
            amount: damage, 
            economyGuid 
        });

        res.json(result ? answer.good(true) : answer.bad(242));
    };
