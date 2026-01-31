'use client';

import axios from 'axios';
import { createClient, SupabaseClient, User as SupabaseAuthUser, Session } from '@supabase/supabase-js';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"; // Base URL of your backend
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Supabase environment variables are not set. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true, // This is key for "remember me" functionality
        storage: localStorage, // Use localStorage for session persistence
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});

// Using Supabase's User type for clarity, augmenting with our profile data
export interface User extends SupabaseAuthUser {
    // Add any additional fields you might expect directly on the user object beyond Supabase's default
}

export interface UserProfile {
    id: string; // The ID of the user (same as User.id)
    username: string;
    first_name: string | null;
    last_name: string | null;
    institution_name: string | null;
    faculty: string | null;
    department: string | null;
    level_class: string | null;
    study_schedule?: any; // Assuming study_schedule can be any JSON structure
    // Add other profile fields as they exist in your backend's profiles table
}

interface AuthResponse {
    success: boolean;
    message?: string;
    session?: Session; // Use Supabase's Session type
    user?: User;
    profile?: UserProfile;
}

const register = async (email: string, password: string, username: string, terms_accepted: boolean): Promise<AuthResponse> => {
    try {
        const response = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/signup`, {
            email,
            password,
            username,
            terms_accepted,
        });
        return response.data;
    } catch (error: any) {
        console.error("Registration API error:", error.response?.data || error);
        return { success: false, message: error.response?.data?.message || "Registration failed." };
    }
};

const login = async (email: string, password: string): Promise<AuthResponse> => {
    try {
        // Supabase client handles session persistence based on its configuration
        // The rememberMe flag here is implicitly handled by `persistSession: true` in createClient opts
        // If you needed to control session persistence dynamically, you'd need custom storage or a different approach.
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error("Supabase login error:", error.message);
            return { success: false, message: error.message || "Login failed." };
        }

        if (data.session && data.user) {
            // Fetch profile data from your backend after successful Supabase login
            // This ensures we get the full profile including any custom fields from your 'profiles' table
            const profileResponse = await axios.get(`${API_BASE_URL}/auth/profile`, {
                headers: { Authorization: `Bearer ${data.session.access_token}` }
            });
            const profile = profileResponse.data as UserProfile; // Cast to our UserProfile interface

            return {
                success: true,
                message: "Login successful!",
                session: data.session,
                user: data.user as User,
                profile: profile,
            };
        }
        return { success: false, message: "Login failed: No user or session data returned from Supabase." };

    } catch (error: any) {
        console.error("Login API error or Profile fetch error:", error.response?.data || error);
        return { success: false, message: error.response?.data?.detail || error.response?.data?.message || "Login failed due to invalid credentials or server error." };
    }
};

const logout = async () => {
    if (typeof window !== 'undefined') {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("Supabase logout error:", error.message);
        }
        // Explicitly remove old localStorage keys from previous authentication implementation
        localStorage.removeItem("user");
        localStorage.removeItem("profile");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("rememberMe");
        localStorage.removeItem("rememberedEmail");
        localStorage.removeItem("rememberedPassword");
        sessionStorage.removeItem("user"); // Clear sessionStorage for good measure too
        sessionStorage.removeItem("profile");
        sessionStorage.removeItem("accessToken");
    }
};

const getCurrentUser = async (): Promise<(User & { username?: string, profile?: UserProfile }) | null> => {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        // Supabase getSession implicitly checks and refreshes tokens if necessary
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            console.error("Supabase getSession error:", sessionError.message);
            await supabase.auth.signOut(); // Attempt to clear potentially corrupted session
            return null;
        }

        if (session && session.user) {
            // Fetch profile from your backend using the session's access token
            const profileResponse = await axios.get(`${API_BASE_URL}/auth/profile`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            const profile = profileResponse.data as UserProfile;

            return {
                ...session.user, // Spread Supabase user properties
                username: profile.username, // Add username from profile
                profile: profile, // Add full profile object
            } as (User & { username?: string, profile?: UserProfile });
        }
    } catch (error: any) {
        console.error("Error during getCurrentUser retrieval (profile fetch or network issue):", error.response?.data || error);
        // Clear session if there's an error retrieving current user (e.g., profile not found or token invalid with backend)
        await supabase.auth.signOut();
        return null;
    }
    
    return null;
};

const getAccessToken = async (): Promise<string | null> => {
    if (typeof window === 'undefined') {
        return null;
    }
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
};

const getUserProfile = async () => {
    const token = getAccessToken();
    if (!token) throw new Error("No access token found");
    const response = await axios.get(`${API_BASE_URL}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

const updateUserProfile = async (profileData: any) => {
    const token = getAccessToken();
    if (!token) throw new Error("No access token found");
    const response = await axios.put(`${API_BASE_URL}/auth/profile`, profileData, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

const AuthService = {
    register,
    login,
    logout,
    getCurrentUser,
    getAccessToken,
    getUserProfile,
    updateUserProfile,
};

export default AuthService;