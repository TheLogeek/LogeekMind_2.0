'use client';

import React from 'react';
import { useRouter } from 'next/navigation'; // Use useRouter from next/navigation
import AuthService from '../services/AuthService'; // Adjust path

const Header = () => {
    const router = useRouter();
    
    // Guard localStorage access for client-side only
    const currentUser = typeof window !== 'undefined' ? AuthService.getCurrentUser() : null;
    const userProfile = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("profile") || 'null') : null; // Explicitly type as null if not found

    const handleLogout = () => {
        AuthService.logout();
        router.push('/login');
    };

    const handleLoginClick = () => {
        router.push('/login');
    };

    const username = userProfile?.username || "Scholar";

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 30px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)',
            backgroundSize: '200% 200%',
            animation: 'gradientMove 6s ease infinite',
            color: 'white',
            boxShadow: '0px 8px 20px rgba(0,0,0,0.15)',
            marginBottom: '30px',
            fontFamily: "'Inter', sans-serif"
        }}>
            <div>
                <h1 style={{ fontSize: '40px', fontWeight: '800', marginBottom: '10px', margin: 0 }}>LogeekMind</h1>
                <p style={{ fontSize: '18px', opacity: '0.95', margin: 0 }}>Your all-in-one AI-powered learning assistant. Understand faster, study smarter, achieve better.</p>
            </div>
            <div style={{ textAlign: 'right' }}>
                {currentUser ? (
                    <>
                        <div style={{ fontSize: '18px', marginBottom: '10px' }}>👋 {username}</div>
                        <button
                            type="button" // Added type to prevent form submission
                            onClick={handleLogout}
                            style={{
                                padding: '8px 15px',
                                backgroundColor: 'transparent',
                                color: 'white',
                                border: '1px solid white',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                transition: 'background-color 0.3s ease'
                            }}
                            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            Log Out
                        </button>
                    </>
                ) : (
                    <>
                        <div style={{ fontSize: '18px', marginBottom: '10px' }}>Guest Mode</div>
                        <button
                            type="button" // Added type to prevent form submission
                            onClick={handleLoginClick}
                            style={{
                                padding: '8px 15px',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                transition: 'background-color 0.3s ease'
                            }}
                            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.backgroundColor = '#0056b3'}
                            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.backgroundColor = '#007bff'}
                        >
                            Login / Sign Up
                        </button>
                    </>
                )}
            </div>
            {/* Keyframes for gradientMove animation - add this to your global CSS or equivalent */}
            <style>{`
                @keyframes gradientMove {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
            `}</style>
        </div>
    );
};

export default Header;
