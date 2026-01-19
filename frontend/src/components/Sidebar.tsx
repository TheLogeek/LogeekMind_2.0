'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AuthService from '../services/AuthService';
import axios, { AxiosError } from 'axios';
import styles from './Sidebar.module.css';
import { useUser } from '../app/layout'; // Import the useUser hook

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
    const [isAdmin, setIsAdmin] = useState(false);
    const { currentUser } = useUser(); // Use the global user context
    const pathname = usePathname();

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

    const getNavLinkClass = (path: string) => {
        return pathname === path ? `${styles.navLink} ${styles.activeNavLink}` : styles.navLink;
    };

    return (
        <div className={`${styles.sidebar} ${isOpen ? styles.open : styles.closed}`}>
            <h2 className={styles.sidebarH2}>
                <Link href="/" onClick={onClose}>LogeekMind</Link>
            </h2>
            <nav>
                <Link href="/dashboard" className={getNavLinkClass('/dashboard')} onClick={onClose}>Dashboard</Link>
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
                {isAdmin && currentUser && ( // Ensure user is logged in to show admin link
                    <>
                        <hr className={styles.linkSeparator}/>
                        <h4 className={styles.categoryTitle}>Admin</h4>
                        <Link href="/admin-dashboard" className={getNavLinkClass('/admin-dashboard')} onClick={onClose}>Admin</Link>
                    </>
                )}
            </nav>
            {isOpen && (
                <button type="button" className={styles.collapseButton} onClick={onClose}>
                    ❮
                </button>
            )}
        </div>
    );
};

export default Sidebar;