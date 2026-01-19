'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthService from '../../services/AuthService';
import axios, { AxiosError } from 'axios';
import { Bar, Line } from 'react-chartjs-2';
import styles from './DashboardPage.module.css';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

// Register Chart.js components (ensure these are registered once globally if not already)
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend);


const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

// Define TypeScript interfaces matching the backend Pydantic models
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

const UserDashboardPage = () => {
    const router = useRouter();
    const [performanceData, setPerformanceData] = useState<PerformanceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const user = AuthService.getCurrentUser();
        if (!user) {
            router.push('/login');
            return;
        }
        setCurrentUser(user);

        const fetchData = async () => {
            setError(''); // Clear previous errors
            setLoading(true); // Set loading true at the start of fetch
            try {
                const accessToken = AuthService.getAccessToken();
                if (!accessToken) { // Extra check in case token is somehow lost
                    setError('Authentication required. Please log in.');
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
                        setError(response.data.message); // Display message if no data but message present
                    }
                } else {
                    setError(response.data.message || 'Failed to fetch performance data from the server.');
                }
            } catch (err: unknown) {
                if (axios.isAxiosError(err)) {
                    const axiosError = err as AxiosError<any>;
                    console.error('Error fetching performance data:', axiosError.response?.data || axiosError);
                    if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
                        setError('Unauthorized access. Please log in with appropriate credentials.');
                        AuthService.logout();
                        router.push('/login');
                    } else {
                        setError(axiosError.response?.data?.detail || axiosError.response?.data?.message || 'An error occurred while fetching performance data.');
                    }
                } else {
                    console.error('Error fetching performance data:', err);
                    setError('An unexpected error occurred.');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [router]); // Rerun effect if router changes (e.g., path changes for some reason)

    if (loading) {
        return <p className={styles.loadingMessage}>Loading your dashboard...</p>;
    }

    if (error) {
        return <p className={`${styles.loadingMessage} ${styles.errorMessage}`}>Error: {error}</p>;
    }

    if (performanceData.length === 0) {
        return <p className={styles.loadingMessage}>No performance data available yet. Take a quiz or simulate an exam to see your progress!</p>;
    }

    // --- Data Processing for Charts and Metrics ---
    // Ensure created_at is converted to Date object for frontend plotting
    const df = performanceData.map(d => ({
        ...d,
        created_at: new Date(d.created_at), // Convert ISO string back to Date object
    }));

    // KPI Metrics
    const totalAttempts = df.length;
    const averageScore = df.reduce((acc, d) => acc + d.percentage, 0) / totalAttempts;
    const bestScore = Math.max(...df.map(d => d.percentage));

    // Performance Over Time (Line Chart)
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
    
    // Average Performance by Feature (Bar Chart)
    const featureGroups: { [key: string]: number[] } = df.reduce((acc: { [key: string]: number[] }, d) => {
        acc[d.feature] = acc[d.feature] || []; // Use d.feature, not d.feature_name
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

    // Recent Attempts Table
    const recentAttempts = df.sort((a, b) => b.created_at.getTime() - a.created_at.getTime()).slice(0, 10);

    return (
        <div className={`page-container ${styles.dashboardPageContainer}`}>
            <h2>Your Performance Dashboard</h2>

            <div className={styles.metricsGrid}>
                <div className={styles.metricCard}><h4>Total Attempts</h4><p>{totalAttempts}</p></div>
                <div className={styles.metricCard}><h4>Average Score</h4><p>{averageScore.toFixed(2)}%</p></div>
                <div className={styles.metricCard}><h4>Best Score</h4><p>{bestScore.toFixed(2)}%</p></div>
            </div>

            <div className={styles.chartGrid}>
                <div className={styles.chartContainer}>
                    <h3>📈 Performance Over Time</h3>
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

export default UserDashboardPage;
