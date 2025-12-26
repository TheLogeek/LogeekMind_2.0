# LogeekMind v2.0 - Next.js Frontend

Welcome to the frontend for LogeekMind v2.0, a powerful, all-in-one AI-powered learning assistant. This version has been migrated from Streamlit to a modern, scalable Next.js application.

## 🚀 About The Project

LogeekMind provides a suite of AI-driven tools to help students and learners understand topics faster, study smarter, and achieve their academic goals.

### Core Features:
- **AI Teacher:** Get interactive explanations and practice on any topic.
- **Content Mastery:** Summarize documents, generate course outlines, and convert lectures between text and audio.
- **Planning & Solving:** Get step-by-step homework solutions, calculate your GPA, and create organized study schedules.
- **Community:** Engage with other learners in the community chat.

### Built With:
- **Frontend:** [Next.js](https://nextjs.org/), [React](https://reactjs.org/), [TypeScript](https://www.typescriptlang.org/)
- **Backend:** Python (FastAPI), Supabase (Auth)
- **Deployment:** [Vercel](https://vercel.com/)

---

## 🛠️ Getting Started

To get a local copy up and running, follow these steps.

### Prerequisites
- **Node.js** (v18 or later)
- **npm**
- **Python** (v3.9 or later) & `pip`

### 1. Backend Setup

First, get the Python backend server running.

1.  Navigate to the backend directory:
    ```sh
    cd LogeekMind_2.0/backend
    ```
2.  Create and activate a virtual environment:
    ```sh
    python -m venv venv
    # On Windows:
    .\venv\Scripts\activate
    # On macOS/Linux:
    source venv/bin/activate
    ```
3.  Install the required Python packages:
    ```sh
    pip install -r requirements.txt
    ```
4.  Run the backend server (assuming it's a FastAPI app named `main.py`):
    ```sh
    uvicorn main:app --reload
    ```
    The backend should now be running on `http://127.0.0.1:8000`.

### 2. Frontend Setup

With the backend running, set up the Next.js frontend in a **new terminal window**.

1.  Navigate to the frontend directory:
    ```sh
    cd LogeekMind_2.0/frontend
    ```
2.  Install npm packages:
    ```sh
    npm install
    ```
3.  **Environment Variables:** For full functionality (especially authentication), you'll need to connect to services like Supabase. Create a file named `.env.local` in the `frontend` directory and add the necessary keys:
    ```
    # Example .env.local
    NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
    ```
    *Note: The application currently points to a local backend at `http://127.0.0.1:8000` by default.*

### 3. Running the Application

1.  Start the frontend development server:
    ```sh
    npm run dev
    ```
2.  Open [http://localhost:3000](http://localhost:3000) in your browser to see the result.

---

## 🚀 Deployment

This application is optimized for deployment on [Vercel](https://vercel.com/).

1.  Push your project to a Git provider (GitHub, GitLab).
2.  Import the repository into Vercel.
3.  Add your environment variables (like Supabase keys) in the Vercel project settings.
4.  Vercel will automatically detect the Next.js framework and deploy the application.