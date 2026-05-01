import React, { useContext, useEffect, useState } from 'react';
import { MediatorContext } from '../../../../App';
import CONFIG from '../../../../config';
import { GameState } from '../../types';
import Minimap from '../Minimap/Minimap';
import './Footer.css';

type FooterResource = {
  label: string;
  value: string | number;
};

const ECONOMY_RESOURCES = [
  { id: 'mycelium', label: 'Мицелий', value: 1250 },
  { id: 'fat', label: 'Жир', value: 420 },
  { id: 'iron', label: 'Железо', value: 85 },
  { id: 'energy', label: 'Энергия', value: '94%' },
];

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

const Footer: React.FC = () => {
  const mediator = useContext(MediatorContext);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [resources, setResources] = useState<FooterResource[]>(getFooterResources(null));

  useEffect(() => {
    if (!mediator) return;

    const EVENT_NAME = CONFIG.MEDIATOR.EVENTS.GAME_STATE_UPDATED;
    const handler = (newState: GameState) => {
      setGameState(newState);
      setResources(getFooterResources(newState));
    };

    mediator.subscribe(EVENT_NAME, handler);
    return () => mediator.unsubscribe(EVENT_NAME, handler);
  }, [mediator]);

  return (
    <footer className="game-footer-wrapper">
      <Minimap gameState={gameState} />

      <div className="game-footer-main-panel">
        <div className="game-economy-resources">
          <span className="game-economy-resources-title">Ресурсы</span>
          <div className="game-economy-resources-list">
            {ECONOMY_RESOURCES.map((resource) => (
              <div className="game-economy-resource" key={resource.id}>
                <span className="game-economy-resource-label">{resource.label}:</span>
                <span className="game-economy-resource-value">{resource.value}</span>
              </div>
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
