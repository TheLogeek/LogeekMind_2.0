'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthService from '../../services/AuthService';
import axios, { AxiosError } from 'axios';
import { Bar, Line } from 'react-chartjs-2';
import styles from './DashboardPage.module.css';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const UserDashboardPage = () => {
    const router = useRouter();
    const [performanceData, setPerformanceData] = useState<any[]>([]);
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
            try {
                const accessToken = AuthService.getAccessToken();
                const response = await axios.get(`${API_BASE_URL}/user-dashboard/performance`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                setPerformanceData(response.data || []);
            } catch (err: unknown) {
                if (axios.isAxiosError(err) && err.response?.status === 401) {
                    router.push('/login');
                } else {
                    setError('Failed to fetch performance data.');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [router]);

    if (loading) {
        return <p className={styles.loadingMessage}>Loading your dashboard...</p>;
    }

    if (error) {
        return <p className={`${styles.loadingMessage} ${styles.errorMessage}`}>{error}</p>;
    }

    if (performanceData.length === 0) {
        return <p className={styles.loadingMessage}>No performance data available yet. Take a quiz or simulate an exam to see your progress!</p>;
    }

    // --- Data Processing for Charts and Metrics ---
    const df = performanceData.map(d => ({
        ...d,
        percentage: (d.score / d.total_questions) * 100,
        created_at: new Date(d.created_at),
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
    const featureGroups = df.reduce((acc, d) => {
        acc[d.feature_name] = acc[d.feature_name] || [];
        acc[d.feature_name].push(d.percentage);
        return acc;
    }, {});

    const barChartData = {
        labels: Object.keys(featureGroups),
        datasets: [
            {
                label: 'Average Score by Feature (%)',
                data: Object.values(featureGroups).map((scores: number[]) => scores.reduce((a, b) => a + b, 0) / scores.length),
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
            },
        ],
    };

    // Recent Attempts Table
    const recentAttempts = df.sort((a, b) => b.created_at.getTime() - a.created_at.getTime()).slice(0, 10);

    return (
        <div className={`page-container ${styles.dashboardPageContainer}`}>
            <h2>📊 Your Performance Dashboard</h2>

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
                    <h3>📊 Average by Feature</h3>
                    <Bar data={barChartData} />
                </div>
            </div>

            <div className={styles.tableContainer}>
                <h3>📝 Recent Attempts</h3>
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
                                <td>{attempt.feature_name}</td>
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
