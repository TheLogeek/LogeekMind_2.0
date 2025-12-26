'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Use useRouter from next/navigation
import AuthService from '../../services/AuthService'; // Adjust path
import axios, { AxiosError } from 'axios';
import styles from './StudySchedulerPage.module.css'; // Import the CSS Module

const API_BASE_URL = "http://127.0.0.1:8000";

interface Subject { // Define interface for Subject
    id: number;
    name: string;
    priority: number;
    time_hr: number;
}

interface ScheduleItem { // Define interface for ScheduleItem
    day: string;
    study_plan: string;
}

const StudySchedulerPage = () => {
    const router = useRouter();
    const [subjects, setSubjects] = useState<Subject[]>([ // Use Subject interface
        { id: 1, name: 'Math', priority: 3, time_hr: 2.0 },
        { id: 2, name: 'English', priority: 2, time_hr: 1.5 },
    ]);
    const [schedule, setSchedule] = useState<ScheduleItem[] | null>(null); // Use ScheduleItem interface
    const [totalTimeAllocated, setTotalTimeAllocated] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Guard localStorage access for client-side only
    const [currentUser, setCurrentUser] = useState(
        typeof window !== 'undefined' ? AuthService.getCurrentUser() : null
    );

    // Guest usage tracking
    const GUEST_SCHEDULE_LIMIT = 2; // Example limit for guest users
    const GUEST_USAGE_KEY = 'study_scheduler_guest_usage';
    const [guestUsageCount, setGuestUsageCount] = useState(() => {
        return typeof window !== 'undefined' ? parseInt(localStorage.getItem(GUEST_USAGE_KEY) || '0', 10) : 0;
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(GUEST_USAGE_KEY, guestUsageCount.toString());
        }
    }, [guestUsageCount]);

    useEffect(() => {
        if (!currentUser && guestUsageCount >= GUEST_SCHEDULE_LIMIT) {
            setError(`You have reached the guest limit of ${GUEST_SCHEDULE_LIMIT} schedules. Please login or sign up for unlimited access.`);
        } else {
            setError(''); // Clear error if limit is no longer an issue
        }
    }, [currentUser, guestUsageCount]);


    const checkGuestLimit = () => {
        if (currentUser) return true; // Logged in users have no guest limit

        if (guestUsageCount >= GUEST_SCHEDULE_LIMIT) {
            setError(`You have reached the guest limit of ${GUEST_SCHEDULE_LIMIT} schedules. Please login or sign up for unlimited access.`);
            return false;
        }
        return true;
    };

    const incrementGuestUsage = () => {
        if (!currentUser && typeof window !== 'undefined') {
            setGuestUsageCount(prev => prev + 1);
        }
    };

    const handleSubjectChange = (id: number, field: keyof Subject, value: string | number) => { // Added type
        setSubjects(prevSubjects =>
            prevSubjects.map(subject =>
                subject.id === id ? { ...subject, [field]: value } : subject
            )
        );
    };

    const addSubject = () => {
        setSubjects(prevSubjects => [
            ...prevSubjects,
            { id: prevSubjects.length ? Math.max(...prevSubjects.map(c => c.id)) + 1 : 1, name: '', priority: 1, time_hr: 1.0 }
        ]);
    };

    const removeSubject = (id: number) => { // Added type
        setSubjects(prevSubjects => prevSubjects.filter(subject => subject.id !== id));
    };

    const handleGenerateSchedule = async () => {
        setError('');
        setSchedule(null);
        setTotalTimeAllocated(0);

        if (!checkGuestLimit()) {
            return;
        }

        const validSubjects = subjects.filter(s => s.name.trim() !== '' && s.time_hr > 0);
        if (validSubjects.length === 0) {
            setError('Please add at least one valid subject to generate a study schedule.');
            return;
        }

        setLoading(true);
        try {
            const accessToken = AuthService.getAccessToken();
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

            const requestData = {
                subjects: validSubjects.map(({ id, ...rest }) => rest) // Remove temporary id for backend
            };

            const response = await axios.post(`${API_BASE_URL}/study-scheduler/generate`, requestData, { headers });

            if (response.data.success && response.data.schedule) {
                setSchedule(response.data.schedule);
                setTotalTimeAllocated(response.data.total_time_allocated_hr);
                incrementGuestUsage(); // Only increment on successful generation for guests
            } else {
                setError(response.data.message || 'Failed to generate study schedule.');
            }
        } catch (err: unknown) { // Explicitly type err as unknown
            if (axios.isAxiosError(err)) {
                console.error('Study schedule generation error:', err.response?.data || err);
                if (err.response && err.response.status === 401) {
                    setError('Unauthorized. Please log in.');
                    AuthService.logout();
                    router.push('/login');
                } else {
                    setError(err.response?.data?.detail || 'An error occurred during schedule generation.');
                }
            } else {
                console.error('Study schedule generation error:', err);
                setError('An unexpected error occurred during schedule generation.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleNewSchedule = () => {
        setSubjects([
            { id: 1, name: 'Math', priority: 3, time_hr: 2.0 },
            { id: 2, name: 'English', priority: 2, time_hr: 1.5 },
        ]);
        setSchedule(null);
        setTotalTimeAllocated(0);
        setError('');
        // Guest usage count is NOT reset here
    };

    const handleResetGuestUsage = () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(GUEST_USAGE_KEY);
            setGuestUsageCount(0);
            setError('');
        }
    };

    return (
        <div className={`page-container ${styles.studySchedulerPageContainer}`}>
            <h2>📅 Study Scheduler</h2>
            <p>Create a structured daily or weekly study plan by listing your subjects and estimated time needs.</p>

            <h3 className={styles.subjectInputSectionH3}>📚 Subject Input</h3>
            <div className={styles.subjectInputGridHeader}>
                <div>Subject Name</div>
                <div>Priority (1-5)</div>
                <div>Time/Week (Hours)</div>
                <div></div>
            </div>

            {subjects.map(subject => (
                <div key={subject.id} className={styles.subjectInputRow}>
                    <input
                        type="text"
                        value={subject.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSubjectChange(subject.id, 'name', e.target.value)}
                        placeholder="Subject Name"
                        className={styles.formInput}
                    />
                    <input
                        type="number"
                        value={subject.priority}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSubjectChange(subject.id, 'priority', parseInt(e.target.value) || 1)}
                        min="1" max="5" step="1"
                        className={styles.formInput}
                    />
                    <input
                        type="number"
                        value={subject.time_hr}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSubjectChange(subject.id, 'time_hr', parseFloat(e.target.value) || 0.5)}
                        min="0.5" step="0.5"
                        className={styles.formInput}
                    />
                    <button type="button" onClick={() => removeSubject(subject.id)} className={styles.removeSubjectButton}>X</button>
                </div>
            ))}

            <button type="button" onClick={addSubject} className={styles.addSubjectButton}>
                ➕ Add Another Course
            </button>

            <button
                type="button"
                onClick={handleGenerateSchedule}
                disabled={loading || !subjects.some(s => s.name.trim() !== '') || (!currentUser && guestUsageCount >= GUEST_SCHEDULE_LIMIT)}
                className={styles.generateButton}
            >
                {loading ? 'Generating Schedule...' : 'Generate Study Schedule'}
            </button>

            {error && <p className={styles.errorText}>{error}</p>}

            {schedule && (
                <div className={styles.scheduleOutput}>
                    <h3>📅 Your Weekly Study Plan</h3>
                    <p>Total Weekly Study Time Allocated: {totalTimeAllocated} Hours</p>
                    
                    <div className={styles.scheduleGridHeader}>
                        <div>Day</div>
                        <div>Study Plan</div>
                    </div>
                    {schedule.map((item, index) => (
                        <div key={index} className={styles.scheduleItem}>
                            <div className={styles.scheduleItemDay}>{item.day}</div>
                            <div>{item.study_plan}</div>
                        </div>
                    ))}
                    <button type="button" onClick={handleNewSchedule} className={styles.newScheduleButton}>Generate New Schedule</button>
                </div>
            )}

            {!currentUser && (
                <p className={styles.guestMessage}>
                    {`You have used ${guestUsageCount} of ${GUEST_SCHEDULE_LIMIT} guest schedules.`}
                    Please <a onClick={() => router.push('/login')}>Login</a> or <a onClick={() => router.push('/signup')}>Sign Up</a> for unlimited access!
                </p>
            )}

            {/* Debugging Button for Guests */}
            {!currentUser && guestUsageCount > 0 && (
                <button type="button" onClick={handleResetGuestUsage} className="debug-button">
                    Reset Guest Usage (DEBUG)
                </button>
            )}
        </div>
    );
};

export default StudySchedulerPage;
