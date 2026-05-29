import type { VerticalSchema } from '../types';

export const nurserySchema: VerticalSchema = {
  vertical: 'nursery',
  industryContext: 'retail nursery and garden center — trees, shrubs, ornamentals, seasonal plants',

  extractionHints: [
    'plant types and species mentioned (trees, shrubs, perennials, annuals, tropicals)',
    'container sizes referenced (1 gal, 5 gal, 15 gal, 30 gal, 45 gal, 100 gal)',
    'delivery or installation services — do they offer it, is it priced?',
    'warranty or guarantee language — how long, what conditions?',
    'seasonal events, sales, or availability windows',
    'pricing — visible on site, ranges mentioned, or no pricing at all?',
    'certifications (Texas Certified Nursery Professional, ISA arborist, TNLA member)',
    'years in business or founding year',
    'family-owned or generational business language',
    'staff or team mentions — named employees, expertise signals',
    'customer testimonials or reviews referenced',
    'social media or newsletter presence linked from site',
    'wholesale or contractor pricing mentioned',
    'landscape design services offered alongside retail',
  ],

  commonPainPoints: [
    'manual invoicing — handwriting tickets, chasing payments',
    'missed add-on sales at the point of purchase (netting, fertilizer, soil amendment)',
    'delivery scheduling and routing — coordinating multiple stops',
    'customer follow-up after purchase — warranty check-ins not happening',
    'social media content — no time to post, nothing ready to go',
    'leakage — large-container plants leaving without protective service purchased',
  ],

  typicalOfferings: [
    { name: 'Customer pickup',              category: 'transport',     price_type: 'flat',     price_unit: 'order'  },
    { name: 'Delivery',                     category: 'transport',     price_type: 'flat',     price_unit: 'order'  },
    { name: 'Delivery and installation',    category: 'transport',     price_type: 'per_unit', price_unit: 'plant'  },
    { name: 'Travel netting',               category: 'addon',         price_type: 'per_unit', price_unit: 'plant'  },
    { name: 'Soil amendment',               category: 'addon',         price_type: 'per_unit', price_unit: 'plant'  },
    { name: 'Fertilizer application',       category: 'addon',         price_type: 'per_unit', price_unit: 'plant'  },
    { name: 'Warranty inspection',          category: 'inspection',    price_type: 'flat',     price_unit: 'visit'  },
    { name: 'Monthly fertilizer service',   category: 'subscription',  price_type: 'flat',     price_unit: 'visit'  },
  ],
};
