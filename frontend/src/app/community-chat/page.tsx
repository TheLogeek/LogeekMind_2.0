'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation'; // Use useRouter from next/navigation
import AuthService from '../../services/AuthService'; // Adjust path
import axios, { AxiosError } from 'axios';
import styles from './CommunityChatPage.module.css'; // Import the CSS Module

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
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [selectedRoom, setSelectedRoom] = useState(CHAT_ROOMS[0]);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [typingUsers, setTypingUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Guard localStorage access for client-side only
    const currentUser = typeof window !== 'undefined' ? AuthService.getCurrentUser() : null;
    const userProfile = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("profile") || 'null') : null;
    const username = userProfile?.username;

    const messagesEndRef = useRef<HTMLDivElement>(null); // Added type

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchData = useCallback(async () => {
        if (!username) return;
        
        try {
            const accessToken = AuthService.getAccessToken();
            const headers = { Authorization: `Bearer ${accessToken}` };
            
            // Using Promise.all to fetch data concurrently
            const [msgRes, onlineRes, typingRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/community-chat/messages/${selectedRoom}`, { headers }),
                axios.get(`${API_BASE_URL}/community-chat/online-users`, { headers }),
                axios.get(`${API_BASE_URL}/community-chat/typing-users/${selectedRoom}`, { headers }),
                axios.post(`${API_BASE_URL}/community-chat/presence`, {}, { headers }), // Also send presence ping
            ]);

            setMessages(msgRes.data.sort((a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())); // Added types
            setOnlineUsers(onlineRes.data);
            setTypingUsers(typingRes.data);

        } catch (err: unknown) { // Explicitly type err as unknown
            if (axios.isAxiosError(err)) {
                console.error('Chat data fetch error:', err.response?.data || err);
                setError('Could not refresh chat data.');
            } else {
                console.error('Chat data fetch error:', err);
                setError('Could not refresh chat data.');
            }
        }
    }, [selectedRoom, username]);

    useEffect(() => {
        if (!username) {
            router.push('/login'); // Use router.push
            return;
        }
        
        fetchData(); // Initial fetch
        const interval = setInterval(fetchData, 5000); // Poll every 5 seconds

        return () => clearInterval(interval); // Cleanup interval on unmount
    }, [router, username, fetchData]); // Added router and fetchData to dependency array

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => { // Added type
        e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            setLoading(true);
            const accessToken = AuthService.getAccessToken();
            await axios.post(
                `${API_BASE_URL}/community-chat/send-message`,
                { group_name: selectedRoom, message: newMessage },
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            setNewMessage('');
            await fetchData(); // Immediately fetch new messages after sending
        } catch (err: unknown) { // Explicitly type err as unknown
            if (axios.isAxiosError(err)) {
                console.error('Send message error:', err.response?.data || err);
                setError('Failed to send message.');
            } else {
                console.error('Send message error:', err);
                setError('Failed to send message.');
            }
        } finally {
            setLoading(false);
        }
    };
    
    // Typing indicator logic
    const isTypingTimeout = useRef<NodeJS.Timeout | null>(null); // Added type
    const handleTyping = async (isTyping: boolean) => { // Added type
        try {
            const accessToken = AuthService.getAccessToken();
            await axios.post(
                `${API_BASE_URL}/community-chat/typing-status`,
                { group_name: selectedRoom, is_typing: isTyping },
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
        } catch(err: unknown) { // Explicitly type err as unknown
            if (axios.isAxiosError(err)) {
                console.error("Failed to set typing status", err.response?.data || err);
            } else {
                console.error("Failed to set typing status", err);
            }
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { // Added type
        setNewMessage(e.target.value);
        
        // Clear previous timeout
        if (isTypingTimeout.current) {
            clearTimeout(isTypingTimeout.current);
        } else {
            // User started typing
            handleTyping(true);
        }

        // Set a new timeout to send `is_typing: false` after user stops typing
        isTypingTimeout.current = setTimeout(() => {
            handleTyping(false);
            isTypingTimeout.current = null;
        }, 3000); // 3 seconds of inactivity
    };

    return (
        <div className={`page-container ${styles.communityChatPageContainer}`}>
            {/* Main Chat Area */}
            <div className={styles.mainChatArea}>
                <h2>{selectedRoom}</h2>
                <div className={styles.messagesWindow}>
                    {messages.map((msg: Message) => ( // Added type
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
                        disabled={loading}
                    />
                    <button type="submit" className={styles.sendButton} disabled={loading}>
                        Send
                    </button>
                </form>
            </div>

            {/* Right Sidebar for Rooms and Users */}
            <div className={styles.rightSidebar}>
                <h3>Rooms</h3>
                {CHAT_ROOMS.map(room => (
                    <button 
                        key={room} 
                        onClick={() => setSelectedRoom(room)}
                        className={`${styles.roomButton} ${selectedRoom === room ? styles.active : ''}`}
                    >
                        # {room}
                    </button>
                ))}
                <h3>Online Users ({onlineUsers.length})</h3>
                {onlineUsers.map((user: string) => ( // Added type
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
