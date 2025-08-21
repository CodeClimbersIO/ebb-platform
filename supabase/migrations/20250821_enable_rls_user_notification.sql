-- Enable RLS on user_notification table to fix security issue

-- Enable Row Level Security
ALTER TABLE public.user_notification ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own notifications
CREATE POLICY "Users can view their own notifications"
    ON public.user_notification FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Create policy for users to update their own notifications (e.g., mark as read)
CREATE POLICY "Users can update their own notifications"
    ON public.user_notification FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Only service role can insert notifications (system generates them)
CREATE POLICY "Only service role can insert notifications"
    ON public.user_notification FOR INSERT
    WITH CHECK (false);

-- Only service role can delete notifications
CREATE POLICY "Only service role can delete notifications"
    ON public.user_notification FOR DELETE
    USING (false);