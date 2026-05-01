import './Header.css';

interface HeaderProps {
  username: string;
  aliveUnitsCount: number;
  onExit: () => void;
}

const Header: React.FC<HeaderProps> = ({ username, onExit }) => {
  return (
    <header className="game-header">
      <div className="header-left">
        <span className="user-nickname">{username}</span>
        {/* <span className="units-info">Живых: {aliveUnitsCount}</span> */}
      </div>
      
      <div className="header-center">
        <h1 className="game-title">Армия грибов</h1>
      </div>
      
      <div className="header-right">
        <button className="exit-button" onClick={onExit}>
          ВЫХОД В ЛОББИ
        </button>
      </div>
    </header>
  );
};

export default Header;