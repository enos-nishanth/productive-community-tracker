-- Fix search_path for increment_likes function
CREATE OR REPLACE FUNCTION increment_likes(post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.blog_posts
  SET likes_count = likes_count + 1
  WHERE id = post_id;
END;
$$;

-- Fix search_path for decrement_likes function
CREATE OR REPLACE FUNCTION decrement_likes(post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.blog_posts
  SET likes_count = GREATEST(0, likes_count - 1)
  WHERE id = post_id;
END;
$$;