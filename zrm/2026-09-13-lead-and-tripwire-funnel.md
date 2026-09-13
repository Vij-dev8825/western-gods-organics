# Lead funnel and tripwire funnel

_ZRM Batch 91 · Day 2, Task 4 · 13 September 2026_

## Assignment

> Day 2 — T4: your lead funnel and tripwire funnel.

Two funnels for Western Gods Organics: one that turns a stranger into a contact
without asking for money, and one that turns a contact into a buyer with a
purchase small enough to say yes to. Prices and mechanics below are read from
the live store on 13 September 2026, not from the course's examples.

---

## Deliverable

### The shape of the thing

```
        content (Instagram, Google, the Business Profile)
                          │
                ┌─────────┴─────────┐
                ▼                   ▼
        LEAD FUNNEL           TRIPWIRE FUNNEL
     "tell me when it's      "₹145 to taste it
       pressed"                 for yourself"
                │                   │
                └─────────┬─────────┘
                          ▼
              CORE — 1 L oil, ₹280–₹440
                          ▼
        PROFIT — 5 L ₹1400–₹1850, subscription, combos
```

The oils are the business. Everything above exists to get someone to their
first litre, and everything below it exists because oil runs out — this is a
product people rebuy every few weeks without being sold to again.

---

### Funnel 1 — the lead funnel

**The offer: "We'll message you the day your oil is pressed."**

Not a discount, not a PDF. A mill that presses in small batches can tell you
when your oil was made, and almost nobody else selling cooking oil in India can
say that. It costs nothing to give, it is true, and it is only interesting
because of how the business actually works.

| Step | What happens | Already built? |
|---|---|---|
| 1 | Content post ends with "we press groundnut every [FILL: pressing day] — want a message when the next batch is done?" | — |
| 2 | They message WhatsApp on +91 88258 75607, or tap **Notify me** on a product page | **Yes** — `stock-notify` route, and the WhatsApp button on every page |
| 3 | Name and number captured against the product they asked about | **Yes** — stock-notify stores product + user |
| 4 | Pressing day: they get the message, with the batch number | **Yes** — `/pressings` page and the batch passport at `/batch/:number` |
| 5 | First order | — |

**Why this and not a discount:** a discount attracts people who want a
discount, and they churn to the next discount. "Tell me when it's fresh"
attracts people who care that it's fresh, which is the only customer this brand
can keep. It also sorts leads by product — someone on the castor list wants
castor, and the follow-up can say so.

**The message, when the batch is pressed:**

> Your groundnut oil was pressed this morning at the mill in Udumalpet — batch
> [FILL: batch no.]. Pressed on the wooden ghani, nothing refined, nothing
> added. You can see the record here: westerngodsorganic.com/batch/[FILL]
>
> 1 litre is ₹280. Reply with your address and we'll send it, or order at
> westerngodsorganic.com.

---

### Funnel 2 — the tripwire funnel

**The tripwire: Cold-Pressed Groundnut Oil, 500 ml — ₹145.**

This is the right one of the twenty-five products, for four reasons:

1. **It is the actual product**, not a sample of something else. A soap bar at
   ₹85 sells a soap; it tells you nothing about whether you'll buy oil.
2. **It is the cheapest oil in the catalogue** — ₹145 against ₹170 castor, ₹175
   coconut, ₹190 sesame.
3. **Groundnut is the everyday cooking oil** in Tamil Nadu. It's what a
   household uses most of, so it has the shortest path to a repeat.
4. **It runs out.** The tripwire's job isn't margin, it's converting a stranger
   into someone who has bought once — and a consumable does that on its own.

**The offer as written:**

> Try a bottle before you commit to a litre.
>
> 500 ml of wood-pressed groundnut oil — ₹145, delivered. Pressed on a wooden
> ghani at our own mill in Udumalpet, unrefined, with the batch number on the
> bottle so you can look up the day it was made.
>
> If you don't taste the difference, don't buy the litre.

That last line is the whole mechanism. It is a real invitation to compare
against the refined oil already in their kitchen, and the brand can afford to
make it because the difference is genuinely tasteable.

**The path after the tripwire:**

