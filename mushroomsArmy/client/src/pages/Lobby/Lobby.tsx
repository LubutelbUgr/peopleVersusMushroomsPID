import React, { useContext, useEffect, useState } from "react";
import { MediatorContext, ServerContext } from "../../App";
import { PAGES } from '../PageManager';
import { authStorage } from "../../utils/authStorage";
import { ILobby, TUser } from "../../services/server/types";
import './Lobby.css';

type TLobbyRole = keyof ILobby['playersGuids'];
const LOBBY_ROLES: TLobbyRole[] = ['spectator', 'mushroomArmy', 'mushroomEconomy', 'peopleArmy', 'peopleEconomy'];
const ROLE_LABELS: Record<TLobbyRole, string> = {
    spectator: 'Наблюдатель',
    mushroomArmy: 'Армия грибов',
    mushroomEconomy: 'Экономика грибов',
    peopleArmy: 'Армия людей',
    peopleEconomy: 'Экономика людей',
};

const Lobby: React.FC<{ setPage: (page: PAGES) => void }> = ({ setPage }) => {
    const server = useContext(ServerContext);
    const mediator = useContext(MediatorContext);

    const GET_STORE = mediator.getTriggerTypes().GET_STORE;
    const {
        USER_LOGGED_OUT,
        GAME_STARTED,
        LOBBY_UPDATED,
        LOBBYS_LIST_UPDATED,
        CREATE_LOBBY,
        JOIN_TO_LOBBY,
        LEAVE_LOBBY,
        SET_READY,
        DROP_FROM_LOBBY,
    } = mediator.getEventTypes();

    const user = mediator.get(GET_STORE, 'user') as TUser | null;

    const [lobbies, setLobbies] = useState<ILobby[]>([]);
    const [currentLobby, setCurrentLobby] = useState<ILobby | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [selectedRole, setSelectedRole] = useState<TLobbyRole>('spectator');
    const [selectedRolesByLobby, setSelectedRolesByLobby] = useState<Record<string, TLobbyRole>>({});
    const [newLobbyName, setNewLobbyName] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const isCreator =
        Boolean(user?.guid) &&
        Boolean(currentLobby?.lobbyGuid) &&
        user!.guid === currentLobby!.lobbyGuid;

    const allReady = (() => {
        if (!currentLobby) return false;
        const roles = Object.keys(currentLobby.playersGuids) as TLobbyRole[];
        return roles
            .filter((role) => currentLobby.playersGuids[role] !== null)
            .every((role) => currentLobby.playersIsReady[role] === true);
    })();

    useEffect(() => {
        let isCancelled = false;

        (async () => {
            try {
                const data = await server.getLobbies();
                if (!isCancelled) setLobbies(data);
            } catch {
                if (!isCancelled) setLobbies([]);
            }
        })();

        return () => {
            isCancelled = true;
        };
    }, [server]);

    useEffect(() => {
        let isCancelled = false;

        const syncLobbyFromList = async () => {
            try {
                const data = await server.getLobbies();
                if (isCancelled) return;
                setLobbies(data);

                if (!user?.guid) return;
                const joinedLobby = data.find((lobby) =>
                    Object.values(lobby.playersGuids).includes(user.guid as string)
                );
                setCurrentLobby(joinedLobby ?? null);
            } catch {
                if (!isCancelled) setLobbies([]);
            }
        };

        const handleLoggedOut = () => {
            authStorage.clearAuth();
            setPage(PAGES.LOGIN);
        };

        const handleGameStarted = () => {
            setPage(PAGES.GAME);
        };

        const handleLobbyUpdated = (data?: unknown) => {
            const lobby = data as ILobby | null | undefined;
            if (!lobby) return;

            setCurrentLobby(lobby);

            const myGuid = user?.guid;
            if (!myGuid) return;

            const roles = Object.keys(lobby.playersGuids) as TLobbyRole[];
            const myRole = roles.find((role) => lobby.playersGuids[role] === myGuid);
            if (!myRole) return;

            setSelectedRole(myRole);
            setIsReady(Boolean(lobby.playersIsReady?.[myRole]));
        };

        const handleLobbiesListUpdated = (data?: unknown) => {
            const list = data as ILobby[] | null | undefined;
            if (!Array.isArray(list)) return;
            setLobbies(list);
        };

        const handleCreateLobby = async () => {
            await syncLobbyFromList();
        };

        const handleJoinToLobby = async () => {
            await syncLobbyFromList();
        };

        const handleLeaveLobby = () => {
            setCurrentLobby(null);
            setIsReady(false);
        };

        const handleSetReady = async (data?: unknown) => {
            // На сервере может приходить boolean; актуальная комната обычно прилетает через LOBBY_UPDATED.
            const lobby = data as ILobby | null | undefined;
            if (lobby?.lobbyGuid) setCurrentLobby(lobby);
            await syncLobbyFromList();
        };

        const handleDropFromLobby = async (data?: unknown) => {
            const lobby = data as ILobby | null | undefined;
            if (lobby?.lobbyGuid) setCurrentLobby(lobby);
            await syncLobbyFromList();
        };

        mediator.subscribe(USER_LOGGED_OUT, handleLoggedOut);
        mediator.subscribe(GAME_STARTED, handleGameStarted);
        mediator.subscribe(LOBBY_UPDATED, handleLobbyUpdated);
        mediator.subscribe(LOBBYS_LIST_UPDATED, handleLobbiesListUpdated);
        mediator.subscribe(CREATE_LOBBY, handleCreateLobby);
        mediator.subscribe(JOIN_TO_LOBBY, handleJoinToLobby);
        mediator.subscribe(LEAVE_LOBBY, handleLeaveLobby);
        mediator.subscribe(SET_READY, handleSetReady);
        mediator.subscribe(DROP_FROM_LOBBY, handleDropFromLobby);

        return () => {
            isCancelled = true;
            mediator.unsubscribe(USER_LOGGED_OUT, handleLoggedOut);
            mediator.unsubscribe(GAME_STARTED, handleGameStarted);
            mediator.unsubscribe(LOBBY_UPDATED, handleLobbyUpdated);
            mediator.unsubscribe(LOBBYS_LIST_UPDATED, handleLobbiesListUpdated);
            mediator.unsubscribe(CREATE_LOBBY, handleCreateLobby);
            mediator.unsubscribe(JOIN_TO_LOBBY, handleJoinToLobby);
            mediator.unsubscribe(LEAVE_LOBBY, handleLeaveLobby);
            mediator.unsubscribe(SET_READY, handleSetReady);
            mediator.unsubscribe(DROP_FROM_LOBBY, handleDropFromLobby);
        };
    }, [
        mediator,
        setPage,
        server,
        user?.guid,
        USER_LOGGED_OUT,
        GAME_STARTED,
        LOBBY_UPDATED,
        LOBBYS_LIST_UPDATED,
        CREATE_LOBBY,
        JOIN_TO_LOBBY,
        LEAVE_LOBBY,
        SET_READY,
        DROP_FROM_LOBBY,
    ]);

    const handleCreateLobby = () => {
        setIsCreateModalOpen(true);
        setNewLobbyName('');
    };

    const handleConfirmCreateLobby = () => {
        const lobbyName = newLobbyName.trim();
        if (!lobbyName) return;
        server.createLobby({ lobbyName, role: selectedRole });
        setIsCreateModalOpen(false);
        setNewLobbyName('');
    };

    const handleJoinLobby = (lobbyGuid: string) => {
        const role = selectedRolesByLobby[lobbyGuid] ?? 'spectator';
        server.joinToLobby({ lobbyGuid, role });
    };

    const handleLeaveLobby = () => {
        setIsReady(false);
        server.leaveLobby();
    };

    const handleToggleReady = () => {
        server.setReady();
    };

    const handleKickPlayer = (targetGuid: string) => {
        server.dropFromLobby({ targetGuid });
    };

    const handleStart = () => {
        server.startGame();
    };

    const handleLogout = () => {
        server.logout();
    };

    const handleRoleChangeForLobby = (lobbyGuid: string, role: TLobbyRole) => {
        setSelectedRolesByLobby((prev) => ({
            ...prev,
            [lobbyGuid]: role,
        }));
    };

    if (currentLobby) {
        const myGuid = user?.guid ?? null;
        const myRole = LOBBY_ROLES.find((role) => currentLobby.playersGuids[role] === myGuid) ?? null;

        return (
            <div className="lobby">
                <div className="lobby__container">
                    <h2 className="lobby__title">Комната: {currentLobby.lobbyName}</h2>

                    <div className="lobby__tableWrap">
                        <table className="lobby__rolesTable">
                            <thead>
                                <tr>
                                    <th>Роль</th>
                                    <th>Игрок</th>
                                    <th>Готовность</th>
                                    <th>Действие</th>
                                </tr>
                            </thead>
                            <tbody>
                                {LOBBY_ROLES.map((role) => {
                                    const playerGuid = currentLobby.playersGuids[role];
                                    const ready = currentLobby.playersIsReady[role];
                                    const canKick = Boolean(isCreator && playerGuid && playerGuid !== user?.guid);

                                    return (
                                        <tr key={role}>
                                            <td>{ROLE_LABELS[role]}</td>
                                            <td>{playerGuid ?? 'пусто'}</td>
                                            <td>
                                                <span className={ready ? 'lobby__readyBadge lobby__readyBadge--yes' : 'lobby__readyBadge'}>
                                                    {playerGuid ? (ready ? 'готов' : 'не готов') : '-'}
                                                </span>
                                            </td>
                                            <td>
                                                {canKick ? (
                                                    <button
                                                        className="lobby__dangerButton"
                                                        onClick={() => handleKickPlayer(playerGuid!)}
                                                    >
                                                        Кикнуть
                                                    </button>
                                                ) : (
                                                    '-'
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="lobby__roomActions">
                        {!isReady && myRole && (
                            <button className="lobby__primaryButton" onClick={handleToggleReady}>
                                Готов
                            </button>
                        )}

                        {isCreator && (
                            <button className="lobby__primaryButton" disabled={!allReady} onClick={handleStart}>
                                Старт
                            </button>
                        )}

                        <button className="lobby__secondaryButton" onClick={handleLeaveLobby}>
                            Покинуть комнату
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="lobby">
            <div className="lobby__container">
                <div className="lobby__topBar">
                    <div className="lobby__userName">{user?.name ?? 'Игрок'}</div>
                    <button className="lobby__dangerButton" onClick={handleLogout}>
                        Выход
                    </button>
                </div>

                <h1 className="lobby__title">Список комнат</h1>

                <div className="lobby__list">
                    {lobbies.length === 0 ? (
                        <div className="lobby__empty">Пока нет комнат</div>
                    ) : (
                        lobbies.map((lobby) => {
                            const takenSlotsCount = LOBBY_ROLES.filter((role) => lobby.playersGuids[role] !== null).length;
                            const selectedRoleForLobby = selectedRolesByLobby[lobby.lobbyGuid] ?? 'spectator';
                            const selectedOccupant = lobby.playersGuids[selectedRoleForLobby];
                            const canJoinSelectedRole = selectedOccupant === null || selectedOccupant === user?.guid;

                            return (
                                <div key={lobby.lobbyGuid} className="lobby__card">
                                    <div className="lobby__cardHeader">
                                        <h3 className="lobby__cardTitle">{lobby.lobbyName}</h3>
                                        <span className="lobby__slots">{takenSlotsCount}/5</span>
                                    </div>

                                    <div className="lobby__cardActions">
                                        <select
                                            className="lobby__select"
                                            value={selectedRoleForLobby}
                                            onChange={(event) => handleRoleChangeForLobby(lobby.lobbyGuid, event.target.value as TLobbyRole)}
                                        >
                                            {LOBBY_ROLES.map((role) => {
                                                const occupantGuid = lobby.playersGuids[role];
                                                const disabled = occupantGuid !== null && occupantGuid !== user?.guid;

                                                return (
                                                    <option key={role} value={role} disabled={disabled}>
                                                        {ROLE_LABELS[role]}
                                                    </option>
                                                );
                                            })}
                                        </select>

                                        <button
                                            className="lobby__primaryButton"
                                            disabled={!canJoinSelectedRole}
                                            onClick={() => handleJoinLobby(lobby.lobbyGuid)}
                                        >
                                            Войти
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <button className="lobby__secondaryButton" onClick={handleCreateLobby}>
                    Создать комнату
                </button>

                {isCreateModalOpen && (
                    <div className="lobby__modalOverlay" onClick={() => setIsCreateModalOpen(false)}>
                        <div className="lobby__modal" onClick={(event) => event.stopPropagation()}>
                            <h3 className="lobby__modalTitle">Создать комнату</h3>

                            <input
                                className="lobby__input"
                                placeholder="Название комнаты"
                                value={newLobbyName}
                                onChange={(event) => setNewLobbyName(event.target.value)}
                            />

                            <select
                                className="lobby__select"
                                value={selectedRole}
                                onChange={(event) => setSelectedRole(event.target.value as TLobbyRole)}
                            >
                                {LOBBY_ROLES.map((role) => (
                                    <option key={role} value={role}>
                                        {ROLE_LABELS[role]}
                                    </option>
                                ))}
                            </select>

                            <div className="lobby__modalActions">
                                <button className="lobby__secondaryButton" onClick={() => setIsCreateModalOpen(false)}>
                                    Отмена
                                </button>
                                <button
                                    className="lobby__primaryButton"
                                    disabled={!newLobbyName.trim()}
                                    onClick={handleConfirmCreateLobby}
                                >
                                    Создать
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Lobby;