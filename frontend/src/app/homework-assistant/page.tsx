'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthService from '../../services/AuthService';
import axios, { AxiosError } from 'axios';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import ApiKeyInput from '../../components/ApiKeyInput';
import styles from './HomeworkAssistantPage.module.css';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const HomeworkAssistantPage = () => {
    const router = useRouter();
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [context, setContext] = useState('');
    const [solution, setSolution] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentUser, setCurrentUser] = useState<any>(null);

    const GUEST_HW_LIMIT = 1;
    const GUEST_USAGE_KEY = 'homework_assistant_guest_usage';
    const [guestUsageCount, setGuestUsageCount] = useState(0);

    const [userGeminiApiKey, setUserGeminiApiKey] = useState('');

    useEffect(() => {
        setCurrentUser(AuthService.getCurrentUser());
        setGuestUsageCount(typeof window !== 'undefined' ? parseInt(localStorage.getItem(GUEST_USAGE_KEY) || '0', 10) : 0);

        // Restore state from sessionStorage
        const savedContext = sessionStorage.getItem('homework_context');
        const savedSolution = sessionStorage.getItem('homework_solution');
        if (savedContext) {
            setContext(savedContext);
        }
        if (savedSolution) {
            setSolution(savedSolution);
        }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(GUEST_USAGE_KEY, guestUsageCount.toString());
            if (!currentUser && guestUsageCount >= GUEST_HW_LIMIT) {
                setError(`You have reached the guest limit of ${GUEST_HW_LIMIT} homework solutions. Please login or sign up for unlimited access.`);
            } else {
                setError('');
            }
        }
    }, [guestUsageCount, currentUser]);

    const checkGuestLimit = () => {
        if (currentUser) return true;
        if (guestUsageCount >= GUEST_HW_LIMIT) {
            setError(`You have reached the guest limit of ${GUEST_HW_LIMIT} homework solutions. Please login or sign up for unlimited access.`);
            return false;
        }
        return true;
    };

    const incrementGuestUsage = () => {
        if (!currentUser) {
            setGuestUsageCount(prev => prev + 1);
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            setSolution('');
            setError('');
        }
    };

    const handleGenerateSolution = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!imageFile) {
            setError('Please upload an image of your homework problem.');
            return;
        }
        if (!checkGuestLimit()) return;

        setError('');
        setSolution('');
        setLoading(true);

        try {
            const accessToken = AuthService.getAccessToken();
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

            const formData = new FormData();
            formData.append('file', imageFile);
            formData.append('context', context);
            if (userGeminiApiKey) {
                formData.append('gemini_api_key', userGeminiApiKey);
            }

            const response = await axios.post(`${API_BASE_URL}/homework-assistant/solve`, formData, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });

            if (response.data && response.data.solution_text) {
                setSolution(response.data.solution_text);
                incrementGuestUsage();
                // Save state to sessionStorage
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem('homework_solution', response.data.solution_text);
                    sessionStorage.setItem('homework_context', context);
                }
            } else {
                setError('Failed to get solution from AI.');
            }
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.detail || 'An error occurred during solution generation.');
            } else {
                setError('An unexpected error occurred.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadDocx = async () => {
        if (!solution || !currentUser) return;

        try {
            const accessToken = AuthService.getAccessToken();
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
            const formData = new FormData();
            formData.append('solution_text', solution);
            formData.append('context', context);

            const response = await axios.post(`${API_BASE_URL}/homework-assistant/download-docx`, formData, { headers, responseType: 'blob' });

            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `homework_solution_${Date.now()}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.detail || 'Failed to download DOCX.');
            } else {
                setError('An unexpected error occurred while downloading DOCX.');
            }
        }
    };

    const handleNewProblem = () => {
        if (imagePreview) {
            URL.revokeObjectURL(imagePreview);
        }
        setImageFile(null);
        setImagePreview(null);
        setContext('');
        setSolution('');
        setError('');
        // Clear sessionStorage
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem('homework_solution');
            sessionStorage.removeItem('homework_context');
        }
    };

    const handleResetGuestUsage = () => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(GUEST_USAGE_KEY, '0');
            setGuestUsageCount(0);
        }
    };

    return (
        <div className={`page-container ${styles.homeworkAssistantPageContainer}`}>
            <h2>📸 Homework Assistant</h2>
            <p>Upload a picture of your homework problem and get a step-by-step, downloadable solution.</p>

            <ApiKeyInput
                userApiKey={userGeminiApiKey}
                setUserApiKey={setUserGeminiApiKey}
            />

            <form onSubmit={handleGenerateSolution} className={styles.homeworkForm}>
                <div className={styles.formGroup}>
                    <label htmlFor="image-upload">Upload Image of Homework Problem:</label>
                    <input
                        id="image-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/jpg"
                        onChange={handleImageChange}
                    />
                    {imagePreview && (
                        <div className={styles.imagePreviewContainer}>
                            <img src={imagePreview} alt="Homework Preview" className={styles.imagePreview} />
                        </div>
                    )}
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="context">Add Context (Optional):</label>
                    <textarea
                        id="context"
                        value={context}
                        onChange={(e) => setContext(e.target.value)}
                        placeholder="e.g., This is a kinematics problem or I'm stuck on Step 3."
                        rows={4}
                    ></textarea>
                </div>
                <button
                    type="submit"
                    disabled={loading || !imageFile || (!currentUser && guestUsageCount >= GUEST_HW_LIMIT)}
                    className={styles.generateButton}
                >
                    {loading ? 'Generating Solution...' : 'Generate Solution'}
                </button>
            </form>

            {error && <p className={styles.errorText}>{error}</p>}

            {solution && (
                <div className={styles.solutionOutput}>
                    <h3>Generated Solution</h3>
                    <MarkdownRenderer content={solution} />
                    <div className={styles.solutionActions}>
                        <button 
                            onClick={handleDownloadDocx} 
                            className={styles.downloadButton}
                            disabled={!currentUser}
                            title={!currentUser ? "Login to download" : "Download as DOCX"}
                        >
                            Download as DOCX
                        </button>
                        <button onClick={handleNewProblem} className={styles.newProblemButton}>New Problem</button>
                    </div>
                </div>
            )}

            {!currentUser && (
                <div className={styles.guestMessage}>
                    <p>
                        {`You have used ${guestUsageCount} of ${GUEST_HW_LIMIT} guest solutions.`}
                        Please <a onClick={() => router.push('/login')}>Login</a> or <a onClick={() => router.push('/signup')}>Sign Up</a> for unlimited access.
                    </p>
                    {guestUsageCount > 0 && (
                        <button onClick={handleResetGuestUsage} className="debug-button">
                            Reset Guest Usage (DEBUG)
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default HomeworkAssistantPage;