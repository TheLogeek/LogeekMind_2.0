'use client';

import React, { useState, useEffect } from 'react';
import styles from './ApiKeyInput.module.css';

interface ApiKeyInputProps {
    userApiKey: string;
    setUserApiKey: (key: string) => void;
}

const ArrowIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"></line>
        <polyline points="12 5 19 12 12 19"></polyline>
    </svg>
);

const API_KEY_STORAGE_KEY = 'gemini_api_key'; // Consistent key for storage

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ userApiKey, setUserApiKey }) => {
    const [feedback, setFeedback] = useState<{ message: string; type: string }>({ message: '', type: '' });
    const [loading, setLoading] = useState(false);
    const [rememberApiKey, setRememberApiKey] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Attempt to load API key from storage on component mount
            let storedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
            if (storedKey) {
                setRememberApiKey(true);
            } else {
                storedKey = sessionStorage.getItem(API_KEY_STORAGE_KEY);
            }

            if (storedKey) {
                setUserApiKey(storedKey);
                setFeedback({ message: 'Loaded saved API key.', type: 'success' });
                setTimeout(() => setFeedback({ message: '', type: '' }), 2000);
            }
        }
    }, [setUserApiKey]); // Only run on mount

    const handleValidation = () => {
        setLoading(true);
        setFeedback({ message: '', type: '' });

        if (typeof window !== 'undefined') {
            // Clear previous storage
            localStorage.removeItem(API_KEY_STORAGE_KEY);
            sessionStorage.removeItem(API_KEY_STORAGE_KEY);
        }

        // Simulate API validation
        setTimeout(() => {
            setLoading(false);
            if (userApiKey && userApiKey.length > 10) { // Simple validation rule
                setFeedback({ message: 'Success! API key will be used for requests.', type: 'success' });
                if (typeof window !== 'undefined') {
                    const storage = rememberApiKey ? localStorage : sessionStorage;
                    storage.setItem(API_KEY_STORAGE_KEY, userApiKey);
                }
            } else {
                setFeedback({ message: 'Invalid API key. Please check and try again.', type: 'error' });
                // If invalid, ensure key is cleared from state if it was stored
                setUserApiKey('');
            }
            // Hide feedback message after 2 seconds
            setTimeout(() => setFeedback({ message: '', type: '' }), 2000);
        }, 500);
    };

    return (
        <div className={styles.apiKeyContainer}>
            <label htmlFor="gemini-api-key">Your Gemini API Key (Optional)</label>
            <div className={styles.inputWrapper}>
                <input
                    type="password"
                    id="gemini-api-key"
                    value={userApiKey}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserApiKey(e.target.value)}
                    placeholder="Enter your key for unlimited usage"
                    className={styles.apiKeyInput}
                />
                <button
                    type="button"
                    onClick={handleValidation}
                    className={styles.sendButton}
                    disabled={loading}
                    title="Validate and use this key"
                >
                    {loading ? '...' : <ArrowIcon />}
                </button>
            </div>
            
            <div className={styles.rememberMeGroup}>
                <input
                    type="checkbox"
                    id="rememberApiKey"
                    checked={rememberApiKey}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRememberApiKey(e.target.checked)}
                    className={styles.rememberMeCheckbox}
                />
                <label htmlFor="rememberApiKey">Remember API Key</label>
                <span className={styles.securityDisclaimer} title="Stored locally in your browser. Not recommended on shared computers.">
                    (i)
                </span>
            </div>

            <p className={styles.infoText}>
                Providing your own key gives you uninterrupted service. <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Get your key here</a>.
            </p>
            {feedback.message && (
                <p className={`${styles.feedbackMessage} ${styles[feedback.type]}`}>
                    {feedback.message}
                </p>
            )}
        </div>
    );
};

export default ApiKeyInput;
