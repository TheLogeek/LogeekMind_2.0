'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Use useRouter from next/navigation
import AuthService from '../../services/AuthService'; // Adjust path
import axios, { AxiosError } from 'axios';
import styles from './GPACalculatorPage.module.css'; // Import the CSS Module

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const GRADE_OPTIONS = ["A", "B", "C", "D", "E", "F"];

const GPACalculatorPage = () => {
    const router = useRouter();
    const [courses, setCourses] = useState([
        { id: 1, name: '', grade: 'A', units: 3 }
    ]);
    const [gpaResult, setGpaResult] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    useEffect(() => {
        const fetchUser = async () => {
            const user = await AuthService.getCurrentUser();
            setCurrentUser(user);
            setGuestUsageCount(typeof window !== 'undefined' ? parseInt(localStorage.getItem(GUEST_USAGE_KEY) || '0', 10) : 0);
        };
        fetchUser();
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(GUEST_USAGE_KEY, guestUsageCount.toString());
        }
    }, [guestUsageCount]);

    useEffect(() => {
        if (!currentUser && guestUsageCount >= GUEST_GPA_LIMIT) {
            setError(`You have reached the guest limit of ${GUEST_GPA_LIMIT} GPA calculations. Please login or sign up for unlimited access.`);
        } else {
            setError(''); // Clear error if limit is no longer an issue
        }
    }, [currentUser, guestUsageCount]);


    const checkGuestLimit = () => {
        if (currentUser) return true; // Logged in users have no guest limit

        if (guestUsageCount >= GUEST_GPA_LIMIT) {
            setError(`You have reached the guest limit of ${GUEST_GPA_LIMIT} GPA calculations. Please login or sign up for unlimited access.`);
            return false;
        }
        return true;
    };

    const incrementGuestUsage = () => {
        if (!currentUser && typeof window !== 'undefined') {
            setGuestUsageCount(prev => prev + 1);
        }
    };

    const handleCourseChange = (id: number, field: string, value: string | number) => { // Added types
        setCourses(prevCourses =>
            prevCourses.map(course =>
                course.id === id ? { ...course, [field]: value } : course
            )
        );
    };

    const addCourse = () => {
        setCourses(prevCourses => [
            ...prevCourses,
            { id: prevCourses.length ? Math.max(...prevCourses.map(c => c.id)) + 1 : 1, name: '', grade: 'A', units: 3 }
        ]);
    };

    const removeCourse = (id: number) => { // Added type
        setCourses(prevCourses => prevCourses.filter(course => course.id !== id));
    };

    const handleCalculateGpa = async () => {
        setError('');
        setGpaResult(null);

        if (!checkGuestLimit()) {
            return;
        }

        const validCourses = courses.filter(course => course.name.trim() && course.units > 0);
        if (validCourses.length === 0) {
            setError('Please add at least one valid course to calculate GPA.');
            return;
        }

        setLoading(true);
        try {
            const accessToken = await AuthService.getAccessToken();
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

            const requestData = {
                courses: validCourses.map(({ id, ...rest }) => rest) // Remove temporary id for backend
            };

            const response = await axios.post(`${API_BASE_URL}/gpa/calculate`, requestData, { headers });

            if (response.data.success && response.data.gpa !== undefined) {
                setGpaResult(response.data.gpa);
                incrementGuestUsage(); // Only increment on successful calculation for guests
            } else {
                setError(response.data.message || 'Failed to calculate GPA.');
            }
        } catch (err: unknown) { // Explicitly type err as unknown
            if (axios.isAxiosError(err)) {
                console.error('GPA calculation error:', err.response?.data || err);
                if (err.response && err.response.status === 401) {
                    setError('Unauthorized. Please log in.');
                    await AuthService.logout();
                    router.push('/login');
                } else {
                    setError(err.response?.data?.detail || 'An error occurred during GPA calculation.');
                }
            } else {
                console.error('GPA calculation error:', err);
                setError('An unexpected error occurred during GPA calculation.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setCourses([{ id: 1, name: '', grade: 'A', units: 3 }]);
        setGpaResult(null);
        setError('');
        // Guest usage count is NOT reset here, it persists for the session.
    };

    const handleResetGuestUsage = () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(GUEST_USAGE_KEY);
            setGuestUsageCount(0);
            setError('');
        }
    };

    return (
        <div className={`page-container ${styles.gpaCalculatorPageContainer}`}>
            <h2>GPA Calculator</h2>
            <p>Enter your grades and credit units to calculate your term GPA.</p>

            <div className={styles.courseInputGridHeader}>
                <div>Course Name</div>
                <div>Grade</div>
                <div>Units</div>
                <div></div>
            </div>

            {courses.map(course => (
                <div key={course.id} className={styles.courseInputRow}>
                    <input
                        type="text"
                        value={course.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCourseChange(course.id, 'name', e.target.value)}
                        placeholder="Course Name"
                    />
                    <select
                        value={course.grade}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleCourseChange(course.id, 'grade', e.target.value)}
                    >
                        {GRADE_OPTIONS.map(grade => (
                            <option key={grade} value={grade}>{grade}</option>
                        ))}
                    </select>
                    <input
                        type="number"
                        value={course.units}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCourseChange(course.id, 'units', parseInt(e.target.value) || 0)}
                        min="1"
                    />
                    <button onClick={() => removeCourse(course.id)} className={styles.removeCourseButton}>X</button>
                </div>
            ))}

            <button onClick={addCourse} className={styles.addCourseButton}>
                Add Another Course
            </button>

            <button
                onClick={handleCalculateGpa}
                disabled={loading || !courses.some(c => c.name.trim() && c.units > 0) || (!currentUser && guestUsageCount >= GUEST_GPA_LIMIT)}
                className={styles.calculateButton}
style={loading ? { color: 'black', opacity: 1 } : {}}
            >
                {loading ? 'Calculating...' : 'Calculate GPA'}
            </button>

            {error && <p className={styles.errorText}>{error}</p>}

            {gpaResult !== null && (
                <div className={styles.gpaResultOutput}>
                    <h3>Calculated Term GPA</h3>
                    <p>{gpaResult.toFixed(2)}</p>
                    <button onClick={handleReset} className={styles.resetButton}>Reset</button>
                </div>
            )}

            {!currentUser && (
                <p className={styles.guestMessage}>
                    {`You have used ${guestUsageCount} of ${GUEST_GPA_LIMIT} guest calculations.`}
                    Please <a href="/login">Login</a> or <a href="/signup">Sign Up</a> for unlimited access!
                </p>
            )}


        </div>
    );
};

export default GPACalculatorPage;
