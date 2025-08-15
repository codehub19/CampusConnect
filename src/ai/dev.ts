
import { config } from 'dotenv';
config();

import '@/ai/flows/ai-assistant-answers-questions.ts';
import '@/ai/flows/generate-icebreaker.ts';
import '@/ai/flows/moderate-missed-connection.ts';
import '@/ai/flows/handle-reported-post.ts';
import '@/ai/flows/generate-event-image-flow.ts';
import '@/ai/flows/accept-friend-request.ts';
import '@/ai/flows/remove-friend.ts';

