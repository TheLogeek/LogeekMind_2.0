-- SQL Schema for LogeekMind Sharing Features

-- Table: shared_exams
-- Stores metadata and actual exam data for sharable exams
CREATE TABLE IF NOT EXISTS public.shared_exams (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, -- Link to auth.users if available, or make nullable if anonymous creation is allowed
    title text NOT NULL,
    exam_data jsonb NOT NULL, -- Stores the exam questions, options, answers, explanations
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Optional: Add RLS policy for shared_exams
-- You might want to adjust this based on your specific security requirements
ALTER TABLE public.shared_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.shared_exams
FOR SELECT USING (TRUE);

CREATE POLICY "Enable insert for authenticated users" ON public.shared_exams
FOR INSERT WITH CHECK (auth.uid() = creator_id);


-- Table: shared_exam_submissions
-- Stores submissions from students taking shared exams
CREATE TABLE IF NOT EXISTS public.shared_exam_submissions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    shared_exam_id uuid REFERENCES public.shared_exams(id) ON DELETE CASCADE,
    student_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- Nullable, for logged-in students
    student_identifier text, -- For anonymous students (e.g., their name or a generated ID)
    user_answers jsonb NOT NULL, -- Stores the student's answers
    score integer NOT NULL,
    total_questions integer NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Optional: Add RLS policy for shared_exam_submissions
ALTER TABLE public.shared_exam_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for creators and submitting students" ON public.shared_exam_submissions
FOR SELECT USING (
    auth.uid() = student_id OR EXISTS (
        SELECT 1 FROM public.shared_exams
        WHERE shared_exams.id = shared_exam_id AND shared_exams.creator_id = auth.uid()
    )
);

CREATE POLICY "Enable insert for all users (authenticated and anonymous)" ON public.shared_exam_submissions
FOR INSERT WITH CHECK (TRUE);


-- Table: smart_quiz_shared_quizzes
-- Stores metadata and actual quiz data for sharable quizzes
CREATE TABLE IF NOT EXISTS public.smart_quiz_shared_quizzes (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, -- Link to auth.users if available, or make nullable if anonymous creation is allowed
    title text NOT NULL,
    quiz_data jsonb NOT NULL, -- Stores the quiz questions, options, answers, explanations
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Optional: Add RLS policy for smart_quiz_shared_quizzes
ALTER TABLE public.smart_quiz_shared_quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users_sq" ON public.smart_quiz_shared_quizzes
FOR SELECT USING (TRUE);

CREATE POLICY "Enable insert for authenticated users_sq" ON public.smart_quiz_shared_quizzes
FOR INSERT WITH CHECK (auth.uid() = creator_id);


-- Table: smart_quiz_submissions
-- Stores submissions from students taking shared quizzes
CREATE TABLE IF NOT EXISTS public.smart_quiz_submissions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    shared_quiz_id uuid REFERENCES public.smart_quiz_shared_quizzes(id) ON DELETE CASCADE,
    student_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- Nullable, for logged-in students
    student_identifier text, -- For anonymous students (e.g., their name or a generated ID)
    user_answers jsonb NOT NULL, -- Stores the student's answers
    score integer NOT NULL,
    total_questions integer NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Optional: Add RLS policy for smart_quiz_submissions
ALTER TABLE public.smart_quiz_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for creators and submitting students_sq" ON public.smart_quiz_submissions
FOR SELECT USING (
    auth.uid() = student_id OR EXISTS (
        SELECT 1 FROM public.smart_quiz_shared_quizzes
        WHERE smart_quiz_shared_quizzes.id = shared_quiz_id AND smart_quiz_shared_quizzes.creator_id = auth.uid()
    )
);

CREATE POLICY "Enable insert for all users (authenticated and anonymous)_sq" ON public.smart_quiz_submissions
FOR INSERT WITH CHECK (TRUE);

-- Ensure uuid-ossp extension is enabled for uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
