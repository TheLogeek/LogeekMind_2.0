'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AuthService from '../../services/AuthService';
import axios, { AxiosError } from 'axios';
import styles from './CommunityChatPage.module.css';
import { useUser } from '../app/layout'; // Import useUser hook

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
    const { currentUser } = useUser(); // Use the global user context
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [selectedRoom, setSelectedRoom] = useState(CHAT_ROOMS[0]);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [typingUsers, setTypingUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Get username from the global context
    const username = currentUser?.username;

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const justSentMessage = useRef(false);

    const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    const fetchData = useCallback(async (isUserAction = false) => {
        if (!username) return;
        
        try {
            const accessToken = AuthService.getAccessToken();
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
        // Redirect if user is not logged in AFTER the initial check
        if (currentUser === null && !AuthService.getAccessToken()) { // Check for access token to avoid redirect during initial load
            router.push('/login');
            return;
        }

        if (username) { // Only fetch data if we have a username
            fetchData(); // Initial fetch
            const interval = setInterval(() => fetchData(), 5000); // Poll every 5 seconds

            return () => clearInterval(interval);
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
            const accessToken = AuthService.getAccessToken();
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
        if (!username) return;
        try {
            const accessToken = AuthService.getAccessToken();
            await axios.post(
                `${API_BASE_URL}/community-chat/typing-status`,
                { group_name: selectedRoom, is_typing: isTyping },
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
        } catch(err: unknown) {
            console.error("Failed to set typing status", err);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewMessage(e.target.value);
        
        // Typing indicator logic remains the same
    };

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
