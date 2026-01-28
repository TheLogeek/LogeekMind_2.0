'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios, { AxiosError } from 'axios';
import MarkdownRenderer from '../../../../components/MarkdownRenderer'; // Adjust path as needed
import styles from '../ExamSimulatorPage.module.css'; // Use existing styles for consistency
import AuthService from '../../../../services/AuthService'; // To check if user is logged in for student_id

interface ExamQuestion {
    question: string;
    options: string[];
    answer: string;
    explanation: string;
}

interface SharedExamData {
    exam_data: ExamQuestion[];
    creator_username: string;
}

interface SharedExamSubmissionResponse {
    success: boolean;
    submission_id?: string;
    score?: number;
    total_questions?: number;
    grade?: string;
    remark?: string;
    message?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const SharedExamPage = () => {
    const params = useParams();
    const router = useRouter();
    const share_id = params.share_id as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sharedExam, setSharedExam] = useState<SharedExamData | null>(null);
    const [userAnswers, setUserAnswers] = useState<{ [key: number]: string }>({});
    const [studentIdentifier, setStudentIdentifier] = useState('');
    const [submissionResults, setSubmissionResults] = useState<SharedExamSubmissionResponse | null>(null);
    const [currentUser, setCurrentUser] = useState<any>(null); // State for logged-in user info

    useEffect(() => {
        setCurrentUser(AuthService.getCurrentUser()); // Check for logged-in user on mount
        const fetchSharedExam = async () => {
            try {
                const response = await axios.get<SharedExamData>(`${API_BASE_URL}/exam-simulator/shared-exams/${share_id}`);
                setSharedExam(response.data);
            } catch (err) {
                const axiosError = err as AxiosError<any>;
                setError(axiosError.response?.data?.detail || 'Failed to load shared exam.');
            } finally {
                setLoading(false);
            }
        };

        if (share_id) {
            fetchSharedExam();
        }
    }, [share_id]);

    const handleAnswerChange = (questionIndex: number, selectedOption: string) => {
        setUserAnswers(prev => ({ ...prev, [questionIndex]: selectedOption }));
    };

    const handleSubmitSharedExam = useCallback(async () => {
        setError('');
        setLoading(true);

        if (!sharedExam) {
            setError('Exam data not available.');
            setLoading(false);
            return;
        }

        // Validate student identifier if user is not logged in
        if (!currentUser && !studentIdentifier.trim()) {
            setError('Please enter your name or an identifier to submit the exam.');
            setLoading(false);
            return;
        }

        try {
            const accessToken = AuthService.getAccessToken(); // Check if a user is logged in
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

            const payload: { user_answers: { [key: number]: string }; student_identifier?: string } = {
                user_answers: userAnswers,
            };

            // Only add student_identifier if the user is anonymous
            if (!currentUser && studentIdentifier.trim()) {
                payload.student_identifier = studentIdentifier.trim();
            }

            const response = await axios.post<SharedExamSubmissionResponse>(
                `${API_BASE_URL}/exam-simulator/shared-exams/${share_id}/submit`,
                payload,
                { headers }
            );

            if (response.data.success) {
                setSubmissionResults(response.data);
            } else {
                setError(response.data.message || 'Failed to submit exam results.');
            }
        } catch (err) {
            const axiosError = err as AxiosError<any>;
            setError(axiosError.response?.data?.detail || 'An error occurred during submission.');
        } finally {
            setLoading(false);
        }
    }, [sharedExam, userAnswers, share_id, studentIdentifier, currentUser]);

    if (loading) {
        return <div className={`page-container ${styles.examSimulatorPageContainer}`}>Loading shared exam...</div>;
    }

    if (error) {
        return <div className={`page-container ${styles.examSimulatorPageContainer}`}><p className={styles.errorText}>{error}</p></div>;
    }

    if (!sharedExam) {
        return <div className={`page-container ${styles.examSimulatorPageContainer}`}><p className={styles.errorText}>Exam not found.</p></div>;
    }

    const totalQuestions = sharedExam.exam_data.length;
    const answeredQuestions = Object.keys(userAnswers).length;

    return (
        <div className={`page-container ${styles.examSimulatorPageContainer}`}>
            <h2>Shared Exam: {sharedExam.creator_username}'s Exam</h2>
            <p>Created by: {sharedExam.creator_username}</p>

            {submissionResults ? (
                <div className={styles.examResultsContainer}>
                    <h3>Your Results</h3>
                    <div className={`${styles.gradeSummary} ${submissionResults.grade === "A" || submissionResults.grade === "B" ? '' : styles.fail}`}>
                        <h2>Grade: {submissionResults.grade}</h2>
                        <h3>Score: {submissionResults.score} / {submissionResults.total_questions}</h3>
                        <p>{submissionResults.remark}</p>
                    </div>
                    <h4 className={styles.correctionsSection}>Answer Key & Explanations</h4>
                    {sharedExam.exam_data.map((q, qIndex) => {
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
                        <button onClick={() => router.push('/exam-simulator')} className={styles.takeAnotherExamButton}>
                            Go to Exam Simulator
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {!currentUser && (
                        <div className={styles.formGroup}>
                            <label htmlFor="studentIdentifier">Your Name or Identifier (Optional, for results tracking):</label>
                            <input
                                type="text"
                                id="studentIdentifier"
                                value={studentIdentifier}
                                onChange={(e) => setStudentIdentifier(e.target.value)}
                                placeholder="e.g., John Doe or Anonymous"
                            />
                        </div>
                    )}
                    <h3 className={styles.questionProgress}>Questions ({answeredQuestions}/{totalQuestions} Answered)</h3>
                    {sharedExam.exam_data.map((q, qIndex) => (
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
                    <button onClick={handleSubmitSharedExam} disabled={loading} className={styles.submitExamButton}>
                        {loading ? 'Submitting...' : 'Submit Shared Exam'}
                    </button>
                </>
            )}
        </div>
    );
};

export default SharedExamPage;