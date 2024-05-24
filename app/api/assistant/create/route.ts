import OpenAI from "openai";

export async function GET() {
  const openai = new OpenAI();

  try {
    const assistant = await openai.beta.assistants.create(
      name="Math Tutor",
      instructions="You are a personal math tutor. Write and run code to answer math questions.",
      tools=[{"type": "code_interpreter"}],
      model="gpt-4o",
    )

    console.log(assistant);

    return Response.json({ assistant: assistant });
  } catch (e) {
    console.log(e);
    return Response.json({ error: e });
  }
}

