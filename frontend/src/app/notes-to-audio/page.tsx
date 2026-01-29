'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthService from '../../services/AuthService';
import axios, { AxiosError } from 'axios';
import styles from './NotesToAudioPage.module.css';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const NotesToAudioPage = () => {
    const router = useRouter();
    const [inputMode, setInputMode] = useState('paste');
    const [textInput, setTextInput] = useState('');
    const [fileInput, setFileInput] = useState<File | null>(null);
    const [audioData, setAudioData] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentUser, setCurrentUser] = useState<any>(null);

    const GUEST_NTA_LIMIT = 1;
    const GUEST_USAGE_KEY = 'notes_to_audio_guest_usage';
    const [guestUsageCount, setGuestUsageCount] = useState(0);

    useEffect(() => {
        setCurrentUser(AuthService.getCurrentUser());
        setGuestUsageCount(typeof window !== 'undefined' ? parseInt(localStorage.getItem(GUEST_USAGE_KEY) || '0', 10) : 0);

        // Restore state from sessionStorage
        const savedInputMode = sessionStorage.getItem('notes_to_audio_inputMode');
        const savedTextInput = sessionStorage.getItem('notes_to_audio_textInput');
        if (savedInputMode) {
            setInputMode(savedInputMode);
        }
        if (savedTextInput) {
            setTextInput(savedTextInput);
        }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(GUEST_USAGE_KEY, guestUsageCount.toString());
            if (!currentUser && guestUsageCount >= GUEST_NTA_LIMIT) {
                setError(`You have reached the guest limit of ${GUEST_NTA_LIMIT} audio conversions. Please login or sign up for unlimited access.`);
            } else {
                setError('');
            }
        }
    }, [guestUsageCount, currentUser]);

    const checkGuestLimit = () => {
        if (currentUser) return true;
        if (guestUsageCount >= GUEST_NTA_LIMIT) {
            setError(`You have reached the guest limit of ${GUEST_NTA_LIMIT} audio conversions. Please login or sign up for unlimited access.`);
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
        const file = e.target.files?.[0];
        if (file) {
            setFileInput(file);
            setTextInput('');
            setAudioData(null);
            setError('');
        }
    };

    const handleTextInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setTextInput(e.target.value);
        setFileInput(null);
        setAudioData(null);
        setError('');
    };

    const handleGenerateAudio = async () => {
        setError('');
        setAudioData(null);
        if (!checkGuestLimit()) return;

        if (inputMode === 'paste' && !textInput.trim()) {
            setError('Please paste your lecture notes.');
            return;
        }
        if (inputMode === 'upload' && !fileInput) {
            setError('Please upload a file.');
            return;
        }

        setLoading(true);
        try {
            const accessToken = AuthService.getAccessToken();
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

            let response;
            if (inputMode === 'paste') {
                const formData = new FormData();
                formData.append('text', textInput);
                response = await axios.post(`${API_BASE_URL}/notes-to-audio/convert-text`, formData, {
                    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
                    responseType: 'blob'
                });
            } else {
                const formData = new FormData();
                if (fileInput) formData.append('file', fileInput);
                response = await axios.post(`${API_BASE_URL}/notes-to-audio/convert-file`, formData, {
                    headers: { ...headers, 'Content-Type': 'multipart/form-data' },
                    responseType: 'blob'
                });
            }

            if (response.data) {
                const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
                const audioUrl = URL.createObjectURL(audioBlob);
                setAudioData(audioUrl);
                incrementGuestUsage();
                // Save inputs to sessionStorage
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem('notes_to_audio_inputMode', inputMode);
                    if (inputMode === 'paste') {
                        sessionStorage.setItem('notes_to_audio_textInput', textInput);
                    } else if (fileInput) {
                        sessionStorage.setItem('notes_to_audio_textInput', fileInput.name); // Save filename
                    }
                }
            } else {
                setError('Failed to generate audio from the server.');
            }
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                if (err.response && err.response.status === 401) {
                    setError('Unauthorized. Please log in.');
                    AuthService.logout();
                    router.push('/login');
                } else {
                    setError(err.response?.data?.detail || 'An error occurred during audio generation.');
                }
            } else {
                setError('An unexpected error occurred.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadAudio = () => {
        if (!audioData || !currentUser) return;
        const a = document.createElement('a');
        a.href = audioData;
        const fileName = fileInput ? `${fileInput.name.split('.')[0]}_audio.mp3` : `notes_audio_${Date.now()}.mp3`;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleNewLecture = () => {
        setTextInput('');
        setFileInput(null);
        if (audioData) {
            URL.revokeObjectURL(audioData);
        }
        setAudioData(null);
        setError('');
        // Clear sessionStorage
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem('notes_to_audio_inputMode');
            sessionStorage.removeItem('notes_to_audio_textInput');
        }
    };

    const handleResetGuestUsage = () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(GUEST_USAGE_KEY);
            setGuestUsageCount(0);
        }
    };

    return (
        <div className={`page-container ${styles.notesToAudioPageContainer}`}>
            <h2>Lecture Notes-to-Audio Converter</h2>
            <p>Convert your notes into an MP3 lecture instantly!</p>

            <div className={styles.inputModeToggle}>
                <button
                    onClick={() => setInputMode('paste')}
                    className={inputMode === 'paste' ? styles.active : ''}
                >
                    Paste Text
                </button>
                <button
                    onClick={() => setInputMode('upload')}
                    className={inputMode === 'upload' ? styles.active : ''}
                >
                    Upload File (.txt, .pdf, .docx)
                </button>
            </div>

            <div className={styles.inputSection}>
                {inputMode === 'paste' ? (
                    <div>
                        <label htmlFor="text-input">Paste your lecture notes:</label>
                        <textarea
                            id="text-input"
                            value={textInput}
                            onChange={handleTextInputChange}
                            placeholder="Enter your text here..."
                            rows={10}
                            className={styles.formInput}
                        ></textarea>
                    </div>
                ) : (
                    <div>
                        <label htmlFor="file-upload">Choose a file:</label>
                        <input
                            id="file-upload"
                            type="file"
                            accept=".pdf,.docx,.txt"
                            onChange={handleFileChange}
                            className={styles.formInput}
                        />
                        {fileInput && <p>Selected file: <strong>{fileInput.name}</strong></p>}
                    </div>
                )}
            </div>

            <button
                onClick={handleGenerateAudio}
                disabled={loading || (inputMode === 'paste' && !textInput.trim()) || (inputMode === 'upload' && !fileInput) || (!currentUser && guestUsageCount >= GUEST_NTA_LIMIT)}
                className={styles.generateButton}
style={loading ? { color: 'black', opacity: 1 } : {}}
            >
                {loading ? 'Generating Audio...' : 'Generate Audio Lecture'}
            </button>

            {error && <p className={styles.errorText}>{error}</p>}

            {audioData && (
                <div className={styles.audioOutput}>
                    <h3>Generated Audio</h3>
                    <audio controls src={audioData} className={styles.audioPlayer}></audio>
                    <div className={styles.audioActions}>
                        <button 
                            onClick={handleDownloadAudio} 
                            className={styles.downloadButton}
                            disabled={!currentUser}
                            title={!currentUser ? "Login to download" : "Download Audio Lecture"}
                        >
                            Download Audio Lecture
                        </button>
                        <button onClick={handleNewLecture} className={styles.newLectureButton}>New Audio Lecture</button>
                    </div>
                </div>
            )}

            {!currentUser && (
                <div className={styles.guestMessage}>
                    <p>
                        {`You have used ${guestUsageCount} of ${GUEST_NTA_LIMIT} guest audio conversions.`}
                        Please <a onClick={() => router.push('/login')}>Login</a> or <a onClick={() => router.push('/signup')}>Sign Up</a> for unlimited access.
                    </p>

                </div>
            )}
        </div>
    );
};

export default NotesToAudioPage;