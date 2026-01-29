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
    const [isSharable, setIsSharable] = useState(false); // New state for sharable exam
    const [sharedExamLink, setSharedExamLink] = useState(''); // New state for shared link
    const [shareMessage, setShareMessage] = useState("Think you're ready for a challenge? I just took this exam on LogeekMind. Give it a try!"); // New state for share message

    // New state for question source selection
    const [selectedSource, setSelectedSource] = useState('topic'); // 'topic' or 'notes'
    const [lectureNotesContent, setLectureNotesContent] = useState('');
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [fileName, setFileName] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
    const [aiInsightsError, setAiInsightsError] = useState('');
    const [aiInsightsContent, setAiInsightsContent] = useState('');

    const GUEST_EXAM_LIMIT = 1;
    const GUEST_USAGE_KEY = 'exam_simulator_guest_usage';
    const [guestUsageCount, setGuestUsageCount] = useState(() => {
        return typeof window !== 'undefined' ? parseInt(localStorage.getItem(GUEST_USAGE_KEY) || '0', 10) : 0;
    });

    // Function to handle file changes for lecture notes upload
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setUploadedFile(file);
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result && typeof e.target.result === 'string') {
                    setLectureNotesContent(e.target.result);
                } else {
                    setError("Could not read file content.");
                    setLectureNotesContent('');
                    setFileName('');
                }
            };
            reader.onerror = () => {
                setError("Error reading file.");
                setLectureNotesContent('');
                setFileName('');
            };
            // Read as text for TXT, PDF, DOCX content extraction handled by backend.
            // For PDF/DOCX, backend might need specific parsers. For now, assuming text extraction is primary.
            // If PDF/DOCX extraction on frontend is needed, FileReader needs to handle binary data appropriately.
            // For simplicity, let's assume reading as text is sufficient for now or backend handles binary.
            // If backend needs binary, the payload needs to change to FormData for file uploads.
            // Given backend expects string for lecture_notes_content, readAsText is appropriate.
            reader.readAsText(file); 
        } else {
            setUploadedFile(null);
            setFileName('');
            setLectureNotesContent('');
        }
    };

    const handleSubmitExam = async () => {
        setError('');
        setLoading(true);
        try {
            const accessToken = AuthService.getAccessToken();
            // Guest users don't submit results to backend for grading.
            // Their score is calculated client-side for immediate feedback.
            if (!currentUser || !accessToken) {
                const score = examData.reduce((acc, q, idx) => acc + (userAnswers[idx] === q.answer ? 1 : 0), 0);
                const [finalGrade, finalRemark] = calculateGradeFrontend(score, examData.length);
                setExamScore(score);
                setGrade(finalGrade);
                setRemark(finalRemark);
                setExamStage("finished");
                sessionStorage.setItem('exam_simulator_results', JSON.stringify({ examData, userAnswers, examScore: score, grade: finalGrade, remark: finalRemark, courseName, topic: selectedSource === 'notes' ? fileName : topic }));
                return;
            }

            const response = await axios.post(`${API_BASE_URL}/exam-simulator/submit-results`, {
                exam_data: examData,
                user_answers: userAnswers,
                course_name: courseName,
                topic: selectedSource === 'topic' ? topic : null, // Send topic if selected, else null
            }, { headers: { Authorization: `Bearer ${accessToken}` } });

            if (response.data.success) {
                setExamScore(response.data.score);
                setGrade(response.data.grade);
                setRemark(response.data.remark);
                setExamStage("finished");
                sessionStorage.setItem('exam_simulator_results', JSON.stringify({
                    examData, userAnswers, examScore: response.data.score, grade: response.data.grade, remark: response.data.remark, courseName, topic: selectedSource === 'topic' ? topic : fileName
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
    };

    useEffect(() => {
        const fetchUser = async () => {
            const user = await AuthService.getCurrentUser();
            setCurrentUser(user);
        };
        fetchUser();
        const savedInputs = sessionStorage.getItem('exam_simulator_inputs');
        if (savedInputs) {
            const { courseName, topic, numQuestions, durationMins, selectedSource, lectureNotesContent, fileName } = JSON.parse(savedInputs);
            setCourseName(courseName || '');
            setTopic(topic || '');
            setNumQuestions(numQuestions || 20);
            setDurationMins(durationMins || 10);
            setSelectedSource(selectedSource || 'topic');
            setLectureNotesContent(lectureNotesContent || '');
            setFileName(fileName || '');
            // If lecture notes were used, we can't fully restore the File object, but we have the content and name
        }
        const savedResults = sessionStorage.getItem('exam_simulator_results');
        if (savedResults) {
            const { examData, userAnswers, examScore, grade, remark, courseName, topic } = JSON.parse(savedResults);
            setExamData(examData || []);
            setUserAnswers(userAnswers || {});
            setExamScore(examScore || 0);
            setGrade(grade || '');
            setRemark(remark || '');
            setCourseName(courseName || ''); // Restore course name and topic/filename for results display
            setTopic(topic || ''); // This topic might be the original topic or the fileName if notes were used
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
        // Validate source input
        if (selectedSource === 'topic' && !topic?.trim()) {
             setError("Please enter a Topic.");
             return;
        }
        if (selectedSource === 'notes' && !lectureNotesContent.trim()) {
             setError("Please upload valid Lecture Notes.");
             return;
        }
        if (!checkGuestLimit()) return;

        setLoading(true);
        try {
            const accessToken = AuthService.getAccessToken();
            // No Authorization header needed for guest generation.
            // For logged-in users, it might be useful for backend logging/rate limiting, but not essential for generation itself.
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

            const payload: any = { // Use 'any' or a more specific type for flexibility
                course_name: courseName,
                num_questions: numQuestions,
                duration_mins: durationMins,
            };

            if (selectedSource === 'topic') {
                payload.topic = topic || null;
            } else { // selectedSource === 'notes'
                payload.lecture_notes_content = lectureNotesContent;
                payload.file_name = fileName; // Send file name for logging
            }
            payload.is_sharable = isSharable; // Pass the is_sharable flag
            
            // Removed Authorization header for guest generation consistency with backend adjustment.
            const requestHeaders = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

            const response = await axios.post(`${API_BASE_URL}/exam-simulator/generate`, payload, { headers: requestHeaders });

            if (response.data.success && response.data.exam_data) {
                setExamData(response.data.exam_data);
                setStartTime(Date.now());
                setRemainingSeconds(durationMins * 60);
                setExamStage("active");
                incrementGuestUsage();
                // If a share_id is returned, construct the shareable link
                if (response.data.share_id) {
                    setSharedExamLink(`${window.location.origin}/exam-simulator/shared/${response.data.share_id}`);
                } else {
                    setSharedExamLink('');
                }
                // Save inputs, including source selection and notes content/filename
                sessionStorage.setItem('exam_simulator_inputs', JSON.stringify({ courseName, topic: selectedSource === 'topic' ? topic : '', numQuestions, durationMins, selectedSource, lectureNotesContent, fileName }));
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
        // Ensure data exists, user is logged in, and exam is finished
        if (!examData.length || examStage !== "finished" || !currentUser) {
            setError('Please log in to download exam results.');
            return;
        }

        setLoading(true);
        try {
            const accessToken = AuthService.getAccessToken();
            // Auth header is needed for download if it's tied to user's premium/account status, but not strictly for downloading generated results. Let's keep it for now if current_user check passes.
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

            const formData = new FormData();
            formData.append('examDataJson', JSON.stringify(examData));
            formData.append('userAnswersJson', JSON.stringify(userAnswers));
            formData.append('score', examScore.toString());
            formData.append('total_questions', examData.length.toString());
            formData.append('grade', grade);
            formData.append('course_name', courseName);
            
            // Dynamically set 'topic' or indicate notes were used for logging/filename
            let topicForApi = ''; // Explicitly declare and initialize
            if (selectedSource === 'notes') {
                // Explicitly check for non-empty string fileName
                if (typeof fileName === 'string' && fileName.length > 0) { 
                    topicForApi = `Notes from ${fileName}`;
                } else {
                    // Fallback if selectedSource is 'notes' but fileName is missing (should not happen if validation is right)
                    topicForApi = 'Notes Uploaded (Details Missing)';
                }
            } else { // selectedSource === 'topic'
                topicForApi = topic || '';
            }
            formData.append('topic', topicForApi); // Append the determined topic value

            const response = await axios.post(`${API_BASE_URL}/exam-simulator/download-results-docx`, formData, {
                headers,
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            // Ensure filename is sanitized and unique using timestamp
            const sanitizedCourseName = courseName.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
            const fileNameForDownload = `${sanitizedCourseName}_Exam_Results_${Date.now()}.docx`;
            a.download = fileNameForDownload;
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

    const handleGetAIInsights = async () => {
        setAiInsightsLoading(true);
        setAiInsightsError('');
        setAiInsightsContent('');

        if (!examData.length || examStage !== "finished") {
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

            // Prepare exam context for AI analysis
            const examContext = examData.map((q, index) => ({
                question: q.question,
                correct_answer: q.answer,
                user_answer: userAnswers[index] || 'N/A', // User's answer for this question
                is_correct: (userAnswers[index] === q.answer)
            }));

            // Determine exam topic for AI request (use fileName if notes were uploaded, otherwise use topic input)
            const insightTopic = selectedSource === 'notes' && fileName ? `Notes from ${fileName}` : courseName + (topic ? ` - ${topic}` : '');

            const payload = {
                quiz_topic: insightTopic, // Using quiz_topic for generic topic field in backend
                quiz_data: examContext, // Using quiz_data for generic exam questions/answers in backend
                user_score: examScore,
                total_questions: examData.length,
            };

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
        setIsSharable(false); // Reset sharable state
        setSharedExamLink(''); // Clear shared link
        // Clear results, but keep inputs for easier re-take
        sessionStorage.removeItem('exam_simulator_results');
        // Also clear the inputs related to the last generation for a clean start
        sessionStorage.removeItem('exam_simulator_inputs');
    };

    const formatTime = (totalSeconds: number) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleCopyLink = () => {
        if (sharedExamLink && shareMessage) {
            const textToCopy = `${shareMessage}\n${sharedExamLink}`;
            navigator.clipboard.writeText(textToCopy)
                .then(() => {
                    alert('Message and link copied to clipboard!');
                })
                .catch(err => {
                    console.error('Failed to copy text: ', err);
                    alert('Failed to copy text.');
                });
        } else if (sharedExamLink) {
            navigator.clipboard.writeText(sharedExamLink)
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
        <div className={`page-container ${styles.examSimulatorPageContainer}`}>
            <h2>Exam Simulator</h2>
            <p>Prepare for your exams with customizable mock tests.</p>

            {error && <p className={styles.errorText}>{error}</p>}
            
            {examStage === "setup" && (
                <form onSubmit={handleGenerateExam} className={styles.examSetupForm}>
                    <div className={styles.formGroup}>
                        <label htmlFor="courseName">Course Name:</label>
                        <input type="text" id="courseName" value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="e.g., Introduction to Computer Science" required />
                    </div>

                    {/* Source Selection Dropdown */}
                    <div className={styles.formGroup}>
                        <label htmlFor="sourceSelection">Question Source:</label>
                        <select id="sourceSelection" value={selectedSource} onChange={(e) => {
                            const newSource = e.target.value;
                            setSelectedSource(newSource);
                            // Reset inputs when source changes to avoid confusion
                            setTopic(''); 
                            setLectureNotesContent('');
                            setFileName('');
                            setUploadedFile(null);
                            setError(''); // Clear previous errors
                        }}>
                            <option value="topic">AI Generated (Topic)</option>
                            <option value="notes">Upload Lecture Notes</option>
                        </select>
                    </div>

                    {/* Conditional Rendering for Topic Input or Notes File Upload */}
                    {selectedSource === 'topic' && (
                        <div className={styles.formGroup}>
                            <label htmlFor="topic">Specific Topic (Enter "general" for general questions on the course):</label>
                            <input type="text" id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., Algorithms" />
                        </div>
                    )}

                    {selectedSource === 'notes' && (
                        <div className={styles.formGroup}>
                            <label htmlFor="lectureNotesFile">Upload Lecture Notes:</label>
                            <input type="file" id="lectureNotesFile" accept=".pdf,.txt,.docx" onChange={handleFileChange} />
                            {fileName && <p>Selected file: {fileName}</p>}
                        </div>
                    )}
                    
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
                    {currentUser && ( // Only show sharable option to logged-in users
                        <div className={styles.formGroup}>
                            <label className={styles.checkboxLabel}>
                                <input type="checkbox" checked={isSharable} onChange={(e) => setIsSharable(e.target.checked)} />
                                Make Sharable (Publicly accessible via link)
                            </label>
                        </div>
                    )}
                    <button type="submit" disabled={loading || !courseName.trim() || (selectedSource === 'topic' && !topic?.trim()) || (selectedSource === 'notes' && !lectureNotesContent.trim()) || (!currentUser && guestUsageCount >= GUEST_EXAM_LIMIT)} className={styles.startButton}>
                        {loading ? 'Preparing Exam...' : 'Start Exam'}
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
                    <button onClick={handleSubmitExam} disabled={loading} className={styles.submitExamButton}
style={loading ? { color: 'black', opacity: 1 } : {}}>
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
                    <h4 className={styles.correctionsSection}>Answer Key & Explanations</h4>
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
                        {sharedExamLink && (
                            <div className={styles.shareLinkContainer} style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px', backgroundColor: '#f8f9fa', marginTop: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
    <p className={styles.shareMessageText}>{shareMessage}</p>
    <input type="text" value={sharedExamLink} readOnly className={styles.shareLinkInput} style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '4px', border: '1px solid #ccc' }} />
    <button onClick={handleCopyLink} className={styles.copyLinkButton} style={{ backgroundColor: '#003366', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
        Copy Message & Link
    </button>
</div>

                        )}
                        <button onClick={handleDownloadResultsDocx} className={styles.downloadButton} disabled={!currentUser} title={!currentUser ? "Login to download" : "Download Results as DOCX"}>
                            Download Results as DOCX
                        </button>
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