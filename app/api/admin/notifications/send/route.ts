// app/api/admin/notifications/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runWeeklyCheckinReminderJob } from '@/lib/weeklyCheckinReminderJob';
import { maybeSendSupportReplyNotification } from '@/lib/supportReplyNotificationJob';

export async function POST(req: NextRequest) {
  try {
    const { user_id, type, case_id } = await req.json();
    if (!user_id || !type) {
      return NextResponse.json({ error: 'Missing user_id or type' }, { status: 400 });
    }
    if (type === 'SUPPORT_REPLY') {
      if (!case_id) return NextResponse.json({ error: 'Missing case_id' }, { status: 400 });
      await maybeSendSupportReplyNotification(user_id, case_id);
      return NextResponse.json({ success: true });
    } else {
      // For weekly reminders, run the job for all users
      await runWeeklyCheckinReminderJob();
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    return NextResponse.json({ error: error?.toString() }, { status: 500 });
  }
}
