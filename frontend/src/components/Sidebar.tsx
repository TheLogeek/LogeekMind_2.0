'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link'; // Use Link from next/link
import { usePathname } from 'next/navigation'; // Use usePathname for active link logic
import AuthService from '../services/AuthService';
import axios, { AxiosError } from 'axios';
import styles from './Sidebar.module.css'; // Import the CSS Module

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
    const [isAdmin, setIsAdmin] = useState(false);
    // Guard localStorage access for client-side only
    const currentUser = typeof window !== 'undefined' ? AuthService.getCurrentUser() : null;
    const pathname = usePathname(); // Get current path for active link

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
                        setIsAdmin(false); // No access token, so not admin
                    }
                } catch (error: unknown) {
                    if (axios.isAxiosError(error)) {
                        console.error('Error checking admin status:', error.response?.data || error);
                    } else {
                        console.error('Error checking admin status:', error);
                    }
                    setIsAdmin(false); // Assume not admin on any error during API call
                }
            } else {
                setIsAdmin(false); // Not logged in, so not admin
            }
        };

        checkAdminStatus();
    }, [currentUser]); // Re-run when currentUser changes

    const getNavLinkClass = (path: string) => {
        return pathname === path ? `${styles.navLink} ${styles.activeNavLink}` : styles.navLink;
    };

    return (
        <div className={`${styles.sidebar} ${isOpen ? styles.open : styles.closed}`}>
            <h2 className={styles.sidebarH2}>
                <Link href="/" onClick={onClose}>LogeekMind</Link>
            </h2>
            <nav>
                <Link href="/dashboard" className={getNavLinkClass('/dashboard')} onClick={onClose}>📊 Dashboard</Link> {/* Updated link for User Dashboard */}
                <hr className={styles.linkSeparator}/>
                <h4 className={styles.categoryTitle}>AI Tools</h4>
                <Link href="/ai-teacher" className={getNavLinkClass('/ai-teacher')} onClick={onClose}>AI Teacher</Link>
                <Link href="/summarizer" className={getNavLinkClass('/summarizer')} onClick={onClose}>Summarizer</Link>
                <Link href="/smart-quiz" className={getNavLinkClass('/smart-quiz')} onClick={onClose}>Smart Quiz</Link>
                <Link href="/exam-simulator" className={getNavLinkClass('/exam-simulator')} onClick={onClose}>Exam Simulator</Link>
                <Link href="/course-outline" className={getNavLinkClass('/course-outline')} onClick={onClose}>Course Outline</Link>
                <Link href="/homework-assistant" className={getNavLinkClass('/homework-assistant')} onClick={onClose}>Homework Assistant</Link>
                <hr className={styles.linkSeparator}/>
                <h4 className={styles.categoryTitle}>Utilities</h4>
                <Link href="/gpa-calculator" className={getNavLinkClass('/gpa-calculator')} onClick={onClose}>GPA Calculator</Link>
                <Link href="/study-scheduler" className={getNavLinkClass('/study-scheduler')} onClick={onClose}>Study Scheduler</Link>
                <Link href="/audio-to-text" className={getNavLinkClass('/audio-to-text')} onClick={onClose}>Audio to Text</Link>
                <Link href="/notes-to-audio" className={getNavLinkClass('/notes-to-audio')} onClick={onClose}>Notes to Audio</Link>
                <hr className={styles.linkSeparator}/>
                <h4 className={styles.categoryTitle}>Community</h4>
                <Link href="/community-chat" className={getNavLinkClass('/community-chat')} onClick={onClose}>Community Chat</Link>
                {isAdmin && ( /* Conditionally render Admin link */
                    <>
                        <hr className={styles.linkSeparator}/>
                        <h4 className={styles.categoryTitle}>Admin</h4>
                        <Link href="/admin-dashboard" className={getNavLinkClass('/admin-dashboard')} onClick={onClose}>Admin</Link>
                    </>
                )}
            </nav>
        </div>
    );
};

export default Sidebar;
