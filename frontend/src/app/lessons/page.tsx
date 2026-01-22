```tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import styles from './LessonsPage.module.css';
import AuthService from '../../services/AuthService';

interface Lesson {
  id: string;
  title: string;
  creator: {
    username: string;
  };
  created_at: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

const PublicLessonsPage = () => {
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const fetchPublicLessons = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE_URL}/lessons/public`, {
        params: { search: searchTerm },
      });
      if (response.data.success) {
        setLessons(response.data.lessons);
      } else {
        setError(
          response.data.message || 'Failed to fetch public lessons.'
        );
      }
    } catch {
      setError(
        'An error occurred while fetching lessons. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const checkLogin = async () => {
      setIsLoadingAuth(true);
      try {
        const user = await AuthService.getCurrentUser();
        setIsLoggedIn(!!user);
      } catch {
        setIsLoggedIn(false);
      } finally {
        setIsLoadingAuth(false);
      }
    };
    checkLogin();
  }, []);

  // ✅ FIX: hook is no longer conditional
  useEffect(() => {
    if (!isLoggedIn || isLoadingAuth) return;
    fetchPublicLessons();
  }, [fetchPublicLessons, isLoggedIn, isLoadingAuth]);

  if (isLoadingAuth) {
    return (
      <div className={`page-container ${styles.lessonsPageContainer}`}>
        <h2>Public Lessons</h2>
        <p>Loading authentication status...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className={`page-container ${styles.lessonsPageContainer}`}>
        <h2>Public Lessons</h2>
        <p>You need to be logged in to view lessons.</p>
        <button
          onClick={() => router.push('/login')}
          className={
            styles.loginPromptButton || styles.createLessonButton
          }
        >
          Log In
        </button>
      </div>
    );
  }

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetchPublicLessons();
  };

  return (
    <div className={`page-container ${styles.lessonsPageContainer}`}>
      <h2>Public Lessons</h2>

      <button
        onClick={() => router.push('/create-lesson')}
        className={styles.createLessonButton}
      >
        Create New Lesson
      </button>

      <p>Explore lessons created by other LogeekMind users.</p>

      <form onSubmit={handleSearch} className={styles.searchForm}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search for lessons..."
          className={styles.searchInput}
        />
        <button
          type="submit"
          disabled={loading}
          className={styles.searchButton}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <p className={styles.errorText}>{error}</p>}

      {loading ? (
        <p>Loading lessons...</p>
      ) : lessons.length > 0 ? (
        <div className={styles.lessonsGrid}>
          {lessons.map((lesson) => (
            <div
              key={lesson.id}
              className={styles.lessonCard}
              onClick={() =>
                router.push(`/lesson/${lesson.id}`)
              }
            >
              <h3>{lesson.title}</h3>
              <p>
                by {lesson.creator?.username ?? 'Unknown Creator'}
              </p>
              <span>
                {new Date(
                  lesson.created_at
                ).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.noLessonsMessage}>
          <p>No lessons found for your search.</p>
        </div>
      )}
    </div>
  );
};

export default PublicLessonsPage;
```
