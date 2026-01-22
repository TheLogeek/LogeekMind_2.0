'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios, { AxiosError } from 'axios';
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

    // State for component-specific configurations
    const [outlineConfig, setOutlineConfig] = useState({ detailLevel: 'medium' });
    const [notesConfig, setNotesConfig] = useState({ source: 'topic', topic: '', file: null, fileName: '' });
    const [quizConfig, setQuizConfig] = useState({ topic: '', numQuestions: 10, difficulty: 3 });
    const [examConfig, setExamConfig] = useState({ topic: '', numQuestions: 20, durationMins: 30 });

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

    // Handlers for component-specific configurations
    const handleOutlineConfigChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setOutlineConfig({ detailLevel: e.target.value });
    };

    const handleNotesConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const target = e.target as HTMLInputElement | HTMLSelectElement; // Explicitly type target
        const { name, value } = target;

        if (name === 'file') { // Specific handling for file input
            // Use a type assertion to safely access 'files' property on HTMLInputElement
            const inputElement = target as HTMLInputElement;
            const file = inputElement.files?.[0];
            setNotesConfig(prev => ({
                ...prev,
                file: file || null,
                fileName: file ? file.name : ''
            }));
        } else { // Handling for select elements or other text inputs
            setNotesConfig(prev => ({ ...prev, [name]: value }));
        }
    };


    const handleQuizConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setQuizConfig(prev => ({ ...prev, [name]: value }));
    };

    const handleExamConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setExamConfig(prev => ({ ...prev, [name]: value }));
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

            // Prepare the payload with dynamic configurations
            const payload: any = {
                title: title,
                is_public: isPublic,
                content_config: {
                    outline: selectedComponents.has_outline ? outlineConfig : undefined,
                    notes: selectedComponents.has_notes ? notesConfig : undefined,
                    quiz: selectedComponents.has_quiz ? quizConfig : undefined,
                    exam: selectedComponents.has_exam ? examConfig : undefined,
                },
            };

            // Remove undefined configurations to keep payload clean
            Object.keys(payload.content_config).forEach(key =>
                payload.content_config[key] === undefined && delete payload.content_config[key]
            );
            // If content_config is empty after cleanup, remove it entirely
            if (Object.keys(payload.content_config).length === 0) {
                delete payload.content_config;
            }


            const createLessonResponse = await axios.post(`${API_BASE_URL}/lessons/create`, payload, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (createLessonResponse.data.success && createLessonResponse.data.lesson) {
                const newLessonId = createLessonResponse.data.lesson.id;
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

                {/* Dynamic Configuration Fields based on selectedComponents */}

                {selectedComponents.has_outline && (
                    <div className={styles.formGroup}>
                        <label htmlFor="outlineDetailLevel">Outline Detail Level:</label>
                        <select id="outlineDetailLevel" name="detailLevel" value={outlineConfig.detailLevel} onChange={handleOutlineConfigChange}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>
                )}

                {selectedComponents.has_notes && (
                    <div className={styles.formGroup}>
                        <label htmlFor="notesSource">Notes Source:</label>
                        <select id="notesSource" name="source" value={notesConfig.source} onChange={handleNotesConfigChange}>
                            <option value="topic">From Topic</option>
                            <option value="file">Upload File</option>
                        </select>

                        {notesConfig.source === 'topic' && (
                            <input
                                type="text"
                                name="topic"
                                value={notesConfig.topic}
                                onChange={handleNotesConfigChange}
                                placeholder="Enter topic for notes generation"
                                className={styles.dynamicInput}
                            />
                        )}
                        {notesConfig.source === 'file' && (
                            <>
                                <input
                                    type="file"
                                    name="file" // name should match state key if using event.target.name directly
                                    accept=".pdf,.txt,.docx"
                                    onChange={handleNotesConfigChange}
                                    className={styles.dynamicInput}
                                />
                                {notesConfig.fileName && <p>Selected file: {notesConfig.fileName}</p>}
                            </>
                        )}
                    </div>
                )}

                {selectedComponents.has_quiz && (
                    <div className={styles.formGroup}>
                        <label>Quiz Configuration:</label>
                        <input
                            type="text"
                            name="topic"
                            value={quizConfig.topic}
                            onChange={handleQuizConfigChange}
                            placeholder="Quiz Topic"
                            className={styles.dynamicInput}
                        />
                        <select name="numQuestions" value={quizConfig.numQuestions} onChange={handleQuizConfigChange}>
                            {[5, 10, 15, 20].map(num => <option key={num} value={num}>{num} Questions</option>)}
                        </select>
                        <select name="difficulty" value={quizConfig.difficulty} onChange={handleQuizConfigChange}>
                            <option value={1}>Easy</option>
                            <option value={2}>Beginner</option>
                            <option value={3}>Intermediate</option>
                            <option value={4}>Advanced</option>
                            <option value={5}>Hard</option>
                        </select>
                    </div>
                )}

                {selectedComponents.has_exam && (
                    <div className={styles.formGroup}>
                        <label>Exam Configuration:</label>
                        <input
                            type="text"
                            name="topic"
                            value={examConfig.topic}
                            onChange={handleExamConfigChange}
                            placeholder="Exam Topic"
                            className={styles.dynamicInput}
                        />
                        <select name="numQuestions" value={examConfig.numQuestions} onChange={handleExamConfigChange}>
                             {[10, 20, 30, 40].map(num => <option key={num} value={num}>{num} Questions</option>)}
                        </select>
                        <select name="durationMins" value={examConfig.durationMins} onChange={handleExamConfigChange}>
                            {[10, 30, 60, 90].map(mins => <option key={mins} value={mins}>{mins} Minutes</option>)}
                        </select>
                    </div>
                )}

                <button type="submit" disabled={loading || !title.trim()} className={styles.submitButton}>
                    {loading ? 'Creating Lesson...' : 'Create Lesson Structure'}
                </button>
            </form>
        </div>
    );
};

export default CreateLessonPage;
