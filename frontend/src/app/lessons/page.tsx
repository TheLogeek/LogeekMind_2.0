'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios, { AxiosError } from 'axios';
import styles from './LessonsPage.module.css';
import AuthService from '../../services/AuthService'; // Import AuthService

interface Lesson {
    id: string;
    title: string;
    creator: {
        username: string;
    };
    created_at: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const PublicLessonsPage = () => {
    const router = useRouter();
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // State to check if user is logged in
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true); // To manage initial auth check loading state

    const fetchPublicLessons = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await axios.get(`${API_BASE_URL}/lessons/public`, {
                params: { search: searchTerm }
            });
            if (response.data.success) {
                setLessons(response.data.lessons);
            } else {
                setError(response.data.message || 'Failed to fetch public lessons.');
            }
        } catch (err) {
            setError('An error occurred while fetching lessons. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [searchTerm]);

    useEffect(() => {
        // Check login status when component mounts
        const checkLogin = async () => {
            setIsLoadingAuth(true);
            try { // Added try-catch for robustness
                const user = await AuthService.getCurrentUser();
                if (user) {
                    setIsLoggedIn(true);
                } else {
                    setIsLoggedIn(false);
                }
            } catch (error) {
                console.error("Error checking login status:", error);
                setIsLoggedIn(false); // Assume not logged in if an error occurs
            } finally {
                setIsLoadingAuth(false);
            }
        };
        checkLogin();
    }, []);

    // Handle initial loading state for auth check
    if (isLoadingAuth) {
        return (
            <div className={`page-container ${styles.lessonsPageContainer}`}>
                <h2>Public Lessons</h2>
                <p>Loading authentication status...</p>
            </div>
        );
    }

    // If not logged in, show login prompt and button
    if (!isLoggedIn) {
        return (
            <div className={`page-container ${styles.lessonsPageContainer}`}>
                <h2>Public Lessons</h2>
                <p>You need to be logged in to view lessons.</p>
                {/* Added a specific class for the login prompt button, falling back to createLessonButton if not found */}
                <button onClick={() => router.push('/login')} className={styles.loginPromptButton || styles.createLessonButton}>
                    Log In
                </button>
            </div>
        );
    }

    // If logged in, proceed to render the page
    useEffect(() => {
        fetchPublicLessons();
    }, [fetchPublicLessons]);

    const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        fetchPublicLessons();
    };

    return (
        <div className={`page-container ${styles.lessonsPageContainer}`}>
            <h2>Public Lessons</h2>
            {/* Create New Lesson button visible to logged-in users at all times */}
            {isLoggedIn && (
                <button onClick={() => router.push('/create-lesson')} className={styles.createLessonButton}>
                    Create New Lesson
                </button>
            )}
            <p>Explore lessons created by other LogeekMind users.</p>

            <form onSubmit={handleSearch} className={styles.searchForm}>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search for lessons..."
                    className={styles.searchInput}
                />
                <button type="submit" disabled={loading} className={styles.searchButton}>
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </form>

            {error && <p className={styles.errorText}>{error}</p>}

            {loading ? (
                <p>Loading lessons...</p>
            ) : lessons.length > 0 ? (
                <div className={styles.lessonsGrid}>
                    {lessons.map(lesson => (
                        <div key={lesson.id} className={styles.lessonCard} onClick={() => router.push(`/lesson/${lesson.id}`)}>
                            <h3>{lesson.title}</h3>
                            {/* Safely access creator.username to prevent errors if creator is null or undefined */}
                            <p>by {lesson.creator?.username ?? 'Unknown Creator'}</p>
                            <span>{new Date(lesson.created_at).toLocaleDateString()}</span>
                        </div>
                    ))}
                </div>
            ) : (
                // This block is now only reached if isLoggedIn is true AND lessons.length is 0
                <div className={styles.noLessonsMessage}>
                    <p>No lessons found for your search.</p>
                </div>
            )}
        </div>
    );
};

export default PublicLessonsPage;