'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios, { AxiosError } from 'axios';
import MarkdownRenderer from '../../../../components/MarkdownRenderer'; // Adjust path as needed
import styles from '../../ExamSimulatorPage.module.css'; // Use existing styles for consistency
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
    // New fields for performance comparison
    comparison_message?: string;
    percentile?: number;
    // New field for guest call to action
    guest_call_to_action?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

// Helper function to extract option label (A, B, C, D) from full option text
const extractOptionLabel = (option: string): string => {
    // Match pattern like "A.", "A)", "A -", or just "A"
    const match = option.match(/^([A-Z])[.)\-\s]/);
    if (match) {
        return match[1];
    }
    // If no pattern matches, return first character if it's a letter
    const firstChar = option.trim()[0];
    if (firstChar && /[A-Z]/i.test(firstChar)) {
        return firstChar.toUpperCase();
    }
    // Fallback: return the option as-is
    return option;
};

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
    const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
    const [aiInsightsError, setAiInsightsError] = useState('');
    const [aiInsightsContent, setAiInsightsContent] = useState('');

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

            // Convert userAnswers to use option labels instead of full option text
            const processedAnswers: { [key: number]: string } = {};
            Object.entries(userAnswers).forEach(([key, value]) => {
                processedAnswers[parseInt(key)] = extractOptionLabel(value);
            });

            const payload: { user_answers: { [key: number]: string }; student_identifier?: string } = {
                user_answers: processedAnswers,
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
                // Fetch performance comparison data *after* successful submission
                let comparisonData = null;
                // Attempt to fetch comparison data if score and total questions are valid
                if (response.data.score !== undefined && response.data.total_questions !== undefined && response.data.score >= 0 && response.data.total_questions > 0) {
                    try {
                        const comparisonRes = await axios.get<{ success: boolean; comparison_message?: string; percentile?: number }>(
                            `${API_BASE_URL}/exam-simulator/shared-exams/${share_id}/performance`
                        );
                        if (comparisonRes.data.success) {
                            comparisonData = comparisonRes.data;
                        } else {
                            console.warn("Failed to fetch performance comparison:", comparisonRes.data.comparison_message);
                        }
                    } catch (compError: unknown) {
                        const axiosCompError = compError as AxiosError<any>;
                        console.error("Error fetching performance comparison:", axiosCompError.response?.data || axiosCompError);
                    }
                }

                // Update submission results with comparison data and potentially refine messages for guests
                const finalSubmissionResults: SharedExamSubmissionResponse = {
                    ...response.data,
                    comparison_message: comparisonData?.comparison_message,
                    percentile: comparisonData?.percentile,
                };

                // Refine guest message if applicable
                const INITIAL_GUEST_CALL_TO_ACTION = "Sign up on LogeekMind to track your progress and unlock more features!";
                if (!currentUser && finalSubmissionResults.comparison_message) {
                    finalSubmissionResults.guest_call_to_action = INITIAL_GUEST_CALL_TO_ACTION;
                } else if (!currentUser && !finalSubmissionResults.comparison_message) {
                    // If no comparison data, provide a generic prompt to sign up
                    finalSubmissionResults.guest_call_to_action = INITIAL_GUEST_CALL_TO_ACTION;
                }

                setSubmissionResults(finalSubmissionResults);
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

    const handleGetAIInsights = useCallback(async () => {
        setAiInsightsLoading(true);
        setAiInsightsError('');
        setAiInsightsContent('');

        if (!sharedExam || !submissionResults) {
            setAiInsightsError('Cannot get AI insights: exam data or submission results missing.');
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

            const examTopic = sharedExam.creator_username ? `${sharedExam.creator_username}'s Exam` : 'General Exam';

            const payload = {
                quiz_topic: examTopic,
                quiz_data: sharedExam.exam_data, // Pass the full sharedExam.exam_data array
                user_answers: userAnswers, // Pass the userAnswers directly
                user_score: submissionResults.score,
                total_questions: submissionResults.total_questions,
            };

            console.log('AI Insights Payload:', payload); // Debug log

            const response = await axios.post(`${API_BASE_URL}/ai-insights/exam`, payload, { headers });

            if (response.data.success) {
                setAiInsightsContent(response.data.insights);
            } else {
                setAiInsightsError(response.data.message || 'Failed to get AI insights.');
            }

        } catch (err: unknown) {
            const axiosError = err as AxiosError<any>;
            console.error('AI insights error:', axiosError.response?.data || axiosError);
            
            // Better error message extraction
            let errorMsg = 'AI insights is currently unavailable. Please try again later.';
            
            if (axiosError.response?.data) {
                const data = axiosError.response.data;
                // Handle FastAPI validation errors (422)
                if (Array.isArray(data.detail)) {
                    errorMsg = data.detail.map((err: any) => err.msg).join(', ');
                } 
                // Handle string detail
                else if (typeof data.detail === 'string') {
                    errorMsg = data.detail;
                }
                // Handle message field
                else if (data.message) {
                    errorMsg = data.message;
                }
            }
            
            setAiInsightsError(errorMsg);
        } finally {
            setAiInsightsLoading(false);
        }
    }, [sharedExam, submissionResults, userAnswers]); // Dependencies for useCallback

    const handleDownloadResults = useCallback(async () => {
        if (!currentUser || !submissionResults?.submission_id || !share_id) {
            setError("Cannot download results: user not logged in or submission data missing.");
            return;
        }

        try {
            const accessToken = AuthService.getAccessToken();
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

            const downloadUrl = `${API_BASE_URL}/exam-simulator/shared-exams/${share_id}/submissions/${submissionResults.submission_id}/download`;
            
            const response = await axios.get(downloadUrl, {
                headers,
                responseType: 'blob', // Important for file downloads
            });

            // Create a Blob from the response data
            const blob = new Blob([response.data], { type: response.headers['content-type'] });
            
            // Create a link element, set the download attribute, and click it
            const contentDisposition = response.headers['content-disposition'];
            let filename = `exam_results_${share_id}.docx`;
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
                    {/* Display performance comparison if available */}
                    {submissionResults.comparison_message && (
                        <div className={styles.performanceComparison}>
                            <p><strong>Performance:</strong> {submissionResults.comparison_message}</p>
                        </div>
                    )}
                    
                    <div className={styles.aiInsightsSection} style={{ marginTop: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
                        <h4>AI Insights</h4>
                        <p style={{ fontSize: '0.9em', color: '#666' }}>Click here to get tips from the AI on your weak points.</p>
                        <button 
                            onClick={handleGetAIInsights}
                            disabled={!currentUser || aiInsightsLoading}
                            className={styles.takeAnotherExamButton} // Re-using existing button style
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
                    <h4 className={styles.correctionsSection}>Answer Key & Explanations</h4>
                    {sharedExam.exam_data.map((q, qIndex) => {
                        const userAnswerLabel = extractOptionLabel(userAnswers[qIndex] || '');
                        const correctAnswerLabel = extractOptionLabel(q.answer);
                        const isCorrect = userAnswerLabel === correctAnswerLabel;
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
                    {/* Display guest call to action if user is a guest and a message exists */}
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
                            className={styles.takeAnotherExamButton} // Reusing existing button style
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