'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation'; // Use useRouter from next/navigation
import AuthService from '../../services/AuthService'; // Adjust path
import axios, { AxiosError } from 'axios';
import styles from './SignupPage.module.css'; // Import the CSS Module

const SignupPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [message, setMessage] = useState('');
    const router = useRouter();

    const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => { // Added type
        e.preventDefault();
        setMessage('');
        if (!termsAccepted) {
            setMessage('You must accept the terms and conditions to sign up.');
            return;
        }
        try {
            const response = await AuthService.register(email, password, username, termsAccepted);
            if (response.success) {
                setMessage('Signup successful! Please login.');
                router.push('/login'); // Redirect to login page on successful signup
            } else {
                setMessage(response.message || 'Signup failed.');
            }
        } catch (error: unknown) { // Explicitly type error as unknown
            if (axios.isAxiosError(error)) {
                console.error('Signup error:', error);
                setMessage(error.response?.data?.detail || 'An unexpected error occurred.');
            } else {
                console.error('Signup error:', error);
                setMessage('An unexpected error occurred.');
            }
        }
    };

    return (
        <div className={`page-container ${styles.signupPageContainer}`}>
            <h2>Sign Up</h2>
            <form onSubmit={handleSignup}>
                <div className={styles.formGroup}>
                    <label htmlFor="email">Email:</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                        required
                        className={styles.formInput}
                    />
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="password">Password:</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                        required
                        className={styles.formInput}
                    />
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="username">Username:</label>
                    <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                        required
                        className={styles.formInput}
                    />
                </div>
                <div className={styles.termsCheckbox}>
                    <input
                        type="checkbox"
                        id="termsAccepted"
                        checked={termsAccepted}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTermsAccepted(e.target.checked)}
                    />
                    <label htmlFor="termsAccepted">I accept the <a onClick={() => router.push('/terms')}>terms and conditions</a></label> {/* Use router.push */}
                </div>
                <button type="submit" className={styles.submitButton}>Sign Up</button>
            </form>
            {message && <p className={styles.message}>{message}</p>}
            <p className={styles.loginLink}>
                Already have an account? <a onClick={() => router.push('/login')}>Login</a> {/* Use router.push */}
            </p>
        </div>
    );
};

export default SignupPage;
