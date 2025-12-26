'use client';

import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"; // Base URL of your backend

interface User {
    id: string;
    email: string;
    // Add other user properties if available
}

interface UserProfile {
    username: string;
    // Add other profile properties if available
}

interface AuthResponse {
    success: boolean;
    message?: string;
    session?: {
        access_token: string;
    };
    user?: User;
    profile?: UserProfile;
}

// Helper function to get storage based on rememberMe flag
const getStorage = (rememberMe: boolean): Storage | null => {
    if (typeof window === 'undefined') {
        return null;
    }
    return rememberMe ? localStorage : sessionStorage;
};

const register = async (email: string, password: string, username: string, terms_accepted: boolean): Promise<AuthResponse> => {
    const response = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/signup`, {
        email,
        password,
        username,
        terms_accepted,
    });
    return response.data;
};

const login = async (email: string, password: string, rememberMe: boolean = false): Promise<AuthResponse> => {
    const response = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/signin`, {
        email,
        password,
    });
    if (response.data.success && response.data.session && response.data.session.access_token) {
        const storage = getStorage(rememberMe);
        if (storage) {
            storage.setItem("user", JSON.stringify(response.data.user));
            storage.setItem("profile", JSON.stringify(response.data.profile)); // Assuming profile is also part of session
            storage.setItem("accessToken", response.data.session.access_token);
        }
    }
    return response.data;
};

const logout = () => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem("user");
        localStorage.removeItem("profile");
        localStorage.removeItem("accessToken");
        sessionStorage.removeItem("user");
        sessionStorage.removeItem("profile");
        sessionStorage.removeItem("accessToken");
    }
    // For JWTs, client-side removal is usually sufficient.
    // If backend signout is required, ensure it's called here:
    // axios.post(`${API_BASE_URL}/auth/signout`); 
};

const getCurrentUser = (): User | null => {
    if (typeof window === 'undefined') {
        return null;
    }
    let user: User | null = null;
    const localStorageUser = localStorage.getItem("user");
    if (localStorageUser) {
        user = JSON.parse(localStorageUser);
    } else {
        const sessionStorageUser = sessionStorage.getItem("user");
        if (sessionStorageUser) {
            user = JSON.parse(sessionStorageUser);
        }
    }
    return user;
};

const getAccessToken = (): string | null => {
    if (typeof window === 'undefined') {
        return null;
    }
    let token = localStorage.getItem("accessToken");
    if (!token) {
        token = sessionStorage.getItem("accessToken");
    }
    return token;
}

const AuthService = {
    register,
    login,
    logout,
    getCurrentUser,
    getAccessToken,
};

export default AuthService;
