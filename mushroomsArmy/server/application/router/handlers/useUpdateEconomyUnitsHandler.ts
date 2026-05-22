import { Request, Response } from 'express';
import CONFIG from '../../../config';
import { TBuildingInput } from '../../army/Army';
import { IAnswer, IMediator } from '../../types/global';

type TBody = {
    armyGuid: string;
    units: TBuildingInput[];
};

export const useUpdateEconomyUnitsHandler = (mediator: IMediator, answer: IAnswer) => {
    return (req: Request, res: Response) => {
        const { armyGuid, units } = req.body as TBody;

        if (!armyGuid || !Array.isArray(units)) {
            res.json(answer.bad(242));
            return;
        }

        const UPDATE_ECONOMY_UNITS = CONFIG.MEDIATOR.TRIGGERS.UPDATE_ECONOMY_UNITS;
        const result = mediator.get(UPDATE_ECONOMY_UNITS, { armyGuid, units });

        if (result) {
            res.json(answer.good(true));
        } else {
            res.json(answer.bad(242));
        }
    };
};
