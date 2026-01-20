'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios, { AxiosError } from 'axios';
import styles from './ResetPasswordPage.module.css';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const ResetPasswordForm = () => {



    const [newPassword, setNewPassword] = useState('');

    const [confirmPassword, setConfirmPassword] = useState('');

    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const [message, setMessage] = useState('');

    const [loading, setLoading] = useState(false);

    const router = useRouter();

    // useSearchParams is for query parameters, Supabase often uses hash parameters for tokens

    const queryParams = useSearchParams();



    // State to hold token and type extracted from hash

        const [hashAccessToken, setHashAccessToken] = useState<string | null>(null);

        const [hashRefreshToken, setHashRefreshToken] = useState<string | null>(null); // New state for refresh token

        const [hashType, setHashType] = useState<string | null>(null);

    

        // Effect to parse hash parameters on component mount

        useEffect(() => {

            if (typeof window !== 'undefined' && window.location.hash) {

                const hash = window.location.hash.substring(1); // Remove the '#'

                const params = new URLSearchParams(hash);

                const token = params.get('access_token');

                const refreshToken = params.get('refresh_token'); // Extract refresh_token

                const type = params.get('type');

                setHashAccessToken(token);

                setHashRefreshToken(refreshToken); // Set refresh token state

                setHashType(type);

                console.log('Extracted access_token from hash:', token); // Debugging

                console.log('Extracted refresh_token from hash:', refreshToken); // Debugging

                console.log('Extracted type from hash:', type); // Debugging

            }

        }, []); // Run only once on mount

    

        // Use tokens and type from hash if available, otherwise fallback to query params (less likely for Supabase)

        const accessToken = hashAccessToken || queryParams.get('access_token');

        const refreshToken = hashRefreshToken || queryParams.get('refresh_token'); // Use refresh token

        const type = hashType || queryParams.get('type');

    

        useEffect(() => {

            if (!accessToken || !refreshToken || type !== 'recovery') { // Check for both tokens

                setMessage('Invalid or missing password reset token.');

            } else {

                setMessage(''); // Clear message if tokens seem valid

            }

        }, [accessToken, refreshToken, type]); // Depend on both tokens

    

        const togglePasswordVisibility = () => {

            setIsPasswordVisible(prevState => !prevState);

        };

    

        const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {

            e.preventDefault();

            setMessage('');

            setLoading(true);

    

            if (!accessToken || !refreshToken) { // Check for both tokens

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

                    { 

                        new_password: newPassword,

                        access_token: accessToken, // Send access_token in body

                        refresh_token: refreshToken // Send refresh_token in body

                    }

                ); // Removed headers as tokens are in body

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

                <div className={`${styles.formGroup} ${styles.passwordWrapper}`}>

                    <label htmlFor="newPassword">New Password:</label>

                    <input

                        type={isPasswordVisible ? "text" : "password"}

                        id="newPassword"

                        value={newPassword}

                        onChange={(e) => setNewPassword(e.target.value)}

                        required

                        className={styles.formInput}

                        disabled={loading}

                    />

                    <button type="button" onClick={togglePasswordVisibility} className={styles.togglePassword}>

                        {isPasswordVisible ? '👁️' : '👁️'}

                    </button>

                </div>

                <div className={`${styles.formGroup} ${styles.passwordWrapper}`}>

                    <label htmlFor="confirmPassword">Confirm New Password:</label>

                    <input

                        type={isPasswordVisible ? "text" : "password"}

                        id="confirmPassword"

                        value={confirmPassword}

                        onChange={(e) => setConfirmPassword(e.target.value)}

                        required

                        className={styles.formInput}

                        disabled={loading}

                    />

                    <button type="button" onClick={togglePasswordVisibility} className={styles.togglePassword}>

                        {isPasswordVisible ? '👁️' : '👁️'}

                    </button>

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
