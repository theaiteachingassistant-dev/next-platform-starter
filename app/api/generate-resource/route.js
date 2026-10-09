import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(req) {
  try {
    // 1. Asynchronous Security Check (Next.js 16+ compliant)
    const { userId } = await auth();
    if (!userId) {
      console.error("API Error: Clerk failed to authenticate the user.");
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 2. Validate API Key Presence
    if (!process.env.GEMINI_API_KEY) {
      console.error("API Error: GEMINI_API_KEY is missing or undefined in Vercel.");
      return new NextResponse("Configuration Error", { status: 500 });
    }

    const body = await req.json();
    const { topic, yearGroup, differentiation } = body;

    const systemPrompt = `
      You are an expert UK Key Stage 2 primary school teacher. 
      Create a highly structured educational resource for the following topic: ${topic}.
      Target Audience: Year ${yearGroup}.
      Differentiation Level: ${differentiation}.

      The resource MUST strictly follow this format:
      - LEARNING OBJECTIVE: One clear, measurable sentence.
      - KEY VOCABULARY: 5 age-appropriate words with simple definitions.
      - DIRECT INSTRUCTION (The 'Hook'): A short, engaging explanation of the concept avoiding complex jargon.
      - GUIDED PRACTICE: 3 step-by-step questions to do together.
      - INDEPENDENT TASK: 5 questions for the pupil to complete alone.
      - CHALLENGE / MASTERY: 1 deeper thinking question.

      Ensure the vocabulary and cognitive load are perfectly scaled for a Year ${yearGroup} pupil. Output clear, plain text with distinct line breaks. Do not use markdown asterisks or hashes.
    `;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }]
      })
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Google API Rejected Request:", errorText);
      throw new Error("Failed to communicate with Google Gemini.");
    }

    const data = await geminiResponse.json();
    const generatedText = data.candidates[0].content.parts[0].text;

    return NextResponse.json({ resource: generatedText });

  } catch (error) {
    console.error("Resource Generation Fatal Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
