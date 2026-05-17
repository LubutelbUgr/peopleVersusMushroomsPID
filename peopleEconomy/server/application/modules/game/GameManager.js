//GLOBAL
const BaseManager = require('../../../../../global/modules/BaseManager');
const GLOBAL_CONFIG = require('../../../../../global/globalConfig');

// LOCAL
const CONFIG = require("../../../config");
const Economy = require('../../economy/Economy');


class GameManager extends BaseManager {
	constructor(options) {
		super(options);
		// data
		this.economies = {};

		// связка: peopleEconomyGuid -> mushroomsArmyGuid
		this.mushroomsArmyGuidByPeopleEconomyGuid = {};
		// sockets
		if (!this.io) return;
		this.io.on('connection', (socket) => { });
		// mediator events subscribers
		this.mediator.subscribe(this.EVENTS.START_GAME, (data) => this.eventStartGame(data));
		this.mediator.subscribe(this.EVENTS.LOAD_GAME, (data) => this.eventLoadGame(data));
		this.mediator.subscribe(this.EVENTS.APPLY_DAMAGE, (data) => this.eventApplyDamage(data));
		// mediator triggers setters
		//...
	}

	/* PRIVATE */
	callbackUpdate(data) {
		// Economy.get() возвращает:
		// { guid: economyGuid, buildings: [...], map: mapGuid }
		const economyGuid = data?.guid;
		const mapGuid = data?.map;
		const buildings = data?.buildings ?? [];

		if (!economyGuid || !mapGuid) return;

		const user = this.mediator.get(this.TRIGGERS.GET_USER_BY_GUID, economyGuid);
		if (!user) {
			console.log('User отсутствует!, callbackUpdate не работает! \n map guid: ', mapGuid);
			return;
		}

		// выплюнуть сообщение в карту
		this.updateBuildings(mapGuid, economyGuid, buildings);

		// параллельно сообщаем mushromsArmy об economy-зданиях людей,
		// чтобы они попали в Army.economyBuildings и отрисовались на поле
		const mushroomsArmyGuid = this.mushroomsArmyGuidByPeopleEconomyGuid?.[economyGuid];
		if (mushroomsArmyGuid) {
			// Нормализация type к lowercase-ключам клиента выполняется внутри updateBuildings
			// но здесь payload должен совпасть с expected TBuildingInput фронта.
			// reuse logic: прогоняем через updateBuildings normalization в отдельной функции нельзя,
			// поэтому нормализуем здесь в минимальном виде.
			const normalizedBuildings = (buildings ?? []).map(b => {
				const t = b?.type;
				if (typeof t !== 'string') return b;
				return { ...b, type: t.toLowerCase().replace('small_generator', 'smallgenerator') };
			});

			this.sendToMushroomsArmy('/updateEconomyBuildings', {
				armyGuid: mushroomsArmyGuid,
				buildings: normalizedBuildings,
			});
		}

		// запросить рельеф
		this.getRelief(mapGuid, economyGuid, mapGuid);

		// ответить на СВОЙ клиент
		this.io.to(user.socketId).emit(
			CONFIG.SOCKET.UPDATE_SCENE,
			this.answer.good(data)
		);
		//this.io.to(user.socketId).emit(CONFIG.SOCKET.UPDATE_SCENE, this.answer.bad(1002));
	}

	/* TRIGGERS */

	/* EVENTS */
	eventStartGame(data = {}) {
		
		const { guids, startPoint } = data;
		console.log('EVENT START GAME');
		//console.log(guids);
		//console.log(SET_SERVICES_GUIDS);

		// сохраняем связку peopleEconomyGuid -> mushroomsArmyGuid
		// (из start payload: в guids приходит и peopleEconomy, и mushroomsArmy)
		if (guids?.peopleEconomy && guids?.mushroomsArmy) {
			this.mushroomsArmyGuidByPeopleEconomyGuid[guids.peopleEconomy] = guids.mushroomsArmy;
		}

		if (guids.mushroomsEconomy) {
			const guid = guids.mushroomsEconomy;
			const user = this.mediator.get(this.TRIGGERS.GET_USER_BY_GUID, guid);
			if (user && user.socketId) {
				this.economies[guid] = new Economy({
					db: this.db,
					common: this.common,
					callbacks: {
						updated: (data) => this.callbackUpdate(data),
						spawnArmyUnit: (data) => this.spawnArmyUnit(data),
					},
					guids, 
					startPoint
				});
				const sceneData = this.economies[guid].get();

				this.io.to(user.socketId).emit(
					GLOBAL_CONFIG.SOCKET.START_GAME,
					sceneData
				);
				//this.getResources(guid, mapGuid);
				console.log("Экономика создана");
				return sceneData;
			}
			return this.answer.bad(1001)
		}
		return this.answer.bad(4001);
	}
	
	eventApplyDamage(data = {}) {
		const { guid, damage, economyGuid } = data;
		const economy = this.economies[economyGuid];

		if (!economy) {
			return false;
		}

		return economy.applyDamage(guid, damage);
	}

	async getRelief(map, guid, mapGuid) {
		if (typeof(map.relief[0][0]) !== "object") return;
		const relief = await this.sendToMap(GLOBAL_CONFIG.URLS.GET_RELIEF, { mapGuid, userGuid: guid });

		if (relief) {
			if (this.economies[guid]) {
				this.economies[guid].setRelief(relief);
			}
		}

	}

	updateBuildings(mapGuid, peopleEconomyGuid, buildings = []) {
		if (buildings.length === 0) return;

		// Нормализуем type к ключам, которые ожидает mushromsArmy (unitRenderer.ts / ECONOMY_BUILDING_CONFIG)
		// Примеры ожидаемых ключей: mine, smallgenerator, pipe, driller, (и fallback: barracks)
		const typeMap = {
			PIPE: 'pipe',
			BARRACKS: 'barracks',
			SMALL_GENERATOR: 'smallgenerator',
			DRILLER: 'driller',
			MINE: 'mine',
		};

		const normalizedBuildings = buildings.map(b => {
			const t = b?.type;

			if (typeof t !== 'string') return b;

			if (typeMap[t]) return { ...b, type: typeMap[t] };

			// Если формат отличается (например already lowercase/с другими регистрами) — приводим к lower-case
			const lower = t.toLowerCase();

			// Частный случай: SMALL GENERATOR могли прийти как small_generator или SMALL_GENERATOR
			if (lower === 'small_generator') return { ...b, type: 'smallgenerator' };

			// Базовый fallback
			return { ...b, type: lower };
		});

		this.sendToMap(GLOBAL_CONFIG.URLS.UPDATE_BUILDINGS, {
			mapGuid,
			userGuid: peopleEconomyGuid,
			buildings: normalizedBuildings,
		});
	}

	spawnArmyUnit(data) { //data = {unitType, x, y, armyGuid}
		this.sendToMushroomsArmy(GLOBAL_CONFIG.URLS.SPAWN_UNIT, data);
	}

	/* SOCKETS */
}

module.exports = GameManager;