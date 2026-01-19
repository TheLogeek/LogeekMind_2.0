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
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    interface MessageState {
        text: string;
        type: 'success' | 'error' | '';
    }
    const [message, setMessage] = useState<MessageState>({ text: '', type: '' });
    const router = useRouter();

    const togglePasswordVisibility = () => {
        setIsPasswordVisible(prevState => !prevState);
    };

    const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setMessage({ text: '', type: '' }); // Clear previous message
        if (!termsAccepted) {
            setMessage({ text: 'You must accept the terms and conditions to sign up.', type: 'error' });
            return;
        }
        try {
            const response = await AuthService.register(email, password, username, termsAccepted);
            if (response.success) {
                setMessage({ text: 'Signup successful! Please login.', type: 'success' });
                setTimeout(() => {
                    router.push('/login');
                }, 1500);
            } else {
                setMessage({ text: response.message || 'Signup failed.', type: 'error' });
            }
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                console.error('Signup error:', error);
                setMessage({ text: error.response?.data?.detail || 'An unexpected error occurred.', type: 'error' });
            } else {
                console.error('Signup error:', error);
                setMessage({ text: 'An unexpected error occurred.', type: 'error' });
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
                <div className={styles.formGroup}>
                    <label htmlFor="username">Username:</label>
                    <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className={styles.formInput}
                    />
                </div>
                <div className={styles.termsCheckbox}>
                    <input
                        type="checkbox"
                        id="termsAccepted"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                    />
                    <label htmlFor="termsAccepted">I accept the <a onClick={() => router.push('/terms')}>terms and conditions</a></label>
                </div>
                <button type="submit" className={styles.submitButton}>Sign Up</button>
            </form>
            {message.text && (
                <p className={`${styles.message} ${message.type === 'success' ? styles.successMessage : styles.errorMessage}`}>
                    {message.text}
                </p>
            )}
            <p className={styles.loginLink}>
                Already have an account? <a onClick={() => router.push('/login')}>Login</a>
            </p>
        </div>
    );
};

export default SignupPage;
