'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation'; // Use useRouter from next/navigation
import AuthService from '../../services/AuthService'; // Adjust path
import axios, { AxiosError } from 'axios';
import MarkdownRenderer from '../../components/MarkdownRenderer'; // Adjust path relative to app/exam-simulator/page.tsx
import ApiKeyInput from '../../components/ApiKeyInput'; // Adjust path relative to app/exam-simulator/page.tsx
import styles from './ExamSimulatorPage.module.css';

interface ExamQuestion {
    question: string;
    options: string[];
    answer: string;
    explanation: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const ExamSimulatorPage = () => {
    const router = useRouter();
    const [examStage, setExamStage] = useState("setup");
    const [examData, setExamData] = useState<ExamQuestion[]>([]);
    const [userAnswers, setUserAnswers] = useState<{ [key: number]: string }>({});
    const [startTime, setStartTime] = useState<number | null>(null); // Explicitly define type
    const [durationMins, setDurationMins] = useState(10);
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const [examScore, setExamScore] = useState(0);
    const [grade, setGrade] = useState("");
    const [remark, setRemark] = useState("");

    const [courseName, setCourseName] = useState('');
    const [topic, setTopic] = useState('');
    const [numQuestions, setNumQuestions] = useState(20);
    const [userGeminiApiKey, setUserGeminiApiKey] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Guard localStorage access for client-side only
    const [currentUser, setCurrentUser] = useState(
        typeof window !== 'undefined' ? AuthService.getCurrentUser() : null
    );

    const GUEST_EXAM_LIMIT = 1;
    const GUEST_USAGE_KEY = 'exam_simulator_guest_usage';
    const [guestUsageCount, setGuestUsageCount] = useState(() => {
        return typeof window !== 'undefined' ? parseInt(localStorage.getItem(GUEST_USAGE_KEY) || '0', 10) : 0;
    });


    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedInputs = sessionStorage.getItem('exam_simulator_inputs');
            if (savedInputs) {
                const { courseName, topic, numQuestions, durationMins } = JSON.parse(savedInputs);
                setCourseName(courseName || '');
                setTopic(topic || '');
                setNumQuestions(numQuestions || 20);
                setDurationMins(durationMins || 10);
            }

            const savedResults = sessionStorage.getItem('exam_simulator_results');
            if (savedResults) {
                const { examData, userAnswers, examScore, grade, remark } = JSON.parse(savedResults);
                setExamData(examData || []);
                setUserAnswers(userAnswers || {});
                setExamScore(examScore || 0);
                setGrade(grade || '');
                setRemark(remark || '');
                setExamStage("finished");
            }
        }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(GUEST_USAGE_KEY, guestUsageCount.toString());
        }
    }, [guestUsageCount]);

    useEffect(() => {
        if (examStage === "active" && startTime !== null) {
            const totalDurationSeconds = durationMins * 60;
            const timerInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                const remaining = totalDurationSeconds - elapsed;

                if (remaining <= 0) {
                    clearInterval(timerInterval);
                    // Using a ref to stable handleSubmitExam across renders for useEffect dependency
                    // Or wrap handleSubmitExam in useCallback with its dependencies
                    if (submitExamRef.current) {
                        submitExamRef.current();
                    }
                } else {
                    setRemainingSeconds(remaining);
                }
            }, 1000);
            return () => clearInterval(timerInterval);
        }
    }, [examStage, startTime, durationMins]);

    const submitExamRef = useRef<(() => Promise<void>) | null>(null); // Create a ref for handleSubmitExam

    const handleSubmitExam = async () => {
        setError('');
        setLoading(true);
        try {
            const accessToken = AuthService.getAccessToken();
            if (!currentUser && !accessToken) { // Guests can finish but can't log results
                const score = examData.reduce((acc, q: ExamQuestion, idx) => acc + (userAnswers[idx] === q.answer ? 1 : 0), 0);
                const total = examData.length;
                const [finalGrade, finalRemark] = calculateGradeFrontend(score, total);
                setExamScore(score);
                setGrade(finalGrade);
                setRemark(finalRemark);
                setExamStage("finished");
                setLoading(false);
                return;
            }

            const response = await axios.post(`${API_BASE_URL}/exam-simulator/submit-results`, {
                exam_data: examData,
                user_answers: userAnswers,
                course_name: courseName,
                topic: topic || null,
            }, { headers: { Authorization: `Bearer ${accessToken}` } });

            if (response.data.success) {
                setExamScore(response.data.score);
                setGrade(response.data.grade);
                setRemark(response.data.remark);
                setExamStage("finished");
                // Save results to sessionStorage
                if (typeof window !== 'undefined') {
                    const results = { examData, userAnswers, examScore: response.data.score, grade: response.data.grade, remark: response.data.remark };
                    sessionStorage.setItem('exam_simulator_results', JSON.stringify(results));
                }
            } else {
                setError(response.data.message || 'Failed to submit exam results.');
            }
        } catch (err: unknown) { // Explicitly type err as unknown
            if (axios.isAxiosError(err)) {
                console.error('Exam submission error:', err.response?.data || err);
                setError(err.response?.data?.detail || 'An error occurred during exam submission.');
            } else {
                console.error('Exam submission error:', err);
                setError('An unexpected error occurred during exam submission.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (submitExamRef.current) { // Add null check
            submitExamRef.current = handleSubmitExam; // Update the ref whenever handleSubmitExam changes
        }
    }, [handleSubmitExam]);

    const checkGuestLimit = () => {
        if (currentUser) return true;
        if (guestUsageCount >= GUEST_EXAM_LIMIT) {
            setError(`Guest limit of ${GUEST_EXAM_LIMIT} exams exceeded. Please log in.`);
            return false;
        }
        return true;
    };

    const incrementGuestUsage = () => {
        if (!currentUser && typeof window !== 'undefined') {
            setGuestUsageCount(prev => prev + 1);
        }
    };

    const calculateGradeFrontend = (score: number, total: number) => { // Explicitly define types
        if (total === 0) return ["N/A", "No questions graded."];
        const percentage = (score / total) * 100;
        if (percentage >= 70) return ["A", "Excellent! Distinction level."];
        if (percentage >= 60) return ["B", "Very Good. Keep it up."];
        if (percentage >= 50) return ["C", "Credit. You passed, but barely."];
        if (percentage >= 45) return ["D", "Pass. You need to study more."];
        if (percentage >= 40) return ["E", "Weak Pass. Dangerous territory."];
        return ["F", "Fail. You are not ready for this exam."];
    };

    const handleGenerateExam = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        setExamData([]);
        setExamScore(0);
        setGrade("");
        setRemark("");
        setUserAnswers({});

        if (!courseName.trim()) {
            setError("Please enter a Course Name.");
            return;
        }
        if (!checkGuestLimit()) {
            return;
        }

        setLoading(true);
        try {
            const accessToken = AuthService.getAccessToken();
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

            const response = await axios.post(`${API_BASE_URL}/exam-simulator/generate`, {
                course_name: courseName,
                topic: topic || null,
                num_questions: numQuestions,
                duration_mins: durationMins,
                gemini_api_key: userGeminiApiKey || null,
            }, { headers });

            if (response.data.success && response.data.exam_data) {
                setExamData(response.data.exam_data);
                setStartTime(Date.now());
                setRemainingSeconds(durationMins * 60);
                setExamStage("active");
                incrementGuestUsage();
                // Save inputs to sessionStorage
                if (typeof window !== 'undefined') {
                    const inputs = { courseName, topic, numQuestions, durationMins };
                    sessionStorage.setItem('exam_simulator_inputs', JSON.stringify(inputs));
                }
            } else {
                setError(response.data.message || 'Failed to generate exam.');
            }
        } catch (err: unknown) { // Explicitly type err as unknown
            if (axios.isAxiosError(err)) {
                console.error('Exam generation error:', err.response?.data || err);
                if (err.response && err.response.status === 401) {
                    setError('Unauthorized. Please log in.');
                    AuthService.logout();
                    router.push('/login');
                } else {
                    setError(err.response?.data?.detail || 'An error occurred during exam generation.');
                }
            } else {
                console.error('Exam generation error:', err);
                setError('An unexpected error occurred during exam generation.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerChange = (questionIndex: number, selectedOption: string) => { // Explicitly define types
        setUserAnswers(prevAnswers => ({
            ...prevAnswers,
            [questionIndex]: selectedOption
        }));
    };

    const handleDownloadResultsDocx = async () => {
        setError('');
        if (!examData.length || examStage !== "finished" || !currentUser) {
            setError('Please log in to download exam results.');
            return;
        }

        setLoading(true);
        try {
            const accessToken = AuthService.getAccessToken();
            const headers = { Authorization: `Bearer ${accessToken}` };

            const formData = new FormData();
            formData.append('examDataJson', JSON.stringify(examData));
            formData.append('userAnswersJson', JSON.stringify(userAnswers));
            formData.append('score', examScore.toString()); // Convert to string
            formData.append('total_questions', examData.length.toString()); // Convert to string
            formData.append('grade', grade);
            formData.append('course_name', courseName);
            formData.append('topic', topic || '');

            const response = await axios.post(`${API_BASE_URL}/exam-simulator/download-results-docx`, formData, {
                headers,
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const fileName = `${courseName.replace(/\s/g, '_')}_Exam_Results.docx`;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err: unknown) { // Explicitly type err as unknown
            if (axios.isAxiosError(err)) {
                console.error('Download DOCX error:', err.response?.data || err);
                setError(err.response?.data?.detail || 'Failed to download DOCX.');
            } else {
                console.error('Download DOCX error:', err);
                setError('An unexpected error occurred while downloading DOCX.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleTakeAnotherExam = () => {
        setError('');
        setExamStage("setup");
        setExamData([]);
        setUserAnswers({});
        setStartTime(null);
        setExamScore(0);
        setGrade("");
        setRemark("");
        setCourseName("");
        setTopic("");
        setNumQuestions(20);
        setDurationMins(10);
        // Clear sessionStorage
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem('exam_simulator_inputs');
            sessionStorage.removeItem('exam_simulator_results');
        }
    };

    const formatTime = (totalSeconds: number) => { // Explicitly define type
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleResetGuestUsage = () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(GUEST_USAGE_KEY);
            setGuestUsageCount(0);
            setError('');
        }
    };

    return (
        <div className={`page-container ${styles.examSimulatorPageContainer}`}>
            <h2>🔥 Exam Simulator</h2>
            <p>Prepare for your exams with customizable mock tests.</p>

            {error && <p className={styles.errorText}>{error}</p>}

            <ApiKeyInput
                userApiKey={userGeminiApiKey}
                setUserApiKey={setUserGeminiApiKey}
            />

            {examStage === "setup" && (
                <form onSubmit={handleGenerateExam} className={styles.examSetupForm}>
                    <div className={styles.examSetupGrid}>
                        <div className={styles.formGroup}>
                            <label htmlFor="courseName">Course Name:</label>
                            <input
                                type="text"
                                id="courseName"
                                value={courseName}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCourseName(e.target.value)}
                                placeholder="e.g., Introduction to Computer Science"
                                required
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="topic">Specific Topic (Optional):</label>
                            <input
                                type="text"
                                id="topic"
                                value={topic}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTopic(e.target.value)}
                                placeholder="e.g., Algorithms"
                            />
                        </div>
                    </div>
                    <div className={styles.examSetupGrid}>
                        <div className={styles.formGroup}>
                            <label htmlFor="duration">Exam Duration:</label>
                            <select
                                id="duration"
                                value={durationMins}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDurationMins(parseInt(e.target.value))}
                            >
                                {[1, 5, 10, 30, 60].map(d => <option key={d} value={d}>{d} Minutes</option>)}
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="numQuestions">Number of Questions:</label>
                            <input
                                type="range"
                                id="numQuestions"
                                min="5"
                                max="50"
                                value={numQuestions}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNumQuestions(parseInt(e.target.value))}
                            />
                            <span>{numQuestions} Questions</span>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !courseName.trim() || (!currentUser && guestUsageCount >= GUEST_EXAM_LIMIT)}
                        className={styles.startButton}
                    >
                        {loading ? 'Preparing Exam...' : 'Start Exam ⏱️'}
                    </button>
                    {!currentUser && (
                        <div className={styles.guestMessage}>
                            <p>
                                {`You have used ${guestUsageCount} of ${GUEST_EXAM_LIMIT} guest exams.`}
                                Please <a href="/login">Login</a> or <a href="/signup">Sign Up</a> for unlimited access.
                            </p>
                        </div>
                    )}
                </form>
            )}

            {examStage === "active" && (
                <div className={styles.activeExamContainer}>
                    <div className={`${styles.timerDisplay} ${remainingSeconds < 120 ? styles.warning : ''}`}>
                        <b>Time Left: {formatTime(remainingSeconds)}</b>
                    </div>
                    <h3 className={styles.questionProgress}>Questions ({Object.keys(userAnswers).filter(k => userAnswers[parseInt(k, 10)]).length}/{examData.length} Answered)</h3>
                    {examData.map((q: ExamQuestion, qIndex) => (
                        <div key={qIndex} className={styles.questionItem}>
                            <p>{qIndex + 1}. <MarkdownRenderer content={q.question} /></p>
                            {q.options.map((option, oIndex) => (
                                <div key={oIndex} className={styles.optionItem}>
                                    <label>
                                        <input
                                            type="radio"
                                            name={`question-${qIndex}`}
                                            value={option}
                                            checked={userAnswers[qIndex] === option}
                                            onChange={() => handleAnswerChange(qIndex, option)}
                                        />
                                        <MarkdownRenderer content={option} inline={true} />
                                    </label>
                                </div>
                            ))}
                        </div>
                    ))}
                    <button
                        onClick={handleSubmitExam}
                        disabled={loading}
                        className={styles.submitExamButton}
                    >
                        {loading ? 'Submitting...' : 'Submit Exam Now'}
                    </button>
                </div>
            )}

            {examStage === "finished" && (
                <div className={styles.examResultsContainer}>
                    <h3>Exam Results</h3>
                    <div className={`${styles.gradeSummary} ${grade === "A" || grade === "B" ? '' : styles.fail}`}>
                        <h2>Grade: {grade}</h2>
                        <h3>Score: {examScore} / {examData.length}</h3>
                        <p>{remark}</p>
                    </div>

                    <h4 className={styles.correctionsSection}>🔍 Answer Key & Explanations</h4>
                    {examData.map((q, qIndex) => {
                        const userChoice = userAnswers[qIndex];
                        const isCorrect = userChoice === q.answer;
                        return (
                            <div key={qIndex} className={`${styles.correctionItem} ${isCorrect ? styles.correct : styles.incorrect}`}>
                                <p>{qIndex + 1}. <MarkdownRenderer content={q.question} /></p>
                                <p>Your Answer: <span className={isCorrect ? styles.correctAnswer : styles.incorrectAnswer}><MarkdownRenderer content={userAnswers[qIndex] || '(No answer)'} inline={true} /></span></p>
                                {!isCorrect && (
                                    <p className={styles.correctAnswer}>Correct Answer: <MarkdownRenderer content={q.answer} inline={true} /></p>
                                )}
                                <p><strong>Explanation:</strong></p>
                                <MarkdownRenderer content={q.explanation} />
                            </div>
                        );
                    })}

                    <div className={styles.resultsActions}>
                        <button
                            onClick={handleDownloadResultsDocx}
                            className={styles.downloadButton}
                            disabled={!currentUser}
                            title={!currentUser ? "Login to download" : "Download Results as DOCX"}
                        >
                            Download Results as DOCX
                        </button>
                        <button onClick={handleTakeAnotherExam} className={styles.takeAnotherExamButton}>
                            Take Another Exam
                        </button>
                    </div>
                </div>
            )}

            {!currentUser && guestUsageCount > 0 && (
                <button onClick={handleResetGuestUsage} className="debug-button">
                    Reset Guest Usage (DEBUG)
                </button>
            )}
        </div>
    );
};

export default ExamSimulatorPage;
