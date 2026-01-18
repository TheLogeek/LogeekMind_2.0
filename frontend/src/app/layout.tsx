'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import AuthService from '../services/AuthService'; // Import AuthService
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Import components
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import SidebarToggleButton from '../components/SidebarToggleButton';

// --- User Context for Global State ---
// This context will provide the currentUser and a way to set it to all components.
const UserContext = createContext<{ currentUser: any, setCurrentUser: React.Dispatch<React.SetStateAction<any>> } | null>(null);

// Custom hook to easily access the User Context
export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return context;
};

// --- Fonts ---
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// --- Root Layout ---
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // --- Auto-login Effect ---
  // On initial app load, check if a user session is stored in localStorage.
  useEffect(() => {
    const initializeUserSession = async () => {
      const storedAccessToken = AuthService.getAccessToken();
      const isRemembered = AuthService.getRememberMe();

      if (isRemembered && storedAccessToken) {
        // If "Remember Me" is true and a token exists, try to verify the session with the backend
        const verificationResponse = await AuthService.verifySession(storedAccessToken);
        if (verificationResponse.success && verificationResponse.user) {
          setCurrentUser(verificationResponse.user);
          console.log("Session verified and auto-login successful for user:", verificationResponse.user);
        } else {
          // Token is invalid or expired, log out the user
          AuthService.logout();
          setCurrentUser(null);
          console.log("Session verification failed or token expired. User logged out.");
        }
      } else {
        // For non-"Remember Me" sessions (or if localStorage is empty), just try to get current user from sessionStorage
        const user = AuthService.getCurrentUser();
        if (user) {
          setCurrentUser(user);
          console.log("Session restored from storage for user:", user);
        }
      }
    };

    initializeUserSession();
  }, []); // Empty dependency array ensures this runs only once on mount

  // --- Sidebar Responsive Logic ---
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <html lang="en">
      <head>
        <title>LogeekMind</title>
        <meta name="description" content="Your all-in-one AI-powered learning assistant." />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1A3A6E" />
        <link rel="apple-touch-icon" href="/icon-192.png"></link>
        <meta name="apple-mobile-web-app-status-bar" content="#1A3A6E" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Provide the user context to the entire application */}
        <UserContext.Provider value={{ currentUser, setCurrentUser }}>
          <div className={`main-layout-container ${!isSidebarOpen ? 'sidebar-closed' : ''}`}>
            <Navbar />
            <div className="content-area-container">
              <Sidebar isOpen={isSidebarOpen} onClose={toggleSidebar} />
              {isSidebarOpen && typeof window !== 'undefined' && window.innerWidth < 768 && <div className="mobile-backdrop" onClick={toggleSidebar}></div>}
              <SidebarToggleButton toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
              <main className="main-content-area">
                {children}
              </main>
            </div>
          </div>
        </UserContext.Provider>
      </body>
    </html>
  );
}
