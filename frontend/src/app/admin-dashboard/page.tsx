'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Use useRouter from next/navigation
import AuthService from '../../services/AuthService';
import axios, { AxiosError } from 'axios';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

import styles from './AdminDashboardPage.module.css'; // Import the CSS Module
// import '../styles/global.css'; // Global styles are handled by root layout, no longer needed here

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend);

interface FeatureUsageItem {
    feature_name: string;
    usage_count: number;
}

interface DailyActivityItem {
    date: string;
    count: number;
}

interface TopUserItem {
    username: string;
    usage_count: number;
}

interface UsageLogItem {
    id?: string; // Assuming an ID for logs, optional as it might not always be present from backend
    created_at: string;
    username: string;
    feature_name: string;
    action: string;
    metadata: any; // Can be more specific if structure is known
}

const API_BASE_URL = "http://127.0.0.1:8000";
const ADMIN_REFRESH_INTERVAL = 60000; // 60 seconds

const AdminDashboardPage = () => {
    const router = useRouter(); // Initialize useRouter
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [metrics, setMetrics] = useState<any>(null);
    const [featureUsage, setFeatureUsage] = useState<FeatureUsageItem[]>([]);
    const [dailyActivity, setDailyActivity] = useState<DailyActivityItem[]>([]);
    const [topUsers, setTopUsers] = useState<TopUserItem[]>([]);
    const [allUsageLogs, setAllUsageLogs] = useState<UsageLogItem[]>([]);
    const [searchUser, setSearchUser] = useState('');
    const [searchFeature, setSearchFeature] = useState('');

    const fetchAdminData = async () => {
        setError('');
        try {
            const accessToken = AuthService.getAccessToken();
            if (!accessToken) {
                setError('Authentication required.');
                AuthService.logout();
                router.push('/login'); // Use router.push
                return;
            }

            const headers = { Authorization: `Bearer ${accessToken}` };

            const [metricsRes, featureRes, dailyRes, topUsersRes, allUsageRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/admin/metrics`, { headers }),
                axios.get(`${API_BASE_URL}/admin/feature-usage`, { headers }),
                axios.get(`${API_BASE_URL}/admin/daily-activity`, { headers }),
                axios.get(`${API_BASE_URL}/admin/top-users`, { headers }),
                axios.get(`${API_BASE_URL}/admin/all-usage-logs`, { headers }),
            ]);

            setMetrics(metricsRes.data);
            setFeatureUsage(featureRes.data);
            setDailyActivity(dailyRes.data);
            setTopUsers(topUsersRes.data);
            setAllUsageLogs(allUsageRes.data);

        } catch (err: unknown) { // Explicitly type err as unknown
            if (axios.isAxiosError(err)) { // Use type guard for AxiosError
                console.error('Error fetching admin data:', err.response?.data || err);
                if (err.response && err.response.status === 401) {
                    setError('Unauthorized. Please log in.');
                    AuthService.logout();
                    router.push('/login');
                } else if (err.response && err.response.status === 403) {
                    setError('Access Denied. You do not have administrator privileges.');
                }
                else {
                    setError(err.response?.data?.detail || 'An error occurred while fetching admin data.');
                }
            } else {
                console.error('Error fetching admin data:', err);
                setError('An unexpected error occurred while fetching admin data.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAdminData();
        const interval = setInterval(fetchAdminData, ADMIN_REFRESH_INTERVAL);
        return () => clearInterval(interval); // Cleanup interval on component unmount
    }, [router]); // Added router to dependency array for useEffect to avoid linting warnings

    if (loading) {
        return <p className={`${styles.loadingMessage}`}>Loading Admin Dashboard...</p>;
    }

    if (error) {
        return <p className={`${styles.loadingMessage} ${styles.errorMessage}`}>Error: {error}</p>;
    }
    
    // --- Chart Data Preparation ---
    const featureUsageLabels = featureUsage.map(item => item.feature_name);
    const featureUsageData = featureUsage.map(item => item.usage_count);

    const featureBarChartData = {
        labels: featureUsageLabels,
        datasets: [{
            label: 'Feature Usage Count',
            data: featureUsageData,
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1,
        }]
    };

    const featurePieChartData = {
        labels: featureUsageLabels,
        datasets: [{
            data: featureUsageData,
            backgroundColor: featureUsageLabels.map((_, i) => `hsl(${i * 60}, 70%, 50%)`),
            hoverOffset: 4
        }]
    };

    const dailyActivityLabels = dailyActivity.map(item => item.date);
    const dailyActivityCounts = dailyActivity.map(item => item.count);

    const dailyActivityLineChartData = {
        labels: dailyActivityLabels,
        datasets: [{
            label: 'Daily User Activity',
            data: dailyActivityCounts,
            fill: false,
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
        }]
    };

    // --- Filtered Usage Logs ---
    const filteredUsageLogs = allUsageLogs.filter(log => {
        const userMatch = log.username.toLowerCase().includes(searchUser.toLowerCase());
        const featureMatch = log.feature_name.toLowerCase().includes(searchFeature.toLowerCase());
        return userMatch && featureMatch;
    });

    return (
        <div className={`page-container ${styles.adminDashboardPageContainer}`}> {/* Apply page-container and component styles */}
            <h2>🛡️ LogeekMind Admin Dashboard</h2>
            <p>Overview of user activity and application usage.</p>

            {metrics && (
                <div className={styles.metricsGrid}>
                    <MetricCard label="Total Users" value={metrics.total_users} />
                    <MetricCard label="Active Users (24h)" value={metrics.active_users_24h} />
                    <MetricCard label="Top User (by usage)" value={metrics.top_user_username} />
                </div>
            )}

            <div className={styles.chartGrid}>
                <div className={styles.chartContainer}>
                    <h3 className={styles.sectionTitle}>Feature Usage Bar Chart</h3>
                    <Bar data={featureBarChartData} />
                </div>
                <div className={styles.chartContainer}>
                    <h3 className={styles.sectionTitle}>Feature Usage Pie Chart</h3>
                    <Pie data={featurePieChartData} />
                </div>
            </div>

            <div className={styles.chartContainer}>
                <h3 className={styles.sectionTitle}>Daily Activity (Last 7 Days)</h3>
                <Line data={dailyActivityLineChartData} />
            </div>

            <div className={styles.usageLogsSection}>
                <h3 className={styles.sectionTitle}>Top 10 Users by Feature Usage</h3>
                {topUsers.length > 0 ? (
                    <div className={styles.topUsersTableWrapper}>
                        <table className={styles.topUsersTable}>
                            <thead>
                                <tr>
                                    <th className={styles.tableHeader}>Username</th>
                                    <th className={styles.tableHeader}>Usage Count</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topUsers.map((user, index) => (
                                    <tr key={index}>
                                        <td className={styles.tableCell}>{user.username}</td>
                                        <td className={styles.tableCell}>{user.usage_count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : <p>No top users data.</p>}
            </div>

            <div className={styles.usageLogsSection}>
                <h3 className={styles.sectionTitle}>All User Activity</h3>
                <div className={styles.searchInputs}>
                    <input
                        type="text"
                        placeholder="Search by Username"
                        value={searchUser}
                        onChange={(e) => setSearchUser(e.target.value)}
                    />
                    <input
                        type="text"
                        placeholder="Search by Feature Name"
                        value={searchFeature}
                        onChange={(e) => setSearchFeature(e.target.value)}
                    />
                </div>
                {filteredUsageLogs.length > 0 ? (
                    <div className={styles.usageLogsTableWrapper}>
                        <table className={styles.usageLogsTable}>
                            <thead>
                                <tr>
                                    <th className={styles.tableHeader}>Date</th>
                                    <th className={styles.tableHeader}>User</th>
                                    <th className={styles.tableHeader}>Feature</th>
                                    <th className={styles.tableHeader}>Action</th>
                                    <th className={styles.tableHeader}>Metadata</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsageLogs.map((log, index) => (
                                    <tr key={log.id || index}>
                                        <td className={styles.tableCell}>{new Date(log.created_at).toLocaleString()}</td>
                                        <td className={styles.tableCell}>{log.username}</td>
                                        <td className={styles.tableCell}>{log.feature_name}</td>
                                        <td className={styles.tableCell}>{log.action}</td>
                                        <td className={styles.tableCell}>{JSON.stringify(log.metadata)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : <p>No usage logs found.</p>}
            </div>

            <p className={styles.lastRefreshed}>Last refreshed: {new Date().toLocaleString()}</p>
        </div>
    );
};

const MetricCard = ({ label, value }: { label: string; value: string | number | undefined }) => (
    <div className={styles.metricCard}>
        <p>{label}</p>
        <h4>{value}</h4>
    </div>
);

export default AdminDashboardPage;
