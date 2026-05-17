const useUpdateBuildingsHandler = (mediator, answer, common) => {
    const { UPDATE_BUILDINGS_HANDLER } = mediator.getTriggerTypes();

    return (req, res) => {
        const { mapGuid, userGuid } = req.body;
        const entities = req.body.entities ?? req.body.buildings;
            if (!mapGuid || !userGuid || !entities) {
                return res.json(answer.bad(242));
            }
            //проверка гуидов
            if (!(common.checkGuid(mapGuid) && common.checkGuid(userGuid))) {
                return res.json(answer.bad(3001));
            }

        const result = mediator.get(UPDATE_BUILDINGS_HANDLER, { mapGuid, userGuid, entities });
        res.json(result?.result ? result : answer.good(result));
    }
}

module.exports = useUpdateBuildingsHandler;