'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthService from '../../services/AuthService';
import axios, { AxiosError } from 'axios';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import ApiKeyInput from '../../components/ApiKeyInput';
import styles from './SummarizerPage.module.css';

const API_BASE_URL = "http://127.0.0.1:8000";

const SummarizerPage = () => {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [textInput, setTextInput] = useState('');
    const [summary, setSummary] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentUser, setCurrentUser] = useState<any>(null);

    const GUEST_SUMMARY_LIMIT = 1;
    const GUEST_USAGE_KEY = 'summarizer_guest_usage';
    const [guestUsageCount, setGuestUsageCount] = useState(0);

    const [userGeminiApiKey, setUserGeminiApiKey] = useState('');

    useEffect(() => {
        setCurrentUser(AuthService.getCurrentUser());
        setGuestUsageCount(typeof window !== 'undefined' ? parseInt(localStorage.getItem(GUEST_USAGE_KEY) || '0', 10) : 0);

        // Restore state from sessionStorage
        const savedTextInput = sessionStorage.getItem('summarizer_textInput');
        const savedSummary = sessionStorage.getItem('summarizer_summary');
        if (savedTextInput) {
            setTextInput(savedTextInput);
        }
        if (savedSummary) {
            setSummary(savedSummary);
        }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(GUEST_USAGE_KEY, guestUsageCount.toString());
            if (!currentUser && guestUsageCount >= GUEST_SUMMARY_LIMIT) {
                setError(`You have reached the guest limit of ${GUEST_SUMMARY_LIMIT} summaries. Please login or sign up for unlimited access.`);
            } else {
                setError('');
            }
        }
    }, [guestUsageCount, currentUser]);

    const checkGuestLimit = () => {
        if (currentUser) return true;
        if (guestUsageCount >= GUEST_SUMMARY_LIMIT) {
            setError(`You have reached the guest limit of ${GUEST_SUMMARY_LIMIT} summaries. Please login or sign up for unlimited access.`);
            return false;
        }
        return true;
    };

    const incrementGuestUsage = () => {
        if (!currentUser) {
            setGuestUsageCount(prev => prev + 1);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setTextInput('');
            setSummary('');
            setError('');
        }
    };

    const handleTextInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setTextInput(e.target.value);
        setFile(null);
        setSummary('');
        setError('');
    };

    const handleSummarize = async () => {
        if (!checkGuestLimit()) return;
        if (!file && !textInput.trim()) {
            setError('Please upload a file or enter text to summarize.');
            return;
        }
        
        setError('');
        setSummary('');
        setLoading(true);
        
        try {
            const accessToken = AuthService.getAccessToken();
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

            let response;
            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                if (userGeminiApiKey) {
                    formData.append('gemini_api_key', userGeminiApiKey);
                }
                response = await axios.post(`${API_BASE_URL}/summarize/upload`, formData, {
                    headers: { ...headers, 'Content-Type': 'multipart/form-data' },
                });
            } else {
                const formData = new FormData();
                formData.append('text', textInput);
                if (userGeminiApiKey) {
                    formData.append('gemini_api_key', userGeminiApiKey);
                }
                response = await axios.post(`${API_BASE_URL}/summarize/text`, formData, {
                    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
                });
            }

            if (response.data && response.data.summary) {
                setSummary(response.data.summary);
                incrementGuestUsage();
                // Save state to sessionStorage
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem('summarizer_summary', response.data.summary);
                    if (textInput) {
                        sessionStorage.setItem('summarizer_textInput', textInput);
                    } else if (file) {
                        // We can't save the file, but we can note its name
                        sessionStorage.setItem('summarizer_textInput', `Summary generated from file: ${file.name}`);
                    }
                }
            } else {
                setError(response.data.message || 'Failed to get summary from the server.');
            }
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.detail || 'An error occurred during summarization.');
            } else {
                setError('An unexpected error occurred.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadSummary = () => {
        if (!summary || !currentUser) return;
        const blob = new Blob([summary], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file ? `${file.name.split('.')[0]}_summary.txt` : 'summary.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleNewSummary = () => {
        setFile(null);
        setTextInput('');
        setSummary('');
        setError('');
        // Clear sessionStorage
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem('summarizer_summary');
            sessionStorage.removeItem('summarizer_textInput');
        }
    };

    const handleResetGuestUsage = () => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(GUEST_USAGE_KEY, '0');
            setGuestUsageCount(0);
        }
    };

    return (
        <div className={`page-container ${styles.summarizerPageContainer}`}>
            <h2>📝 Document Summarizer</h2>
            <p>Upload your document or paste text to get a quick summary.</p>

            <ApiKeyInput
                userApiKey={userGeminiApiKey}
                setUserApiKey={setUserGeminiApiKey}
            />

            <div className={styles.inputSection}>
                <label htmlFor="file-upload">Upload PDF, DOCX, or TXT file:</label>
                <input
                    id="file-upload"
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileChange}
                />
                {file && <p>Selected file: <strong>{file.name}</strong></p>}
                <p className={styles.separator}>— OR —</p>
                <label htmlFor="text-input">Paste text here:</label>
                <textarea
                    id="text-input"
                    value={textInput}
                    onChange={handleTextInputChange}
                    placeholder="Enter your text here..."
                    rows={10}
                ></textarea>
            </div>

            <button
                onClick={handleSummarize}
                disabled={loading || (!file && !textInput.trim()) || (!currentUser && guestUsageCount >= GUEST_SUMMARY_LIMIT)}
                className={styles.summarizeButton}
            >
                {loading ? 'Generating Summary...' : 'Generate Summary'}
            </button>

            {error && <p className={styles.errorText}>{error}</p>}

            {summary && (
                <div className={styles.summaryOutput}>
                    <h3>Key Takeaways</h3>
                    <MarkdownRenderer content={summary} />
                    <div className={styles.summaryActions}>
                        <button 
                            onClick={handleDownloadSummary} 
                            className={styles.downloadButton}
                            disabled={!currentUser}
                            title={!currentUser ? "Login to download" : "Download Summary"}
                        >
                            Download Summary
                        </button>
                        <button onClick={handleNewSummary} className={styles.newSummaryButton}>Generate New Summary</button>
                    </div>
                </div>
            )}

            {!currentUser && (
                <div className={styles.guestMessage}>
                    <p>
                        {`You have used ${guestUsageCount} of ${GUEST_SUMMARY_LIMIT} guest summaries.`}
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

export default SummarizerPage;