-- Add INSERT policy for game_predictions so edge functions can create predictions
CREATE POLICY "Service role can manage predictions" 
ON public.game_predictions 
FOR ALL 
USING (auth.role() = 'service_role'::text);