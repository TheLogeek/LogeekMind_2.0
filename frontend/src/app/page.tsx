'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import FeatureCard from '../components/FeatureCard';
import styles from './HomePage.module.css';
import AuthService from './../../services/AuthService'; // Import AuthService

interface Feature {
    icon: string;
    title: string;
    description: string;
    linkTo: string;
}

const HomePage = () => {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const featureSectionRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const fetchUser = async () => {
            const user = await AuthService.getCurrentUser();
            setCurrentUser(user);
        };
        fetchUser();
    }, []);

    const handleGetStartedClick = () => {
        if (currentUser) {
            // User is logged in, scroll to features
            if (featureSectionRef.current) {
                featureSectionRef.current.scrollIntoView({ behavior: 'smooth' });
            }
        } else {
            // User is a guest, redirect to signup
            router.push('/signup');
        }
    };

    const AI_LEARNING_FEATURES: Feature[] = [
        { icon: " ", title: "AI Teacher", description: "Get interactive explanations and practice on any topic.", linkTo: "/ai-teacher" },
        { icon: " ", title: "Smart Quiz Generator", description: "Create customized quizzes with instant feedback.", linkTo: "/smart-quiz" },
        { icon: " ", title: "Exam Simulator", description: "Prepare with simulated exams.", linkTo: "/exam-simulator" },
    ];

    const CONTENT_MASTERY_FEATURES: Feature[] = [
        { icon: " ", title: "Summarizer", description: "Summarize texts, PDFs, and documents instantly.", linkTo: "/summarizer" },
        { icon: " ", title: "Course Outline Generator", description: "Generate structured course syllabi and outlines.", linkTo: "/course-outline" },
        { icon: " ", title: "Audio to Text", description: "Transcribe lecture audio to text notes.", linkTo: "/audio-to-text" },
        { icon: " ", title: "Notes to Audio", description: "Convert your written notes into audio lectures.", linkTo: "/notes-to-audio" },
    ];

    const PLANNING_SOLVING_FEATURES: Feature[] = [
        { icon: " ", title: "Homework Assistant", description: "Get step-by-step solutions for homework problems.", linkTo: "/homework-assistant" },
        { icon: " ", title: "GPA Calculator", description: "Calculate your GPA with ease.", linkTo: "/gpa-calculator" },
        { icon: " ", title: "Study Scheduler", description: "Plan and organize your study time effectively.", linkTo: "/study-scheduler" },
    ];

    return (
        <div className={styles.homePageContainer}>
            {/* Hero Section */}
            <section className={styles.heroSection}>
                <h1>
                    Unlock Your Full Academic Potential
                </h1>
                <p>
                    LogeekMind: Your all-in-one AI-powered learning assistant. Understand faster, study smarter, achieve better.
                </p>
                <div className={styles.heroButtons}>
                    <button
                        onClick={handleGetStartedClick}
                        className={styles.heroButtonPrimary}
                    >
                        Get Started - It's Free!
                    </button>
                    <button
                        onClick={() => router.push('/ai-teacher')} // Use router.push
                        className={styles.heroButtonSecondary}
                    >
                        Explore Features
                    </button>
                </div>
            </section>

            {/* Feature Sections */}
            <section className={styles.featureSections} ref={featureSectionRef}>
                <h2 className={styles.featureSectionTitle}> Powering Your Learning Journey</h2>

                <div className={styles.featureCategory}>
                    <h3>AI Learning</h3>
                    <div className={styles.featureCardGrid}>
                        {AI_LEARNING_FEATURES.map((feature: Feature, index: number) => ( // Added types
                            <div key={index} className={styles.featureCardWrapper}>
                                <FeatureCard {...feature} />
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.featureCategory}>
                    <h3>Content Mastery</h3>
                    <div className={styles.featureCardGrid}>
                        {CONTENT_MASTERY_FEATURES.map((feature: Feature, index: number) => ( // Added types
                            <div key={index} className={styles.featureCardWrapper}>
                                <FeatureCard {...feature} />
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.featureCategory}>
                    <h3>Planning & Solving</h3>
                    <div className={styles.featureCardGrid}>
                        {PLANNING_SOLVING_FEATURES.map((feature: Feature, index: number) => ( // Added types
                           <div key={index} className={styles.featureCardWrapper}>
                                <FeatureCard {...feature} />
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* General CTA Section */}
            <section className={styles.ctaSection}>
                <h2>Ready to Supercharge Your Studies?</h2>
                <p>
                    Join other students who are learning smarter, not harder, with LogeekMind.
                </p>
                <div className={styles.docLinkContainer}>
                    <a href="https://thelogeek.github.io/LogeekMind" target="_blank" rel="noopener noreferrer"
                       className={styles.docLink}>
                        View LogeekMind Full Documentation Here!
                    </a>
                </div>
                <button
                    onClick={handleGetStartedClick}
                    className={styles.ctaButton}
                >
                    Start Your Free Journey Now!
                </button>
            </section>

            {/* Footer */}
            <footer className={styles.footer}>
                <div className={styles.footerLinks}>
                    <Link href="/privacy-policy" className={styles.footerLink}>Privacy Policy</Link>
                    <Link href="/terms" className={styles.footerLink}>Terms of Service</Link>
                    <Link href="/contact" className={styles.footerLink}>Contact Us</Link>
                </div>
                <p className={styles.footerInfo}>©️ 2026 <span className={styles.footerCopyrightBrand}>LogeekMind</span>.</p>
            </footer>
        </div>
    );
};

export default HomePage;