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
// This helper is primarily used by login and logout to determine where to save/clear
const getTargetStorage = (rememberMe: boolean): Storage | null => {
    if (typeof window === 'undefined') {
        return null;
    }
    return rememberMe ? localStorage : sessionStorage;
};

// Helper to get actual active storage based on whether 'rememberMe' is currently set in localStorage
const getActiveStorage = (): Storage | null => {
    if (typeof window === 'undefined') {
        return null;
    }
    return localStorage.getItem("rememberMe") === "true" ? localStorage : sessionStorage;
};

// Helper to get stored credentials for re-login attempt
const getStoredCredentials = (): { email: string | null; password: string | null; rememberMe: boolean } => {
    if (typeof window === 'undefined') {
        return { email: null, password: null, rememberMe: false };
    }
    const email = localStorage.getItem("rememberedEmail");
    const password = localStorage.getItem("rememberedPassword");
    const rememberMe = localStorage.getItem("rememberMe") === "true";
    return { email, password, rememberMe };
};


const register = async (email: string, password: string, username: string, terms_accepted: boolean): Promise<AuthResponse> => {
    try { // Added try-catch for register
        const response = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/signup`, {
            email,
            password,
            username,
            terms_accepted,
        });
        return response.data;
    } catch (error) {
        console.error("Registration API error:", error);
        return { success: false, message: "Registration failed due to an API error." };
    }
};

const login = async (email: string, password: string, rememberMe: boolean = false): Promise<AuthResponse> => {
    try { // Added try-catch for login
        const response = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/signin`, {
            email,
            password,
        });
        if (response.data.success && response.data.session && response.data.session.access_token) {
            const storage = getTargetStorage(rememberMe); // Use helper to determine storage

            if (storage) {
                storage.setItem("user", JSON.stringify(response.data.user));
                storage.setItem("profile", JSON.stringify(response.data.profile)); 
                storage.setItem("accessToken", response.data.session.access_token);
                // Store rememberMe preference in localStorage (always), and credentials if rememberMe is true
                localStorage.setItem("rememberMe", String(rememberMe)); 
                if (rememberMe) {
                    localStorage.setItem("rememberedEmail", email);
                    localStorage.setItem("rememberedPassword", password); // Storing password for re-login (SECURITY RISK)
                } else {
                    localStorage.removeItem("rememberedEmail");
                    localStorage.removeItem("rememberedPassword");
                }
            }
        }
        return response.data;
    } catch (error) {
        console.error("Login API error:", error);
        return { success: false, message: "Login failed due to an API error." };
    }
};

// New silentLogin function for re-authentication
const silentLogin = async (email: string, password: string): Promise<AuthResponse> => {
    try {
        const response = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/signin`, {
            email,
            password,
        });
        if (response.data.success && response.data.session && response.data.session.access_token) {
            // If silent login is successful, update localStorage with fresh tokens/user data
            localStorage.setItem("user", JSON.stringify(response.data.user));
            localStorage.setItem("profile", JSON.stringify(response.data.profile)); 
            localStorage.setItem("accessToken", response.data.session.access_token);
            return { success: true, user: response.data.user, profile: response.data.profile };
        } else {
            return { success: false, message: response.data.message || "Silent login failed." };
        }
    } catch (error) {
        console.error("Silent login API error:", error);
        // Return a structured error response
        return { success: false, message: "Silent login failed due to an API error." };
    }
};

const logout = () => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem("user");
        localStorage.removeItem("profile");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("rememberMe");
        localStorage.removeItem("rememberedEmail");
        localStorage.removeItem("rememberedPassword");
        sessionStorage.removeItem("user");
        sessionStorage.removeItem("profile");
        sessionStorage.removeItem("accessToken");
    }
};

const getCurrentUser = async (): Promise<(User & { username?: string, profile?: UserProfile }) | null> => {
    if (typeof window === 'undefined') {
        return null;
    }

    const { email, password, rememberMe } = getStoredCredentials();
    const activeStorage = getActiveStorage();

    let user: (User & { username?: string, profile?: UserProfile }) | null = null;
    let storedUserRaw: string | null = null;
    let storedProfileRaw: string | null = null;

    try { // Added try-catch for potential JSON.parse errors or storage access issues
        if (rememberMe && email && password) {
            // Attempt silent re-login if remembered credentials exist
            const silentLoginResponse = await silentLogin(email, password); // silentLogin now has its own try-catch
            if (silentLoginResponse.success && silentLoginResponse.user && silentLoginResponse.profile) {
                user = { ...silentLoginResponse.user, username: silentLoginResponse.profile.username, profile: silentLoginResponse.profile };
            } else {
                // Silent login failed, clear remembered credentials
                logout(); // This clears all, including remembered info
            }
        } else {
            // For non-remembered sessions, or if silent login failed
            // Explicitly ensure the result is string | null by using '|| null'
            storedUserRaw = activeStorage?.getItem("user") || null;
            storedProfileRaw = activeStorage?.getItem("profile") || null;

            // Check if data exists and is not an empty string before parsing
            if (storedUserRaw && storedUserRaw.trim() !== "" && storedProfileRaw && storedProfileRaw.trim() !== "") {
                const storedUser: User = JSON.parse(storedUserRaw); // JSON.parse can throw
                const storedProfile: UserProfile = JSON.parse(storedProfileRaw); // JSON.parse can throw
                user = { ...storedUser, username: storedProfile.username, profile: storedProfile };
            } else {
                // If data is missing or empty, clear potentially stale tokens/preferences
                // This might happen if only rememberMe is true but user/profile data got cleared
                if (rememberMe) { // Only clear if rememberMe was true, to avoid clearing session tokens unexpectedly
                   localStorage.removeItem("rememberedEmail");
                   localStorage.removeItem("rememberedPassword");
                   localStorage.removeItem("rememberMe");
                }
                // Also clear session storage if it was the active one
                if (activeStorage === sessionStorage) {
                    sessionStorage.removeItem("user");
                    sessionStorage.removeItem("profile");
                    sessionStorage.removeItem("accessToken");
                }
            }
        }
    } catch (error) {
        console.error("Error during getCurrentUser session retrieval:", error);
        // Clear potentially corrupted stored data if an error occurs
        logout();
        return null; // Indicate failure
    }
    
    return user;
};

const getAccessToken = (): string | null => {
    const activeStorage = getActiveStorage();
    return activeStorage?.getItem("accessToken") || null;
};

const AuthService = {
    register,
    login,
    logout,
    getCurrentUser,
    getAccessToken
};

export default AuthService;
