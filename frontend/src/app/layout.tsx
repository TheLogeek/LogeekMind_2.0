'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import AuthService, { User, UserProfile } from '../services/AuthService'; // Import AuthService
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Import components
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';



// --- User Context for Global State ---
// This context will provide the currentUser and a way to set it to all components.
const UserContext = createContext<{ currentUser: User | null, setCurrentUser: React.Dispatch<React.SetStateAction<User | null>> } | null>(null);

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Re-add isSidebarOpen state
  const [currentUser, setCurrentUser] = useState<(User & { username?: string, profile?: UserProfile }) | null>(null);

  // --- Auto-login Effect ---
  // On initial app load, check if a user session is stored in localStorage/sessionStorage.
  useEffect(() => {
    const initializeUserSession = async () => { // Made async
      const user = await AuthService.getCurrentUser(); // Await the async function
      if (user) {
        setCurrentUser(user);
        console.log("Session restored from storage for user:", user);
      } else {
        // If no user is found in storage, ensure currentUser is null
        setCurrentUser(null);
        console.log("No active session found in storage.");
      }
    };

    initializeUserSession();
  }, []); // Empty dependency array ensures this runs only once on mount

  // --- Sidebar Responsive Logic (Re-added) ---
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false); // Sidebar closed by default on mobile
      } else {
        setIsSidebarOpen(true); // Sidebar open by default on desktop
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Call once on mount to set initial state
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Service Worker Registration ---
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
            console.log('Service Worker registered with scope:', registration.scope);
          })
          .catch(error => {
            console.error('Service Worker registration failed:', error);
          });
      });
    }
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
          <div className={`main-layout-container ${isSidebarOpen ? '' : 'sidebar-closed'}`}> {/* Apply class for sidebar state */}
            <Navbar toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} /> {/* Pass toggleSidebar to Navbar */}
            <div className="content-area-container"> {/* Re-add content-area-container */}
              <Sidebar isOpen={isSidebarOpen} onClose={toggleSidebar} /> {/* Render Sidebar */}
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