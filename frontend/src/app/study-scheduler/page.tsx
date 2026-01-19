'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Use useRouter from next/navigation
import AuthService from '../../services/AuthService'; // Adjust path
import axios, { AxiosError } from 'axios';
import styles from './StudySchedulerPage.module.css'; // Import the CSS Module

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

interface Subject {
    id: number;
    name: string;
    priority: number | string;
    time_hr: number | string;
}

interface ScheduleItem {
    day: string;
    study_plan: string;
}

const StudySchedulerPage = () => {
    const router = useRouter();
    const [subjects, setSubjects] = useState<Subject[]>([
        { id: 1, name: 'Math', priority: 3, time_hr: 2.0 },
        { id: 2, name: 'English', priority: 2, time_hr: 1.5 },
    ]);
    const [schedule, setSchedule] = useState<ScheduleItem[] | null>(null);
    const [totalTimeAllocated, setTotalTimeAllocated] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const [currentUser, setCurrentUser] = useState(
        () => typeof window !== 'undefined' ? AuthService.getCurrentUser() : null
    );

    const GUEST_SCHEDULE_LIMIT = 2;
    const GUEST_USAGE_KEY = 'study_scheduler_guest_usage';
    const [guestUsageCount, setGuestUsageCount] = useState(() => {
        return typeof window !== 'undefined' ? parseInt(localStorage.getItem(GUEST_USAGE_KEY) || '0', 10) : 0;
    });

    useEffect(() => {
        localStorage.setItem(GUEST_USAGE_KEY, guestUsageCount.toString());
        if (!currentUser && guestUsageCount >= GUEST_SCHEDULE_LIMIT) {
            setError(`You have reached the guest limit of ${GUEST_SCHEDULE_LIMIT} schedules. Please log in.`);
        } else {
            setError('');
        }
    }, [currentUser, guestUsageCount]);

    const handleSubjectChange = (id: number, field: keyof Subject, value: string | number) => {
        setSubjects(prevSubjects =>
            prevSubjects.map(subject =>
                subject.id === id ? { ...subject, [field]: value } : subject
            )
        );
    };

    const handleNumericInputBlur = (id: number, field: 'priority' | 'time_hr', value: string, defaultValue: number, isFloat = false) => {
        let numericValue = isFloat ? parseFloat(value) : parseInt(value, 10);
        if (isNaN(numericValue) || numericValue <= 0) { // Ensure value is positive
            numericValue = defaultValue;
        }
        handleSubjectChange(id, field, numericValue);
    };

    const addSubject = () => {
        setSubjects(prevSubjects => [
            ...prevSubjects,
            { id: prevSubjects.length ? Math.max(...prevSubjects.map(c => c.id)) + 1 : 1, name: '', priority: 1, time_hr: 1.0 }
        ]);
    };

    const removeSubject = (id: number) => {
        setSubjects(prevSubjects => prevSubjects.filter(subject => subject.id !== id));
    };

    const handleGenerateSchedule = async () => {
        setError('');
        setSchedule(null);
        setTotalTimeAllocated(0);

        const subjectsWithParsedNumbers = subjects.map(s => ({
            ...s,
            priority: typeof s.priority === 'string' ? parseInt(s.priority, 10) || 1 : s.priority,
            time_hr: typeof s.time_hr === 'string' ? parseFloat(s.time_hr) || 0.5 : s.time_hr,
        }));

        // Update state with parsed numbers for consistency before validation/API call
        setSubjects(subjectsWithParsedNumbers);

        const validSubjects = subjectsWithParsedNumbers.filter(s => s.name.trim() !== '' && (typeof s.time_hr === 'number' && s.time_hr > 0) && (typeof s.priority === 'number' && s.priority > 0));
        
        if (validSubjects.length === 0) {
            setError('Please add at least one valid subject with positive time and priority to generate a study schedule.');
            return;
        }
        
        if (!currentUser && guestUsageCount >= GUEST_SCHEDULE_LIMIT) {
            setError(`Guest limit of ${GUEST_SCHEDULE_LIMIT} schedules reached. Please log in.`);
            return;
        }

        setLoading(true);
        try {
            const accessToken = AuthService.getAccessToken();
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

            const requestData = {
                subjects: validSubjects.map(({ id, ...rest }) => rest)
            };

            const response = await axios.post(`${API_BASE_URL}/study-scheduler/generate`, requestData, { headers });

            if (response.data.success && response.data.schedule) {
                setSchedule(response.data.schedule);
                setTotalTimeAllocated(response.data.total_time_allocated_hr);
                if (!currentUser) {
                    setGuestUsageCount(prev => prev + 1);
                }
            } else {
                setError(response.data.message || 'Failed to generate study schedule.');
            }
        } catch (err: unknown) {
            const axiosError = err as AxiosError<any>;
            setError(axiosError.response?.data?.detail || 'An error occurred during schedule generation.');
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
    };

    return (
        <div className={`page-container ${styles.studySchedulerPageContainer}`}>
            <h2>Study Scheduler</h2>
            <p>Create a structured daily or weekly study plan by listing your subjects and estimated time needs.</p>

            <h3 className={styles.subjectInputSectionH3}>Subject Input</h3>
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
                        onChange={(e) => handleSubjectChange(subject.id, 'name', e.target.value)}
                        placeholder="Subject Name"
                        className={styles.formInput}
                    />
                    <input
                        type="text"
                        value={subject.priority}
                        onChange={(e) => handleSubjectChange(subject.id, 'priority', e.target.value.replace(/[^0-9]/g, ''))}
                        onBlur={(e) => handleNumericInputBlur(subject.id, 'priority', e.target.value, 1)}
                        min="1" max="5" // min/max are for validation, step for number type, but it's text type here
                        className={styles.formInput}
                    />
                    <input
                        type="text"
                        value={subject.time_hr}
                        onChange={(e) => handleSubjectChange(subject.id, 'time_hr', e.target.value.replace(/[^0-9.]/g, ''))}
                        onBlur={(e) => handleNumericInputBlur(subject.id, 'time_hr', e.target.value, 0.5, true)}
                        min="0.5" step="0.5" // min/step are for validation, but it's text type here
                        className={styles.formInput}
                    />
                    <button type="button" onClick={() => removeSubject(subject.id)} className={styles.removeSubjectButton}>X</button>
                </div>
            ))}

            <button type="button" onClick={addSubject} className={styles.addSubjectButton}>
                Add Another Course
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
                    <h3>Your Weekly Study Plan</h3>
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
        </div>
    );
};

export default StudySchedulerPage;

