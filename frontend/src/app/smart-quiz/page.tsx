'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Use useRouter from next/navigation
import AuthService from '../../services/AuthService'; // Adjust path
import axios, { AxiosError } from 'axios';
import MarkdownRenderer from '../../components/MarkdownRenderer'; // Adjust path relative to app/smart-quiz/page.tsx
import ApiKeyInput from '../../components/ApiKeyInput'; // Adjust path relative to app/smart-quiz/page.tsx
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
    const [quizData, setQuizData] = useState<any[] | null>(null); // Added type
    const [userAnswers, setUserAnswers] = useState<{ [key: number]: string }>({}); // Added type
    const [quizSubmitted, setQuizSubmitted] = useState(false);
    const [quizScore, setQuizScore] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Guard localStorage access for client-side only
    const [currentUser, setCurrentUser] = useState(
        typeof window !== 'undefined' ? AuthService.getCurrentUser() : null
    );

    const GUEST_QUIZ_LIMIT = 1;
    const GUEST_USAGE_KEY = 'smart_quiz_guest_usage';
    const [guestUsageCount, setGuestUsageCount] = useState(() => {
        return typeof window !== 'undefined' ? parseInt(localStorage.getItem(GUEST_USAGE_KEY) || '0', 10) : 0;
    });

    const [userGeminiApiKey, setUserGeminiApiKey] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Restore inputs
            const savedInputs = sessionStorage.getItem('smart_quiz_inputs');
            if (savedInputs) {
                const { quizTopic, numQuestions, quizType, difficulty } = JSON.parse(savedInputs);
                setQuizTopic(quizTopic || '');
                setNumQuestions(numQuestions || NUM_QUESTIONS_OPTIONS[0]);
                setQuizType(quizType || QUESTION_TYPES[0]);
                setDifficulty(difficulty || 3);
            }

            // Restore quiz data and user answers
            const savedQuizData = sessionStorage.getItem('smart_quiz_data');
            const savedUserAnswers = sessionStorage.getItem('smart_quiz_userAnswers');
            const savedQuizSubmitted = sessionStorage.getItem('smart_quiz_submitted');
            const savedQuizScore = sessionStorage.getItem('smart_quiz_score');

            if (savedQuizData) {
                setQuizData(JSON.parse(savedQuizData));
            }
            if (savedUserAnswers) {
                setUserAnswers(JSON.parse(savedUserAnswers));
            }
            if (savedQuizSubmitted === 'true') {
                setQuizSubmitted(true);
            }
            if (savedQuizScore) {
                setQuizScore(parseInt(savedQuizScore, 10));
            }
        }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(GUEST_USAGE_KEY, guestUsageCount.toString());
            if (!currentUser && guestUsageCount >= GUEST_QUIZ_LIMIT) {
                setError(`You have reached the guest limit of ${GUEST_QUIZ_LIMIT} quizzes. Please login or sign up for unlimited access.`);
            } else {
                setError('');
            }
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
        if (!currentUser && typeof window !== 'undefined') {
            setGuestUsageCount(prev => prev + 1);
        }
    };

    const handleGenerateQuiz = async (e: React.FormEvent<HTMLFormElement>) => { // Added type
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
                gemini_api_key: userGeminiApiKey || null,
            }, { headers });

            if (response.data.success && response.data.quiz_data) {
                setQuizData(response.data.quiz_data);
                incrementGuestUsage();
                // Save state to sessionStorage
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem('smart_quiz_data', JSON.stringify(response.data.quiz_data));
                    const inputs = { quizTopic, numQuestions, quizType, difficulty };
                    sessionStorage.setItem('smart_quiz_inputs', JSON.stringify(inputs));
                }
            } else {
                setError(response.data.message || 'Failed to generate quiz.');
            }
        } catch (err: unknown) { // Explicitly type err as unknown
            if (axios.isAxiosError(err)) {
                console.error('Quiz generation error:', err.response?.data || err);
                setError(err.response?.data?.detail || 'Failed to generate quiz.');
            } else {
                console.error('Quiz generation error:', err);
                setError('An unexpected error occurred during quiz generation.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerChange = (questionIndex: number, selectedOption: string) => { // Added type
        setUserAnswers(prevAnswers => ({
            ...prevAnswers,
            [questionIndex]: selectedOption
        }));
    };

    const handleSubmitQuiz = async (e: React.FormEvent<HTMLFormElement>) => { // Added type
        e.preventDefault();
        let score = 0;
        quizData?.forEach((q, index) => { // Added optional chaining
            if (userAnswers[index] === q.answer) {
                score++;
            }
        });
        setQuizScore(score);
        setQuizSubmitted(true);

        if (typeof window !== 'undefined') {
            sessionStorage.setItem('smart_quiz_userAnswers', JSON.stringify(userAnswers));
            sessionStorage.setItem('smart_quiz_score', score.toString());
            sessionStorage.setItem('smart_quiz_submitted', 'true');
        }

        if (currentUser && quizData) { // Check quizData
            try {
                const accessToken = AuthService.getAccessToken();
                const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
                await axios.post(`${API_BASE_URL}/smart-quiz/log-performance`, {
                    score: score,
                    total_questions: quizData.length,
                    correct_answers: score,
                    extra: {
                        topic: quizTopic,
                        difficulty: difficulty,
                        quiz_type: quizType,
                    }
                }, { headers });
            } catch (err: unknown) { // Explicitly type err as unknown
                if (axios.isAxiosError(err)) {
                    console.error('Error logging quiz performance:', err.response?.data || err);
                } else {
                    console.error('Error logging quiz performance:', err);
                }
            }
        }
    };

    const handleDownloadResultsDocx = async () => {
        if (!quizData || !quizSubmitted || !currentUser || typeof window === 'undefined') return;

        try {
            const accessToken = AuthService.getAccessToken();
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

            const formData = new FormData();
            formData.append('quizDataJson', JSON.stringify(quizData));
            formData.append('quiz_topic', quizTopic);
            formData.append('user_score', quizScore.toString()); // Convert to string
            formData.append('total_questions', quizData.length.toString()); // Convert to string

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
        } catch (err: unknown) { // Explicitly type err as unknown
            if (axios.isAxiosError(err)) {
                console.error('Error downloading DOCX:', err.response?.data || err);
                setError(err.response?.data?.detail || 'Failed to download DOCX.');
            } else {
                console.error('Error downloading DOCX:', err);
                setError('An unexpected error occurred while downloading DOCX.');
            }
        }
    };

    const handleNewQuiz = () => {
        setQuizData(null);
        setQuizSubmitted(false);
        setQuizScore(0);
        setUserAnswers({});
        setError('');
        // Clear sessionStorage
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem('smart_quiz_data');
            sessionStorage.removeItem('smart_quiz_inputs');
            sessionStorage.removeItem('smart_quiz_userAnswers');
            sessionStorage.removeItem('smart_quiz_score');
            sessionStorage.removeItem('smart_quiz_submitted');
        }
    };

    const handleResetGuestUsage = () => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(GUEST_USAGE_KEY, '0');
            setGuestUsageCount(0);
        }
    };

    return (
        <div className={`page-container ${styles.smartQuizPageContainer}`}>
            <h2>❓ Smart Quiz Generator</h2>
            <p>Generate interactive quizzes with instant grading and explanations.</p>

            <ApiKeyInput
                userApiKey={userGeminiApiKey}
                setUserApiKey={setUserGeminiApiKey}
            />

            <form onSubmit={handleGenerateQuiz} className={styles.quizForm}>
                <div className={styles.formGroup}>
                    <label htmlFor="quizTopic">Topic to Quiz on:</label>
                    <input
                        type="text"
                        id="quizTopic"
                        value={quizTopic}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuizTopic(e.target.value)}
                        placeholder="e.g., Newton's Laws of Motion"
                        required
                    />
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="numQuestions">Number of Questions:</label>
                    <select
                        id="numQuestions"
                        value={numQuestions}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNumQuestions(parseInt(e.target.value))}
                    >
                        {NUM_QUESTIONS_OPTIONS.map(num => <option key={num} value={num}>{num}</option>)}
                    </select>
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="quizType">Question Type:</label>
                    <select
                        id="quizType"
                        value={quizType}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setQuizType(e.target.value)}
                    >
                        {QUESTION_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="difficulty">Difficulty Level: {DIFFICULTY_MAP_FRONTEND[difficulty]}</label>
                    <input
                        type="range"
                        id="difficulty"
                        min="1"
                        max="5"
                        value={difficulty}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDifficulty(parseInt(e.target.value))}
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading || !quizTopic.trim() || (!currentUser && guestUsageCount >= GUEST_QUIZ_LIMIT)}
                    className={styles.generateButton}
                >
                    {loading ? 'Generating Quiz...' : 'Generate Quiz'}
                </button>
            </form>

            {error && <p className={styles.errorText}>{error}</p>}

            {quizData && !quizSubmitted && (
                <div className={styles.quizDisplay}>
                    <h3>📝 Quiz: {quizTopic}</h3>
                    <form onSubmit={handleSubmitQuiz}>
                        {quizData.map((q, qIndex) => (
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
                        <button
                            type="submit"
                            className={styles.submitQuizButton}
                        >
                            Submit & Grade
                        </button>
                    </form>
                </div>
            )}

            {quizData && quizSubmitted && (
                <div className={styles.quizResults}>
                    <h3>Quiz Results: {quizTopic}</h3>
                    <p className={styles.quizResultsScore}>
                        You scored {quizScore}/{quizData.length} ({(quizScore / quizData.length * 100).toFixed(0)}%)
                    </p>

                    <h4 className={styles.answerKeyHeading}>🔍 Answer Key & Explanations</h4>
                    {quizData.map((q, qIndex) => (
                        <div key={qIndex} className={`${styles.answerItem} ${userAnswers[qIndex] === q.answer ? styles.correct : styles.incorrect}`}>
                            <p>{qIndex + 1}. <MarkdownRenderer content={q.question} /></p>
                            <p>Your Answer: <span className={userAnswers[qIndex] === q.answer ? styles.correctAnswer : styles.incorrectAnswer}><MarkdownRenderer content={userAnswers[qIndex] || '(No Answer)'} inline={true} /></span></p>
                            {userAnswers[qIndex] !== q.answer && (
                                <p className={styles.correctAnswer}>Correct Answer: <MarkdownRenderer content={q.answer} inline={true} /></p>
                            )}
                            <p><strong>Explanation:</strong></p>
                            <MarkdownRenderer content={q.explanation} />
                        </div>
                    ))}
                    <div className={styles.quizActions}>
                        <button 
                            type="button" // Added type to prevent form submission
                            onClick={handleDownloadResultsDocx} 
                            className={styles.downloadButton}
                            disabled={!currentUser}
                            title={!currentUser ? "Login to download" : "Download Results as DOCX"}
                        >
                            Download Results as DOCX
                        </button>
                        <button 
                            type="button" // Added type to prevent form submission
                            onClick={handleNewQuiz} 
                            className={styles.newQuizButton}
                        >
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
                    {guestUsageCount > 0 && (
                        <button 
                            type="button" // Added type to prevent form submission
                            onClick={handleResetGuestUsage} 
                            className="debug-button"
                        >
                            Reset Guest Usage (DEBUG)
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default SmartQuizPage;
