-- SQL for new tables: shared_quizzes, shared_exams, shared_quiz_submissions, shared_exam_submissions

-- Table for sharable quizzes
CREATE TABLE public.shared_quizzes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    quiz_data JSONB NOT NULL, -- Stores the generated quiz questions, options, answers, explanations
    title TEXT NOT NULL,      -- Title for the quiz
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for sharable exams
CREATE TABLE public.shared_exams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    exam_data JSONB NOT NULL, -- Stores the generated exam questions, options, answers, explanations
    title TEXT NOT NULL,      -- Title for the exam
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for submissions to shared quizzes
CREATE TABLE public.shared_quiz_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shared_quiz_id UUID REFERENCES public.shared_quizzes(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NULL, -- Nullable if anonymous submissions are allowed
    student_identifier TEXT, -- For anonymous submissions (e.g., name from form)
    user_answers JSONB NOT NULL, -- Store user's chosen answers
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for submissions to shared exams
CREATE TABLE public.shared_exam_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shared_exam_id UUID REFERENCES public.shared_exams(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NULL, -- Nullable if anonymous submissions are allowed
    student_identifier TEXT, -- For anonymous submissions (e.g., name from form)
    user_answers JSONB NOT NULL, -- Store user's chosen answers
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.shared_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_quiz_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_exam_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shared_quizzes
-- Allow anyone to read a shared quiz definition (publicly accessible)
CREATE POLICY "Allow public read access to shared quizzes" ON public.shared_quizzes FOR SELECT USING (TRUE);

-- Allow creator to manage their own shared quizzes (for potential future edit/delete)
CREATE POLICY "Allow creator to manage own quizzes" ON public.shared_quizzes FOR ALL
USING (auth.uid() = creator_id)
WITH CHECK (auth.uid() = creator_id);

-- RLS Policies for shared_quiz_submissions
-- Allow students to insert their own submissions
CREATE POLICY "Allow student to insert own submission" ON public.shared_quiz_submissions FOR INSERT
WITH CHECK (auth.uid() = student_id OR student_id IS NULL); -- Allow if student_id is NULL (anonymous) or matches logged-in user

-- Allow students to view their own submissions
CREATE POLICY "Allow student to view own submissions" ON public.shared_quiz_submissions FOR SELECT
USING (auth.uid() = student_id OR student_id IS NULL);

-- Allow quiz creator to view all submissions for their quizzes
CREATE POLICY "Allow creator to view submissions" ON public.shared_quiz_submissions FOR SELECT
USING (EXISTS (SELECT 1 FROM public.shared_quizzes WHERE id = shared_quiz_id AND creator_id = auth.uid()));

-- RLS Policies for shared_exams (similar to quizzes)
CREATE POLICY "Allow public read access to shared exams" ON public.shared_exams FOR SELECT USING (TRUE);
CREATE POLICY "Allow creator to manage own exams" ON public.shared_exams FOR ALL
USING (auth.uid() = creator_id)
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Allow student to insert own exam submission" ON public.shared_exam_submissions FOR INSERT
WITH CHECK (auth.uid() = student_id OR student_id IS NULL);
CREATE POLICY "Allow student to view own exam submissions" ON public.shared_exam_submissions FOR SELECT
USING (auth.uid() = student_id OR student_id IS NULL);
CREATE POLICY "Allow creator to view exam submissions" ON public.shared_exam_submissions FOR SELECT
USING (EXISTS (SELECT 1 FROM public.shared_exams WHERE id = shared_exam_id AND creator_id = auth.uid()));