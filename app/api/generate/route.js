export const maxDuration = 60;
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const { pupil, topics, isTestMode } = body;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // 1. Identify exactly which subjects were requested in this specific payload
    const activeSubjects = Object.keys(topics);
    
    // 2. Dynamically build the System Instruction to only request active subjects
    const systemInstruction = `You are an expert UK Key Stage 2 primary school teacher generating a targeted intervention pack for a pupil named ${pupil.name}.
Reading Age: ${pupil.reading_age} | Tier: ${pupil.reading_tier} | Interests: ${pupil.interests}

CURRICULUM GUARDRAILS:
- Spelling/Grammar: Strictly British English (colour, categorise).
- Terminology: Department for Education standard (maths, inverted commas, fronted adverbials).
- Units: UK currency (£/p) and metric measurements (cm, ml, kg).
- Thematic Saturation: 80% of contexts, characters, and word problems must integrate the pupil's listed interests.

SUBJECT INSTRUCTIONS (ONLY GENERATE THESE SPECIFIC SUBJECTS):
${activeSubjects.includes('maths') ? 'Maths: Generate exactly 5 arithmetic questions and 3 worded questions targeting the exact topic.' : ''}
${activeSubjects.includes('reading') ? `Reading: Generate a fiction/non-fiction passage calibrated to the reading age. Follow with exactly 4 NFER-style comprehension questions targeting KS2 content domains 2a, 2b, 2c, and 2d. ${isTestMode ? "TEST MODE ACTIVE: Generate an extended 300-400 word passage and 8 questions." : ""}` : ''}
${activeSubjects.includes('writing') ? 'Writing: Scaffold the target topic strictly into three progressive tasks: "Try it", "Use it", and "Prove it".' : ''}
${activeSubjects.includes('spelling') ? 'Spelling: Extract exactly 5 target words based on the provided topic/rule, integrated into practice tasks.' : ''}
${activeSubjects.includes('times_tables') ? 'Times Tables: Generate exactly 12 speed-check calculations targeting the exact topic.' : ''}

OUTPUT FORMAT & CRITICAL FORMATTING RULES:
- Generate standard Markdown text inside the schema values. Do NOT use markdown code block formatting in the output strings.
- LEAK PREVENTION: Never use Markdown formatting (bolding, italics, or underlining) to highlight target words, answers, or clues within the question text itself.`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction
    });

    // 3. Dynamically build the strict JSON Schema based ONLY on requested subjects
    const properties = {
      pupil_name: { type: SchemaType.STRING },
    };
    const required = ["pupil_name"];

    if (activeSubjects.includes('maths')) {
      properties.maths = {
        type: SchemaType.OBJECT,
        properties: {
          objective: { type: SchemaType.STRING },
          worksheet_markdown: { type: SchemaType.STRING },
          answer_key: { type: SchemaType.STRING }
        },
        required: ["objective", "worksheet_markdown", "answer_key"]
      };
      required.push("maths");
    }
    
    if (activeSubjects.includes('reading')) {
      properties.reading = {
        type: SchemaType.OBJECT,
        properties: {
          passage: { type: SchemaType.STRING },
          questions: { type: SchemaType.STRING },
          answer_key: { type: SchemaType.STRING }
        },
        required: ["passage", "questions", "answer_key"]
      };
      required.push("reading");
    }

    if (activeSubjects.includes('writing')) {
      properties.writing = {
        type: SchemaType.OBJECT,
        properties: {
          stimulus: { type: SchemaType.STRING },
          stage_1: { type: SchemaType.STRING },
          stage_2: { type: SchemaType.STRING },
          stage_3: { type: SchemaType.STRING },
          answer_key: { type: SchemaType.STRING }
        },
        required: ["stimulus", "stage_1", "stage_2", "stage_3", "answer_key"]
      };
      required.push("writing");
    }

    if (activeSubjects.includes('spelling')) {
      properties.spelling = {
        type: SchemaType.OBJECT,
        properties: {
          target_words: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          worksheet_markdown: { type: SchemaType.STRING },
          answer_key: { type: SchemaType.STRING }
        },
        required: ["target_words", "worksheet_markdown", "answer_key"]
      };
      required.push("spelling");
    }

    if (activeSubjects.includes('times_tables')) {
      properties.times_tables = {
        type: SchemaType.OBJECT,
        properties: {
          calculations: { type: SchemaType.STRING },
          answer_key: { type: SchemaType.STRING }
        },
        required: ["calculations", "answer_key"]
      };
      required.push("times_tables");
    }

    const worksheetSchema = {
      type: SchemaType.OBJECT,
      properties,
      required
    };

    // 4. Send the targeted prompt
    const prompt = `Target Topics for ${pupil.name}:\n` + activeSubjects.map(sub => `- ${sub.replace('_', ' ').toUpperCase()}: ${topics[sub]}`).join('\n') + `\n\nExecute generation mapping to the structural schema.`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: worksheetSchema,
        temperature: 0.2, 
      }
    });

    const output = result.response.text();
    return NextResponse.json(JSON.parse(output));
    
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
