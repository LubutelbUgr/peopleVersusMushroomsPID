import { Socket } from 'socket.io';
import BaseManager from '../BaseManager';
import CONFIG from '../../../config';
import User from './User';

const { REGISTRATION, LOGIN, LOGOUT, LOBBY_START, VALIDATE_TOKEN } = CONFIG.SOCKET;

interface UserManagerOptions {
    mediator: any;
    db: any;
    io: any;
    answer: any;
    common: any;
}

interface RegistrationData {
    name?: string;
    password?: string;
    passwordRepeat?: string;
}

interface LoginData {
    name?: string;
    password?: string;
}

interface LogoutData {
    token?: string;
    guid?: string;
}

interface ValidateTokenData {
    token?: string;
}

class UserManager extends BaseManager {
    private users: { [guid: string]: User };

    constructor(options: UserManagerOptions) {
        super(options);
        this.users = {};

        if (!this.io) return;

        this.io.on('connection', (socket: Socket) => {
            socket.on(REGISTRATION, (data: RegistrationData) => this.socketRegistration(data, socket));
            socket.on(LOGIN, (data: LoginData) => this.socketLogin(data, socket));
            socket.on(LOGOUT, (data: LogoutData) => this.socketLogout(data, socket));
            socket.on(LOBBY_START, (data: any) => this.socketLobbyStart(data, socket));
            socket.on(VALIDATE_TOKEN, (data: ValidateTokenData) => this.socketValidateToken(data, socket));

            socket.on('disconnect', () => {
                const user = Object.values(this.users).find(u => u.getSelf().socketId === socket.id);
                if (user && user.getSelf().guid) {
                    this.mediator.get(CONFIG.MEDIATOR.TRIGGERS.DESTROY_ARMY, user.getSelf().guid);
                    delete this.users[user.getSelf().guid!];
                }
            });
        });
    }

    private validateLogin(name: string): boolean {
        if (!name || name.length < 3 || name.length > 20) {
            return false;
        }
        const loginRegex = /^[a-zA-Z0-9_]([a-zA-Z0-9_.]*[a-zA-Z0-9_])?$/;
        if (!loginRegex.test(name)) {
            return false;
        }
        if (name.includes('..') || name.startsWith('.') || name.endsWith('.')) {
            return false;
        }
        return true;
    }

    private validatePassword(password: string): boolean {
        return !!(password && password.length >= 6 && password.length <= 50);
    }

    private async socketRegistration(data: RegistrationData, socket: Socket): Promise<void> {
        const { name, password, passwordRepeat } = data;

        if (!name || !password || !passwordRepeat) {
            socket.emit(REGISTRATION, this.answer.bad(13));
            return;
        }

        if (!this.validateLogin(name)) {
            socket.emit(REGISTRATION, this.answer.bad(13));
            return;
        }

        if (!this.validatePassword(password)) {
            socket.emit(REGISTRATION, this.answer.bad(13));
            return;
        }

        if (password !== passwordRepeat) {
            socket.emit(REGISTRATION, this.answer.bad(13));
            return;
        }

        if (await this.db.getUserByName(name)) {
            socket.emit(REGISTRATION, this.answer.bad(17));
            return;
        }

        const user = new User({ db: this.db, common: this.common, socketId: socket.id });
        await user.registration(name, password);
        this.users[user.getSelf().guid!] = user;

        socket.emit(REGISTRATION, this.answer.good(user.toClient()));
    }

    private async socketLogin(data: LoginData, socket: Socket): Promise<void> {
        const { name, password } = data;

        if (!name || !password) {
            socket.emit(LOGIN, this.answer.bad(13));
            return;
        }

        if (!this.validateLogin(name)) {
            socket.emit(LOGIN, this.answer.bad(13));
            return;
        }

        if (!this.validatePassword(password)) {
            socket.emit(LOGIN, this.answer.bad(13));
            return;
        }

        const user = new User({ db: this.db, common: this.common, socketId: socket.id });
        if (await user.login(name, password)) {
            this.users[user.getSelf().guid!] = user;
            socket.emit(LOGIN, this.answer.good(user.toClient()));
            return;
        }

        socket.emit(LOGIN, this.answer.bad(11));
    }

    private async socketLogout(data: LogoutData, socket: Socket): Promise<void> {
        const { token, guid } = data;

        if (!token) {
            socket.emit(LOGOUT, this.answer.bad(13));
            return;
        }

        const user = this.users[guid!];
        if (user) {
            await user.logout();
            delete this.users[user.getSelf().guid!];
        }

        socket.emit(LOGOUT, this.answer.good(true));
    }

    private async socketLobbyStart(data: any, socket: Socket): Promise<void> {
        socket.emit(LOBBY_START, this.answer.good(true));
    }

    private async socketValidateToken(data: ValidateTokenData, socket: Socket): Promise<void> {
        const { token } = data;

        if (!token) {
            socket.emit(VALIDATE_TOKEN, this.answer.bad(13));
            return;
        }

        const cachedUser = Object.values(this.users).find((item) => item.getSelf().token === token);
        if (cachedUser) {
            socket.emit(VALIDATE_TOKEN, this.answer.good(cachedUser.toClient()));
            return;
        }

        const userData = await this.db.getUserByValidToken(token);
        if (userData) {
            const user = User.restoreFromData(
                { db: this.db, common: this.common, socketId: socket.id },
                userData as any
            );
            this.users[user.getSelf().guid!] = user;
            socket.emit(VALIDATE_TOKEN, this.answer.good(user.toClient()));
            return;
        }

        socket.emit(VALIDATE_TOKEN, this.answer.bad(10));
    }
}

export default UserManager;