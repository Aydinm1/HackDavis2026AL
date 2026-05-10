/**
 * Live integration test for the Gemini parser.
 * Run with: npx tsx tests/gemini-live.ts
 */
import { parseGeminiChatMessage } from "@/lib/ai/geminiParser";

const messages = [
  "Add a task to finish my project report by Friday with high priority",
  "Schedule a team meeting tomorrow at 2pm for 1 hour",
  "Hey, how are you?",
];

async function main() {
  for (const msg of messages) {
    console.log(`\n--- Input: "${msg}" ---`);
    const actions = await parseGeminiChatMessage(msg);
    console.log("Actions:", JSON.stringify(actions, null, 2));
  }
}

main().catch(console.error);
