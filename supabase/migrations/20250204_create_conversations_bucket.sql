-- Create the conversations bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('conversations', 'conversations', false)
on conflict (id) do nothing;

-- Allow authenticated users to upload files to their own conversation folders
create policy "Users can upload their own conversation files"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'conversations' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to read their own conversation files
create policy "Users can read their own conversation files"
on storage.objects for select
to authenticated
using (
    bucket_id = 'conversations' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own conversation files
create policy "Users can update their own conversation files"
on storage.objects for update
to authenticated
using (
    bucket_id = 'conversations' AND
    auth.uid()::text = (storage.foldername(name))[1]
)
with check (
    bucket_id = 'conversations' AND
    auth.uid()::text = (storage.foldername(name))[1]
);