| When | Message | Mechanism |
|---|---|---|
| On delivery | Batch record link + how to use it (high smoke point, everyday frying) | existing delivery notification |
| Day 10 | "About half gone? The litre works out at ₹280 — ₹85 less per litre than the 500 ml." | CRM broadcast, **active** segment |
| Day 25 | Subscription offer — 10% off, arriving before it runs out | **built** — `/subscriptions`, 10% discount |
| Day 60, if silent | The slipping-away message | CRM broadcast, **lapsing** segment |

### The arithmetic, with the gaps marked

Per-unit economics for the tripwire, which is the number the course's Day 3
insists you know:

| Line | Value |
|---|---|
| Tripwire price | **₹145** |
| Cost of goods | [FILL: cost to press and bottle 500 ml groundnut] |
| Shipping, one bottle | [FILL: actual courier cost, single 500 ml parcel] |
| Packaging | [FILL: bottle, label, carton] |
| **Margin, or loss, per tripwire** | **[FILL — compute from the three above]** |
| Core offer, 1 L | ₹280 |
| Margin on 1 L | [FILL] |
| 5 L | ₹1400 |
| Margin on 5 L | [FILL] |
| Tripwire → core conversion | [FILL: measure after the first 50] |

**The threshold problem, stated plainly.** Free shipping starts at ₹899 for a
Bronze customer. A ₹145 tripwire is nowhere near it, so every tripwire order
carries its full courier cost — and if that cost is [FILL] against a ₹145 sale,
the tripwire may lose money on every unit.

**That is allowed, but only if it is deliberate.** A tripwire is customer
acquisition: you are paying to convert a stranger into a buyer, and the return
comes on the litre and the litre after that. The number that decides whether
it works is not the margin on ₹145 — it is `(margin on 1 L × conversion rate)`
against `(loss per tripwire)`. Fill the blanks before scaling past the first
fifty, because until then you cannot tell a working funnel from an expensive
one.

### What already exists, and what doesn't

Most of this is built. The gap is not software.

**Built and unused:**

- Welcome coupon — **₹100 flat**, issued automatically on signup
- Referral — **₹100** to the referrer, a code per customer
- Loyalty — 1 point per ₹10 spent, 1 point = ₹1; Silver at 500 points drops free
  shipping to ₹699, Gold at 1500 makes it free always
- Subscriptions at 10% off
- Stock-notify, the pressing calendar, batch passports
- Segmented broadcast — active / slipping / lapsed / never-ordered / top 10%

**Not built:**

- A landing page for the tripwire. Right now the only route in is the product
  page, which shows all three sizes and invites comparison shopping at exactly
  the moment the offer wants a single yes.
- Any measurement of where a customer came from. Without it, both funnels are
  unmeasurable and every number in the table above stays a blank.

---

## Needs real data

- **[FILL: cost to press and bottle 500 ml of groundnut oil]** — from the mill's
  own costing. Without it the tripwire cannot be judged.
- **[FILL: courier cost for a single 500 ml parcel, within Tamil Nadu and outside]**
  — from the shipping partner's rate card.
- **[FILL: margin on 1 L and 5 L]** — the same costing exercise.
- **[FILL: orders per month, and how many are repeats]** — Admin → Customers now
  shows this; read the real segment counts.
- **[FILL: which product sells most]** — same screen.
- **[FILL: WhatsApp list size]** — from the WhatsApp Business account.
- **[FILL: where traffic comes from]** — Search Console shows 43 clicks over
  seven weeks from Google, which is the only measured source; everything else is
  unattributed.

Deliberately not estimated. A funnel plan with invented conversion rates reads
more finished and is worth less than one with the blanks showing.

---

## Notes

**Where the assignment's framing doesn't fit.** The tripwire model comes from
information products, where the thing you sell after costs nothing to deliver
and the tripwire's margin genuinely doesn't matter. This shop ships glass and
oil. Every tripwire has a courier cost attached, so "the tripwire can lose
money" is true here only up to a point, and that point is set by the conversion
rate — which nobody knows yet. Run fifty, count how many buy a litre, then
decide whether to scale it.

**The lead funnel is the better of the two for this business**, and the course
puts the tripwire first. A pressing-day list costs nothing per subscriber, has
no courier attached, and is a list of people who already care about the one
thing that makes this brand different. If only one gets built, build that.

**Next step:** the ₹145 tripwire landing page. One product, one size, one
button, the batch record visible, and no navigation to compare against the
litre. Everything else in the funnel already exists.
