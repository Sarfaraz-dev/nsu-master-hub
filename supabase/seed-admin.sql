-- After creating your Supabase Auth user, replace USER_UUID below with that user's UUID.
-- You can find it in Supabase Dashboard -> Authentication -> Users.
insert into public.app_admins (user_id)
values ('USER_UUID_HERE')
on conflict (user_id) do nothing;
