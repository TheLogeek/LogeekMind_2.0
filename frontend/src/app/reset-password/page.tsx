'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios, { AxiosError } from 'axios';
import styles from './ResetPasswordPage.module.css';

const API_BASE_URL = "http://127.0.0.1:8000";

const ResetPasswordForm = () => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    const accessToken = searchParams.get('access_token');
    const type = searchParams.get('type');

    useEffect(() => {
        if (!accessToken || type !== 'recovery') {
            setMessage('Invalid or missing password reset token.');
        }
    }, [accessToken, type]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setMessage('');
        setLoading(true);

        if (!accessToken) {
            setMessage('Invalid password reset link. Please try again.');
            setLoading(false);
            return;
        }

        if (newPassword !== confirmPassword) {
            setMessage('New password and confirm password do not match.');
            setLoading(false);
            return;
        }

        if (newPassword.length < 6) {
            setMessage('Password must be at least 6 characters long.');
            setLoading(false);
            return;
        }

        try {
            const response = await axios.post(`${API_BASE_URL}/auth/reset-password`,
                { new_password: newPassword },
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            setMessage(response.data.message || 'Password reset successfully!');
            setTimeout(() => {
                router.push('/login');
            }, 3000);
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                console.error('Password reset error:', error);
                setMessage(error.response?.data?.detail || 'An unexpected error occurred during password reset.');
            } else {
                console.error('Password reset error:', error);
                setMessage('An unexpected error occurred during password reset.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`page-container ${styles.resetPasswordPageContainer}`}>
            <h2>Reset Password</h2>
            <p>Enter your new password.</p>
            <form onSubmit={handleSubmit}>
                <div className={styles.formGroup}>
                    <label htmlFor="newPassword">New Password:</label>
                    <input
                        type="password"
                        id="newPassword"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        className={styles.formInput}
                        disabled={loading}
                    />
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="confirmPassword">Confirm New Password:</label>
                    <input
                        type="password"
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className={styles.formInput}
                        disabled={loading}
                    />
                </div>
                <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={loading || !accessToken}
                >
                    {loading ? 'Resetting...' : 'Reset Password'}
                </button>
            </form>
            {message && (
                <p className={`${styles.message} ${
                    message.includes('successfully') ? styles.successMessage : styles.errorMessage
                }`}>
                    {message}
                </p>
            )}
        </div>
    );
};

const ResetPasswordPage = () => {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ResetPasswordForm />
        </Suspense>
    );
};

export default ResetPasswordPage;