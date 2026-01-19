'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthService from '../services/AuthService';
import styles from './Navbar.module.css';
import { useUser } from '../app/layout'; // Import the useUser hook
import axios from 'axios'; // Import axios for check-admin-status

// Define API_BASE_URL within the file's scope, using environment variable with a fallback
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

interface NavbarProps {
    toggleSidebar: () => void;
    isSidebarOpen: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ toggleSidebar, isSidebarOpen }) => {
    const router = useRouter();
    const [isNavOpen, setIsNavOpen] = useState(false);
    const { currentUser, setCurrentUser } = useUser(); // Use the global user context

    // Access username directly from currentUser
    const username = currentUser?.username || "Guest";

    const handleLogout = () => {
        AuthService.logout();
        setCurrentUser(null); // Update the global state to log out the user
        router.push('/login'); // Redirect to login page
    };

    const handleMobileNavToggle = () => {
        setIsNavOpen(!isNavOpen);
    };

    const handleNavLinkClick = () => {
        setIsNavOpen(false); // Close mobile nav when a link is clicked
    };

    return (
        <nav className={styles.navbar}>
            <div className={styles.navbarLeft}>
                {/* Hamburger menu for mobile, Desktop sidebar toggle for desktop */}
                {typeof window !== 'undefined' && window.innerWidth < 768 ? ( // Hamburger on mobile
                    <button type="button" className={styles.hamburgerMenu} onClick={handleMobileNavToggle}>
                        {isNavOpen ? '✕' : '☰'}
                    </button>
                ) : ( // Sidebar toggle for desktop
                    <button type="button" className={styles.sidebarToggleButton} onClick={toggleSidebar}>
                        {isSidebarOpen ? '❮' : '❯'}
                    </button>
                )}
                <Link href="/" className={styles.navbarLogo}>
                    <span className={styles.navbarLogoSpan1}></span>
                    <span className={styles.navbarLogoSpan2}>    LogeekMind</span>
                </Link>
            </div>

            {/* Desktop Navigation Links */}
            <div className={styles.navbarNavDesktop}>
                <Link href="/" className={styles.navLink} onClick={handleNavLinkClick}>Home</Link>
                <Link href="/dashboard" className={styles.navLink} onClick={handleNavLinkClick}>Dashboard</Link>
                <Link href="/contact" className={styles.navLink} onClick={handleNavLinkClick}>Contact</Link>
            </div>

            {/* Desktop Auth Buttons */}
            <div className={styles.navbarAuthDesktop}>
                {currentUser ? (
                    <>
                        <span className={styles.welcomeText}>{username}</span>
                        <button type="button" onClick={handleLogout} className={styles.logoutButton}>Log Out</button>
                    </>
                ) : (
                    <>
                        <span className={styles.welcomeText}>Guest</span>
                        <button type="button" onClick={() => router.push('/login')} className={styles.authButton}>Login / Sign Up</button>
                    </>
                )}
            </div>

            {/* Mobile Auth Buttons */}
            <div className={styles.navbarAuthMobile}>
                {currentUser ? (
                    <>
                        <span className={styles.welcomeText}>{username}</span>
                    </>
                ) : (
                    <button type="button" onClick={() => router.push('/login')} className={styles.authButton}>Login</button>
                )}
            </div>

            {/* Mobile Full-Screen Overlay Nav */}
            <div className={`${styles.mobileNavOverlay} ${isNavOpen ? styles.open : ''}`}>
                <button type="button" className={styles.mobileNavCloseButton} onClick={handleMobileNavToggle}>
                    ✕
                </button>
                <div className={styles.mobileNavContent}>
                    {/* Auth Section for Mobile */}
                    <div className={styles.mobileNavAuth}>
                        {currentUser ? (
                            <>
                                <span className={styles.welcomeText}>{username}</span>
                                <button type="button" onClick={handleLogout} className={styles.logoutButton}>Log Out</button>
                            </>
                        ) : (
                            <>
                                <span className={styles.welcomeText}>Guest</span>
                                <button type="button" onClick={() => router.push('/login')} className={styles.authButton}>Login / Sign Up</button>
                            </>
                        )}
                    </div>
                    <hr className={styles.linkSeparator} />

                    {/* Main Nav Links for Mobile */}
                    <Link href="/" className={styles.navLink} onClick={handleNavLinkClick}>Home</Link>
                    <Link href="/dashboard" className={styles.navLink} onClick={handleNavLinkClick}>Dashboard</Link>
                    <Link href="/contact" className={styles.navLink} onClick={handleNavLinkClick}>Contact</Link>
                    
                    {/* Feature Links (from original Sidebar) for Mobile */}
                    <hr className={styles.linkSeparator}/>
                    <h4 className={styles.categoryTitle}>AI Tools</h4>
                    <Link href="/ai-teacher" className={styles.navLink} onClick={handleNavLinkClick}>AI Teacher</Link>
                    <Link href="/summarizer" className={styles.navLink} onClick={handleNavLinkClick}>Summarizer</Link>
                    <Link href="/smart-quiz" className={styles.navLink} onClick={handleNavLinkClick}>Smart Quiz</Link>
                    <Link href="/exam-simulator" className={styles.navLink} onClick={handleNavLinkClick}>Exam Simulator</Link>
                    <Link href="/course-outline" className={styles.navLink} onClick={handleNavLinkClick}>Course Outline</Link>
                    <Link href="/homework-assistant" className={styles.navLink} onClick={handleNavLinkClick}>Homework Assistant</Link>
                    <hr className={styles.linkSeparator}/>
                    <h4 className={styles.categoryTitle}>Utilities</h4>
                    <Link href="/gpa-calculator" className={styles.navLink} onClick={handleNavLinkClick}>GPA Calculator</Link>
                    <Link href="/study-scheduler" className={styles.navLink} onClick={handleNavLinkClick}>Study Scheduler</Link>
                    <Link href="/audio-to-text" className={styles.navLink} onClick={handleNavLinkClick}>Audio to Text</Link>
                    <Link href="/notes-to-audio" className={styles.navLink} onClick={handleNavLinkClick}>Notes to Audio</Link>
                    <hr className={styles.linkSeparator}/>
                    <h4 className={styles.categoryTitle}>Community</h4>
                    <Link href="/community-chat" className={styles.navLink} onClick={handleNavLinkClick}>Community Chat</Link>
                    
                    {/* Admin Link for Mobile */}
                    {currentUser && (
                        <AdminLink isNavOpen={isNavOpen} onNavLinkClick={handleNavLinkClick} />
                    )}
                </div>
            </div>
        </nav>
    );
};

