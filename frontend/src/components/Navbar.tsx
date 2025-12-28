'use client';

import React, { useState } from 'react';
import Link from 'next/link'; // Use Link from next/link
import { useRouter } from 'next/navigation'; // Use useRouter from next/navigation
import AuthService from '../services/AuthService'; // Adjust path
import styles from './Navbar.module.css'; // Import the CSS Module

const Navbar = () => { // Removed onSidebarToggle and isSidebarOpen props
    const router = useRouter();
    const [isNavOpen, setIsNavOpen] = useState(false); // Internal state for mobile nav toggle
    
    // Guard localStorage access for client-side only
    const currentUser = typeof window !== 'undefined' ? AuthService.getCurrentUser() : null;
    const userProfile = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("profile") || 'null') : null; // Explicitly type as null if not found
    const username = userProfile?.username || "Scholar";

    const handleLogout = () => {
        AuthService.logout();
        router.push('/login');
    };

    const toggleNav = () => {
        setIsNavOpen(!isNavOpen);
    };

    return (
        <nav className={styles.navbar}>
            {/* Logo and App Name */}
            <div className={styles.navbarLogo}>
                <Link href="/" className={styles.navbarLogo}>
                    <span className={styles.navbarLogoSpan1}>🧠</span>
                    <span className={styles.navbarLogoSpan2}>LogeekMind</span>
                </Link>
            </div>

            {/* Hamburger Menu Icon (Mobile Only) - controls Navbar's own links */}
            <button type="button" className={styles.hamburgerMenu} onClick={toggleNav}>
                {isNavOpen ? '✕' : '☰'}
            </button>

            {/* Navigation Links (Desktop, collapsed on mobile, toggled by internal state) */}
            <div className={`${styles.navbarNav} ${isNavOpen ? styles.open : ''}`}>
                <Link href="/" className={styles.navLink} onClick={toggleNav}>Home</Link>
                <Link href="/ai-teacher" className={styles.navLink} onClick={toggleNav}>Features</Link>
                <Link href="/contact" className={styles.navLink} onClick={toggleNav}>Contact</Link>
            </div>

            {/* Auth Buttons / User Info (Desktop, collapsed on mobile, toggled by internal state) */}
            <div className={`${styles.navbarAuth} ${isNavOpen ? styles.open : ''}`}>
                {currentUser ? (
                    <>
                        <span className={styles.welcomeText}>👋 {username}</span>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className={styles.logoutButton}
                        >
                            Log Out
                        </button>
                    </>
                ) : (
                    <>
                        <span className={styles.welcomeText}>Guest</span>
                        <button
                            type="button"
                            onClick={() => router.push('/login')}
                            className={styles.authButton}
                        >
                            Login / Sign Up
                        </button>
                    </>
                )}
            </div>
        </nav>
    );
};

export default Navbar;
