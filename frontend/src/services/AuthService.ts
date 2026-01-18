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
    rememberMe?: boolean; // Add rememberMe to AuthResponse
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
        const storage = rememberMe ? localStorage : sessionStorage; // Directly use storage based on rememberMe

        // Store entire user and profile objects
        storage.setItem("user", JSON.stringify(response.data.user));
        storage.setItem("profile", JSON.stringify(response.data.profile)); 
        storage.setItem("accessToken", response.data.session.access_token);
        // Also store rememberMe preference in localStorage regardless, for logic in getCurrentUser
        localStorage.setItem("rememberMe", String(rememberMe)); 
    }
    return response.data;
};

const logout = () => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem("user");
        localStorage.removeItem("profile");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("rememberMe"); // Clear rememberMe flag
        sessionStorage.removeItem("user");
        sessionStorage.removeItem("profile");
        sessionStorage.removeItem("accessToken");
    }
};

const getStoredSession = (): { user: User | null; profile: UserProfile | null; accessToken: string | null } => {
    if (typeof window === 'undefined') {
        return { user: null, profile: null, accessToken: null };
    }

    const isRemembered = localStorage.getItem("rememberMe") === "true";
    const storage = isRemembered ? localStorage : sessionStorage;

    let user: User | null = null;
    let profile: UserProfile | null = null;
    let accessToken: string | null = null;

    const storedUser = storage.getItem("user");
    if (storedUser) {
        user = JSON.parse(storedUser);
    }

    const storedProfile = storage.getItem("profile");
    if (storedProfile) {
        profile = JSON.parse(storedProfile);
    }
    
    accessToken = storage.getItem("accessToken");

    return { user, profile, accessToken };
};

// getCurrentUser should return a combined object with user details and username
const getCurrentUser = (): (User & { username?: string, profile?: UserProfile }) | null => {
    const { user, profile } = getStoredSession();
    if (user && profile) {
        return { ...user, username: profile.username, profile: profile };
    }
    return null;
};

const getAccessToken = (): string | null => {
    const { accessToken } = getStoredSession();
    return accessToken;
};

const AuthService = {
    register,
    login,
    logout,
    getCurrentUser,
    getAccessToken
};

export default AuthService;
