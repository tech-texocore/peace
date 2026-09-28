import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { NotificationsService } from '../../infra/notifications/notifications.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Public()
@Controller('contact')
export class ContactController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async submit(
    @Body()
    body: {
      name?: string;
      email?: string;
      subject?: string;
      message?: string;
    },
  ) {
    const name = (body.name ?? '').trim();
    const email = (body.email ?? '').trim();
    const message = (body.message ?? '').trim();
    if (!name || !/.+@.+\..+/.test(email) || message.length < 3)
      throw new BadRequestException(
        'Please provide your name, a valid email and a message',
      );

    const store = await this.prisma.store.findFirst({
      select: { settings: true },
    });
    const to = (store?.settings as { contact?: { email?: string } } | null)
      ?.contact?.email;
    if (!to)
      throw new BadRequestException(
        'Contact form is not set up yet. Please try again later.',
      );
    const html = `<p><b>From:</b> ${name} (${email})</p><p><b>Subject:</b> ${body.subject?.trim() || '—'}</p><p>${message}</p>`;
    await this.notifications.sendEmail(
      to,
      `Contact form: ${body.subject?.trim() || 'New message'}`,
      html,
    );
    return { received: true };
  }
}
