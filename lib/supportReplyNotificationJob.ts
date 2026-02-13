// supportReplyNotificationJob.ts
// Triggered when an admin sends a message in a support case
// Should be called after inserting an admin message

import { createClient } from '@supabase/supabase-js';
import { sendEmail } from './email';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

// Helper: check if user is eligible for support message emails
async function isUserEligibleForSupportEmail(user_id: string) {
  const { data, error } = await supabase
    .from('user_notification_prefs')
    .select('support_message_emails_enabled')
    .eq('user_id', user_id)
    .maybeSingle();
  if (error) throw error;
  return data?.support_message_emails_enabled === true;
}

// Helper: check rate limit (1 per user per case per day)
async function canSendSupportReplyEmail(user_id: string, case_id: string) {
  const { data, error } = await supabase
    .from('notification_events')
    .select('id')
    .eq('user_id', user_id)
    .eq('type', 'SUPPORT_REPLY')
    .eq('case_id', case_id)
    .eq('sent_at_date', new Date().toISOString().slice(0, 10))
    .maybeSingle();
  if (error) throw error;
  return !data;
}

// Helper: send notification (actual email logic)
async function sendSupportReplyEmail(user_id: string, case_id: string) {
  // Fetch user email
  const { data: user, error: userError } = await supabase
    .from('auth.users')
    .select('email')
    .eq('id', user_id)
    .maybeSingle();
  if (userError || !user?.email) {
    console.warn('Could not fetch user email for support reply notification', userError);
    return;
  }

  // Compose email
  const subject = 'You have a new message in Support.';
  const supportLink = `${process.env.APP_BASE_URL || 'https://anka.app'}/support-inbox/${case_id}`;
  const preferencesLink = `${process.env.APP_BASE_URL || 'https://anka.app'}/settings/notifications`;
  const html = `
    <p>You have a new message in Support.</p>
    <p><a href="${supportLink}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:5px;text-decoration:none;">Open Anka</a></p>
    <p style="font-size:12px;color:#888;">You are receiving this email because you enabled support message notifications.<br>
    <a href="${preferencesLink}">Manage notification preferences</a></p>
  `;

  await sendEmail({
    to: user.email,
    subject,
    html,
    text: `You have a new message in Support. Open: ${supportLink}\n\nTo manage notifications: ${preferencesLink}`,
  });

  // Log event for idempotency
  await supabase.from('notification_events').insert({
    user_id,
    type: 'SUPPORT_REPLY',
    case_id,
    sent_at_date: new Date().toISOString().slice(0, 10),
  });
}

export async function maybeSendSupportReplyNotification(user_id: string, case_id: string) {
  if (!(await isUserEligibleForSupportEmail(user_id))) return;
  if (!(await canSendSupportReplyEmail(user_id, case_id))) return;
  await sendSupportReplyEmail(user_id, case_id);
}
