import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(req) {
  try {
    // 1. Security Check: Block unauthorized API abuse
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { topic, yearGroup, differentiation } = body;

    // 2. The Invisible Prompt: Hardcoded KS2 Intelligence
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

    // 3. Fire the request directly to the Gemini REST API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }]
      })
    });

    if (!geminiResponse.ok) {
      throw new Error("Failed to communicate with Google Gemini.");
    }

    const data = await geminiResponse.json();
    const generatedText = data.candidates[0].content.parts[0].text;

    return NextResponse.json({ resource: generatedText });

  } catch (error) {
    console.error("Resource Generation Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
