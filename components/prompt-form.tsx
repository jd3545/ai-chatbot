'use client';

import * as React from 'react';
import Textarea from 'react-textarea-autosize';
import { useActions, useUIState } from 'ai/rsc';
import { UserMessage } from './stocks/message';
import { type AI } from '@/lib/chat/actions';
import { Button } from '@/components/ui/button';
import { IconArrowElbow, IconPlus } from '@/components/ui/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useEnterSubmit } from '@/lib/hooks/use-enter-submit';
import { nanoid } from 'nanoid';
import { useRouter } from 'next/navigation';
import { generateText } from 'ai';
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

//correct
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function toBase64ImageUrl(imgUrl: string): Promise<string> {
  const fetchImageUrl = await fetch(imgUrl);
  const responseArrBuffer = await fetchImageUrl.arrayBuffer();
  const toBase64 = `data:${fetchImageUrl.headers.get('Content-Type') || 'image/png'};base64,${Buffer.from(responseArrBuffer).toString('base64')}`;
  return toBase64;
}

export function PromptForm({
  input,
  setInput
}: {
  input: string
  setInput: (value: string) => void
}) {
  const router = useRouter();
  const { formRef, onKeyDown } = useEnterSubmit();
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const { submitUserMessage } = useActions();
  const [_, setMessages] = useUIState<typeof AI>();
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Blur focus on mobile
    // if (window.innerWidth < 600) {
    //   e.target['message']?.blur();
    // }

    const value = input.trim();
    setInput('');
    if (!value && !selectedFile) return;

    // Optimistically add user message UI
    setMessages(currentMessages => [
      ...currentMessages,
      {
        id: nanoid(),
        display: <UserMessage>{value}</UserMessage>
      }
    ]);

    if (selectedFile) {
      const model = openai('gpt-4');
      const imageUrl = await toBase64ImageUrl("https://github.com/vercel/ai/blob/main/examples/ai-core/data/comic-cat.png");

      const result = await streamText({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe the image in detail.' },
              {
                type: 'image',
                image: imageUrl
              },
            ],
          },
        ],
      });

      for await (const textPart of result.textStream) {
        console.log(textPart);
      }
    }

    // Submit and get response message
    const responseMessage = await submitUserMessage(value);
    setMessages(currentMessages => [...currentMessages, responseMessage]);
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <div className="relative flex max-h-60 w-full grow flex-col overflow-hidden bg-background px-8 sm:rounded-md sm:border sm:px-12">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-0 top-[14px] size-8 rounded-full bg-background p-0 sm:left-4"
              onClick={() => {
                fileInputRef.current?.click();
              }}
            >
              <IconPlus />
              <span className="sr-only">Upload File</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Upload File</TooltipContent>
        </Tooltip>
        
        <Textarea
          ref={inputRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          placeholder="Send a message."
          className="min-h-[60px] w-full resize-none bg-transparent px-4 py-[1.3rem] focus-within:outline-none sm:text-sm"
          autoFocus
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          name="message"
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
        />

        <div className="absolute right-0 top-[13px] sm:right-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="submit" size="icon" disabled={input === '' && !selectedFile}>
                <IconArrowElbow />
                <span className="sr-only">Send message</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send message</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="mt-4">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-full file:border-0
          file:text-sm file:font-semibold
          file:bg-violet-50 file:text-violet-700
          hover:file:bg-violet-100
        "/>
      </div>
    </form>
  );
}
