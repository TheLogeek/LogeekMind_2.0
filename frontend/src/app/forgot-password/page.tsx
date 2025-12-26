'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation'; // Use useRouter from next/navigation
import axios, { AxiosError } from 'axios';
import styles from './ForgotPasswordPage.module.css'; // Import the CSS Module

const API_BASE_URL = "http://127.0.0.1:8000"; // Use your backend URL

const ForgotPasswordPage = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setMessage('');
        setLoading(true);

        try {
            const response = await axios.post(`${API_BASE_URL}/auth/forgot-password`, { email });
            setMessage(response.data.message || "If an account with that email exists, a password reset link has been sent.");
        } catch (error: unknown) { // Explicitly type error as unknown
            if (axios.isAxiosError(error)) {
                console.error('Forgot password error:', error);
                setMessage(error.response?.data?.detail || 'An unexpected error occurred. Please try again.');
            } else {
                console.error('Forgot password error:', error);
                setMessage('An unexpected error occurred. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`page-container ${styles.forgotPasswordPageContainer}`}>
            <h2>Forgot Password</h2>
            <p>Enter your email address to receive a password reset link.</p>
            <form onSubmit={handleSubmit}>
                <div className={styles.formGroup}>
                    <label htmlFor="email">Email:</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                        required
                        className={styles.formInput}
                        disabled={loading}
                    />
                </div>
                <button 
                    type="submit" 
                    className={styles.submitButton}
                    disabled={loading}
                >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
            </form>
            {message && (
                <p className={`${styles.message} ${
                    message.includes('unexpected') || message.includes('error') ? styles.errorMessage : styles.successMessage
                }`}>
                    {message}
                </p>
            )}
            <p className={styles.loginLink}>
                Remember your password? <a onClick={() => router.push('/login')}>Login</a> {/* Use router.push */}
            </p>
        </div>
    );
};

export default ForgotPasswordPage;
