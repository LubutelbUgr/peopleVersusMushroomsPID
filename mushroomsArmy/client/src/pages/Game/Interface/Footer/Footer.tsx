import React, { useContext, useEffect, useState } from 'react';
import { MediatorContext } from '../../../../App';
import CONFIG from '../../../../config';
import { GameState } from '../../types';
import Minimap, { MinimapDot } from '../Minimap/Minimap';
import './Footer.css';

type FooterResource = {
  label: string;
  value: string | number;
};

const ECONOMY_RESOURCES = ['Мицелий', 'Жир', 'Железо', 'Энергия'];

const getFooterResources = (state: GameState | null): FooterResource[] => {
  const aliveUnits = state?.units.filter((unit) => unit.hp > 0) ?? [];
  const aliveBuildings =
    state?.buildings.filter((building) => building.hp > 0 && building.isAlive !== false) ?? [];

  return [
    {
      label: 'Спорометов',
      value: aliveUnits.filter((unit) => unit.type === 'sporomet').length,
    },
    {
      label: 'Шампиньебов',
      value: aliveUnits.filter((unit) => unit.type === 'champigneb').length,
    },
    {
      label: 'Еблекарей',
      value: aliveUnits.filter((unit) => unit.type === 'eblekar').length,
    },
    {
      label: 'Взрывоморов',
      value: aliveBuildings.filter((building) => building.type === 'vzryvomor').length,
    },
    {
      label: 'Споровых башен',
      value: aliveBuildings.filter((building) => building.type === 'sporovaya_bashnya').length,
    },
  ];
};

const getMinimapDots = (state: GameState | null): MinimapDot[] => {
  if (!state) return [];

  const worldHeight = state.map.length || 1;
  const worldWidth = state.map[0]?.length || 1;
  const ownBuildingTypes = ['vzryvomor', 'sporovaya_bashnya'];
  const clampPercent = (value: number) => Math.max(0, Math.min(100, value));
  const toMinimapX = (x: number) => clampPercent((x / worldWidth) * 100);
  const toMinimapY = (y: number) => clampPercent((y / worldHeight) * 100);

  const unitDots = state.units
    .filter((unit) => unit.hp > 0)
    .map((unit) => ({
      color: '#42d96b',
      guid: unit.guid,
      x: toMinimapX(unit.x + 0.5),
      y: toMinimapY(unit.y + 0.5),
    }));

  const buildingDots = state.buildings
    .filter((building) => building.hp > 0 && building.isAlive !== false)
    .map((building) => ({
      color: ownBuildingTypes.includes(building.type) ? '#ffd966' : '#f05252',
      guid: building.guid,
      x: toMinimapX(building.x + (building.sizeX ?? 1) / 2),
      y: toMinimapY(building.y + (building.sizeY ?? 1) / 2),
    }));

  return [...unitDots, ...buildingDots];
};

const Footer: React.FC = () => {
  const mediator = useContext(MediatorContext);
  const [resources, setResources] = useState<FooterResource[]>(getFooterResources(null));
  const [minimapDots, setMinimapDots] = useState<MinimapDot[]>([]);
  const [minimapMap, setMinimapMap] = useState<GameState['map']>([]);

  useEffect(() => {
    if (!mediator) return;

    const EVENT_NAME = CONFIG.MEDIATOR.EVENTS.GAME_STATE_UPDATED;
    const handler = (newState: GameState) => {
      setResources(getFooterResources(newState));
      setMinimapDots(getMinimapDots(newState));
      setMinimapMap(newState.map);
    };

    mediator.subscribe(EVENT_NAME, handler);

    return () => {
      mediator.unsubscribe(EVENT_NAME, handler);
    };
  }, [mediator]);

  return (
    <footer className="game-footer-wrapper">
      <Minimap dots={minimapDots} map={minimapMap} />

      <div className="game-footer-main-panel">
        <div className="game-economy-resources">
          <span className="game-economy-resources-title">Ресурсы</span>
          <div className="game-economy-resources-list">
            {ECONOMY_RESOURCES.map((resource) => (
              <span className="game-economy-resource" key={resource}>
                {resource}
              </span>
            ))}
          </div>
        </div>

        <div className="game-footer-stats">
          {resources.map((resource) => (
            <div className="game-stat-item" key={resource.label}>
              <span className="game-stat-label">{resource.label}</span>
              <span className="game-stat-value">{resource.value}</span>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
