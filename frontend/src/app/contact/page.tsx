'use client';

import React from 'react';
import styles from './ContactPage.module.css'; // Import the CSS Module

const ContactPage = () => {
    return (
        <div className={`page-container ${styles.contactPageContainer}`}>
            <h2 className={styles.heading}>Contact LogeekMind Support</h2>
            <p className={styles.description}>
                We're here to help! Whether you have a question, feedback, or need technical assistance, please don't hesitate to reach out.
            </p>

            <div className={styles.contactInfoGrid}>
                <div className={styles.contactInfoCard}>
                    <h3 className={styles.cardTitle}>General Inquiries</h3>
                    <p className={styles.cardText}><strong>Email:</strong> <a href="mailto:solomonadenuga8@gmail.com" className={styles.cardLink}>solomonadenuga8@gmail.com</a></p>
                    <p className={styles.cardText}><strong>WhatsApp:</strong> +2348023710562</p>
                    <span className={styles.cardNote}>
                        For general questions, partnerships, or business inquiries.
                    </span>
                </div>
                <div className={styles.contactInfoCard}>
                    <h3 className={styles.cardTitle}>Technical Support</h3>
                    <p className={styles.cardText}><strong>Email:</strong> <a href="mailto:logeekmind@gmail.com" className={styles.cardLink}>logeekmind@gmail.com</a></p>
                    <p className={styles.cardText}><strong>WhatsApp:</strong> +2348023710562</p>
                    <span className={styles.cardNote}>
                        Experiencing an issue? Report bugs or request technical assistance here.
                    </span>
                </div>
            </div>

            <h3 className={styles.messageFormHeading}>Send Us a Message</h3>
            <form className={styles.messageForm}>
                <div className={styles.formGroup}>
                    <label htmlFor="name" className={styles.formLabel}>Your Name:</label>
                    <input type="text" id="name" name="name" className={styles.formInput} placeholder="John Doe" />
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="email" className={styles.formLabel}>Your Email:</label>
                    <input type="email" id="email" name="email" className={styles.formInput} placeholder="your.email@example.com" />
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="subject" className={styles.formLabel}>Subject:</label>
                    <input type="text" id="subject" name="subject" className={styles.formInput} placeholder="Regarding LogeekMind Feature" />
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="message" className={styles.formLabel}>Message:</label>
                    <textarea id="message" name="message" rows={6} className={styles.formInput} placeholder="Type your message here..."></textarea>
                </div>
                <button type="submit" className={styles.submitButton}>
                    Send Message
                </button>
            </form>
        </div>
    );
};

export default ContactPage;
