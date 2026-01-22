'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import styles from './CreateLessonPage.module.css';
import AuthService from '../../services/AuthService';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const CreateLessonPage = () => {
    const router = useRouter();
    const [title, setTitle] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [selectedComponents, setSelectedComponents] = useState({
        has_outline: true,
        has_notes: true,
        has_quiz: false,
        has_exam: false,
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Redirect if not logged in, as lesson creation requires a creator_id
        if (!AuthService.getCurrentUser()) {
            router.push('/login?redirect=/create-lesson');
        }
    }, [router]);

    const handleComponentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = event.target;
        setSelectedComponents(prev => ({
            ...prev,
            [name]: checked,
        }));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        if (!title.trim()) {
            setError("Lesson title cannot be empty.");
            return;
        }
        
        setLoading(true);
        try {
            const accessToken = AuthService.getAccessToken();
            if (!accessToken) {
                setError("You must be logged in to create a lesson.");
                setLoading(false);
                return;
            }

            // Create the lesson shell first
            const createLessonResponse = await axios.post(`${API_BASE_URL}/lessons/create`, {
                title: title,
                is_public: isPublic,
                content_config: selectedComponents,
            }, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (createLessonResponse.data.success && createLessonResponse.data.lesson) {
                const newLessonId = createLessonResponse.data.lesson.id;
                // Now, potentially, we would redirect to a page where the tutor can add content,
                // or we could integrate generation directly here if the UI supported it.
                // For now, let's just confirm creation and redirect to the lesson view or a dashboard.
                router.push(`/lesson/${newLessonId}`); // Redirect to the newly created lesson page
            } else {
                setError(createLessonResponse.data.message || 'Failed to create lesson.');
            }
        } catch (err: unknown) {
            const axiosError = err as AxiosError<any>;
            console.error('Error creating lesson:', axiosError.response?.data || axiosError);
            setError(axiosError.response?.data?.detail || 'An unexpected error occurred while creating the lesson.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`page-container ${styles.createLessonPageContainer}`}>
            <h2>Create New Lesson</h2>
            <p>Set up your lesson structure and choose which AI tools to include.</p>

            {error && <p className={styles.errorText}>{error}</p>}

            <form onSubmit={handleSubmit} className={styles.createLessonForm}>
                <div className={styles.formGroup}>
                    <label htmlFor="lessonTitle">Lesson Title:</label>
                    <input
                        type="text"
                        id="lessonTitle"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Introduction to Quantum Physics"
                        required
                    />
                </div>

                <div className={styles.formGroup}>
                    <label htmlFor="publicAccess">Publicly Visible:</label>
                                <input
                                    type="checkbox"
                                    id="publicAccess"
                                    checked={isPublic}
                                    onChange={(e) => setIsPublic(e.target.checked)}
                                />
                                <small className={styles.helperText}>If checked, other users can view this lesson.</small>
                            </div>
                    
                            <div className={styles.formGroup}>
                                <label>Lesson Components:</label>
                                <div className={styles.componentCheckboxes}>
                                    <label>
                                        <input
                                            type="checkbox"
                                            name="has_outline"
                                            checked={selectedComponents.has_outline}
                                            onChange={handleComponentChange}
                                        /> Course Outline
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            name="has_notes"
                                            checked={selectedComponents.has_notes}
                                            onChange={handleComponentChange}
                                        /> Lesson Notes (AI Teacher)
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            name="has_quiz"
                                            checked={selectedComponents.has_quiz}
                                            onChange={handleComponentChange}
                                        /> Quiz
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            name="has_exam"
                                            checked={selectedComponents.has_exam}
                                            onChange={handleComponentChange}
                                        /> Exam
                                    </label>
                                </div>
                            </div>
                    
                            <button type="submit" disabled={loading || !title.trim()} className={styles.submitButton}>
                                {loading ? 'Creating Lesson...' : 'Create Lesson Structure'}
                            </button>
                        </form>
                    </div>
                    );
                    };
                    
                    export default CreateLessonPage;
