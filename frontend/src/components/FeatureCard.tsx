'use client';

import React from 'react';
import { useRouter } from 'next/navigation'; // Use useRouter from next/navigation
import styles from './FeatureCard.module.css'; // Import the CSS Module

interface FeatureCardProps {
    icon: React.ReactNode; // Type for icon can be more specific if needed
    title: string;
    description: string;
    linkTo?: string; // linkTo is optional
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description, linkTo }) => {
    const router = useRouter();

    const handleClick = () => {
        if (linkTo) {
            router.push(linkTo);
        }
    };

    return (
        <div className={styles.featureCard}>
            <button type="button" onClick={handleClick} className={styles.transparentButton} aria-label={title}></button>
            <div className={styles.featureIcon}>{icon}</div>
            <h4 className={styles.featureTitle}>{title}</h4>
            <p className={styles.featureDescription}>{description}</p>
        </div>
    );
};

export default FeatureCard;
