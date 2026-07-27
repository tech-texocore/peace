import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { NotificationsService } from '../../infra/notifications/notifications.service';

@Public()
@Controller('contact')
export class ContactController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async submit(@Body() body: { name?: string; email?: string; subject?: string; message?: string }) {
    const name = (body.name ?? '').trim();
    const email = (body.email ?? '').trim();
    const message = (body.message ?? '').trim();
    if (!name || !/.+@.+\..+/.test(email) || message.length < 3) throw new BadRequestException('Please provide your name, a valid email and a message');

    const to = this.config.get<string>('contact.email') ?? 'support@peace.local';
    const html = `<p><b>From:</b> ${name} (${email})</p><p><b>Subject:</b> ${body.subject?.trim() || '—'}</p><p>${message}</p>`;
    await this.notifications.sendEmail(to, `Contact form: ${body.subject?.trim() || 'New message'}`, html);
    return { received: true };
  }
}
