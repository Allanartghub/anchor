// weeklyCheckinReminderJob.ts
// Scheduled job to send weekly check-in reminders and follow-ups
// Run this script via cron or a scheduled serverless function

import { createClient } from '@supabase/supabase-js';
import { sendEmail } from './email';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

// Helper: get all users eligible for weekly reminder #1
async function getUsersForWeeklyReminder1() {
  // Users who have weekly_checkin_emails_enabled, have not completed check-in for current period, and have not received reminder 1
  const { data, error } = await supabase.rpc('get_users_for_weekly_reminder_1');
  if (error) throw error;
  return data;
}

// Helper: get all users eligible for weekly reminder #2
async function getUsersForWeeklyReminder2() {
  // Users who received reminder 1 >= 48h ago, have not completed check-in, and have not received reminder 2
  const { data, error } = await supabase.rpc('get_users_for_weekly_reminder_2');
  if (error) throw error;
  return data;
}

// Helper: send notification (actual email logic)
type WeeklyReminderType = 'WEEKLY_REMINDER_1' | 'WEEKLY_REMINDER_2';
interface WeeklyReminderUser {
  user_id: string;
  email: string;
  period_key: string;
}
async function sendWeeklyReminderEmail(user: WeeklyReminderUser, type: WeeklyReminderType) {
  // Compose subject/body based on type
  let subject = 'Your weekly check-in is ready.';
  let bodyCopy = 'Your weekly check-in is ready.';
  if (type === 'WEEKLY_REMINDER_2') {
    // Use one of the other approved neutral messages for follow-up
    subject = 'Time to reflect on this week’s load.';
    bodyCopy = 'Take 2 minutes to check in.';
  }
  const checkinLink = `${process.env.APP_BASE_URL || 'https://anka.app'}/checkin`;
  const preferencesLink = `${process.env.APP_BASE_URL || 'https://anka.app'}/settings/notifications`;
  const html = `
    <p>${bodyCopy}</p>
    <p><a href="${checkinLink}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:5px;text-decoration:none;">Open Anka</a></p>
    <p style="font-size:12px;color:#888;">You are receiving this email because you enabled weekly check-in reminders.<br>
    <a href="${preferencesLink}">Manage notification preferences</a></p>
  `;

  await sendEmail({
    to: user.email,
    subject,
    html,
    text: `${bodyCopy}\n\nOpen: ${checkinLink}\n\nTo manage notifications: ${preferencesLink}`,
  });

  // Log event for idempotency
  await supabase.from('notification_events').insert({
    user_id: user.user_id,
    type,
    period_key: user.period_key,
  });
}

export async function runWeeklyCheckinReminderJob() {
  // Reminder 1
  const users1 = await getUsersForWeeklyReminder1();
  for (const user of users1) {
    await sendWeeklyReminderEmail(user, 'WEEKLY_REMINDER_1');
  }
  // Reminder 2
  const users2 = await getUsersForWeeklyReminder2();
  for (const user of users2) {
    await sendWeeklyReminderEmail(user, 'WEEKLY_REMINDER_2');
  }
}

// If run directly
if (require.main === module) {
  runWeeklyCheckinReminderJob().then(() => {
    console.log('Weekly check-in reminder job complete.');
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
