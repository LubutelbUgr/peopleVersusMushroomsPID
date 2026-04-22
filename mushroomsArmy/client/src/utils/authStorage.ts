import { TUser } from '../services/server/types';

export const authStorage = {
    setAuth: (token: string, user: TUser) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
    },

    getAuth: () => {
        const token = localStorage.getItem('token');
        const userString = localStorage.getItem('user');

        try {
            return {
                token: token,
                user: userString ? JSON.parse(userString) : null //(userString) в ОБЪЕКТ (user)
            };
        } catch {
            return {
                token: token,
                user: null
            };
        }
    },

    clearAuth: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
};