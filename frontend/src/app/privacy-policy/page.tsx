import React from 'react';

const PRIVACY_POLICY_CONTENT_HTML = `
<h1>LogeekMind Privacy Policy</h1>
<p><strong>Effective Date: November 24, 2025</strong></p>
<hr>
<h2>2. Information We Collect</h2>
<p>We collect information in two ways: (1) information you actively submit, and (2) information gathered automatically through usage.</p>
<h3>2.1. Submitted Content</h3>
<p>This includes:</p>
<ul>
<li>Audio files you upload</li>
<li>Transcribed text</li>
<li>Chat prompts</li>
<li>Quizzes, flashcards, notes, or summaries generated using the Service</li>
</ul>
<h3>2.2. Usage Data</h3>
<p>This includes:</p>
<ul>
<li>IP address</li>
<li>Device and browser type</li>
<li>Operating system</li>
<li>Pages visited, time spent, and activity logs</li>
<li>Diagnostic and crash data</li>
</ul>
<h3>2.3. Account Information</h3>
<p>(Only applies when login is enabled)</p>
<ul>
<li>Email address used for authentication</li>
<li>Any additional registration information required by Supabase</li>
</ul>
<hr>
<h2>3. How Your Information Is Used</h2>
<p>We use your information to:</p>
<ul>
<li>Provide and improve the Service</li>
<li>Generate quizzes, summaries, transcripts, and similar features</li>
<li>Maintain system performance and prevent abuse</li>
<li>Personalize your experience, such as saving your progress (when logged in)</li>
<li>Monitor security and comply with legal obligations</li>
</ul>
<hr>
<h2>4. Sharing of Data with Third Parties</h2>
<p>To deliver core features, your Submitted Content may be shared <em>only</em> with trusted third-party providers:</p>
<h3>4.1. AI Processing</h3>
<ul>
    <li><strong>Groq Cloud</strong> &rarr; for text generation (quizzes, exam questions, summaries, explanations) for AI Teacher, Course Outline Generator, Summarizer, Exam Simulator, and Smart Quiz Generator.</li>
    <li><strong>Gemini API (Google)</strong> &rarr; for text and image-based interactions for the Homework Assistant.</li>
    <li><strong>Whisper API (OpenAI)</strong> &rarr; for audio-to-text transcription.</li>
    <li><strong>gTTS</strong> &rarr; for generating voice output.</li>
</ul><h3>4.2. Storage & Authentication</h3>
<ul>
<li><strong>Supabase</strong> &rarr; stores your account data and optional saved content</li>
</ul>
<p><strong>Important:</strong><br>By using the Service, you consent to your Submitted Content being transmitted to these third-party services <strong>solely</strong> to fulfill your requests.</p>
<hr>
<h2>5. Data Security & Retention</h2>
<ul>
<li>All data is transmitted over <strong>encrypted HTTPS connections</strong></li>
<li>Submitted Content is stored only as long as necessary to provide the Service</li>
<li>Account data is retained while your account remains active</li>
<li>We periodically delete old or inactive temporary processing files</li>
</ul>
<hr>
<h2>6. Your Rights</h2>
<p>You may request:</p>
<ul>
<li>Access to your data</li>
<li>Correction of inaccurate data</li>
<li>Deletion of your data</li>
</ul>
<p>To exercise these rights, contact: <strong>solomonadenuga8@gmail.com</strong></p>
<hr>
<h2>7. Changes to This Policy</h2>
<p>We may update this Privacy Policy as the Service evolves. Continued use of LogeekMind after updates constitutes acceptance of the new terms.</p>
<hr>
<p>If you have questions about your privacy, please reach out to us at the email above.</p>
`;

const PrivacyPolicyPage = () => {
    return (
        <div style={{ maxWidth: '800px', margin: '30px auto', padding: '20px', border: '1px solid #eee', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <div dangerouslySetInnerHTML={{ __html: PRIVACY_POLICY_CONTENT_HTML }} />
        </div>
    );
};

export default PrivacyPolicyPage;
