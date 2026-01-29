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
    creator_username?: string; 
}

interface SharedQuizSubmissionResponse {
    success: boolean;
    submission_id?: string;
    score?: number;
    total_questions?: number;
    grade?: string;
    remark?: string;
    message?: string;
    comparison_message?: string;
    percentile?: number;
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
    const [currentUser, setCurrentUser] = useState<any>(null); 
    const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
    const [aiInsightsError, setAiInsightsError] = useState('');
    const [aiInsightsContent, setAiInsightsContent] = useState('');

    const GUEST_QUIZ_LIMIT = 2;
    // Ensure share_id is available before creating the key
    const GUEST_USAGE_KEY = share_id ? `shared_quiz_guest_usage_${share_id}` : 'temp_guest_key';
    
    const [guestUsageCount, setGuestUsageCount] = useState(() => {
        if (typeof window !== 'undefined') {
            return parseInt(localStorage.getItem(GUEST_USAGE_KEY) || '0', 10);
        }
        return 0;
    });

    const INITIAL_GUEST_CALL_TO_ACTION = "Sign up on LogeekMind to track your progress and unlock more features!";

    // --- FIX: Unified Data Fetching Effect ---
    useEffect(() => {
        const fetchUserAndQuiz = async () => {
            setLoading(true);
            try {
                // 1. Fetch User Session
                if (typeof window !== 'undefined') {
                    const user = await AuthService.getCurrentUser();
                    setCurrentUser(user);
                    
                    // Update guest usage from local storage
                    const storedUsage = localStorage.getItem(GUEST_USAGE_KEY);
                    if (storedUsage) {
                        setGuestUsageCount(parseInt(storedUsage, 10));
                    }
                }

                // 2. Fetch Quiz Data (This was missing in your original code)
                if (share_id) {
                    const response = await axios.get<SharedQuizData>(
                        `${API_BASE_URL}/smart-quiz/shared-quizzes/${share_id}`
                    );
                    setSharedQuiz(response.data);
                }
            } catch (err) {
                console.error("Error fetching quiz data:", err);
                setError("Failed to load the quiz. It may not exist or the link is invalid.");
            } finally {
                setLoading(false);
            }
        };

        if (share_id) {
            fetchUserAndQuiz();
        }
    }, [share_id, GUEST_USAGE_KEY]); 

    // Effect to handle Guest Limits
    useEffect(() => {
        if (typeof window !== 'undefined' && share_id) {
            localStorage.setItem(GUEST_USAGE_KEY, guestUsageCount.toString());
            
            // Only show error if we are sure user is NOT logged in and limit is reached
            if (!currentUser && guestUsageCount >= GUEST_QUIZ_LIMIT) {
                // Only set error if we haven't already submitted successfully (to allow viewing results)
                if (!submissionResults) {
                    setError(`You have reached the guest limit of ${GUEST_QUIZ_LIMIT} attempts for this quiz. Please login or sign up for unlimited access.`);
                }
            } else if (!submissionResults) {
                // Clear error if conditions are met (unless we have a submission error)
                setError((prev) => prev.includes('guest limit') ? '' : prev);
            }
        }
    }, [guestUsageCount, currentUser, share_id, submissionResults, GUEST_USAGE_KEY]);

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
            if (submissionResponse.data.score !== undefined && submissionResponse.data.total_questions !== undefined) {
                try {
                    const comparisonRes = await axios.get<{ success: boolean; comparison_message?: string; percentile?: number }>(
                        `${API_BASE_URL}/smart-quiz/shared-quizzes/${share_id}/performance`
                    );
                    if (comparisonRes.data.success) {
                        comparisonData = comparisonRes.data;
                    }
                } catch (compError) {
                    console.error("Error fetching performance comparison", compError);
                }
            }

            const finalSubmissionResults: SharedQuizSubmissionResponse = {
                ...submissionResponse.data,
                comparison_message: comparisonData?.comparison_message,
                percentile: comparisonData?.percentile,
            };

