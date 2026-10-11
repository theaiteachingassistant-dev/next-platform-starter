export const maxDuration = 60;
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json();
    const { pupil, topics, isTestMode } = body;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Configure the model with strict KS2 constraints
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `You are an expert UK Key Stage 2 primary school teacher generating a differentiated 5-subject intervention pack for a pupil named ${pupil.name}.
Reading Age: ${pupil.reading_age} | Tier: ${pupil.reading_tier} | Interests: ${pupil.interests}

CURRICULUM GUARDRAILS:
- Spelling/Grammar: Strictly British English (colour, categorise).
- Terminology: Department for Education standard (maths, inverted commas, fronted adverbials).
- Units: UK currency (£/p) and metric measurements (cm, ml, kg).
- Thematic Saturation: 80% of contexts, characters, and word problems must integrate the pupil's listed interests. The remaining 20% must be abstract or generic KS2 scenarios.

SUBJECT ARCHITECTURE:
1. Maths: Generate exactly 5 arithmetic questions and 3 worded questions targeting the exact topic.
2. Reading: Generate a fiction/non-fiction passage calibrated to the reading age. Follow with exactly 4 NFER-style comprehension questions targeting KS2 content domains 2a, 2b, 2c, and 2d. ${isTestMode ? "TEST MODE ACTIVE: Generate an extended 300-400 word passage and 8 questions." : ""}
3. Writing: Scaffold the target topic strictly into three progressive tasks: "Try it", "Use it", and "Prove it".
4. Spelling: Extract exactly 5 target words based on the provided topic/rule, integrated into practice tasks.
5. Times Tables: Generate exactly 12 speed-check calculations targeting the exact topic.

OUTPUT FORMAT:
Generate standard Markdown text inside the schema values. Do NOT use markdown code block formatting in the output strings.`
    });

    // The Structured Output Schema guaranteeing JSON reliability
    const worksheetSchema = {
      type: SchemaType.OBJECT,
      properties: {
        pupil_name: { type: SchemaType.STRING },
        maths: {
          type: SchemaType.OBJECT,
          properties: {
            objective: { type: SchemaType.STRING },
            worksheet_markdown: { type: SchemaType.STRING },
            answer_key: { type: SchemaType.STRING }
          },
          required: ["objective", "worksheet_markdown", "answer_key"]
        },
        reading: {
          type: SchemaType.OBJECT,
          properties: {
            passage: { type: SchemaType.STRING },
            questions: { type: SchemaType.STRING },
            answer_key: { type: SchemaType.STRING }
          },
          required: ["passage", "questions", "answer_key"]
        },
        writing: {
          type: SchemaType.OBJECT,
          properties: {
            stimulus: { type: SchemaType.STRING },
            stage_1: { type: SchemaType.STRING },
            stage_2: { type: SchemaType.STRING },
            stage_3: { type: SchemaType.STRING },
            answer_key: { type: SchemaType.STRING }
          },
          required: ["stimulus", "stage_1", "stage_2", "stage_3", "answer_key"]
        },
        spelling: {
          type: SchemaType.OBJECT,
          properties: {
            target_words: { 
              type: SchemaType.ARRAY, 
              items: { type: SchemaType.STRING } 
            },
            worksheet_markdown: { type: SchemaType.STRING },
            answer_key: { type: SchemaType.STRING }
          },
          required: ["target_words", "worksheet_markdown", "answer_key"]
        },
        times_tables: {
          type: SchemaType.OBJECT,
          properties: {
            calculations: { type: SchemaType.STRING },
            answer_key: { type: SchemaType.STRING }
          },
          required: ["calculations", "answer_key"]
        }
      },
      required: ["pupil_name", "maths", "reading", "writing", "spelling", "times_tables"]
    };

    const prompt = `Target Topics for ${pupil.name}:
- Maths: ${topics.maths}
- Reading: ${topics.reading}
- Writing: ${topics.writing}
- Spelling: ${topics.spelling}
- Times Tables: ${topics.times_tables}

Execute generation mapping to the structural schema.`;

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
