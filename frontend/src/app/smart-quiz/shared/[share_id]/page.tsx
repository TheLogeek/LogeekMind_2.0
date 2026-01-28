'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios, { AxiosError } from 'axios';
import MarkdownRenderer from '../../../../components/MarkdownRenderer'; // Adjust path as needed
import styles from '../SmartQuizPage.module.css'; // Use existing styles for consistency
import AuthService from '../../../../services/AuthService'; // To check if user is logged in for student_id

interface QuizQuestion {
    question: string;
    options: string[];
    answer: string;
    explanation: string;
}

interface SharedQuizData {
    quiz_data: QuizQuestion[];
    creator_username: string;
    title: string;
}

interface SharedQuizSubmissionResponse {
    success: boolean;
    submission_id?: string;
    score?: number;
    total_questions?: number;
    grade?: string;
    remark?: string;
    message?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const SharedQuizPage = () => {
    const params = useParams();
    const router = useRouter();
    const share_id = params.share_id as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sharedQuiz, setSharedQuiz] = useState<SharedQuizData | null>(null);
    const [userAnswers, setUserAnswers] = useState<{ [key: number]: string }>({});
    const [studentIdentifier, setStudentIdentifier] = useState('');
    const [submissionResults, setSubmissionResults] = useState<SharedQuizSubmissionResponse | null>(null);
    const [currentUser, setCurrentUser] = useState<any>(null); // State for logged-in user info

    useEffect(() => {
        setCurrentUser(AuthService.getCurrentUser()); // Check for logged-in user on mount
        const fetchSharedQuiz = async () => {
            try {
                const response = await axios.get<SharedQuizData>(`${API_BASE_URL}/smart-quiz/shared-quizzes/${share_id}`);
                setSharedQuiz(response.data);
            } catch (err) {
                const axiosError = err as AxiosError<any>;
                setError(axiosError.response?.data?.detail || 'Failed to load shared quiz.');
            } finally {
                setLoading(false);
            }
        };

        if (share_id) {
            fetchSharedQuiz();
        }
    }, [share_id]);

    const handleAnswerChange = (questionIndex: number, selectedOption: string) => {
        setUserAnswers(prev => ({ ...prev, [questionIndex]: selectedOption }));
    };

    const handleSubmitSharedQuiz = useCallback(async () => {
        setError('');
        setLoading(true);

        if (!sharedQuiz) {
            setError('Quiz data not available.');
            setLoading(false);
            return;
        }

        // Validate student identifier if user is not logged in
        if (!currentUser && !studentIdentifier.trim()) {
            setError('Please enter your name or an identifier to submit the quiz.');
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

            const response = await axios.post<SharedQuizSubmissionResponse>(
                `${API_BASE_URL}/smart-quiz/shared-quizzes/${share_id}/submit`,
                payload,
                { headers }
            );

            if (response.data.success) {
                setSubmissionResults(response.data);
            } else {
                setError(response.data.message || 'Failed to submit quiz results.');
            }
        } catch (err) {
            const axiosError = err as AxiosError<any>;
            setError(axiosError.response?.data?.detail || 'An error occurred during submission.');
        } finally {
            setLoading(false);
        }
    }, [sharedQuiz, userAnswers, share_id, studentIdentifier, currentUser]);

    if (loading) {
        return <div className={`page-container ${styles.smartQuizPageContainer}`}>Loading shared quiz...</div>;
    }

    if (error) {
        return <div className={`page-container ${styles.smartQuizPageContainer}`}><p className={styles.errorText}>{error}</p></div>;
    }

    if (!sharedQuiz) {
        return <div className={`page-container ${styles.smartQuizPageContainer}`}><p className={styles.errorText}>Quiz not found.</p></div>;
    }

    const totalQuestions = sharedQuiz.quiz_data.length;
    const answeredQuestions = Object.keys(userAnswers).length;

    return (
        <div className={`page-container ${styles.smartQuizPageContainer}`}>
            <h2>Shared Quiz: {sharedQuiz.title}</h2>
            <p>Created by: {sharedQuiz.creator_username}</p>

            {submissionResults ? (
                <div className={styles.quizResults}>
                    <h3>Your Results</h3>
                    <p className={styles.quizResultsScore}>
                        You scored {submissionResults.score}/{submissionResults.total_questions} ({( (submissionResults.score || 0) / (submissionResults.total_questions || 1) * 100).toFixed(0)}%)
                    </p>
                    <p>Grade: {submissionResults.grade}</p>
                    <p>Remark: {submissionResults.remark}</p>
                    <h4 className={styles.answerKeyHeading}>Answer Key & Explanations</h4>
                    {sharedQuiz.quiz_data.map((q, qIndex) => {
                        const isCorrect = userAnswers[qIndex] === q.answer;
                        return (
                            <div key={qIndex} className={`${styles.answerItem} ${isCorrect ? styles.correct : styles.incorrect}`}>
                                <p>{qIndex + 1}. <MarkdownRenderer content={q.question} /></p>
                                <p>Your Answer: <span className={isCorrect ? styles.correctAnswer : styles.incorrectAnswer}><MarkdownRenderer content={userAnswers[qIndex] || '(No Answer)'} inline={true} /></span></p>
                                {!isCorrect && <p className={styles.correctAnswer}>Correct Answer: <MarkdownRenderer content={q.answer} inline={true} /></p>}
                                <p><strong>Explanation:</strong></p>
                                <MarkdownRenderer content={q.explanation} />
                            </div>
                        );
                    })}
                    <div className={styles.quizActions}>
                        <button onClick={() => router.push('/smart-quiz')} className={styles.newQuizButton}>
                            Go to Smart Quiz Generator
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
                    {sharedQuiz.quiz_data.map((q, qIndex) => (
                        <div key={qIndex} className={styles.questionItem}>
                            <p>{qIndex + 1}. <MarkdownRenderer content={q.question} /></p>
                            {q.options.map((option: string, oIndex: number) => (
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
                    <button onClick={handleSubmitSharedQuiz} disabled={loading} className={styles.submitQuizButton}>
                        {loading ? 'Submitting...' : 'Submit Shared Quiz'}
                    </button>
                </>
            )}
        </div>
    );
};

export default SharedQuizPage;