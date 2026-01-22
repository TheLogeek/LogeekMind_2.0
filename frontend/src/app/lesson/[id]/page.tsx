'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import MarkdownRenderer from '../../../components/MarkdownRenderer';
import styles from './LessonPage.module.css';

interface LessonData {
    id: string;
    title: string;
    creator_id: string;
    is_public: boolean;
    created_at: string;
    content_config: {
        has_outline?: boolean;
        has_notes?: boolean;
        has_quiz?: boolean;
        has_exam?: boolean;
    };
    outline?: string;
    notes?: string;
    quiz?: any; // Define a proper type later
    exam?: any; // Define a proper type later
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const LessonPage = () => {
    const params = useParams();
    const lessonId = params.id as string;
    const [lesson, setLesson] = useState<LessonData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (lessonId) {
            const fetchLesson = async () => {
                setLoading(true);
                setError('');
                try {
                    const response = await axios.get(`${API_BASE_URL}/lessons/${lessonId}`);
                    if (response.data.success) {
                        setLesson(response.data.lesson);
                    } else {
                        setError(response.data.message || 'Failed to fetch lesson.');
                    }
                } catch (err) {
                    setError('A network error occurred or the lesson was not found.');
                } finally {
                    setLoading(false);
                }
            };
            fetchLesson();
        }
    }, [lessonId]);

    if (loading) {
        return <div className={`page-container ${styles.lessonPageContainer}`}><p>Loading lesson...</p></div>;
    }

    if (error) {
        return <div className={`page-container ${styles.lessonPageContainer}`}><p className={styles.errorText}>{error}</p></div>;
    }

    if (!lesson) {
        return <div className={`page-container ${styles.lessonPageContainer}`}><p>Lesson not found.</p></div>;
    }

    return (
        <div className={`page-container ${styles.lessonPageContainer}`}>
            <h1 className={styles.lessonTitle}>{lesson.title}</h1>

            {lesson.content_config.has_outline && lesson.outline && (
                <div className={styles.lessonSection}>
                    <h2>Course Outline</h2>
                    <MarkdownRenderer content={lesson.outline} />
                </div>
            )}

            {lesson.content_config.has_notes && lesson.notes && (
                <div className={styles.lessonSection}>
                    <h2>Lesson Notes</h2>
                    <MarkdownRenderer content={lesson.notes} />
                </div>
            )}

            {lesson.content_config.has_quiz && lesson.quiz && (
                <div className={styles.lessonSection}>
                    <h2>Quiz</h2>
                    {/* Placeholder for Quiz Component */}
                    <p>Quiz component will be rendered here.</p>
                </div>
            )}

            {lesson.content_config.has_exam && lesson.exam && (
                <div className={styles.lessonSection}>
                    <h2>Exam</h2>
                    {/* Placeholder for Exam Component */}
                    <p>Exam Simulator component will be rendered here.</p>
                </div>
            )}
        </div>
    );
};

export default LessonPage;
