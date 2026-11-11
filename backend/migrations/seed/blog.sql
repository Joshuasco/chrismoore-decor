-- Starter journal posts. Runs only when blog_posts is empty (see database.Seed).
insert into blog_posts (title, slug, excerpt, content, cover_image, category, tags, status, is_featured,
                        published_at, reading_minutes, product_category, seo_description)
values
(
  'How to Measure Your Windows for Curtains',
  'how-to-measure-windows-for-curtains',
  'Get the perfect fall every time. Our step-by-step guide to measuring width, drop and rod height — plus the mistakes we see most often.',
  $md$
Beautiful curtains start with accurate measurements. A few centimetres can be the difference between drapes that pool elegantly and drapes that hover awkwardly above the floor. Grab a **steel tape measure**, a pencil and a friend, and follow these steps.

## 1. Decide where the rod or track will go

Fix your hardware position *before* measuring the drop.

- **Rods** usually sit 10–15 cm above the window frame. Mounting higher — closer to the ceiling — makes a room feel taller.
- **Ceiling tracks** are ideal for floor-to-ceiling drapes and bay windows.
- Extend the rod **15–20 cm beyond each side** of the frame so the curtains can stack back without blocking light.

## 2. Measure the width

Measure the full length of the rod or track (not the window), excluding decorative finials.

For a full, gathered look, the total fabric width should be:

| Heading style | Fullness |
|---|---|
| Eyelet | 1.5 – 2 × track width |
| Pinch pleat | 2 – 2.5 × track width |
| Sheer / voile | 2.5 – 3 × track width |

## 3. Measure the drop

Measure from the top of the rod (eyelets) or the bottom of the rings/hooks (pleats) down to where you want the curtain to finish:

- **Sill length** — 1 cm above the sill. Neat and practical for kitchens.
- **Below sill** — 15 cm below the sill.
- **Floor length** — 1 cm above the floor. Our most popular choice.
- **Puddled** — 5–10 cm extra for a romantic, relaxed look.

## 4. Measure twice, in three places

Walls and floors are rarely perfectly level. Take the drop measurement at the left, centre and right, and use the **shortest** for floor-length curtains.

> **Tip:** Not sure? Send us a photo of your window with the measurements on WhatsApp and we'll recommend the right size and heading — free of charge.

## Common mistakes to avoid

1. Measuring the window instead of the track.
2. Forgetting to allow for fullness.
3. Measuring before the rod is fitted.
4. Using a cloth tape measure (they stretch!).

Once you have your numbers, browse our [curtain collection](/shop?category=curtains) or [rods and tracks](/shop?category=curtain-accessories) to complete the look.
$md$,
  'https://images.unsplash.com/photo-1617104678098-de229db51175?w=1600&q=80&auto=format&fit=crop',
  'Guides', array['curtains','measuring','windows'], 'published', true,
  now() - interval '2 days', 4, 'curtains',
  'Step-by-step guide to measuring windows for curtains: rod height, width, fullness and drop.'
),
(
  'Choosing the Right Rug Size for Every Room',
  'choosing-the-right-rug-size',
  'A rug that is too small is the most common styling mistake. Here''s how to size rugs for living rooms, bedrooms and dining rooms.',
  $md$
The right rug anchors a room and ties your furniture together. The wrong size makes even a beautiful space feel disjointed. Use these simple rules.

## Living room

Choose one of three layouts:

- **All legs on** — every piece of furniture sits fully on the rug. Luxurious; needs a large rug (200 × 300 cm or more).
- **Front legs on** — the front legs of the sofa and chairs rest on the rug. The most versatile option (160 × 230 cm works for most Nigerian living rooms).
- **Floating** — a smaller rug under the coffee table only. Best for compact spaces.

Leave **30–45 cm of bare floor** around the edges of the room.

## Bedroom

The rug should extend at least **45–60 cm beyond each side of the bed**, so your feet land on something soft every morning.

| Bed size | Recommended rug |
|---|---|
| 4 × 6 ft | 160 × 230 cm |
| 6 × 6 ft | 200 × 290 cm |
| 7 × 7 ft | 240 × 340 cm |

## Dining room

Chairs should stay on the rug even when pulled out. Add **60 cm** to every side of the table.

## Choosing a material

- **Wool** — durable and naturally stain-resistant.
- **Jute** — earthy texture, perfect for high-traffic areas.
- **Shag** — ultra-soft; best in bedrooms and lounges.
- **Kilim** — flat-woven, reversible and easy to clean.

> Use painter's tape to mark the rug outline on your floor before you buy. It's the easiest way to see the size in your space.

Explore our [rug collection](/shop?category=rugs) to find your perfect fit.
$md$,
  'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1600&q=80&auto=format&fit=crop',
  'Guides', array['rugs','living room','bedroom'], 'published', false,
  now() - interval '9 days', 4, 'rugs',
  'Rug size guide for living rooms, bedrooms and dining rooms, plus how to choose a rug material.'
),
(
  'Thread Count, Linen or Sateen? A Bedding Guide',
  'thread-count-linen-or-sateen-bedding-guide',
  'Cool and crisp or silky and smooth? We explain thread count, weaves and fabrics so you can choose bed sheets you''ll love sleeping in.',
  $md$
Great sleep starts with the right sheets. Here's what actually matters when choosing bedding — especially in a warm climate.

## Thread count: less important than you think

Thread count is the number of threads woven into one square inch of fabric. **Between 300 and 600** is the sweet spot. Beyond that, manufacturers often use thinner, twisted threads that don't feel any better — and can trap heat.

## Weave makes the biggest difference

- **Percale** — a simple one-over, one-under weave. Crisp, matte and very breathable. Perfect for hot sleepers.
- **Sateen** — more threads on the surface give a silky feel and subtle sheen. Warmer and drapes beautifully.

## Fabric

| Fabric | Feels | Best for |
|---|---|---|
| Egyptian cotton | Soft, durable | Everyday luxury |
| French linen | Textured, airy | Hot nights, relaxed style |
| Microfibre | Smooth, wrinkle-free | Guest rooms, kids' rooms |

## Caring for your bedding

1. Wash before first use.
2. Use a gentle cycle at 30–40 °C.
3. Avoid fabric softener on linen — it reduces absorbency.
4. Rotate between two sets to extend their life.

> **Our pick for Nigerian weather:** stonewashed linen or cotton percale. Both stay cool and get softer with every wash.

Shop our [bed sheet collection](/shop?category=bed-sheets) to find your perfect set.
$md$,
  'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=1600&q=80&auto=format&fit=crop',
  'Bedroom', array['bed sheets','bedding','care'], 'published', false,
  now() - interval '16 days', 3, 'bed-sheets',
  'How to choose bed sheets: thread count, percale vs sateen, cotton vs linen, and bedding care tips.'
),
(
  'Vertical Blinds for Offices and Homes: What to Know',
  'vertical-blinds-guide',
  'Fabric, blackout or PVC? How vertical blinds control light and heat, which type suits each room, and how to keep them looking new.',
  $md$
Vertical blinds are one of the most practical window treatments for large windows and sliding doors. They control light precisely, reduce heat gain and are easy to maintain.

## Why choose vertical blinds?

- **Precise light control** — tilt the louvres to direct light without losing privacy.
- **Great for wide windows** — they stack neatly to one side.
- **Heat reduction** — blackout louvres reflect sunlight, helping rooms stay cool.
- **Low maintenance** — individual louvres can be replaced if damaged.

## Which type is right for you?

| Type | Best for |
|---|---|
| Fabric | Living rooms and bedrooms — soft, diffused light |
| Blackout | Bedrooms, offices, conference rooms |
| PVC | Kitchens, clinics and busy offices — wipe-clean |

## Measuring for vertical blinds

- **Recess fit:** measure the inside width at the top, middle and bottom; use the smallest. Measure the drop at the left, centre and right.
- **Face fit:** add 10 cm to the width and 10 cm to the drop to overlap the frame.

> We supply made-to-measure blinds priced per square metre. Send us your window sizes on WhatsApp for a quick quote.

## Cleaning tips

1. Dust weekly with a microfibre cloth or soft vacuum attachment.
2. Spot-clean fabric louvres with mild soap and water.
3. Wipe PVC louvres with a damp cloth.

Browse our [vertical blinds](/shop?category=vertical-blinds) to get started.
$md$,
  'https://images.unsplash.com/photo-1616137466211-f939a420be84?w=1600&q=80&auto=format&fit=crop',
  'Guides', array['vertical blinds','offices','windows'], 'published', false,
  now() - interval '23 days', 3, 'vertical-blinds',
  'Guide to vertical blinds: fabric vs blackout vs PVC, measuring for recess or face fit, and cleaning tips.'
);
