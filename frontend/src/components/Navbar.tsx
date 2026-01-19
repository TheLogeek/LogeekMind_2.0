'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthService from '../services/AuthService';
import styles from './Navbar.module.css';
import { useUser } from '../app/layout'; // Import the useUser hook

const Navbar = () => {
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

    const toggleNav = () => {
        setIsNavOpen(!isNavOpen);
    };

    return (
        <nav className={styles.navbar}>
            <div className={styles.navbarLogo}>
                <Link href="/" className={styles.navbarLogo}>
                    // <span className={styles.navbarLogoSpan1}>🧠</span>
                    <span className={styles.navbarLogoSpan2}>LogeekMind</span>
                </Link>
            </div>

            <button type="button" className={styles.hamburgerMenu} onClick={toggleNav}>
                {isNavOpen ? '✕' : '☰'}
            </button>

            <div className={`${styles.navbarNav} ${isNavOpen ? styles.open : ''}`}>
                <Link href="/" className={styles.navLink} onClick={toggleNav}>Home</Link>
                {/* Adjust features link if needed */}
                <Link href="/dashboard" className={styles.navLink} onClick={toggleNav}>Dashboard</Link>
                <Link href="/contact" className={styles.navLink} onClick={toggleNav}>Contact</Link>
            </div>

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