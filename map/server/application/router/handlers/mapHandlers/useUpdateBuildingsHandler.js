const useUpdateBuildingsHandler = (mediator, answer, common) => {
    const { UPDATE_BUILDINGS_HANDLER } = mediator.getTriggerTypes();

    return (req, res) => {
        const { mapGuid, userGuid } = req.body;
        //только const { …, entities } = req.body → запрос с buildings падал в 242 («не переданы параметры»), хотя данные есть.
        //?? req.body.buildings — совместимость имён, внутрь mediator всё равно уходит entities.
        const entities = req.body.entities ?? req.body.buildings;
            if (!mapGuid || !userGuid || !entities) {
                return res.json(answer.bad(242));
            }
            //проверка гуидов
            if (!(common.checkGuid(mapGuid) && common.checkGuid(userGuid))) {
                return res.json(answer.bad(3001));
            }

        const result = mediator.get(UPDATE_BUILDINGS_HANDLER, { mapGuid, userGuid, entities });
        //Старый answer.good(mediator.get(...)) на ошибке даёт ложный ok. Новая строка — чтобы этого не было.
        //На успехе с true оба варианта дают { result: "ok", data: true }
        res.json(result?.result ? result : answer.good(result));
    }

    //у них

//     return (req, res) => {
//         const { mapGuid, userGuid, entities } = req.body;
//             if (!mapGuid || !userGuid || !entities) {
//                 return res.json(answer.bad(242));
//             }
//             //проверка гуидов
//             if (!(common.checkGuid(mapGuid) && common.checkGuid(userGuid))) {
//                 return res.json(answer.bad(3001));
//             }

//         res.json(answer.good(mediator.get(UPDATE_BUILDINGS_HANDLER, { mapGuid, userGuid, entities })));
//     }
}

module.exports = useUpdateBuildingsHandler;