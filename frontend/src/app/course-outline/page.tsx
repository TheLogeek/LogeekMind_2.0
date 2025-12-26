'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Use useRouter from next/navigation
import AuthService from '../../services/AuthService'; // Adjust path
import axios, { AxiosError } from 'axios';
import MarkdownRenderer from '../../components/MarkdownRenderer'; // Adjust path relative to app/course-outline/page.tsx
import ApiKeyInput from '../../components/ApiKeyInput'; // Adjust path relative to app/course-outline/page.tsx
import styles from './CourseOutlinePage.module.css';

const API_BASE_URL = "http://127.0.0.1:8000";

const CourseOutlinePage = () => {
    const router = useRouter();
    const [courseFullName, setCourseFullName] = useState('');
    const [courseCode, setCourseCode] = useState('');
    const [universityName, setUniversityName] = useState('');
    const [generatedOutline, setGeneratedOutline] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Guard localStorage access for client-side only
    const [currentUser, setCurrentUser] = useState(
        typeof window !== 'undefined' ? AuthService.getCurrentUser() : null
    );

    const GUEST_OUTLINE_LIMIT = 1;
    const GUEST_USAGE_KEY = 'course_outline_guest_usage';
    const [guestUsageCount, setGuestUsageCount] = useState(() => {
        return typeof window !== 'undefined' ? parseInt(localStorage.getItem(GUEST_USAGE_KEY) || '0', 10) : 0;
    });

    const [userGeminiApiKey, setUserGeminiApiKey] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedOutline = sessionStorage.getItem('course_outline_outline');
            const savedInputs = sessionStorage.getItem('course_outline_inputs');
            if (savedOutline) {
                setGeneratedOutline(savedOutline);
            }
            if (savedInputs) {
                const { courseFullName, courseCode, universityName } = JSON.parse(savedInputs);
                setCourseFullName(courseFullName || '');
                setCourseCode(courseCode || '');
                setUniversityName(universityName || '');
            }
        }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(GUEST_USAGE_KEY, guestUsageCount.toString());
            if (!currentUser && guestUsageCount >= GUEST_OUTLINE_LIMIT) {
                setError(`You have reached the guest limit of ${GUEST_OUTLINE_LIMIT} course outlines. Please login or sign up for unlimited access.`);
            } else {
                setError('');
            }
        }
    }, [guestUsageCount, currentUser]);

    const checkGuestLimit = () => {
        if (currentUser) return true;
        if (guestUsageCount >= GUEST_OUTLINE_LIMIT) {
            setError(`You have reached the guest limit of ${GUEST_OUTLINE_LIMIT} course outlines. Please login or sign up for unlimited access.`);
            return false;
        }
        return true;
    };

    const incrementGuestUsage = () => {
        if (!currentUser && typeof window !== 'undefined') {
            setGuestUsageCount(prev => prev + 1);
        }
    };

    const handleGenerateOutline = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!courseFullName.trim()) {
            setError('Please enter the Course Full Name.');
            return;
        }
        if (!checkGuestLimit()) return;

        setError('');
        setGeneratedOutline('');
        setLoading(true);

        try {
            const accessToken = AuthService.getAccessToken();
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

            const response = await axios.post(`${API_BASE_URL}/course-outline/generate`, {
                course_full_name: courseFullName,
                course_code: courseCode || null,
                university_name: universityName || null,
                gemini_api_key: userGeminiApiKey || null,
            }, { headers });

            if (response.data.success && response.data.outline_text) {
                setGeneratedOutline(response.data.outline_text);
                incrementGuestUsage();
                // Save state to sessionStorage
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem('course_outline_outline', response.data.outline_text);
                    const inputs = { courseFullName, courseCode, universityName };
                    sessionStorage.setItem('course_outline_inputs', JSON.stringify(inputs));
                }
            } else {
                setError(response.data.message || 'Failed to generate course outline.');
            }
        } catch (err: unknown) { // Explicitly type err as unknown
            if (axios.isAxiosError(err)) {
                console.error('Course outline generation error:', err.response?.data || err);
                setError(err.response?.data?.detail || 'An error occurred during generation.');
            } else {
                console.error('Course outline generation error:', err);
                setError('An unexpected error occurred during generation.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadDocx = async () => {
        if (!generatedOutline || !currentUser) return;

        try {
            const accessToken = AuthService.getAccessToken();
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
            const response = await axios.post(`${API_BASE_URL}/course-outline/download-docx`, {
                course_full_name: courseFullName,
                outline_text: generatedOutline,
            }, { headers, responseType: 'blob' });

            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const fileName = courseFullName.replace(/\s/g, '_') + '_Outline.docx'; // More robust filename
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err: unknown) { // Explicitly type err as unknown
            if (axios.isAxiosError(err)) {
                console.error('Error downloading DOCX:', err.response?.data || err);
                setError(err.response?.data?.detail || 'Failed to download DOCX.');
            } else {
                console.error('Error downloading DOCX:', err);
                setError('An unexpected error occurred while downloading DOCX.');
            }
        }
    };

    const handleNewOutline = () => {
        setCourseFullName('');
        setCourseCode('');
        setUniversityName('');
        setGeneratedOutline('');
        setError('');
        // Clear sessionStorage
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem('course_outline_outline');
            sessionStorage.removeItem('course_outline_inputs');
        }
    };

    const handleResetGuestUsage = () => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(GUEST_USAGE_KEY, '0');
            setGuestUsageCount(0);
            setError('');
        }
    };

    return (
        <div className={`page-container ${styles.courseOutlinePageContainer}`}>
            <h2>📝 Course Outline Generator</h2>
            <p>Instantly generate a detailed, university-level course syllabus and outline.</p>

            <ApiKeyInput
                userApiKey={userGeminiApiKey}
                setUserApiKey={setUserGeminiApiKey}
            />

            <form onSubmit={handleGenerateOutline} className={styles.courseOutlineForm}>
                <div className={styles.formGroup}>
                    <label htmlFor="courseFullName">Course Full Name:</label>
                    <input
                        type="text"
                        id="courseFullName"
                        value={courseFullName}
                        onChange={(e) => setCourseFullName(e.target.value)}
                        placeholder="e.g. Introduction to Computer Science"
                        required
                    />
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="courseCode">Course Code (Optional):</label>
                    <input
                        type="text"
                        id="courseCode"
                        value={courseCode}
                        onChange={(e) => setCourseCode(e.target.value)}
                        placeholder="e.g., CSC 101"
                    />
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="universityName">University Name (Optional):</label>
                    <input
                        type="text"
                        id="universityName"
                        value={universityName}
                        onChange={(e) => setUniversityName(e.target.value)}
                        placeholder="e.g., Harvard University or Lagos State University"
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading || !courseFullName.trim() || (!currentUser && guestUsageCount >= GUEST_OUTLINE_LIMIT)}
                    className={styles.generateButton}
                >
                    {loading ? 'Generating Outline...' : 'Generate Outline'}
                </button>
            </form>

            {error && <p className={styles.errorText}>{error}</p>}

            {generatedOutline && (
                <div className={styles.generatedOutlineOutput}>
                    <h3>Generated Course Outline</h3>
                    <MarkdownRenderer content={generatedOutline} />
                    <div className={styles.outlineActions}>
                        <button 
                            onClick={handleDownloadDocx} 
                            className={styles.downloadButton}
                            disabled={!currentUser}
                            title={!currentUser ? "Login to download" : "Download as DOCX"}
                        >
                            Download as DOCX
                        </button>
                        <button onClick={handleNewOutline} className={styles.newOutlineButton}>Generate New Outline</button>
                    </div>
                </div>
            )}

            {!currentUser && (
                <div className={styles.guestMessage}>
                    <p>
                        {`You have used ${guestUsageCount} of ${GUEST_OUTLINE_LIMIT} guest outlines.`}
                        Please <a href="/login">Login</a> or <a href="/signup">Sign Up</a> for unlimited access.
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

export default CourseOutlinePage;
