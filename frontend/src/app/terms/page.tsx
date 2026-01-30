import React from 'react';

const TERMS_OF_SERVICE_HTML = `
<h1>LogeekMind Terms of Service</h1>
<p><strong>Effective Date: November 24, 2025</strong></p>
<hr>
<h2>1. Acceptance of Terms</h2>
<p>By accessing or using the LogeekMind web application ("the Service"), you agree to comply with these Terms of Service ("Terms"). If you do not agree, do not use the Service.</p>
<hr>
<h2>2. User Content & Ownership</h2>
<h3>2.1. Input Content</h3>
<p>You retain full ownership of:</p>
<ul>
<li>Audio files</li>
<li>Notes</li>
<li>Prompts</li>
<li>Any content you upload or submit ("Input Content")</li>
</ul>
<h3>2.2. Output Content</h3>
<p>You receive a <strong>royalty-free, perpetual, worldwide license</strong> to use the AI-generated content ("Output Content") strictly for <strong>personal, educational use</strong>.</p>
<h3>2.3. Non-Uniqueness of AI Output</h3>
<p>Because AI models generate probabilistic content, you acknowledge that Output Content may be similar or identical to that generated for other users.</p>
<hr>
<h2>3. Acceptable Use Policy</h2>
<p>You agree NOT to:</p>
<ul>
<li>Upload illegal, abusive, harmful, or infringing content</li>
<li>Attempt to hack, disrupt, or reverse engineer the Service</li>
<li>Use the AI-generated content for legal, medical, financial, or high-risk decision-making</li>
<li>Bypass usage limits or abuse the AI APIs</li>
</ul>
<hr>
<h2>4. AI Accuracy Disclaimer (Important)</h2>
<h3>4.1. Probabilistic Nature</h3>
<p>AI-generated content may contain errors, hallucinations, or inaccuracies. No output is guaranteed to be factual.</p>
<h3>4.2. No Professional Advice</h3>
<p>The Service provides educational assistance only. It is <strong>not</strong> a replacement for certified academic or professional guidance.</p>
<h3>4.3. User Responsibility</h3>
<p>You agree that you are responsible for verifying the accuracy and suitability of any generated output.</p>
<h3>4.4. Indemnification</h3>
<p>You agree to indemnify and hold LogeekMind harmless for any claims arising from misuse or reliance on AI-generated content.</p>
<h3>4.5. Third-Party AI Models</h3>
<p>LogeekMind utilizes advanced artificial intelligence models provided by third parties, specifically Groq Cloud (for features like AI Teacher, Course Outline Generator, Summarizer, Exam Simulator, and Smart Quiz Generator) and Google Gemini API (for the Homework Assistant). While these models are designed to provide accurate and helpful information, their responses are generated probabilistically and are subject to the limitations inherent in current AI technology. By using these features, you acknowledge and agree that:</p>
<ul>
    <li>Your input to these features (e.g., prompts, questions, uploaded content) may be processed by these third-party AI providers to generate the requested output.</li>
    <li>The privacy policies and terms of service of Groq Cloud and Google Gemini may apply to the data processed by their respective models. We encourage you to review their policies for more information on how they handle data.</li>
    <li>LogeekMind does not control the internal workings or algorithms of these third-party AI models and cannot guarantee the privacy or security of data once it is transmitted to them for processing. We transmit only the data necessary to fulfill your request.</li>
    <li>You are solely responsible for ensuring that any input content you provide does not violate any third-party rights or applicable laws when processed by these AI models.</li>
</ul>
<hr>
<h2>5. Termination</h2>
<p>We may suspend or terminate access to the Service, without notice, for:</p>
<ul>
<li>Violation of these Terms</li>
<li>Abuse of the Service</li>
<li>Security or system integrity concerns</li>
</ul>
<hr>
<h2>6. Liability Disclaimer</h2>
<p>The Service is provided <strong>“AS IS”</strong> and <strong>“AS AVAILABLE.”</strong><br>To the extent permitted by law:</p>
<ul>
<li>LogeekMind disclaims all warranties</li>
<li>LogeekMind is not liable for indirect, incidental, or consequential damages</li>
<li>You use the Service at your own risk</li>
</ul>
<hr>
<h2>7. Modifications to Terms</h2>
<p>We may revise these Terms at any time. Continued use of the Service after changes are posted means you accept the updated Terms.</p>
<hr>
<p>Thank you for using LogeekMind. Your learning experience is important to us.</p>
`;

const TermsOfServicePage = () => {
    return (
        <div style={{ maxWidth: '800px', margin: '30px auto', padding: '20px', border: '1px solid #eee', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <div dangerouslySetInnerHTML={{ __html: TERMS_OF_SERVICE_HTML }} />
        </div>
    );
};

export default TermsOfServicePage;
