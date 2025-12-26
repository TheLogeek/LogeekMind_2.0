# 🧠 LogeekMind v2.0 - AI Academic Super-Assistant

Welcome to the official repository for **LogeekMind v2.0**, a powerful, all-in-one AI-powered learning assistant designed to help students and learners study smarter, not harder.

---

## 🚀 About The Project

LogeekMind provides a suite of AI-driven tools to help users understand complex topics, master content, solve problems, and plan their studies effectively. This repository contains the full-stack application, which includes a modern web frontend and a robust Python backend.

### Key Features:
- **AI Teacher:** Interactive, conversational learning on any subject.
- **Content Mastery Suite:** Includes a document summarizer, course outline generator, and lecture-to-text/text-to-audio converters.
- **Problem-Solving Tools:** Get step-by-step solutions for homework problems with an image-based assistant.
- **Academic Utilities:** Plan your study schedule and calculate your GPA with ease.
- **Community Chat:** Engage with other learners in a collaborative environment.

---

## 🏛️ Project Architecture

This project follows a modern, decoupled architecture:

-   **`frontend/`**: A [Next.js](https://nextjs.org/), [React](https://reactjs.org/), and [TypeScript](https://www.typescriptlang.org/) application that serves as the user interface. It is optimized for performance and is deployable as a Progressive Web App (PWA).
-   **`backend/`**: A Python-based REST API (likely using [FastAPI](https://fastapi.tiangolo.com/)) that handles all business logic, AI model interactions, and database communications.

---

## 🛠️ Getting Started

To run this project, you need to set up and run both the frontend and backend servers simultaneously.

### 1. Backend Setup

Navigate to the backend directory and follow the instructions in its README file.

```sh
cd backend
```
> **[View Backend README](./backend/README.md)**

### 2. Frontend Setup

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

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
