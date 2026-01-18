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
        const storage = getStorage(rememberMe);
        if (storage) {
            storage.setItem("user", JSON.stringify(response.data.user));
            storage.setItem("profile", JSON.stringify(response.data.profile));
            storage.setItem("accessToken", response.data.session.access_token);
            storage.setItem("rememberMe", String(rememberMe)); // Store rememberMe preference
        }
    }
    return response.data;
};

const logout = () => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem("user");
        localStorage.removeItem("profile");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("rememberMe");
        sessionStorage.removeItem("user");
        sessionStorage.removeItem("profile");
        sessionStorage.removeItem("accessToken");
    }
};

const getRememberMe = (): boolean => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem("rememberMe") === "true";
}

const getCurrentUser = (): User | null => {
    if (typeof window === 'undefined') {
        return null;
    }
    let user: User | null = null;
    const isRemembered = getRememberMe();
    const storage = getStorage(isRemembered);

    const storedUser = storage?.getItem("user");
    if (storedUser) {
        user = JSON.parse(storedUser);
    }
    return user;
};

const getAccessToken = (): string | null => {
    if (typeof window === 'undefined') {
        return null;
    }
    const isRemembered = getRememberMe();
    const storage = getStorage(isRemembered);

    return storage?.getItem("accessToken") || null;
}

const verifySession = async (accessToken: string): Promise<AuthResponse> => {
    try {
        const response = await axios.get<AuthResponse>(`${API_BASE_URL}/auth/verify-session`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        if (response.data.success) {
            const isRemembered = getRememberMe();
            const storage = getStorage(isRemembered);
            if (storage) {
                // Update local storage with potentially refreshed user/profile data
                storage.setItem("user", JSON.stringify(response.data.user));
                storage.setItem("profile", JSON.stringify(response.data.profile));
                // Do not update accessToken here unless the backend explicitly issues a new one
                // For now, assume if verify-session is successful, the existing token is still valid.
            }
            return { success: true, user: response.data.user, profile: response.data.profile };
        } else {
            return { success: false, message: response.data.message || "Session verification failed." };
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("Session verification API error:", error.response?.data || error);
            return { success: false, message: error.response?.data?.detail || "Session verification failed due to an API error." };
        }
        console.error("Session verification unexpected error:", error);
        return { success: false, message: "An unexpected error occurred during session verification." };
    }
};

const AuthService = {
    register,
    login,
    logout,
    getCurrentUser,
    getAccessToken,
    getRememberMe,
    verifySession
};

export default AuthService;
