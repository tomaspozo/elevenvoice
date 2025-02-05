-- Create the conversations bucket
insert into storage.buckets (id, name)
values ('conversations', 'conversations')
on conflict do nothing;

-- Create policy for authenticated access
create policy "Allow authenticated access"
on "storage"."objects"
as permissive
for all
to authenticated
using ((bucket_id = 'conversations'::text))
with check ((bucket_id = 'conversations'::text));

-- Create policy for authenticated users to upload files
create policy "Allow authenticated users to upload files"
on "storage"."objects"
as permissive
for insert
to authenticated
with check (((bucket_id = 'conversations'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
