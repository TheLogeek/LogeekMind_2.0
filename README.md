# 🧠 LogeekMind v2.0
**Your All-in-One AI-Powered Academic Assistant**

Welcome to the official repository for **LogeekMind v2.0**, a powerful, open-source learning platform designed to help students and learners study smarter, not harder.

---

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Stars](https://img.shields.io/github/stars/TheLogeek/LogeekMind_2.0?style=social)](https://github.com/TheLogeek/LogeekMind_2.0/stargazers)

## 🚀 About The Project

LogeekMind provides a comprehensive suite of AI-driven tools to help users understand complex topics, master content, solve problems, and plan their studies effectively. This repository contains the full-stack application, which includes a modern web frontend and a robust Python backend.

### ✨ Key Features

-   **🧠 AI Teacher**: Get interactive, conversational explanations on any subject at any level.
-   **📝 Content Mastery Suite**: Includes a document summarizer, course outline generator, and lecture-to-text/text-to-audio converters.
-   **📸 Problem-Solving Tools**: Get step-by-step solutions for homework problems with an image-based assistant.
-   **🧮 Academic Utilities**: Plan your study schedule and calculate your GPA with ease.
-   **💬 Community Chat**: Engage with other learners in a collaborative, real-time chat environment.
-   **💻 Exam Simulator**: Prepare for exams with customizable mock tests.

---

## 🛠️ Tech Stack

This project is built with a modern, decoupled architecture.

### Frontend
-   **Framework**: [Next.js](https://nextjs.org/) / [React](https://reactjs.org/)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/) & CSS Modules
-   **State Management**: React Context API
-   **Deployment**: Vercel

### Backend
-   **Framework**: [FastAPI](https://fastapi.tiangolo.com/)
-   **Language**: [Python](https://www.python.org/)
-   **Database**: [PostgreSQL](https://www.postgresql.org/) (managed via [Supabase](https://supabase.com/))
-   **Authentication**: Supabase Auth
-   **AI**: Google Gemini API
-   **Deployment**: Render

---

## 🏛️ Project Architecture

-   **`frontend/`**: A Next.js, React, and TypeScript application that serves as the user interface. It is optimized for performance and is deployed as a Progressive Web App (PWA).
-   **`backend/`**: A Python-based REST API using FastAPI that handles all business logic, AI model interactions, and database communications.

---

## 🏁 Getting Started

To run this project locally, you need to set up and run both the frontend and backend servers simultaneously.

### Prerequisites
-   Node.js and npm
-   Python 3.10+ and pip
-   A Supabase account (for database and auth)
-   A Google Gemini API Key
-   Ffmpeg

### Installation & Setup

#### 1. Backend Setup
Navigate to the backend directory and follow the instructions in its README file.

```sh
cd backend
```
> **[View Backend README](./backend/README.md)**

#### 2. Frontend Setup
In a separate terminal, navigate to the frontend directory and follow the setup instructions.

```sh
cd frontend
```
> **[View Frontend README](./frontend/README.md)**

---

## 🚀 Deployment

The two parts of this application are deployed independently:

-   The **frontend** is designed for a seamless deployment on **[Vercel](https://vercel.com/)**.
-   The **backend** can be deployed on any platform that supports Python web servers, such as **[Render](https://render.com/)** or Heroku.

Please refer to the README file in each directory for detailed deployment instructions.

---

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

## 📞 Contact

Solomon Adenuga (Logeek) - [@TheLogeek](https://twitter.com/TheLogeek) - solomonadenuga8@gmail.com

Project Link: [https://github.com/TheLogeek/LogeekMind_2.0](https://github.com/TheLogeek/LogeekMind_2.0)