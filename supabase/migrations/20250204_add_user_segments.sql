-- Add user_segments and processed_at columns to conversations table
alter table conversations
add column if not exists user_segments jsonb,
add column if not exists processed_at timestamp with time zone;