            if (!currentUser) {
                finalSubmissionResults.guest_call_to_action = INITIAL_GUEST_CALL_TO_ACTION;
            }
            
            setSubmissionResults(finalSubmissionResults);
            incrementGuestUsage(); 

        } catch (err: unknown) {
            const axiosError = err as AxiosError<any>;
            console.error('Quiz submission error:', axiosError.response?.data || axiosError);
            setError(axiosError.response?.data?.detail || 'An error occurred during submission.');
        } finally {
            setLoading(false);
        }
    }, [sharedQuiz, userAnswers, share_id, studentIdentifier, currentUser, GUEST_USAGE_KEY]);

    const handleGetAIInsights = useCallback(async () => {
        setAiInsightsLoading(true);
        setAiInsightsError('');
        setAiInsightsContent('');

        if (!sharedQuiz || !submissionResults) {
            setAiInsightsError('Cannot get AI insights: quiz data or submission results missing.');
            setAiInsightsLoading(false);
            return;
        }

        try {
            const accessToken = AuthService.getAccessToken();
            if (!accessToken) {
                setAiInsightsError('You must be logged in to get AI insights.');
                setAiInsightsLoading(false);
                return;
            }

            const headers = { Authorization: `Bearer ${accessToken}` };

            const quizContext = sharedQuiz.quiz_data.map((q, index) => ({
                question: q.question,
                correct_answer: q.answer,
                user_answer: userAnswers[index] || 'N/A',
                is_correct: (userAnswers[index] === q.answer)
            }));

        const payload = {
            quiz_topic: sharedQuiz.title,
            user_score: submissionResults.score,
            total_questions: submissionResults.total_questions,
            quiz_data: sharedQuiz.quiz_data, // Pass the original quiz data
            user_answers: userAnswers,      // Pass the user's answers as a separate field
        };

        const response = await axios.post(`${API_BASE_URL}/ai-insights/quiz`, payload, { headers });

            if (response.data.success) {
                setAiInsightsContent(response.data.insights);
            } else {
                setAiInsightsError(response.data.message || 'Failed to get AI insights.');
            }

        } catch (err: unknown) {
            const axiosError = err as AxiosError<any>;
            console.error('AI insights error:', axiosError.response?.data || axiosError);
            setAiInsightsError(axiosError.response?.data?.detail || 'AI insights is currently unavailable right now. Please try again later.');
        } finally {
            setAiInsightsLoading(false);
        }
    }, [sharedQuiz, submissionResults, userAnswers]);

    const handleDownloadResults = useCallback(async () => {
        if (!currentUser || !submissionResults?.submission_id || !share_id) {
            setError("Cannot download results: user not logged in or submission data missing.");
            return;
        }

        try {
            const accessToken = AuthService.getAccessToken();
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

            const downloadUrl = `${API_BASE_URL}/smart-quiz/shared-quizzes/${share_id}/submissions/${submissionResults.submission_id}/download`;
            
            const response = await axios.get(downloadUrl, {
                headers,
                responseType: 'blob', // Important for file downloads
            });

            // Create a Blob from the response data
            const blob = new Blob([response.data], { type: response.headers['content-type'] });
            
            // Create a link element, set the download attribute, and click it
            const contentDisposition = response.headers['content-disposition'];
            let filename = `quiz_results_${share_id}.docx`;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1];
                }
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

        } catch (err: unknown) {
            const axiosError = err as AxiosError<any>;
            console.error('Download results error:', axiosError.response?.data || axiosError);
            const errorDetail = axiosError.response?.data?.detail || 'Failed to download results.';
            setError(errorDetail);
        }
    }, [currentUser, submissionResults, share_id]);

    if (loading) {
        return <div className={`page-container ${styles.smartQuizPageContainer}`}>Loading shared quiz...</div>;
    }

    // Only show error if we don't have a sharedQuiz loaded yet OR if it's a specific submission error
    if (error && !sharedQuiz) {
        return <div className={`page-container ${styles.smartQuizPageContainer}`}><p className={styles.errorText}>{error}</p></div>;
    }

    if (!sharedQuiz) {
        return <div className={`page-container ${styles.smartQuizPageContainer}`}><p className={styles.errorText}>Quiz not found.</p></div>;
    }

    const totalQuestions = sharedQuiz.quiz_data.length;
    const answeredQuestions = Object.keys(userAnswers).length;

    return (
        <div className={`page-container ${styles.smartQuizPageContainer}`}>
            {error && <p className={styles.errorText}>{error}</p>}
            
            <h2>Shared Quiz: {sharedQuiz.title}</h2>
            <p>Created by: {sharedQuiz.creator_username || 'Unknown User'}</p>

            {submissionResults ? (
                <div className={styles.quizResults}>
                    <h3>Your Results</h3>
                    <p className={styles.quizResultsScore}>
                        You scored {submissionResults.score}/{submissionResults.total_questions} ({( (submissionResults.score || 0) / (submissionResults.total_questions || 1) * 100).toFixed(0)}%)
                    </p>
                    <p>Grade: {submissionResults.grade}</p>
                    <p>Remark: {submissionResults.remark}</p>
                    
                    <div className={styles.aiInsightsSection} style={{ marginTop: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
                        <h4>AI Insights</h4>
                        <p style={{ fontSize: '0.9em', color: '#666' }}>Click here to get tips from the AI on your weak points.</p>
                        <button 
                            onClick={handleGetAIInsights}
                            disabled={!currentUser || aiInsightsLoading}
                            className={styles.newQuizButton}
                            style={{ marginRight: '10px' }}
                        >
                            {aiInsightsLoading ? 'Getting Insights...' : 'Get AI Insights'}
                        </button>
                        {!currentUser && (
                            <p style={{ color: '#dc3545', fontSize: '0.9em', marginTop: '5px' }}>Login to get AI Insights.</p>
                        )}
                        {aiInsightsError && <p className={styles.errorText} style={{ marginTop: '10px' }}>{aiInsightsError}</p>}
                        {aiInsightsContent && (
                            <div className={styles.aiInsightsContent} style={{ marginTop: '15px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                                <MarkdownRenderer content={aiInsightsContent} />
                            </div>
                        )}
                    </div>
                    
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
                    
                    {submissionResults.guest_call_to_action && (
                        <div className={styles.guestMessage} style={{ marginTop: '20px', border: '1px solid #f0ad4e', padding: '15px', borderRadius: '5px', backgroundColor: '#fcf8e3', color: '#8a6d3b' }}>
                            <p>
                                <strong>{submissionResults.guest_call_to_action}</strong>
                            </p>
                        </div>
                    )}

                    {submissionResults.guest_call_to_action && (
                        <div className={styles.guestMessage} style={{ marginTop: '20px', border: '1px solid #f0ad4e', padding: '15px', borderRadius: '5px', backgroundColor: '#fcf8e3', color: '#8a6d3b' }}>
                            <p>
                                <strong>{submissionResults.guest_call_to_action}</strong>
                            </p>
                        </div>
                    )}

                    {/* NEW DOWNLOAD BUTTON SECTION START */}
                    <div className={styles.downloadSection} style={{ marginTop: '20px' }}>
                        <button
                            onClick={handleDownloadResults}
                            disabled={!currentUser || !submissionResults?.submission_id}
                            className={styles.newQuizButton} // Reusing existing button style
                            style={{ marginRight: '10px' }}
                        >
                            Download Results (.docx)
                        </button>
                        {!currentUser && (
                            <p style={{ color: '#dc3545', fontSize: '0.9em', marginTop: '5px' }}>
                                Login or Signup to download your results.
                            </p>
                        )}
                    </div>
                    {/* NEW DOWNLOAD BUTTON SECTION END */}

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