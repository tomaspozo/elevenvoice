-- Drop existing policies
drop policy if exists "Users can upload their own conversation files" on storage.objects;
drop policy if exists "Users can read their own conversation files" on storage.objects;
drop policy if exists "Users can update their own conversation files" on storage.objects;

-- Create new policies that check against the conversations table
create policy "Users can upload their own conversation files"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'conversations' AND
    exists (
        select 1 from conversations
        where id = (storage.foldername(name))[1]::uuid
        and user_id = auth.uid()
    )
);

-- Allow authenticated users to read their own conversation files
create policy "Users can read their own conversation files"
on storage.objects for select
to authenticated
using (
    bucket_id = 'conversations' AND
    exists (
        select 1 from conversations
        where id = (storage.foldername(name))[1]::uuid
        and user_id = auth.uid()
    )
);

-- Allow authenticated users to update their own conversation files
create policy "Users can update their own conversation files"
on storage.objects for update
to authenticated
using (
    bucket_id = 'conversations' AND
    exists (
        select 1 from conversations
        where id = (storage.foldername(name))[1]::uuid
        and user_id = auth.uid()
    )
)
with check (
    bucket_id = 'conversations' AND
    exists (
        select 1 from conversations
        where id = (storage.foldername(name))[1]::uuid
        and user_id = auth.uid()
    )
);
