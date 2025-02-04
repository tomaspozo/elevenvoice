-- Drop existing policies if they exist
drop policy if exists "Users can upload their own conversation files" on storage.objects;
drop policy if exists "Users can read their own conversation files" on storage.objects;
drop policy if exists "Users can update their own conversation files" on storage.objects;

-- Create a simple policy that allows authenticated users to access the bucket
create policy "Allow authenticated access"
on storage.objects for all
to authenticated
using ( bucket_id = 'conversations' )
with check ( bucket_id = 'conversations' );
