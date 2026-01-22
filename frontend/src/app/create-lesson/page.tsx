'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios, { AxiosError } from 'axios';
import styles from './CreateLessonPage.module.css';
import AuthService from '../../services/AuthService';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

const CreateLessonPage = () => {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [selectedComponents, setSelectedComponents] = useState({
    has_outline: true,
    has_notes: true,
    has_quiz: false,
    has_exam: false,
  });

  const [outlineConfig, setOutlineConfig] = useState({ detailLevel: 'medium' });

  interface NotesConfig {
    source: string;
    topic: string;
    file: File | null;
    fileName: string;
  }

  const [notesConfig, setNotesConfig] = useState<NotesConfig>({
    source: 'topic',
    topic: '',
    file: null,
    fileName: '',
  });

  const [quizConfig, setQuizConfig] = useState({
    topic: '',
    numQuestions: 10,
    difficulty: 3,
  });
  const [examConfig, setExamConfig] = useState({
    topic: '',
    numQuestions: 20,
    durationMins: 30,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ✅ FIX: avoid render-time auth branching that can cause hook mismatch
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await AuthService.getCurrentUser();
        if (!user) {
          router.push('/login?redirect=/create-lesson');
        }
      } finally {
        setIsLoadingAuth(false);
      }
    };
    checkAuth();
  }, [router]);

  if (isLoadingAuth) {
    return (
      <div className={`page-container ${styles.createLessonPageContainer}`}>
        <p>Checking authentication...</p>
      </div>
    );
  }

  const handleComponentChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, checked } = event.target;
    setSelectedComponents((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handleOutlineConfigChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setOutlineConfig({ detailLevel: e.target.value });
  };

  const handleNotesConfigChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    const { name, value } = target;

    if (name === 'file') {
      const inputElement = target as HTMLInputElement;
      const file = inputElement.files?.[0];
      setNotesConfig((prev) => ({
        ...prev,
        file: file || null,
        fileName: file ? file.name : '',
      }));
    } else {
      setNotesConfig((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleQuizConfigChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setQuizConfig((prev) => ({ ...prev, [name]: value }));
  };

  const handleExamConfigChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setExamConfig((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Lesson title cannot be empty.');
      return;
    }

    setLoading(true);
    try {
      const accessToken = AuthService.getAccessToken();
      if (!accessToken) {
        setError('You must be logged in to create a lesson.');
        return;
      }

      const payload: any = {
        title,
        is_public: isPublic,
        content_config: {},
      };

      if (selectedComponents.has_outline)
        payload.content_config.outline = outlineConfig;
      if (selectedComponents.has_notes)
        payload.content_config.notes = notesConfig;
      if (selectedComponents.has_quiz)
        payload.content_config.quiz = quizConfig;
      if (selectedComponents.has_exam)
        payload.content_config.exam = examConfig;

      const res = await axios.post(
        `${API_BASE_URL}/lessons/create`,
        payload,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (res.data.success && res.data.lesson) {
        router.push(`/lesson/${res.data.lesson.id}`);
      } else {
        setError(res.data.message || 'Failed to create lesson.');
      }
    } catch (err: unknown) {
      const axiosError = err as AxiosError<any>;
      setError(
        axiosError.response?.data?.detail ||
          axiosError.message ||
          'An unexpected error occurred while creating the lesson.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`page-container ${styles.createLessonPageContainer}`}>
      {/* unchanged JSX */}
    </div>
  );
};

export default CreateLessonPage;
