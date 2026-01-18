'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation'; // Use useRouter from next/navigation
import AuthService from '../../services/AuthService'; // Adjust path
import axios, { AxiosError } from 'axios';
import styles from './LoginPage.module.css'; // Import the CSS Module

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false); // New state for remember me
    const [message, setMessage] = useState('');
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => { // Added type
        e.preventDefault();
        setMessage('');
        try {
            // Pass rememberMe state to AuthService.login serv
            const response = await AuthService.login(email, password, rememberMe);
            if (response.success) {
                router.push('/'); // Redirect to home page on successful login
            } else {
                setMessage(response.message || 'Login failed.');
            }
        } catch (error: unknown) { // Explicitly type error as unknown
            if (axios.isAxiosError(error)) {
                console.error('Login error:', error);
                setMessage(error.response?.data?.detail || 'An unexpected error occurred.');
            } else {
                console.error('Login error:', error);
                setMessage('An unexpected error occurred.');
            }
        }
    };

    return (
        <div className={`page-container ${styles.loginPageContainer}`}>
            <h2>Login</h2>
            <form onSubmit={handleLogin}>
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
                {/* Remember Me Checkbox */}
                <div className={styles.rememberMeGroup}>
                    <input
                        type="checkbox"
                        id="rememberMe"
                        checked={rememberMe}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRememberMe(e.target.checked)}
                        className={styles.rememberMeCheckbox}
                    />
                    <label htmlFor="rememberMe">Remember Me</label>
                </div>
                <button type="submit" className={styles.submitButton}>Login</button>
            </form>
            {message && <p className={styles.message}>{message}</p>}
            <p className={styles.forgotPasswordLink}>
                <a onClick={() => router.push('/forgot-password')}>Forgot Password?</a> {/* Use router.push */}
            </p>
            <p className={styles.signupLink}>
                Don't have an account? <a onClick={() => router.push('/signup')}>Sign Up</a> {/* Use router.push */}
            </p>
        </div>
    );
};

export default LoginPage;
