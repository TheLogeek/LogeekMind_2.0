'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthService from '../../services/AuthService';
import axios, { AxiosError } from 'axios';
import styles from './AudioToTextPage.module.css';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const AudioToTextPage = () => {
    const router = useRouter();
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [transcribedText, setTranscribedText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentUser, setCurrentUser] = useState<any>(null);

    const GUEST_TRANSCRIBE_LIMIT = 1;
    const GUEST_USAGE_KEY = 'audio_to_text_guest_usage';
    const [guestUsageCount, setGuestUsageCount] = useState(0);

    useEffect(() => {
        setCurrentUser(AuthService.getCurrentUser());
        setGuestUsageCount(typeof window !== 'undefined' ? parseInt(localStorage.getItem(GUEST_USAGE_KEY) || '0', 10) : 0);

        // Restore state from sessionStorage
        const savedTranscribedText = sessionStorage.getItem('audio_to_text_transcribedText');
        if (savedTranscribedText) {
            setTranscribedText(savedTranscribedText);
        }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(GUEST_USAGE_KEY, guestUsageCount.toString());
            if (!currentUser && guestUsageCount >= GUEST_TRANSCRIBE_LIMIT) {
                setError(`You have reached the guest limit of ${GUEST_TRANSCRIBE_LIMIT} audio transcriptions. Please login or sign up for unlimited access and to download your transcripted file.`);
            } else {
                setError('');
            }
        }
    }, [guestUsageCount, currentUser]);

    const checkGuestLimit = () => {
        if (currentUser) return true;
        if (guestUsageCount >= GUEST_TRANSCRIBE_LIMIT) {
            setError(`You have reached the guest limit of ${GUEST_TRANSCRIBE_LIMIT} audio transcriptions. Please login or sign up for unlimited access.`);
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
            setAudioFile(file);
            setTranscribedText('');
            setError('');
        }
    };

    const handleTranscribe = async () => {
        setError('');
        setTranscribedText('');
        if (!audioFile) {
            setError('Please upload an audio file.');
            return;
        }
        if (!checkGuestLimit()) return;

        setLoading(true);
        try {
            const accessToken = AuthService.getAccessToken();
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

            const formData = new FormData();
            formData.append('file', audioFile);

            const response = await axios.post(`${API_BASE_URL}/audio-to-text/transcribe`, formData, {
                headers: { ...headers, 'Content-Type': 'multipart/form-data' },
            });

            if (response.data && response.data.transcribed_text) {
                setTranscribedText(response.data.transcribed_text);
                incrementGuestUsage();
                // Save state to sessionStorage
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem('audio_to_text_transcribedText', response.data.transcribed_text);
                }
            } else {
                setError('Failed to transcribe audio.');
            }
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                if (err.response && err.response.status === 401) {
                    setError('Unauthorized. Please log in.');
                    AuthService.logout();
                    router.push('/login');
                } else {
                    setError(err.response?.data?.detail || 'An error occurred during transcription.');
                }
            } else {
                setError('An unexpected error occurred.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadTranscript = () => {
        if (!transcribedText || !currentUser) return;
        const blob = new Blob([transcribedText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileName = audioFile ? `${audioFile.name.split('.')[0]}_transcription.txt` : 'transcription.txt';
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleNewTranscription = () => {
        setAudioFile(null);
        setTranscribedText('');
        setError('');
        // Clear sessionStorage
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem('audio_to_text_transcribedText');
        }
    };

    const handleResetGuestUsage = () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(GUEST_USAGE_KEY);
            setGuestUsageCount(0);
        }
    };

    return (
        <div className={`page-container ${styles.audioToTextPageContainer}`}>
            <h2>Lecture Audio-to-Text Converter</h2>
            <p>Upload an audio file to transcribe it and download the text.</p>

            <div className={styles.inputSection}>
                <label htmlFor="audio-upload">Upload an audio file (MP3, WAV, M4A, OGG):</label>
                <input
                    id="audio-upload"
                    type="file"
                    accept="audio/mpeg,audio/wav,audio/x-m4a,audio/ogg"
                    onChange={handleFileChange}
                />
                {audioFile && <p>Selected file: <strong>{audioFile.name}</strong></p>}
                {audioFile && <audio controls src={URL.createObjectURL(audioFile)} className={styles.audioPlayer} />}
            </div>

            <button
                onClick={handleTranscribe}
                disabled={loading || !audioFile || (!currentUser && guestUsageCount >= GUEST_TRANSCRIBE_LIMIT)}
                className={styles.transcribeButton}
style={loading ? { color: 'black', opacity: 1 } : {}}
            >
                {loading ? 'Transcribing...' : 'Convert and Generate File'}
            </button>

            {error && <p className={styles.errorText}>{error}</p>}

            {transcribedText && (
                <div className={styles.transcriptionOutput}>
                    <h3>Transcription</h3>
                    <pre>{transcribedText}</pre>
                    <div className={styles.transcriptionActions}>
                        <button 
                            onClick={handleDownloadTranscript} 
                            className={styles.downloadButton}
                            disabled={!currentUser}
                            title={!currentUser ? "Login to download" : "Download Transcript"}
                        >
                            Download Transcript
                        </button>
                        <button onClick={handleNewTranscription} className={styles.newTranscriptionButton}>Generate New</button>
                    </div>
                </div>
            )}

            {!currentUser && (
                <div className={styles.guestMessage}>
                    <p>
                        {`You have used ${guestUsageCount} of ${GUEST_TRANSCRIBE_LIMIT} guest transcriptions.`}
                        Please <a onClick={() => router.push('/login')}>Login</a> or <a onClick={() => router.push('/signup')}>Sign Up</a> for unlimited access.
                    </p>

                </div>
            )}
        </div>
    );
};

export default AudioToTextPage;