# AI Teaching Assistant - Project State & Architecture

## 1. Project Overview
A Next.js web application acting as an automated teaching assistant. The core functionality tracks pupil curriculum mastery using a traffic light system (Blank, Red, Orange, Green) and uses the Gemini API to generate highly differentiated, pupil-specific intervention worksheets. 

## 2. Tech Stack & Infrastructure
*   **Framework:** Next.js 14+ (App Router)
*   **Database:** Supabase (PostgreSQL)
*   **Authentication:** Clerk (Custom Supabase JWT Integration)
*   **Styling:** Tailwind CSS (Default theming, no custom visuals yet)
*   **Charting:** Recharts
*   **Hosting:** Vercel Pro

## 3. Strict Development Protocols
*   **Authentication Flow:** All Supabase clients MUST be initialized dynamically inside components using `useSession` from Clerk and `getToken({ template: 'supabase' })`. Never use standard anonymous keys for database fetches.
*   **Defensive SQL:** Assume a legacy database environment. Provide defensive SQL to disarm hidden constraints before inserting new data, mandate strict on-screen error surfacing, and map state-resets for all UI transitions.
*   **Voice Dictation Rule:** Strictly avoid using the Gemini API for voice dictation; use the browser's built-in Web Speech API paired with a local fuzzy search (Fuse.js) to protect API limits.
*   **API Economy:** Prompt bundling architecture is required to consolidate all 5 subjects into a single structured payload per pupil to bypass Google's 15 RPM limit.

## 4. Exact Database Schema (Confirmed Built)
*   `pupils`: id, user_id, name, surname_initial, reading_age, reading_tier, is_send, is_eal, is_pp, gender.
*   `curriculum_skills`: id, user_id, subject, skill_name, order_index.
*   `pupil_progress`: id, user_id, pupil_id, skill_id, status (green, orange, red, blank), last_assessed_at, next_review_date.
*   `pupil_notes`: id, user_id, pupil_id, content, tag, created_at.
*   `generated_worksheets`: id, user_id, pupil_id, payload, type, created_at.

## 5. File Architecture & State
*   **Global Queue:** Generation is managed by `context/GenerationContext.jsx` (located at the ROOT of the project, NOT inside the `/app` directory) using `addBatchToQueue`.
*   **Component Hub:** Reusable components (MasterTab, PupilDrawer, SubjectMatrix) live in `app/dashboard/components/`.
*   **Stats Hub:** Located at `app/dashboard/class-stats/page.jsx`.

## 6. Completed Stages
*   **Phase 1 & Stages 1-8:** Completed. The Command Center, Subject Matrices, Drag-and-Drop headers, Pupil Drawer (with interactive micro-stats pie charts and comparative bar charts), Stage 7 Voice/Notes engine, and the Class Analytics Hub are fully built. 
*   The Analytics Hub includes the X-Ray Drilldown Modal and the Top Trumps comparison engine.

## 7. Current Objective: Stage 9 & Beyond
*   **Immediate Next Step:** Stage 9: The Unified Reporting Hub. A dedicated `/dashboard/reporting` route synthesizing grid data and notes to output 3 Achievements and 3 Struggles for Maths, Reading, and Writing. (Exact output format—screen vs. DB vs. PDF—to be defined in current session).
*   **Pending Future Builds:** 
    *   Stage 10: The Morning Briefing (Landing dashboard with actionable feeds).
    *   Phase 2: The Spaced Memory Visualizer (12-Week 5-Bar Battery UI replacing the static clock icon).
    *   Phase 4: The 7-Day Worksheet Bank (Automated PostgreSQL retention script).
    *   Phase 5: The Export & PDF Engine (Client-side browser compilation via html2pdf.js).
