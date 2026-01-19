'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthService from '../services/AuthService';
import styles from './Navbar.module.css';
import { useUser } from '../app/layout'; // Import the useUser hook
import axios from 'axios'; // Import axios for check-admin-status

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const Navbar = () => {
    const router = useRouter();
    const [isNavOpen, setIsNavOpen] = useState(false);
    const { currentUser, setCurrentUser } = useUser(); // Use the global user context
    const [isAdmin, setIsAdmin] = useState(false); // State for admin status

    // Access username directly from currentUser
    const username = currentUser?.username || "Guest";

    // Effect to check admin status
    useEffect(() => {
        const checkAdminStatus = async () => {
            if (currentUser) {
                try {
                    const accessToken = AuthService.getAccessToken();
                    if (accessToken) {
                        const response = await axios.get(`${API_BASE_URL}/auth/check-admin`, {
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
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

        checkAdminStatus();
    }, [currentUser]); // Re-run when currentUser from context changes

    const handleLogout = () => {
        AuthService.logout();
        setCurrentUser(null); // Update the global state to log out the user
        router.push('/login'); // Redirect to login page
    };

    const toggleNav = () => {
        setIsNavOpen(!isNavOpen);
    };

    const handleNavLinkClick = () => {
        setIsNavOpen(false); // Close mobile nav when a link is clicked
    };

    return (
        <nav className={styles.navbar}>
            <div className={styles.navbarLogo}>
                <Link href="/" className={styles.navbarLogo}>
                    <span className={styles.navbarLogoSpan1}></span>
                    <span className={styles.navbarLogoSpan2}>    LogeekMind</span>
                </Link>
            </div>

            <button type="button" className={styles.hamburgerMenu} onClick={toggleNav}>
                {isNavOpen ? '✕' : '☰'}
            </button>

            <div className={`${styles.navbarNav} ${isNavOpen ? styles.open : ''}`}>
                <Link href="/" className={styles.navLink} onClick={handleNavLinkClick}>Home</Link>
                {/* Unified navigation links */}
                <Link href="/dashboard" className={styles.navLink} onClick={handleNavLinkClick}>Dashboard</Link>
                <Link href="/contact" className={styles.navLink} onClick={handleNavLinkClick}>Contact</Link>
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
                {isAdmin && currentUser && ( // Ensure user is logged in to show admin link
                    <>
                        <hr className={styles.linkSeparator}/>
                        <h4 className={styles.categoryTitle}>Admin</h4>
                        <Link href="/admin-dashboard" className={styles.navLink} onClick={handleNavLinkClick}>Admin</Link>
                    </>
                )}
            </div>

            <div className={`${styles.navbarAuth} ${isNavOpen ? styles.open : ''}`}>
                {currentUser ? (
                    <>
                        <span className={styles.welcomeText}>{username}</span>
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