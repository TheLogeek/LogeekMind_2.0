'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AuthService from '../../services/AuthService';
import axios, { AxiosError } from 'axios';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import ApiKeyInput from '../../components/ApiKeyInput';
import styles from './AITeacherPage.module.css';

interface Message {
    role: 'user' | 'model';
    text: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const AITeacherPage = () => {
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputPrompt, setInputPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentUser, setCurrentUser] = useState<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const GUEST_AI_TEACHER_LIMIT = 1;
    const GUEST_USAGE_KEY = 'ai_teacher_guest_usage';
    const [guestUsageCount, setGuestUsageCount] = useState(() => {
        return typeof window !== 'undefined' ? parseInt(localStorage.getItem(GUEST_USAGE_KEY) || '0', 10) : 0;
    });

    const [userGeminiApiKey, setUserGeminiApiKey] = useState('');

    // Persistence: Restore messages on mount
    useEffect(() => {
        setCurrentUser(AuthService.getCurrentUser()); // Ensure currentUser is set early
        const savedMessages = sessionStorage.getItem('ai_teacher_messages');
        if (savedMessages) {
            setMessages(JSON.parse(savedMessages));
        }
    }, []);

    // Persistence: Save messages whenever they change
    useEffect(() => {
        if (messages.length > 0 && typeof window !== 'undefined') {
            sessionStorage.setItem('ai_teacher_messages', JSON.stringify(messages));
        } else if (messages.length === 0 && typeof window !== 'undefined') {
            // Clear sessionStorage if messages become empty (e.g., new session started)
            sessionStorage.removeItem('ai_teacher_messages');
        }
    }, [messages]);


    useEffect(() => {
        if (typeof window !== 'undefined') { // Guard window access
            localStorage.setItem(GUEST_USAGE_KEY, guestUsageCount.toString());
            if (!currentUser && guestUsageCount >= GUEST_AI_TEACHER_LIMIT) {
                setError(`You have reached the guest limit of ${GUEST_AI_TEACHER_LIMIT} AI Teacher sessions. Please login or sign up for unlimited access.`);
            } else {
                setError('');
            }
        }
    }, [guestUsageCount, currentUser]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]); // Scroll to bottom when messages change

    const checkGuestLimit = () => {
        if (currentUser) return true;
        if (guestUsageCount >= GUEST_AI_TEACHER_LIMIT) {
            setError(`You have reached the guest limit of ${GUEST_AI_TEACHER_LIMIT} AI Teacher sessions. Please login or sign up for unlimited access.`);
            return false;
        }
        return true;
    };

    const incrementGuestUsage = () => {
        if (!currentUser && typeof window !== 'undefined') {
            setGuestUsageCount(prev => prev + 1);
        }
    };

    const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!inputPrompt.trim() || loading || !checkGuestLimit()) return;

        setError('');
        setLoading(true);
        const userMessage: Message = { role: 'user', text: inputPrompt };
        setMessages(prev => [...prev, userMessage]);
        setInputPrompt('');

        try {
            const accessToken = AuthService.getAccessToken();
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
            const response = await axios.post(`${API_BASE_URL}/ai-teacher/chat`, {
                current_prompt: userMessage.text,
                chat_history: [...messages, userMessage].map(m => ({ role: m.role, text: m.text })),
                gemini_api_key: userGeminiApiKey || null,
            }, { headers });

            if (response.data.success && response.data.ai_text) {
                setMessages(prev => [...prev, { role: 'model', text: response.data.ai_text } as Message]);
                incrementGuestUsage();
            } else {
                setError(response.data.message || 'Failed to get a response from AI Teacher.');
            }
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                console.error('AI Teacher chat error:', err.response?.data || err);
                setError(err.response?.data?.detail || 'An error occurred during chat.');
            } else {
                console.error('AI Teacher chat error:', err);
                setError('An unexpected error occurred during chat.');
            }
        }
        finally {
            setLoading(false);
        }
    };

    const handleStartNewSession = () => {
        setMessages([]);
        setInputPrompt('');
        setError('');
        sessionStorage.removeItem('ai_teacher_messages'); // Clear stored messages
    };

    const handleDownloadNotes = () => {
        if (messages.length === 0) return;

        let formattedNotes = `# AI Teacher Session\n\n`;
        messages.forEach(msg => {
            formattedNotes += `## ${msg.role === 'user' ? 'User' : 'AI Teacher'}:\n${msg.text}\n\n`;
        });

        const blob = new Blob([formattedNotes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai_teacher_session_${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleResetGuestUsage = () => {
        localStorage.setItem(GUEST_USAGE_KEY, '0');
        setGuestUsageCount(0);
    };

    return (
        <div className={`page-container ${styles.aiTeacherPageContainer}`}>
            <h2>🧠 Your AI Teacher</h2>
            <p>Struggling with a topic? Ask your teacher anything!</p>

            <ApiKeyInput
                userApiKey={userGeminiApiKey}
                setUserApiKey={setUserGeminiApiKey}
            />

            <div className={styles.chatWindow}>
                {messages.length === 0 ? (
                    <p>Start a conversation with your AI Teacher...</p>
                ) : (
                    messages.map((msg: Message, index) => (
                        <div key={index} className={`${styles.chatMessage} ${msg.role === 'user' ? styles.userMessage : styles.modelMessage}`}>
                            {msg.role === 'user' ? (
                                <span>{msg.text}</span>
                            ) : (
                                <div><MarkdownRenderer content={msg.text} /></div>
                            )}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {error && <p className={styles.errorText}>{error}</p>}

            <form onSubmit={handleSendMessage} className={styles.chatForm}>
                <input
                    type="text"
                    value={inputPrompt}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputPrompt(e.target.value)}
                    placeholder="Ask your teacher a question..."
                    disabled={loading}
                    className={styles.chatInput}
                />
                <button
                    type="submit"
                    disabled={loading || !inputPrompt.trim() || (!currentUser && guestUsageCount >= GUEST_AI_TEACHER_LIMIT)}
                    className={styles.sendButton}
                >
                    {loading ? 'Sending...' : 'Send'}
                </button>
            </form>

            {/* Session Actions for New Session and Download */}
            <div className={styles.sessionActions}>
                <button
                    type="button"
                    onClick={handleDownloadNotes}
                    disabled={messages.length === 0 || !currentUser} // Disabled if no messages or not logged in
                    className={styles.downloadNotesButton}
                >
                    Download Notes
                </button>
                <button
                    type="button"
                    onClick={handleStartNewSession}
                    className={styles.newSessionButton}
                >
                    Start New Teaching Session
                </button>
            </div>

            {!currentUser && (
                <div className={styles.guestMessage}>
                    <p>
                        {`You have used ${guestUsageCount} of ${GUEST_AI_TEACHER_LIMIT} guest sessions.`}
                        Please <a onClick={() => router.push('/login')}>Login</a> or <a onClick={() => router.push('/signup')}>Sign Up</a> for unlimited access.
                    </p>

                </div>
            )}
        </div>
    );
};

export default AITeacherPage;