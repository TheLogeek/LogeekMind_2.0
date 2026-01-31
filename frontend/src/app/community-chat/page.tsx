'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AuthService from '../../services/AuthService';
import axios, { AxiosError } from 'axios';
import styles from './CommunityChatPage.module.css';
import { useUser } from '../layout'; // Import useUser hook

interface Message {
    id: string;
    username: string;
    message: string;
    created_at: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const CHAT_ROOMS = ["General Lobby", "Homework Help", "Exam Prep", "Chill Zone"];

const CommunityChatPage = () => {
    const router = useRouter();
    const { currentUser } = useUser();
    const [isAuthenticating, setIsAuthenticating] = useState(true); // New loading state for auth
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [selectedRoom, setSelectedRoom] = useState(CHAT_ROOMS[0]);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [typingUsers, setTypingUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const username = currentUser?.profile?.username;

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const justSentMessage = useRef(false);

    const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    const fetchData = useCallback(async (isUserAction = false) => {
        if (!username) return;
        
        try {
            const accessToken = await AuthService.getAccessToken();
            const headers = { Authorization: `Bearer ${accessToken}` };
            
            const [msgRes, onlineRes, typingRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/community-chat/messages/${selectedRoom}`, { headers }),
                axios.get(`${API_BASE_URL}/community-chat/online-users`, { headers }),
                axios.get(`${API_BASE_URL}/community-chat/typing-users/${selectedRoom}`, { headers }),
                !isUserAction ? axios.post(`${API_BASE_URL}/community-chat/presence`, {}, { headers }) : Promise.resolve(),
            ]);

            setMessages(msgRes.data.sort((a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
            setOnlineUsers(onlineRes.data);
            setTypingUsers(typingRes.data);

        } catch (err: unknown) {
            const axiosError = err as AxiosError<any>;
            console.error('Chat data fetch error:', axiosError.response?.data || axiosError);
            setError('Could not refresh chat data.');
        }
    }, [selectedRoom, username]);

    useEffect(() => {
        // This effect now handles the authentication check and data fetching lifecycle
        if (currentUser !== undefined) { // Wait until currentUser is initialized (not undefined)
            if (currentUser === null) {
                // If user is explicitly null (not just uninitialized), redirect to login
                router.push('/login');
            } else {
                // User is authenticated, proceed with data fetching
                setIsAuthenticating(false);
                if (username) {
                    fetchData(); // Initial fetch
                    const interval = setInterval(() => fetchData(), 5000); // Poll every 5 seconds
                    return () => clearInterval(interval);
                }
            }
        }
    }, [currentUser, username, router, fetchData]); // Depend on currentUser and username

    useEffect(() => {
        // Only scroll to bottom if the user just sent a message
        if (justSentMessage.current) {
            scrollToBottom('auto');
            justSentMessage.current = false;
        }
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!newMessage.trim() || !username) return;

        try {
            setLoading(true);
            const accessToken = await AuthService.getAccessToken();
            await axios.post(
                `${API_BASE_URL}/community-chat/send-message`,
                { group_name: selectedRoom, message: newMessage },
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            setNewMessage('');
            justSentMessage.current = true;
            await fetchData(true);
        } catch (err: unknown) {
            const axiosError = err as AxiosError<any>;
            console.error('Send message error:', axiosError.response?.data || axiosError);
            setError('Failed to send message.');
        } finally {
            setLoading(false);
        }
    };
    
    // Typing indicator logic
    const handleTyping = async (isTyping: boolean) => {
        // ... (implementation remains the same)
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewMessage(e.target.value);
        // ... (typing indicator logic remains the same)
    };

    // Render a loading state while authenticating
    if (isAuthenticating) {
        return <p className={`page-container`}>Authenticating...</p>;
    }

    return (
        <div className={`page-container ${styles.communityChatPageContainer}`}>
            <div className={styles.mainChatArea}>
                <h2>{selectedRoom}</h2>
                <div className={styles.messagesWindow}>
                    {messages.map((msg: Message) => (
                        <div key={msg.id} className={`${styles.messageItem} ${msg.username === username ? styles.messageUser : styles.messageOther}`}>
                            <span className={styles.messageUsername}>{msg.username}</span>
                            <div className={`${styles.messageContent} ${msg.username === username ? styles.user : styles.other}`}>
                                {msg.message}
                            </div>
                            <span className={styles.messageTimestamp}>{new Date(msg.created_at).toLocaleTimeString()}</span>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                {typingUsers.length > 0 && <div className={styles.typingIndicator}>{typingUsers.join(', ')} typing...</div>}
                <form onSubmit={handleSendMessage} className={styles.chatForm}>
                    <input
                        type="text"
                        value={newMessage}
                        onChange={handleInputChange}
                        placeholder="Say something..."
                        className={styles.chatInput}
                        disabled={loading || !currentUser}
                    />
                    <button type="submit" className={styles.sendButton} disabled={loading || !currentUser}>
                        Send
                    </button>
                </form>
            </div>

            <div className={styles.rightSidebar}>
                <h3>Rooms</h3>
                {CHAT_ROOMS.map(room => (
                    <button 
                        key={room} 
                        onClick={() => setSelectedRoom(room)}
                        className={`${styles.roomButton} ${selectedRoom === room ? styles.active : ''}`}
                    >
                        {room}
                    </button>
                ))}
                <h3>Online Users ({onlineUsers.length})</h3>
                {onlineUsers.map((user: string) => (
                    <div key={user} className={styles.onlineUserTag}>
                        {user}
                    </div>
                ))}
                {error && <p className={styles.errorText}>{error}</p>}
            </div>
        </div>
    );
};

export default CommunityChatPage;