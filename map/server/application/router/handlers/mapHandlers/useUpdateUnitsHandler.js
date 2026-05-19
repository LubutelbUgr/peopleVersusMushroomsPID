const useUpdateUnitsHandler = (mediator, answer, common) => {
    const { UPDATE_UNITS_HANDLER } = mediator.getTriggerTypes();

    return (req, res) => {
        const { mapGuid, userGuid } = req.body;
    //Карта внутри ждёт entities.
    //peopleArmy шлёт entities: [...aliveUnits, ...destroyedUnits], старый клиент мог слать units.
    //Без ?? запрос с units → 242, юниты на карту не попадут.
        const entities = req.body.entities ?? req.body.units;
            if (!mapGuid || !userGuid || !entities) {
                return res.json(answer.bad(242));
            }
            //проверка гуидов
            if (!(common.checkGuid(mapGuid) && common.checkGuid(userGuid))) {
                return res.json(answer.bad(3001));
            }

        const result = mediator.get(UPDATE_UNITS_HANDLER, { mapGuid, userGuid, entities });
        res.json(result?.result ? result : answer.good(result));
    }
    //у них

    // return (req, res) => {
    //     const { mapGuid, userGuid, entities } = req.body;
    //         if (!mapGuid || !userGuid || !entities) {
    //             return res.json(answer.bad(242));
    //         }
    //         //проверка гуидов
    //         if (!(common.checkGuid(mapGuid) && common.checkGuid(userGuid))) {
    //             return res.json(answer.bad(3001));
    //         }

    //     res.json(answer.good(mediator.get(UPDATE_UNITS_HANDLER, { mapGuid, userGuid, entities })));
    // }
}

module.exports = useUpdateUnitsHandler;