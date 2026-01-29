'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AuthService from '../../services/AuthService';
import axios, { AxiosError } from 'axios';
import MarkdownRenderer from '../../components/MarkdownRenderer';
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

    const GUEST_AI_TEACHER_LIMIT = 2; // Adjusted limit
    const GUEST_USAGE_KEY = 'ai_teacher_guest_usage';
    const [guestUsageCount, setGuestUsageCount] = useState(() => {
        return typeof window !== 'undefined' ? parseInt(localStorage.getItem(GUEST_USAGE_KEY) || '0', 10) : 0;
    });

    useEffect(() => {
        const fetchUser = async () => {
            const user = await AuthService.getCurrentUser();
            setCurrentUser(user);
        };
        fetchUser();
        const savedMessages = sessionStorage.getItem('ai_teacher_messages');
        if (savedMessages) {
            setMessages(JSON.parse(savedMessages));
        }
    }, []);

    useEffect(() => {
        if (messages.length > 0) {
            sessionStorage.setItem('ai_teacher_messages', JSON.stringify(messages));
        } else {
            sessionStorage.removeItem('ai_teacher_messages');
        }
    }, [messages]);


    useEffect(() => {
        localStorage.setItem(GUEST_USAGE_KEY, guestUsageCount.toString());
        if (!currentUser && guestUsageCount >= GUEST_AI_TEACHER_LIMIT) {
            setError(`You have reached the guest limit of ${GUEST_AI_TEACHER_LIMIT} AI Teacher sessions. Please login or sign up for unlimited access.`);
        } else {
            setError('');
        }
    }, [guestUsageCount, currentUser]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const checkGuestLimit = () => {
        if (currentUser) return true;
        if (guestUsageCount >= GUEST_AI_TEACHER_LIMIT) {
            setError(`You have reached the guest limit of ${GUEST_AI_TEACHER_LIMIT} AI Teacher sessions. Please login or sign up for unlimited access.`);
            return false;
        }
        return true;
    };

    const incrementGuestUsage = () => {
        if (!currentUser) {
            setGuestUsageCount(prev => prev + 1);
        }
    };

    const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!inputPrompt.trim() || loading || !checkGuestLimit()) return;

        setError('');
        setLoading(true);
        const userMessage: Message = { role: 'user', text: inputPrompt };
        const currentMessages = [...messages, userMessage];
        setMessages(currentMessages);
        setInputPrompt('');

        try {
            const accessToken = AuthService.getAccessToken();
            const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
            const response = await axios.post(`${API_BASE_URL}/ai-teacher/chat`, {
                current_prompt: userMessage.text,
                chat_history: currentMessages.map(m => ({ role: m.role, text: m.text })),
            }, { headers });

            if (response.data.success && response.data.ai_text) {
                setMessages(prev => [...prev, { role: 'model', text: response.data.ai_text } as Message]);
                incrementGuestUsage();
            } else {
                setError(response.data.message || 'Failed to get a response from AI Teacher.');
            }
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                const axiosError = err as AxiosError<any>;
                console.error('AI Teacher chat error:', axiosError.response?.data || axiosError);
                if (axiosError.response?.status === 429) {
                    // Rate limit error
                    setError(axiosError.response.data.detail || "You are making too many requests. Please try again shortly.");
                } else if (axiosError.response?.status === 503) {
                    // AI service unavailable
                    setError(axiosError.response.data.detail || "The AI service is currently unavailable. Please try again later.");
                } else {
                    setError(axiosError.response?.data?.detail || 'An error occurred during chat.');
                }
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
        sessionStorage.removeItem('ai_teacher_messages');
    };

    const handleDownloadNotes = () => {
        if (messages.length === 0) return;

        let formattedNotes = `# AI Teacher Session\n\n`;
        messages.forEach(msg => {
            // Strip Markdown from each message before adding to formattedNotes
            const plainText = msg.text
                .replace(/^#+\s/gm, '') // Remove ATX headings (e.g., # Heading)
                .replace(/(\*\*|__)(.*?)\1/g, '$2') // Remove bold (e.g., **bold**)
                .replace(/(\*|_)(.*?)\1/g, '$2') // Remove italics (e.g., *italic*)
                .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links (e.g., [text](url) -> text)
                .replace(/`{1,3}(.*?)`{1,3}/g, '$1') // Remove inline code (e.g., `code`)
                .replace(/^-+\s/gm, '') // Remove unordered list item markers (e.g., - item)
                .replace(/^\d+\.\s/gm, '') // Remove ordered list item markers (e.g., 1. item)
                .replace(/^>\s?/gm, '') // Remove blockquote markers (e.g., > text)
                .replace(/^-{3,}|^\*{3,}|^_{3,}/gm, '') // Remove horizontal rules (---, ***, ___)
                .replace(/\$\$.*?\$\$/g, '') // Remove block math $$...$$
                .replace(/\$.*?$/g, '') // Remove inline math $...$
                .replace(/\\(frac|sqrt|text|begin|end){.*?}/g, '') // Remove common LaTeX commands
                .replace(/\\(alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|omicron|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega)/g, '') // Remove common Greek letters
                .replace(/\s*\|.*\n/g, '') // Remove table rows (simple approach, might need refinement for complex tables)
                .replace(/\|.*-/g, '') // Remove table header separator line
                .replace(/\s{2,}/g, ' ') // Normalize multiple spaces
                .replace(/\n{2,}/g, '\n\n') // Normalize multiple newlines
                .trim();
            
            formattedNotes += `## ${msg.role === 'user' ? 'User' : 'AI Teacher'}:\n${plainText}\n\n`;
        });

        const blob = new Blob([formattedNotes], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai_teacher_session_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className={`page-container ${styles.aiTeacherPageContainer}`}>
            <h2>Your AI Teacher</h2>
            <p>Struggling with a topic? Ask your teacher anything!</p>

            <div className={styles.chatWindow}>
                {messages.length === 0 && !loading && (
                    <div className={styles.placeholder}>Start a conversation with your AI Teacher...</div>
                )}
                {messages.map((msg: Message, index) => (
                    <div key={index} className={`${styles.chatMessage} ${msg.role === 'user' ? styles.userMessage : styles.modelMessage}`}>
                        <MarkdownRenderer content={msg.text} />
                    </div>
                ))}
                {loading && <div className={`${styles.chatMessage} ${styles.modelMessage} ${styles.loading}`}>...</div>}
                <div ref={messagesEndRef} />
            </div>

            {error && <p className={styles.errorText}>{error}</p>}

            <form onSubmit={handleSendMessage} className={styles.chatForm}>
                <input
                    type="text"
                    value={inputPrompt}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputPrompt(e.target.value)}
                    placeholder="Ask your teacher a question..."
                    disabled={loading || (!currentUser && guestUsageCount >= GUEST_AI_TEACHER_LIMIT)}
                    className={styles.chatInput}
                />
                <button
                    type="submit"
                    disabled={loading || !inputPrompt.trim() || (!currentUser && guestUsageCount >= GUEST_AI_TEACHER_LIMIT)}
                    className={styles.sendButton}
style={loading ? { color: 'black', opacity: 1 } : {}}
                >
                    {loading ? 'Sending...' : 'Send'}
                </button>
            </form>

            <div className={styles.sessionActions}>
                <button
                    type="button"
                    onClick={handleDownloadNotes}
                    disabled={messages.length === 0 || !currentUser}
                    className={styles.downloadNotesButton}
                    title={!currentUser ? "Login to download notes" : ""}
                >
                    Download Notes
                </button>
                <button
                    type="button"
                    onClick={handleStartNewSession}
                    className={styles.newSessionButton}
                >
                    Start New Session
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