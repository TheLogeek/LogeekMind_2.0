'use client';

import React, { useState, useEffect } from 'react';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import Prism from 'prismjs';
import 'prismjs/themes/prism-okaidia.css'; // You can choose a different theme
// Import language syntaxes you need
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup'; // For HTML

interface MarkdownRendererProps {
    content: string;
    inline?: boolean; // Added inline prop as it was commented out in previous usage
}

const marked = new Marked(
    markedHighlight({
        langPrefix: 'language-',
        highlight(code, lang) {
            const language = Prism.languages[lang];
            if (language) {
                return Prism.highlight(code, language, lang);
            }
            return code;
        }
    })
);


const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, inline = false }) => {
    const [htmlContent, setHtmlContent] = useState('');

    useEffect(() => {
        const parseMarkdown = async () => {
            if (inline) {
                setHtmlContent(content);
            } else {
                const parsed = await marked.parse(content || '');
                setHtmlContent(parsed);
            }
        };

        parseMarkdown();
    }, [content, inline]);

    useEffect(() => {
        if (htmlContent) {
            Prism.highlightAll();
        }
    }, [htmlContent]);

    return (
        <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
    );
};

export default MarkdownRenderer;