// New AdminLink component to check admin status for mobile menu
const AdminLink: React.FC<{ isNavOpen: boolean, onNavLinkClick: () => void }> = ({ isNavOpen, onNavLinkClick }) => {
    const [isAdmin, setIsAdmin] = useState(false);
    const { currentUser } = useUser();
    const router = useRouter(); // Use useRouter in AdminLink

    useEffect(() => {
        const checkAdminStatus = async () => {
            if (currentUser) {
                try {
                    const accessToken = AuthService.getAccessToken();
                    if (accessToken) {
                        const response = await axios.get(`${API_BASE_URL}/auth/check-admin`, {
                            headers: {
                                Authorization: `Bearer ${accessToken}`, // Corrected Authorization header
                            },
                        });
                        setIsAdmin(response.data.is_admin);
                    } else {
                        setIsAdmin(false);
                    }
                } catch (error) {
                    console.error('Error checking admin status:', error);
                    setIsAdmin(false);
                }
            } else {
                setIsAdmin(false);
            }
        };
        // Only check admin status if the nav is open and user is logged in
        if (isNavOpen && currentUser) {
            checkAdminStatus();
        } else if (!currentUser) {
            setIsAdmin(false);
        }
    }, [currentUser, isNavOpen]);

    if (isAdmin && currentUser) {
        return (
            <>
                <hr className={styles.linkSeparator}/>
                <h4 className={styles.categoryTitle}>Admin</h4>
                <Link href="/admin-dashboard" className={styles.navLink} onClick={onNavLinkClick}>Admin</Link>
            </>
        );
    }
    return null;
}


export default Navbar;