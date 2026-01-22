-- 1. Create the main 'lessons' table
CREATE TABLE public.lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  content_config JSONB
);

-- 2. Create tables for different types of lesson content
CREATE TABLE public.lesson_outlines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  outline_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.lesson_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  notes_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.lesson_quizzes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  quiz_data_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.lesson_exams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  exam_data_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create a table for student submissions
CREATE TABLE public.student_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS) for the new tables
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_outlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_submissions ENABLE ROW LEVEL SECURITY;

-- 5. Define RLS Policies for the new tables
-- Allow public access to public lessons
CREATE POLICY "Allow public read access to public lessons" ON public.lessons FOR SELECT USING (is_public = TRUE);

-- Allow creators to manage their own lessons
CREATE POLICY "Allow creator to do everything" ON public.lessons FOR ALL
USING (auth.uid() = creator_id)
WITH CHECK (auth.uid() = creator_id);

-- Allow logged-in users to read lesson content if they can read the lesson
CREATE POLICY "Allow read access to lesson content" ON public.lesson_outlines FOR SELECT
USING (EXISTS (SELECT 1 FROM public.lessons WHERE id = lesson_id));

CREATE POLICY "Allow read access to lesson content" ON public.lesson_notes FOR SELECT
USING (EXISTS (SELECT 1 FROM public.lessons WHERE id = lesson_id));

CREATE POLICY "Allow read access to lesson content" ON public.lesson_quizzes FOR SELECT
USING (EXISTS (SELECT 1 FROM public.lessons WHERE id = lesson_id));

CREATE POLICY "Allow read access to lesson content" ON public.lesson_exams FOR SELECT
USING (EXISTS (SELECT 1 FROM public.lessons WHERE id = lesson_id));

-- Allow creators to insert content for their lessons
CREATE POLICY "Allow creator to insert content" ON public.lesson_outlines FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.lessons WHERE id = lesson_id AND creator_id = auth.uid()));

CREATE POLICY "Allow creator to insert content" ON public.lesson_notes FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.lessons WHERE id = lesson_id AND creator_id = auth.uid()));

CREATE POLICY "Allow creator to insert content" ON public.lesson_quizzes FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.lessons WHERE id = lesson_id AND creator_id = auth.uid()));

CREATE POLICY "Allow creator to insert content" ON public.lesson_exams FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.lessons WHERE id = lesson_id AND creator_id = auth.uid()));

-- Policies for student_submissions
-- Allow student to insert their own submissions
CREATE POLICY "Allow student to insert own submission" ON public.student_submissions FOR INSERT
WITH CHECK (auth.uid() = student_id);

-- Allow students to view their own submissions
CREATE POLICY "Allow student to view own submissions" ON public.student_submissions FOR SELECT
USING (auth.uid() = student_id);

-- Allow lesson creators to view all submissions for their lessons
CREATE POLICY "Allow creator to view submissions" ON public.student_submissions FOR SELECT
USING (EXISTS (SELECT 1 FROM public.lessons WHERE id = lesson_id AND creator_id = auth.uid()));
