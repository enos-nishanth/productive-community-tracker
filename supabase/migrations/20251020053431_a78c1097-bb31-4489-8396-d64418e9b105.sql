-- Enable realtime for profiles table to sync points and streak updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.blog_posts;