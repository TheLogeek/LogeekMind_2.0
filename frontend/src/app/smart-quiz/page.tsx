'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthService from '../../services/AuthService';
import axios, { AxiosError } from 'axios';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import styles from './SmartQuizPage.module.css';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const DIFFICULTY_MAP_FRONTEND: { [key: number]: string } = { 1: "Easy", 2: "Beginner", 3: "Intermediate", 4: "Advanced", 5: "Hard" };
const QUESTION_TYPES = ["Multiple Choice", "True/False"];
const NUM_QUESTIONS_OPTIONS = [5, 10, 15];

const SmartQuizPage = () => {
    const router = useRouter();
    const [quizTopic, setQuizTopic] = useState('');
    const [numQuestions, setNumQuestions] = useState(NUM_QUESTIONS_OPTIONS[0]);
    const [quizType, setQuizType] = useState(QUESTION_TYPES[0]);
    const [difficulty, setDifficulty] = useState(3);
    const [quizData, setQuizData] = useState<any[] | null>(null);
    const [userAnswers, setUserAnswers] = useState<{ [key: number]: string }>({});
    const [quizSubmitted, setQuizSubmitted] = useState(false);
    const [quizScore, setQuizScore] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSharable, setIsSharable] = useState(false); // New state for sharable quiz
    const [sharedQuizLink, setSharedQuizLink] = useState(''); // New state for shared link
    const [shareMessage, setShareMessage] = useState("Just aced this quiz on LogeekMind! Think you can beat my score? Give it a try!"); // New state for share message
    
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
    const [aiInsightsError, setAiInsightsError] = useState('');
    const [aiInsightsContent, setAiInsightsContent] = useState('');

    const GUEST_QUIZ_LIMIT = 2; // Adjusted limit
    const GUEST_USAGE_KEY = 'smart_quiz_guest_usage';
    const [guestUsageCount, setGuestUsageCount] = useState(() => {
        return typeof window !== 'undefined' ? parseInt(localStorage.getItem(GUEST_USAGE_KEY) || '0', 10) : 0;
    });

    useEffect(() => {
        const fetchUser = async () => {
            const user = await AuthService.getCurrentUser();
            setCurrentUser(user);
        };
        fetchUser();
        // Restore state from sessionStorage
        const savedInputs = sessionStorage.getItem('smart_quiz_inputs');
        if (savedInputs) {
            const { quizTopic, numQuestions, quizType, difficulty } = JSON.parse(savedInputs);
            setQuizTopic(quizTopic || '');
            setNumQuestions(numQuestions || NUM_QUESTIONS_OPTIONS[0]);
            setQuizType(quizType || QUESTION_TYPES[0]);
            setDifficulty(difficulty || 3);
        }
        const savedQuizData = sessionStorage.getItem('smart_quiz_data');
        if (savedQuizData) setQuizData(JSON.parse(savedQuizData));
        const savedUserAnswers = sessionStorage.getItem('smart_quiz_userAnswers');
        if (savedUserAnswers) setUserAnswers(JSON.parse(savedUserAnswers));
        if (sessionStorage.getItem('smart_quiz_submitted') === 'true') setQuizSubmitted(true);
        const savedQuizScore = sessionStorage.getItem('smart_quiz_score');
        if (savedQuizScore) setQuizScore(parseInt(savedQuizScore, 10));
    }, []);

    useEffect(() => {
        localStorage.setItem(GUEST_USAGE_KEY, guestUsageCount.toString());
        if (!currentUser && guestUsageCount >= GUEST_QUIZ_LIMIT) {
            setError(`You have reached the guest limit of ${GUEST_QUIZ_LIMIT} quizzes. Please login or sign up for unlimited access.`);
        } else {
            setError('');
        }
    }, [guestUsageCount, currentUser]);

    const checkGuestLimit = () => {
        if (currentUser) return true;
        if (guestUsageCount >= GUEST_QUIZ_LIMIT) {
            setError(`You have reached the guest limit of ${GUEST_QUIZ_LIMIT} quizzes. Please login or sign up for unlimited access.`);
            return false;
        }
        return true;
    };

    const incrementGuestUsage = () => {
        if (!currentUser) {
            setGuestUsageCount(prev => prev + 1);
        }
    };

    const handleGenerateQuiz = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!quizTopic.trim()) {
            setError('Please enter a topic to quiz on.');
            return;
        }
        if (!checkGuestLimit()) return;

        setError('');
        setQuizData(null);
        setQuizSubmitted(false);
        setQuizScore(0);
        setUserAnswers({});
        setLoading(true);

        try {
            const accessToken = AuthService.getAccessToken();
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

            const response = await axios.post(`${API_BASE_URL}/smart-quiz/generate`, {
                quiz_topic: quizTopic,
                num_questions: numQuestions,
                quiz_type: quizType,
                difficulty: difficulty,
                is_sharable: isSharable, // Pass the is_sharable flag
            }, { headers });

            if (response.data.success && response.data.quiz_data) {
                setQuizData(response.data.quiz_data);
                incrementGuestUsage();
                // If a share_id is returned, construct the shareable link
                if (response.data.share_id) {
                    setSharedQuizLink(`${window.location.origin}/smart-quiz/shared/${response.data.share_id}`);
                } else {
                    setSharedQuizLink('');
                }
                sessionStorage.setItem('smart_quiz_data', JSON.stringify(response.data.quiz_data));
                sessionStorage.setItem('smart_quiz_inputs', JSON.stringify({ quizTopic, numQuestions, quizType, difficulty }));
            } else {
                setError(response.data.message || 'Failed to generate quiz.');
            }
        } catch (err: unknown) {
            const axiosError = err as AxiosError<any>;
            if (axiosError.response?.status === 429) {
                setError(axiosError.response.data.detail || "You are making too many requests. Please try again shortly.");
            } else if (axiosError.response?.status === 503) {
                setError(axiosError.response.data.detail || "The AI service is currently unavailable. Please try again later.");
            } else {
                setError(axiosError.response?.data?.detail || 'Failed to generate quiz.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerChange = (questionIndex: number, selectedOption: string) => {
        setUserAnswers(prev => ({ ...prev, [questionIndex]: selectedOption }));
    };

    const handleSubmitQuiz = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        let score = quizData?.reduce((acc, q, index) => acc + (userAnswers[index] === q.answer ? 1 : 0), 0) || 0;
        setQuizScore(score);
        setQuizSubmitted(true);
        sessionStorage.setItem('smart_quiz_userAnswers', JSON.stringify(userAnswers));
        sessionStorage.setItem('smart_quiz_score', score.toString());
        sessionStorage.setItem('smart_quiz_submitted', 'true');

        if (currentUser && quizData) {
            try {
                const accessToken = AuthService.getAccessToken();
                await axios.post(`${API_BASE_URL}/smart-quiz/log-performance`, {
                    score,
                    total_questions: quizData.length,
                    correct_answers: score,
                    extra: { topic: quizTopic, difficulty, quiz_type: quizType }
                }, { headers: { Authorization: `Bearer ${accessToken}` } });
            } catch (err) {
                console.error('Error logging quiz performance:', err);
            }
        }
    };

    const handleGetAIInsights = async () => {
        setAiInsightsLoading(true);
        setAiInsightsError('');
        setAiInsightsContent('');

        if (!quizData || !quizSubmitted) {
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

            // Prepare quiz context for AI analysis
            const quizContext = quizData.map((q, index) => ({
                question: q.question,
                correct_answer: q.answer,
                user_answer: userAnswers[index] || 'N/A', // User's answer for this question
                is_correct: (userAnswers[index] === q.answer)
            }));

            const payload = {
                quiz_topic: quizTopic,
                quiz_data: quizContext,
                user_score: quizScore,
                total_questions: quizData.length
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
    };

    const handleDownloadResultsDocx = async () => {
        if (!quizData || !quizSubmitted || !currentUser) {
            setError("Please log in to download your results.");
            return;
        };

        try {
            const accessToken = AuthService.getAccessToken();
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

            const formData = new FormData();
            formData.append('quizDataJson', JSON.stringify(quizData));
            formData.append('quiz_topic', quizTopic);
            formData.append('user_score', quizScore.toString());
            formData.append('total_questions', quizData.length.toString());

            const response = await axios.post(`${API_BASE_URL}/smart-quiz/download-results-docx`, formData, { headers, responseType: 'blob' });

            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${quizTopic.replace(/\s/g, '_')}_Quiz_Results.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err: unknown) {
            const axiosError = err as AxiosError<any>;
            console.error('Error downloading DOCX:', axiosError.response?.data || axiosError);
            setError(axiosError.response?.data?.detail || 'Failed to download DOCX.');
        }
    };

    const handleNewQuiz = () => {
        setQuizData(null);
        setQuizSubmitted(false);
        setQuizScore(0);
        setUserAnswers({});
        setError('');
        setIsSharable(false); // Reset sharable state
        setSharedQuizLink(''); // Clear shared link
        sessionStorage.removeItem('smart_quiz_data');
        sessionStorage.removeItem('smart_quiz_inputs');
        sessionStorage.removeItem('smart_quiz_userAnswers');
        sessionStorage.removeItem('smart_quiz_score');
        sessionStorage.removeItem('smart_quiz_submitted');
    };

    const handleCopyLink = () => {
        if (sharedQuizLink && shareMessage) {
            const textToCopy = `${shareMessage}\n${sharedQuizLink}`;
            navigator.clipboard.writeText(textToCopy)
                .then(() => {
                    alert('Message and link copied to clipboard!');
                })
                .catch(err => {
                    console.error('Failed to copy text: ', err);
                    alert('Failed to copy text.');
                });
        } else if (sharedQuizLink) {
            navigator.clipboard.writeText(sharedQuizLink)
                .then(() => {
                    alert('Link copied to clipboard!');
                })
                .catch(err => {
                    console.error('Failed to copy link: ', err);
                    alert('Failed to copy link.');
                });
        }
    };

    return (
        <div className={`page-container ${styles.smartQuizPageContainer}`}>
            <h2>Smart Quiz Generator</h2>
            <p>Generate interactive quizzes with instant grading and explanations.</p>

            <form onSubmit={handleGenerateQuiz} className={styles.quizForm}>
                <div className={styles.formGroup}>
                    <label htmlFor="quizTopic">Topic to Quiz on:</label>
                    <input type="text" id="quizTopic" value={quizTopic} onChange={(e) => setQuizTopic(e.target.value)} placeholder="e.g., Newton's Laws of Motion" required />
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="numQuestions">Number of Questions:</label>
                    <select id="numQuestions" value={numQuestions} onChange={(e) => setNumQuestions(parseInt(e.target.value))}>
                        {NUM_QUESTIONS_OPTIONS.map(num => <option key={num} value={num}>{num}</option>)}
                    </select>
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="quizType">Question Type:</label>
                    <select id="quizType" value={quizType} onChange={(e) => setQuizType(e.target.value)}>
                        {QUESTION_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="difficulty">Difficulty Level: {DIFFICULTY_MAP_FRONTEND[difficulty]}</label>
                    <input type="range" id="difficulty" min="1" max="5" value={difficulty} onChange={(e) => setDifficulty(parseInt(e.target.value))} />
                </div>
                {currentUser && ( // Only show sharable option to logged-in users
                    <div className={styles.formGroup}>
                        <label className={styles.checkboxLabel}>
                            <input type="checkbox" checked={isSharable} onChange={(e) => setIsSharable(e.target.checked)} />
                            Make Sharable (Publicly accessible via link)
                        </label>
                    </div>
                )}
                <button type="submit" disabled={loading || !quizTopic.trim() || (!currentUser && guestUsageCount >= GUEST_QUIZ_LIMIT)} className={styles.generateButton}
style={loading ? { color: 'black', opacity: 1 } : {}}>
                    {loading ? 'Generating Quiz...' : 'Generate Quiz'}
                </button>
            </form>

            {error && <p className={styles.errorText}>{error}</p>}

            {quizData && !quizSubmitted && (
                <div className={styles.quizDisplay}>
                    <h3>Quiz: {quizTopic}</h3>
                    <form onSubmit={handleSubmitQuiz}>
                        {quizData.map((q, qIndex) => (
                            <div key={qIndex} className={styles.questionItem}>
                                <p>{qIndex + 1}. <MarkdownRenderer content={q.question} /></p>
                                {q.options.map((option: string, oIndex: number) => (
                                    <div key={oIndex} className={styles.optionItem}>
                                        <label>
                                            <input type="radio" name={`question-${qIndex}`} value={option} checked={userAnswers[qIndex] === option} onChange={() => handleAnswerChange(qIndex, option)} />
                                            <MarkdownRenderer content={option} inline={true} />
                                        </label>
                                    </div>
                                ))}
                            </div>
                        ))}
                        <button type="submit" className={styles.submitQuizButton}>Submit & Grade</button>
                    </form>
                </div>
            )}

            {quizData && quizSubmitted && (
                <div className={styles.quizResults}>
                    <h3>Quiz Results: {quizTopic}</h3>
                    <p className={styles.quizResultsScore}>
                        You scored {quizScore}/{quizData.length} ({(quizScore / quizData.length * 100).toFixed(0)}%)
                    </p>
                    <h4 className={styles.answerKeyHeading}>Answer Key & Explanations</h4>
                    {quizData.map((q, qIndex) => (
                        <div key={qIndex} className={`${styles.answerItem} ${userAnswers[qIndex] === q.answer ? styles.correct : styles.incorrect}`}>
                            <p>{qIndex + 1}. <MarkdownRenderer content={q.question} /></p>
                            <p>Your Answer: <span className={userAnswers[qIndex] === q.answer ? styles.correctAnswer : styles.incorrectAnswer}><MarkdownRenderer content={userAnswers[qIndex] || '(No Answer)'} inline={true} /></span></p>
                            {userAnswers[qIndex] !== q.answer && <p className={styles.correctAnswer}>Correct Answer: <MarkdownRenderer content={q.answer} inline={true} /></p>}
                            <p><strong>Explanation:</strong></p>
                            <MarkdownRenderer content={q.explanation} />
                        </div>
                    ))}
                    <div className={styles.quizActions}>
                        {sharedQuizLink && (
    <div 
        className={styles.shareLinkContainer} 
        style={{
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: '20px',
            backgroundColor: '#f8f9fa',
            marginTop: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}
    >
        <p className={styles.shareMessageText}>{shareMessage}</p>
        <input 
            type="text" 
            value={sharedQuizLink} 
            readOnly 
            className={styles.shareLinkInput} 
            style={{
                width: '100%',
                padding: '10px',
                marginBottom: '15px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontSize: '14px',
                boxSizing: 'border-box' // Ensures padding doesn't break the width
            }} 
        />
        <button 
            onClick={handleCopyLink} 
            className={styles.copyLinkButton} 
            style={{
                backgroundColor: '#003366', // Dark Blue
                color: 'white',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold',
                width: '100%' // Optional: makes the button full width to match the input
            }}
        >
            Copy Message & Link
        </button>
    </div>

                        )}
                        <button 
                            type="button"
                            onClick={handleDownloadResultsDocx} 
                            className={styles.downloadButton}
                            disabled={!currentUser}
                            title={!currentUser ? "Login to download" : "Download Results as DOCX"}
                        >
                            Download Results as DOCX
                        </button>
                        <button 
                            type="button"
                            onClick={handleGetAIInsights}
                            disabled={!currentUser || aiInsightsLoading}
                            className={styles.newQuizButton} // Re-using existing button style
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
                        <button type="button" onClick={handleNewQuiz} className={styles.newQuizButton}>
                            Generate New Quiz
                        </button>
                    </div>
                </div>
            )}

            {!currentUser && (
                <div className={styles.guestMessage}>
                    <p>
                        {`You have used ${guestUsageCount} of ${GUEST_QUIZ_LIMIT} guest quizzes.`}
                        Please <a onClick={() => router.push('/login')}>Login</a> or <a onClick={() => router.push('/signup')}>Sign Up</a> for unlimited access.
                    </p>
                </div>
            )}
        </div>
    );
};

export default SmartQuizPage;
