<h1 align="center">ElevenVoice</h1>

<p align="center">
 An AI agent that helps you generate a sample of your voice for [Eleven Labs voice cloning](https://elevenlabs.io/voice-cloning).
</p>

## How it works

1. **Conversation with AI**

   - AI agent engages you in natural conversation
   - Asks interesting questions to capture your voice

2. **Voice Processing**

   - Original conversation is saved securely
   - ElevenLabs provides conversation transcript
   - Client-side FFmpeg extracts your voice segments
   - High-quality MP3 output optimized for cloning

3. **Voice Sample**
   - Processed voice sample saved to your account
   - Download your voice sample
   - Ready to use with ElevenLabs voice cloning

## Tech Stack

- Next.js 14 (App Router)
- FFmpeg WASM for client-side audio processing
- Supabase for auth and storage
- Tailwind CSS + shadcn/ui
- TypeScript for type safety

## Requirements

- A Supabase project

  - Run locally: `npx supabase start`
  - Required: Auth and Storage services
  - Migrations will set up storage buckets

- An ElevenLabs account and AI Agent
  - [Sign up here](https://elevenlabs.io/signup) (free tier available, but paid plan required for voice cloning)
  - Set up an [AI Agent](https://elevenlabs.io/app/conversational-ai/agents). Agent should encourage > 1 minute conversations with the user.
  - Need: API key and Agent ID

## Environment Setup

```bash
# Required environment variables
NEXT_PUBLIC_SUPABASE_URL=         # Your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Your Supabase anon key
NEXT_PUBLIC_AGENT_ID=             # Your ElevenLabs agent
ELEVENLABS_API_KEY=               # Your ElevenLabs API keyID
```

## Getting Started

1. Clone and install

   ```bash
   git clone https://github.com/tomaspozo/elevenvoice.git
   cd elevenvoice
   npm install
   ```

2. Set up environment

   ```bash
   cp .env.example .env
   # Fill in your environment variables
   ```

3. Run migrations

   ```bash
   npx supabase migration up
   ```

4. Start development server

   ```bash
   npm run dev
   ```

Visit [localhost:3000](http://localhost:3000/) to start creating your voice clone!
