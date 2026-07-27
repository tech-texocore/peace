import { BadRequestException, Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

interface PostOffice {
  Name: string;
  District: string;
  State: string;
}

@Controller('geo')
export class GeoController {
  // Looks up an Indian PIN code via the free postalpincode.in API and returns
  // the state, district and the list of localities for that pincode.
  @Public()
  @Get('pincode/:pincode')
  async pincode(@Param('pincode') pincode: string) {
    if (!/^\d{6}$/.test(pincode)) throw new BadRequestException('Invalid pincode');

    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const body = (await res.json()) as Array<{ Status: string; PostOffice: PostOffice[] | null }>;
    const entry = Array.isArray(body) ? body[0] : body;

    if (entry?.Status !== 'Success' || !entry?.PostOffice?.length) {
      throw new NotFoundException('No records found for this pincode');
    }

    const offices = entry.PostOffice;
    return {
      pincode,
      state: offices[0].State,
      district: offices[0].District,
      localities: [...new Set(offices.map((o) => o.Name))],
    };
  }
}
