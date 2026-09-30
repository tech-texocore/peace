import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { EmailService } from '../../infra/notifications/email.service';
import { contactFormEmail } from '../../infra/notifications/email-content';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Public()
@Controller('contact')
export class ContactController {
  constructor(
    private readonly email: EmailService,
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
      select: { id: true, settings: true },
    });
    const to = (store?.settings as { contact?: { email?: string } } | null)
      ?.contact?.email;
    if (!to)
      throw new BadRequestException(
        'Contact form is not set up yet. Please try again later.',
      );
    const subject = body.subject?.trim() || 'New message';
    await this.email.send(store!.id, to, `Contact form: ${subject}`, contactFormEmail(name, email, subject, message));
    return { received: true };
  }
}
