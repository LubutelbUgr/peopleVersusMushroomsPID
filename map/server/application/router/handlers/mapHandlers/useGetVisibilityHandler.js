const useGetVisibilityHandler = (mediator, answer, common) => {
    const { GET_VISIBILITY_HANDLER } = mediator.getTriggerTypes();

    return (req, res) => {
        const { mapGuid, userGuid } = req.body;
        //проверка гуидов
        if (!(common.checkGuid(mapGuid) && common.checkGuid(userGuid))) {
            return res.json(answer.bad(3001));
        }
        const result = mediator.get(GET_VISIBILITY_HANDLER, { mapGuid, userGuid });
        res.json(result?.result ? result : answer.good(result));
    }
    //у них

    //двойная обёртка, sendToMap в peopleArmy видит ok и ломается.

    // return (req, res) => {
    //     const { mapGuid, userGuid } = req.body;
    //     //проверка гуидов
    //     if (!(common.checkGuid(mapGuid) && common.checkGuid(userGuid))) {
    //         return res.json(answer.bad(3001));
    //     }
    //     res.json(answer.good(mediator.get(GET_VISIBILITY_HANDLER, { mapGuid, userGuid })));
    // }
}

module.exports = useGetVisibilityHandler;