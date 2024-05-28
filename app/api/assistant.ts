import { AssistantResponse } from "ai";
import OpenAI from "openai";
import { NextRequest } from "next/server";
import { string, z } from "zod";
import { zfd } from "zod-form-data";

const schema = zfd.formData({
	threadId: z.string().or(z.undefined()),
	message: zfd.text(),
	file: z.instanceof(Blob)
});
const homeTemperatures = {
  bedroom: 20,
  'home office': 21,
  'living room': 21,
  kitchen: 22,
  bathroom: 23,
};
// Create an OpenAI API client (that's edge friendly!)
const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY || ""
});
export const runtime = "edge";

export async function POST(req: NextRequest) {
	// Parse the request body
	const input = await req.formData();

	const data = schema.parse(input);

	const file = new File([data.file], "file", { type: data.file.type });

	const threadId = Boolean(data.threadId)
		? data.threadId!
		: (await openai.beta.threads.create()).id;

	let openAiFile: OpenAI.Files.FileObject | null = null;

	if (data.file.size > 0) {
		openAiFile = await openai.files.create({
			file,
			purpose: "assistants"
		});
	}

	const messageData = {
		role: "user" as "user",
		content: data.message,
		file_ids: openAiFile ? [openAiFile.id] : undefined
	};

	// Add a message to the thread
	const createdMessage = await openai.beta.threads.messages.create(
		threadId,
		messageData
	);

	return AssistantResponse(
		{ threadId, messageId: createdMessage.id },
		async ({ forwardStream, sendMessage }) => {
			// Run the assistant on the thread
			const runStream = await openai.beta.threads.runs.stream(threadId, {
				assistant_id:
					process.env.ASSISTANT_ID ??
					(() => {
						throw new Error("ASSISTANT_ID is not set");
					})()
			});
      let runResult = await forwardStream(runStream);
      while (
        runResult?.status === 'requires_action' &&
        runResult.required_action?.type === 'submit_tool_outputs'
      ) {
        const tool_outputs =
          runResult.required_action.submit_tool_outputs.tool_calls.map(
            (toolCall: any) => {
              const parameters = JSON.parse(toolCall.function.arguments);

              switch (toolCall.function.name) {
                case 'getRoomTemperature': {
                  const temperature =
                    homeTemperatures[
                      parameters.room as keyof typeof homeTemperatures
                    ];

                  return {
                    tool_call_id: toolCall.id,
                    output: temperature.toString(),
                  };
                }

                case 'setRoomTemperature': {
                  const oldTemperature =
                    homeTemperatures[
                      parameters.room as keyof typeof homeTemperatures
                    ];

                  homeTemperatures[
                    parameters.room as keyof typeof homeTemperatures
                  ] = parameters.temperature;

                  return {
                    tool_call_id: toolCall.id,
                    output: `temperature set successfully`,
                  };
                }

                default:
                  throw new Error(
                    `Unknown tool call function: ${toolCall.function.name}`,
                  );
              }
            },
          );
        runResult = await forwardStream(
          openai.beta.threads.runs.submitToolOutputsStream(
            threadId,
            runResult.id,
          { tool_outputs },
           { signal: req.signal },
          ),
        );
      }
		},
	);
}