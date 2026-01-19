'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation'; // Use useRouter from next/navigation
import AuthService from '../../services/AuthService'; // Adjust path
import axios, { AxiosError } from 'axios';
import styles from './LoginPage.module.css'; // Import the CSS Module(s)
import { useUser } from '../layout'; // Import useUser hook from layout

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [message, setMessage] = useState('');
    const router = useRouter();
    const { setCurrentUser } = useUser();

    const togglePasswordVisibility = () => {
        setIsPasswordVisible(prevState => !prevState);
    };

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setMessage('');
        try {
            const response = await AuthService.login(email, password, rememberMe);
            if (response.success && response.user) {
                setCurrentUser(response.user);
                router.push('/');
            } else {
                setMessage(response.message || 'Login failed.');
            }
        } catch (error: unknown) {
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
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className={styles.formInput}
                    />
                </div>
                <div className={`${styles.formGroup} ${styles.passwordWrapper}`}>
                    <label htmlFor="password">Password:</label>
                    <input
                        type={isPasswordVisible ? "text" : "password"}
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className={styles.formInput}
                    />
                    <button type="button" onClick={togglePasswordVisibility} className={styles.togglePassword}>
                        {isPasswordVisible ? '👁️' : '👁️'}
                    </button>
                </div>
                {/* Remember Me Checkbox */}
                <div className={styles.rememberMeGroup}>
                    <input
                        type="checkbox"
                        id="rememberMe"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className={styles.rememberMeCheckbox}
                    />
                    <label htmlFor="rememberMe">Remember Me</label>
                </div>
                <button type="submit" className={styles.submitButton}>Login</button>
            </form>
            {message && <p className={styles.message}>{message}</p>}
            <p className={styles.forgotPasswordLink}>
                <a onClick={() => router.push('/forgot-password')}>Forgot Password?</a>
            </p>
            <p className={styles.signupLink}>
                Don't have an account? <a onClick={() => router.push('/signup')}>Sign Up</a>
            </p>
        </div>
    );
};
