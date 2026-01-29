'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios, { AxiosError } from 'axios';
import MarkdownRenderer from '../../../../components/MarkdownRenderer'; // Adjust path as needed
import styles from '../../SmartQuizPage.module.css'; // Use existing styles for consistency
import AuthService from '../../../../services/AuthService'; // To check if user is logged in for student_id

interface QuizQuestion {
    question: string;
    options: string[];
    answer: string;
    explanation: string;
}

interface SharedQuizData {
    id: string;
    creator_id: string;
    title: string;
    quiz_data: QuizQuestion[];
    created_at: string;
    creator_username?: string; // Added for display
}

// Updated to include performance comparison data and guest call to action
interface SharedQuizSubmissionResponse {
    success: boolean;
    submission_id?: string;
    score?: number;
    total_questions?: number;
    grade?: string;
    remark?: string;
    message?: string;
    // New fields for performance comparison
    comparison_message?: string;
    percentile?: number;
    // New field for guest call to action
    guest_call_to_action?: string;
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

    // Guest usage limit for this specific shared quiz
    const GUEST_QUIZ_LIMIT = 2;
    const GUEST_USAGE_KEY = `shared_quiz_guest_usage_${share_id}`; // Unique key per shared quiz
    const [guestUsageCount, setGuestUsageCount] = useState(() => {
        return typeof window !== 'undefined' ? parseInt(localStorage.getItem(GUEST_USAGE_KEY) || '0', 10) : 0;
    });

    // Refined share message for better structure and clarity
    const SHARE_MESSAGE_TEMPLATE = (score: number | undefined, total: number | undefined, grade: string | undefined, comparison: string | undefined) => {
        let baseMessage = `I just took a quiz on LogeekMind!`;
        if (score !== undefined && total !== undefined) {
            baseMessage += ` Scored ${score}/${total} (${grade}).`;
        }
        if (comparison) {
            baseMessage += ` ${comparison}`;
        }
        baseMessage += ` Think you can beat me? Try it!`;
        return baseMessage;
    };

    const INITIAL_GUEST_CALL_TO_ACTION = "Sign up on LogeekMind to track your progress and unlock more features!";

    useEffect(() => {
        const fetchUserAndQuiz = async () => {
            if (typeof window !== 'undefined') {
                const user = await AuthService.getCurrentUser();
                setCurrentUser(user);
                setGuestUsageCount(parseInt(localStorage.getItem(GUEST_USAGE_KEY) || '0', 10));
            }

            }
        };
        fetchUserAndQuiz();
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(GUEST_USAGE_KEY, guestUsageCount.toString());
            if (!currentUser && guestUsageCount >= GUEST_QUIZ_LIMIT) {
                setError(`You have reached the guest limit of ${GUEST_QUIZ_LIMIT} attempts for this quiz. Please login or sign up for unlimited access.`);
            } else {
                setError('');
            }
        }
    }, [guestUsageCount, currentUser, share_id]); // Include share_id in dependencies

    const checkGuestLimit = () => {
        if (currentUser) return true;
        if (guestUsageCount >= GUEST_QUIZ_LIMIT) {
            setError(`You have reached the guest limit of ${GUEST_QUIZ_LIMIT} attempts for this quiz. Please login or sign up for unlimited access.`);
            return false;
        }
        return true;
    };

    const incrementGuestUsage = () => {
        if (!currentUser) {
            setGuestUsageCount(prev => prev + 1);
        }
    };

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
            const accessToken = AuthService.getAccessToken();
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

            const payload: { user_answers: { [key: number]: string }; student_identifier?: string } = {
                user_answers: userAnswers,
            };

            if (!currentUser && studentIdentifier.trim()) {
                payload.student_identifier = studentIdentifier.trim();
            }
            
            // Submit answers
            const submissionResponse = await axios.post<SharedQuizSubmissionResponse>(
                `${API_BASE_URL}/smart-quiz/shared-quizzes/${share_id}/submit`,
                payload,
                { headers }
            );

            if (!submissionResponse.data.success) {
                setError(submissionResponse.data.message || 'Failed to submit quiz results.');
                setLoading(false);
                return;
            }

            // Fetch performance comparison data *after* successful submission
            let comparisonData = null;
            // Only attempt to fetch comparison if score/total are valid and a share_id exists
            if (submissionResponse.data.score !== undefined && submissionResponse.data.total_questions !== undefined && submissionResponse.data.score >= 0 && submissionResponse.data.total_questions > 0) {
                try {
                    // Fetch performance data from the new backend endpoint
                    const comparisonRes = await axios.get<{ success: boolean; comparison_message?: string; percentile?: number }>(
                        `${API_BASE_URL}/smart-quiz/shared-quizzes/${share_id}/performance`
                    );
                    if (comparisonRes.data.success) {
                        comparisonData = comparisonRes.data;
                    } else {
                        console.warn("Failed to fetch performance comparison:", comparisonRes.data.message);
                    }
                } catch (compError: unknown) {
                    const axiosCompError = compError as AxiosError<any>;
                    console.error("Error fetching performance comparison:", axiosCompError.response?.data || axiosCompError);
                }
            }

            // Update submission results with comparison data and potentially refine messages for guests
            const finalSubmissionResults: SharedQuizSubmissionResponse = {
                ...submissionResponse.data,
                comparison_message: comparisonData?.comparison_message,
                percentile: comparisonData?.percentile,
            };

            // Refine guest message if applicable
            if (!currentUser && finalSubmissionResults.comparison_message) {
                finalSubmissionResults.guest_call_to_action = INITIAL_GUEST_CALL_TO_ACTION;
            } else if (!currentUser && !finalSubmissionResults.comparison_message) {
                // If no comparison data, provide a generic prompt to sign up
                finalSubmissionResults.guest_call_to_action = INITIAL_GUEST_CALL_TO_ACTION;
            }
            
            setSubmissionResults(finalSubmissionResults);
            incrementGuestUsage(); // Increment usage only on successful submission

        } catch (err: unknown) {
            const axiosError = err as AxiosError<any>;
            console.error('Quiz submission error:', axiosError.response?.data || axiosError);
            setError(axiosError.response?.data?.detail || 'An error occurred during submission.');
        } finally {
            setLoading(false);
        }
    }, [sharedQuiz, userAnswers, share_id, studentIdentifier, currentUser, guestUsageCount]); // Ensure dependencies are complete

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
                    
                    {/* Display performance comparison if available */}
                    {submissionResults.comparison_message && (
                        <div className={styles.performanceComparison}>
                            <p><strong>Performance:</strong> {submissionResults.comparison_message}</p>
                        </div>
                    )}

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
                    
                    {/* Display guest call to action if user is a guest and a message exists */}
                    {submissionResults.guest_call_to_action && (
                        <div className={styles.guestMessage} style={{ marginTop: '20px', border: '1px solid #f0ad4e', padding: '15px', borderRadius: '5px', backgroundColor: '#fcf8e3', color: '#8a6d3b' }}>
                            <p>
                                <strong>{submissionResults.guest_call_to_action}</strong>
                            </p>
                        </div>
                    )}

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
                    <button onClick={handleSubmitSharedQuiz} disabled={loading || answeredQuestions < totalQuestions} className={styles.submitQuizButton}>
                        {loading ? 'Submitting...' : 'Submit Shared Quiz'}
                    </button>
                </>
            )}
        </div>
    );
};

export default SharedQuizPage;