'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthService from '../../services/AuthService';
import axios, { AxiosError } from 'axios';
import styles from './MyProfilePage.module.css';

// Chart.js imports and registration
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend);

interface UserProfile {
    id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    institution_name: string | null;
    faculty: string | null;
    department: string | null;
    level_class: string | null;
    study_schedule?: StudySchedule;
    // Add other profile fields if they exist and are relevant to display
}

interface StudySchedule {
    schedule: { day: string; study_plan: string }[];
    totalTimeAllocated: number;
}

// Interfaces for Performance Dashboard (copied from DashboardPage.tsx)
interface PerformanceItem {
    feature: string;
    score: number;
    total_questions: number;
    correct_answers: number;
    created_at: string; // ISO string from backend
    percentage: number;
}

interface UserPerformanceResponse {
    success: boolean;
    message?: string;
    data: PerformanceItem[];
}


const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const MyProfilePage = () => {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true); // Renamed to avoid conflict
    const [savingProfile, setSavingProfile] = useState(false); // Renamed to avoid conflict
    const [profileError, setProfileError] = useState(''); // Renamed to avoid conflict
    const [successMessage, setSuccessMessage] = useState('');

    // Form state for profile
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [institutionName, setInstitutionName] = useState('');
    const [faculty, setFaculty] = useState('');
    const [department, setDepartment] = useState('');
    const [levelClass, setLevelClass] = useState('');

    // State for Dashboard content
    const [showDashboard, setShowDashboard] = useState(false);
    const [performanceData, setPerformanceData] = useState<PerformanceItem[]>([]);
    const [loadingDashboard, setLoadingDashboard] = useState(false); // Only loads when button clicked
    const [dashboardError, setDashboardError] = useState('');

    const [studySchedule, setStudySchedule] = useState<StudySchedule | null>(null);
    const [showStudySchedule, setShowStudySchedule] = useState(false);

    // --- Profile Fetching Effect ---
    useEffect(() => {
        const fetchUserAndProfile = async () => {
            const currentUser = await AuthService.getCurrentUser();
            if (!currentUser) {
                router.push('/login'); // Redirect to login if not authenticated
                return;
            }
            setUser(currentUser);

            try {
                const data = await AuthService.getUserProfile();
                setProfile(data);
                // Initialize form fields with fetched data
                setFirstName(data.first_name || '');
                setLastName(data.last_name || '');
                setInstitutionName(data.institution_name || '');
                setFaculty(data.faculty || '');
                setDepartment(data.department || '');
                setLevelClass(data.level_class || '');
                if (data.study_schedule) {
                    setStudySchedule(data.study_schedule);
                }

            } catch (err: any) {
                console.error("Error fetching profile:", err.message);
                setProfileError('Failed to load profile data.');
            } finally {
                setLoadingProfile(false);
            }
        };

        fetchUserAndProfile();
    }, [router]);

    // --- Performance Data Fetching Effect (triggered by showDashboard) ---
    useEffect(() => {
        if (showDashboard && user && performanceData.length === 0 && !loadingDashboard && !dashboardError) {
            const fetchData = async () => {
                setDashboardError('');
                setLoadingDashboard(true);
                try {
                    const accessToken = AuthService.getAccessToken();
                    if (!accessToken) {
                        setDashboardError('Authentication required. Please log in.');
                        AuthService.logout();
                        router.push('/login');
                        return;
                    }
                    const response = await axios.get<UserPerformanceResponse>(`${API_BASE_URL}/user-dashboard/performance`, {
                        headers: { Authorization: `Bearer ${accessToken}` },
                    });

                    if (response.data.success) {
                        setPerformanceData(response.data.data || []);
                        if (response.data.data.length === 0 && response.data.message) {
                            setDashboardError(response.data.message);
                        }
                    } else {
                        setDashboardError(response.data.message || 'Failed to fetch performance data from the server.');
                    }
                } catch (err: unknown) {
                    if (axios.isAxiosError(err)) {
                        const axiosError = err as AxiosError<any>;
                        console.error('Error fetching performance data:', axiosError.response?.data || axiosError);
                        if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
                            setDashboardError('Unauthorized access. Please log in with appropriate credentials.');
                            AuthService.logout();
                            router.push('/login');
                        } else {
                            setDashboardError(axiosError.response?.data?.detail || axiosError.response?.data?.message || 'An error occurred while fetching performance data.');
                        }
                    } else {
                        console.error('Error fetching performance data:', err);
                        setDashboardError('An unexpected error occurred.');
                    }
                } finally {
                    setLoadingDashboard(false);
                }
            };
            fetchData();
        }
    }, [showDashboard, user, performanceData.length, loadingDashboard, dashboardError, router]);


    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingProfile(true);
        setProfileError('');
        setSuccessMessage('');

        if (!user) {
            setProfileError('User not authenticated.');
            setSavingProfile(false);
            return;
        }

        try {
            const updatedProfile = {
                first_name: firstName || null,
                last_name: lastName || null,
                institution_name: institutionName || null,
                faculty: faculty || null,
                department: department || null,
                level_class: levelClass || null,
            };
            await AuthService.updateUserProfile(updatedProfile);

            setSuccessMessage('Profile updated successfully!');
            // Update local profile state
            setProfile(prev => ({
                ...prev!,
                ...updatedProfile,
            }));

        } catch (err: any) {
            console.error("Error saving profile:", err.message);
            setProfileError('Failed to save profile changes.');
        } finally {
            setSavingProfile(false);
        }
    };

    // --- Render Logic for Profile Page ---
    if (loadingProfile) {
        return (
            <div className={`${styles.myProfilePageContainer} ${styles.loadingState}`}>
                <p>Loading profile...</p>
            </div>
        );
    }

    if (profileError && !profile) {
        return (
            <div className={`${styles.myProfilePageContainer} ${styles.errorState}`}>
                <p className={styles.errorText}>{profileError}</p>
            </div>
        );
    }

    const renderStudySchedule = () => {
        if (!studySchedule) {
            return <p>No study schedule found.</p>;
        }

        return (
            <div className={styles.scheduleOutput}>
                <h3>Your Weekly Study Plan</h3>
                <p>Total Weekly Study Time Allocated: {studySchedule.totalTimeAllocated} Hours</p>
                
                <div className={styles.scheduleGridHeader}>
                    <div>Day</div>
                    <div>Study Plan</div>
                </div>
                {studySchedule.schedule.map((item, index) => (
                    <div key={index} className={styles.scheduleItem}>
                        <div className={styles.scheduleItemDay}>{item.day}</div>
                        <div>{item.study_plan}</div>
                    </div>
                ))}
            </div>
        );
    }

    // --- Dashboard Content Processing (copied from DashboardPage.tsx) ---
    const renderDashboardContent = () => {
        if (loadingDashboard) {
            return <p className={styles.loadingMessage}>Loading your dashboard...</p>;
        }

        if (dashboardError) {
            return <p className={`${styles.loadingMessage} ${styles.errorMessage}`}>Error: {dashboardError}</p>;
        }

        if (performanceData.length === 0) {
            return <p className={styles.loadingMessage}>No performance data available yet. Take a quiz or simulate an exam to see your progress!</p>;
        }

        const df = performanceData.map(d => ({
            ...d,
            created_at: new Date(d.created_at),
        }));

        const totalAttempts = df.length;
        const averageScore = df.reduce((acc, d) => acc + d.percentage, 0) / totalAttempts;
        const bestScore = Math.max(...df.map(d => d.percentage));

        const lineChartData = {
            labels: df.map(d => d.created_at.toLocaleDateString()),
            datasets: [
                {
                    label: 'Performance Over Time (%)',
                    data: df.map(d => d.percentage),
                    fill: false,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                },
            ],
        };
        
        const featureGroups: { [key: string]: number[] } = df.reduce((acc: { [key: string]: number[] }, d) => {
            acc[d.feature] = acc[d.feature] || [];
            acc[d.feature].push(d.percentage);
            return acc;
        }, {});

        const barChartData = {
            labels: Object.keys(featureGroups),
            datasets: [
                {
                    label: 'Average Score by Feature (%)',
                    data: Object.values(featureGroups).map((scores: number[]): number => scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0),
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                },
            ],
        };

        const recentAttempts = df.sort((a, b) => b.created_at.getTime() - a.created_at.getTime()).slice(0, 10);

        return (
            <div className={styles.dashboardContent}> {/* New class for dashboard specific styling within profile page */}
                <div className={styles.metricsGrid}>
                    <div className={styles.metricCard}><h4>Total Attempts</h4><p>{totalAttempts}</p></div>
                    <div className={styles.metricCard}><h4>Average Score</h4><p>{averageScore.toFixed(2)}%</p></div>
                    <div className={styles.metricCard}><h4>Best Score</h4><p>{bestScore.toFixed(2)}%</p></div>
                </div>

                <div className={styles.chartGrid}>
                    <div className={styles.chartContainer}>
                        <h3>Performance Over Time</h3>
                        <Line data={lineChartData} />
                    </div>
                    <div className={styles.chartContainer}>
                        <h3>Average by Feature</h3>
                        <Bar data={barChartData} />
                    </div>
                </div>

                <div className={styles.tableContainer}>
                    <h3>Recent Attempts</h3>
                    <table className={styles.attemptsTable}>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Feature</th>
                                <th>Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentAttempts.map((attempt, index) => (
                                <tr key={index}>
                                    <td>{attempt.created_at.toLocaleString()}</td>
                                    <td>{attempt.feature}</td>
                                    <td>{attempt.score} / {attempt.total_questions} ({attempt.percentage.toFixed(0)}%)</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className={styles.myProfilePageContainer}>
            <h1 className={styles.pageTitle}>My Profile</h1>
            <p className={styles.subtitle}>Manage your personal and academic information.</p>

            {successMessage && <p className={styles.successMessage}>{successMessage}</p>}
            {profileError && <p className={styles.errorText}>{profileError}</p>}

            <form onSubmit={handleSaveProfile} className={styles.profileForm}>
                <div className={styles.formSection}>
                    <h2 className={styles.sectionTitle}>Personal Information</h2>
                    <div className={styles.formGroup}>
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            type="text"
                            value={profile?.username || ''}
                            disabled
                            className={styles.disabledInput}
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="first_name">First Name</label>
                        <input
                            id="first_name"
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="Your First Name"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="last_name">Last Name</label>
                        <input
                            id="last_name"
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Your Last Name"
                        />
                    </div>
                </div>

                <div className={styles.formSection}>
                    <h2 className={styles.sectionTitle}>Academic Information (Optional)</h2>
                    <div className={styles.formGroup}>
                        <label htmlFor="institution_name">Institution Name</label>
                        <input
                            id="institution_name"
                            type="text"
                            value={institutionName}
                            onChange={(e) => setInstitutionName(e.target.value)}
                            placeholder="e.g., University of XYZ"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="faculty">Faculty / College</label>
                        <input
                            id="faculty"
                            type="text"
                            value={faculty}
                            onChange={(e) => setFaculty(e.target.value)}
                            placeholder="e.g., Engineering"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="department">Department</label>
                        <input
                            id="department"
                            type="text"
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            placeholder="e.g., Computer Science"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="level_class">Level / Class</label>
                        <input
                            id="level_class"
                            type="text"
                            value={levelClass}
                            onChange={(e) => setLevelClass(e.target.value)}
                            placeholder="e.g., Year 3 / Freshman"
                        />
                    </div>
                </div>

                <button type="submit" disabled={savingProfile} className={styles.saveButton}>
                    {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
            </form>

            <div className={styles.dashboardSection}>
                <h2 className={styles.sectionTitle}>My Study Schedule</h2>
                <button 
                    onClick={() => setShowStudySchedule(!showStudySchedule)} 
                    className={styles.viewDashboardButton}
                >
                    {showStudySchedule ? 'Hide Study Schedule' : 'View Study Schedule'}
                </button>
                {showStudySchedule && renderStudySchedule()}
            </div>

            <div className={styles.dashboardSection}>
                <h2 className={styles.sectionTitle}>Performance Overview</h2>
                <button 
                    onClick={() => setShowDashboard(!showDashboard)} 
                    className={styles.viewDashboardButton}
                >
                    {showDashboard ? 'Hide Performance Dashboard' : 'View Performance Dashboard'}
                </button>
                {showDashboard && renderDashboardContent()}
            </div>
        </div>
    );
};

export default MyProfilePage;

