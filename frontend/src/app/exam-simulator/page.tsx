'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AuthService from '../../services/AuthService';
import axios, { AxiosError } from 'axios';
import MarkdownRenderer from '../../components/MarkdownRenderer';
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
    const [startTime, setStartTime] = useState<number | null>(null);
    const [durationMins, setDurationMins] = useState(10);
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const [examScore, setExamScore] = useState(0);
    const [grade, setGrade] = useState("");
    const [remark, setRemark] = useState("");

    const [courseName, setCourseName] = useState('');
    const [topic, setTopic] = useState('');
    const [numQuestions, setNumQuestions] = useState(20);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [currentUser, setCurrentUser] = useState<any>(null);

    const GUEST_EXAM_LIMIT = 1;
    const GUEST_USAGE_KEY = 'exam_simulator_guest_usage';
    const [guestUsageCount, setGuestUsageCount] = useState(() => {
        return typeof window !== 'undefined' ? parseInt(localStorage.getItem(GUEST_USAGE_KEY) || '0', 10) : 0;
    });

    const handleSubmitExam = useCallback(async () => {
        setError('');
        setLoading(true);
        try {
            const accessToken = AuthService.getAccessToken();
            if (!currentUser || !accessToken) {
                const score = examData.reduce((acc, q, idx) => acc + (userAnswers[idx] === q.answer ? 1 : 0), 0);
                const [finalGrade, finalRemark] = calculateGradeFrontend(score, examData.length);
                setExamScore(score);
                setGrade(finalGrade);
                setRemark(finalRemark);
                setExamStage("finished");
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
                sessionStorage.setItem('exam_simulator_results', JSON.stringify({
                    examData, userAnswers, examScore: response.data.score, grade: response.data.grade, remark: response.data.remark
                }));
            } else {
                setError(response.data.message || 'Failed to submit exam results.');
            }
        } catch (err) {
            const axiosError = err as AxiosError<any>;
            setError(axiosError.response?.data?.detail || 'An error occurred during exam submission.');
        } finally {
            setLoading(false);
        }
    }, [currentUser, examData, userAnswers, courseName, topic]);

    useEffect(() => {
        setCurrentUser(AuthService.getCurrentUser());
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
    }, []);

    useEffect(() => {
        localStorage.setItem(GUEST_USAGE_KEY, guestUsageCount.toString());
    }, [guestUsageCount]);

    useEffect(() => {
        if (examStage === "active" && startTime) {
            const timer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                const remaining = (durationMins * 60) - elapsed;
                if (remaining <= 0) {
                    clearInterval(timer);
                    handleSubmitExam();
                } else {
                    setRemainingSeconds(remaining);
                }
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [examStage, startTime, durationMins, handleSubmitExam]);

    const checkGuestLimit = () => {
        if (currentUser) return true;
        if (guestUsageCount >= GUEST_EXAM_LIMIT) {
            setError(`Guest limit of ${GUEST_EXAM_LIMIT} exams exceeded. Please log in.`);
            return false;
        }
        return true;
    };

    const incrementGuestUsage = () => {
        if (!currentUser) {
            setGuestUsageCount(prev => prev + 1);
        }
    };

    const calculateGradeFrontend = (score: number, total: number): [string, string] => {
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
        if (!courseName.trim()) {
            setError("Please enter a Course Name.");
            return;
        }
        if (!checkGuestLimit()) return;

        setLoading(true);
        try {
            const accessToken = AuthService.getAccessToken();
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

            const response = await axios.post(`${API_BASE_URL}/exam-simulator/generate`, {
                course_name: courseName,
                topic: topic || null,
                num_questions: numQuestions,
                duration_mins: durationMins,
            }, { headers });

            if (response.data.success && response.data.exam_data) {
                setExamData(response.data.exam_data);
                setStartTime(Date.now());
                setRemainingSeconds(durationMins * 60);
                setExamStage("active");
                incrementGuestUsage();
                sessionStorage.setItem('exam_simulator_inputs', JSON.stringify({ courseName, topic, numQuestions, durationMins }));
            } else {
                setError(response.data.message || 'Failed to generate exam.');
            }
        } catch (err: unknown) {
            const axiosError = err as AxiosError<any>;
            if (axiosError.response?.status === 429) {
                setError(axiosError.response.data.detail || "You are making too many requests. Please try again shortly.");
            } else if (axiosError.response?.status === 503) {
                setError(axiosError.response.data.detail || "The AI service is currently unavailable. Please try again later.");
            } else {
                setError(axiosError.response?.data?.detail || 'An error occurred during exam generation.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerChange = (questionIndex: number, selectedOption: string) => {
        setUserAnswers(prev => ({ ...prev, [questionIndex]: selectedOption }));
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
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

            const formData = new FormData();
            formData.append('examDataJson', JSON.stringify(examData));
            formData.append('userAnswersJson', JSON.stringify(userAnswers));
            formData.append('score', examScore.toString());
            formData.append('total_questions', examData.length.toString());
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
        } catch (err: unknown) {
            const axiosError = err as AxiosError<any>;
            console.error('Download DOCX error:', axiosError.response?.data || axiosError);
            setError(axiosError.response?.data?.detail || 'Failed to download DOCX.');
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
        // Do not clear courseName, topic etc. to allow for easy re-take
        sessionStorage.removeItem('exam_simulator_results');
    };

    const formatTime = (totalSeconds: number) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`page-container ${styles.examSimulatorPageContainer}`}>
            <h2>💻 Exam Simulator</h2>
            <p>Prepare for your exams with customizable mock tests.</p>

            {error && <p className={styles.errorText}>{error}</p>}
            
            {examStage === "setup" && (
                <form onSubmit={handleGenerateExam} className={styles.examSetupForm}>
                    {/* Form elements remain the same, just no ApiKeyInput */}
                    <div className={styles.examSetupGrid}>
                        <div className={styles.formGroup}>
                            <label htmlFor="courseName">Course Name:</label>
                            <input type="text" id="courseName" value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="e.g., Introduction to Computer Science" required />
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="topic">Specific Topic (Optional):</label>
                            <input type="text" id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., Algorithms" />
                        </div>
                    </div>
                    <div className={styles.examSetupGrid}>
                        <div className={styles.formGroup}>
                            <label htmlFor="duration">Exam Duration:</label>
                            <select id="duration" value={durationMins} onChange={(e) => setDurationMins(parseInt(e.target.value))}>
                                {[1, 5, 10, 30, 60].map(d => <option key={d} value={d}>{d} Minutes</option>)}
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="numQuestions">Number of Questions:</label>
                            <input type="range" id="numQuestions" min="5" max="50" value={numQuestions} onChange={(e) => setNumQuestions(parseInt(e.target.value))} />
                            <span>{numQuestions} Questions</span>
                        </div>
                    </div>
                    <button type="submit" disabled={loading || !courseName.trim() || (!currentUser && guestUsageCount >= GUEST_EXAM_LIMIT)} className={styles.startButton}>
                        {loading ? 'Preparing Exam...' : 'Start Exam ⏱️'}
                    </button>
                    {!currentUser && (
                        <div className={styles.guestMessage}><p>{`You have used ${guestUsageCount} of ${GUEST_EXAM_LIMIT} guest exams.`} Please <a href="/login">Login</a> or <a href="/signup">Sign Up</a> for unlimited access.</p></div>
                    )}
                </form>
            )}

            {examStage === "active" && (
                <div className={styles.activeExamContainer}>
                    <div className={`${styles.timerDisplay} ${remainingSeconds < 120 ? styles.warning : ''}`}>
                        <b>Time Left: {formatTime(remainingSeconds)}</b>
                    </div>
                    <h3 className={styles.questionProgress}>Questions ({Object.keys(userAnswers).length}/{examData.length} Answered)</h3>
                    {examData.map((q, qIndex) => (
                        <div key={qIndex} className={styles.questionItem}>
                            <p>{qIndex + 1}. <MarkdownRenderer content={q.question} /></p>
                            {q.options.map((option, oIndex) => (
                                <div key={oIndex} className={styles.optionItem}>
                                    <label>
                                        <input type="radio" name={`question-${qIndex}`} value={option} checked={userAnswers[qIndex] === option} onChange={() => handleAnswerChange(qIndex, option)} />
                                        <MarkdownRenderer content={option} inline={true} />
                                    </label>
                                </div>
                            ))}
                        </div>
                    ))}
                    <button onClick={handleSubmitExam} disabled={loading} className={styles.submitExamButton}>
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
                        const isCorrect = userAnswers[qIndex] === q.answer;
                        return (
                            <div key={qIndex} className={`${styles.correctionItem} ${isCorrect ? styles.correct : styles.incorrect}`}>
                                <p>{qIndex + 1}. <MarkdownRenderer content={q.question} /></p>
                                <p>Your Answer: <span className={isCorrect ? styles.correctAnswer : styles.incorrectAnswer}><MarkdownRenderer content={userAnswers[qIndex] || '(No answer)'} inline={true} /></span></p>
                                {!isCorrect && <p className={styles.correctAnswer}>Correct Answer: <MarkdownRenderer content={q.answer} inline={true} /></p>}
                                <p><strong>Explanation:</strong></p>
                                <MarkdownRenderer content={q.explanation} />
                            </div>
                        );
                    })}
                    <div className={styles.resultsActions}>
                        <button onClick={handleDownloadResultsDocx} className={styles.downloadButton} disabled={!currentUser} title={!currentUser ? "Login to download" : "Download Results as DOCX"}>
                            Download Results as DOCX
                        </button>
                        <button onClick={handleTakeAnotherExam} className={styles.takeAnotherExamButton}>
                            Take Another Exam
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExamSimulatorPage;
