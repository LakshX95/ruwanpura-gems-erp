/**
 * Seed with realistic Sri Lankan trade data.
 *
 * The point is not to have "some rows". It is to build against the shape and
 * volume of real stock — hundreds of stones, parcels split into dozens of
 * pieces, cost spread across purchase/cutting/heating/lab, and goods sitting
 * out with cutters. Screens designed against three rows collapse on real data.
 */
import { loadEnvFile } from "node:process";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import {
  CostKind,
  CustodyReason,
  Role,
  StoneKind,
  StoneStatus,
  TransformKind,
} from "../src/generated/prisma/enums";

try {
  loadEnvFile(".env");
} catch {}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

/** Deterministic PRNG so every reseed produces the identical dataset. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260820);

const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
const between = (lo: number, hi: number) => lo + rnd() * (hi - lo);
const intBetween = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));
const ct = (n: number) => Number(n.toFixed(3));
const rupees = (n: number) => BigInt(Math.round(n * 100));
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);

// ---------------------------------------------------------------- reference

const VARIETIES: [string, string][] = [
  ["Blue Sapphire", "Corundum"],
  ["Padparadscha", "Corundum"],
  ["Yellow Sapphire", "Corundum"],
  ["Pink Sapphire", "Corundum"],
  ["White Sapphire", "Corundum"],
  ["Star Sapphire", "Corundum"],
  ["Ruby", "Corundum"],
  ["Cat's Eye Chrysoberyl", "Chrysoberyl"],
  ["Alexandrite", "Chrysoberyl"],
  ["Spinel", "Spinel"],
  ["Garnet", "Garnet"],
  ["Moonstone", "Feldspar"],
  ["Zircon", "Zircon"],
  ["Tourmaline", "Tourmaline"],
];

const SHAPES = [
  "Oval", "Cushion", "Round", "Pear", "Marquise",
  "Emerald Cut", "Trillion", "Cabochon", "Sugarloaf", "Freeform",
];

const COLOURS = [
  "Royal Blue", "Cornflower Blue", "Vivid Blue", "Pastel Blue", "Greenish Blue",
  "Pink-Orange", "Vivid Pink", "Hot Pink", "Canary Yellow", "Golden Yellow",
  "Pigeon Blood Red", "Vivid Red", "Honey", "Colourless", "Grey-Blue", "Peacock",
];

const TREATMENTS: [string, string][] = [
  ["None (Unheated)", "No indications of thermal enhancement."],
  ["Heated", "Evidence of heat treatment. Disclosed to buyer."],
  ["Heated, minor residue", "Heat treatment with minor residue in fissures. Disclosed."],
  ["Diffusion", "Lattice diffusion treatment. Disclosed to buyer."],
  ["Fissure-filled", "Fissures filled. Disclosed to buyer."],
];

/**
 * A pink sapphire is not "royal blue" and a moonstone is not "pigeon blood".
 * Constraining the generated data to what each variety can actually be is the
 * difference between a demo the client recognises and one they dismiss.
 */
const COLOUR_FOR: Record<string, string[]> = {
  "Blue Sapphire": ["Royal Blue", "Cornflower Blue", "Vivid Blue", "Pastel Blue", "Greenish Blue", "Grey-Blue", "Peacock"],
  Padparadscha: ["Pink-Orange"],
  "Yellow Sapphire": ["Canary Yellow", "Golden Yellow", "Honey"],
  "Pink Sapphire": ["Vivid Pink", "Hot Pink"],
  "White Sapphire": ["Colourless"],
  "Star Sapphire": ["Royal Blue", "Grey-Blue", "Pastel Blue"],
  Ruby: ["Pigeon Blood Red", "Vivid Red"],
  "Cat's Eye Chrysoberyl": ["Honey", "Golden Yellow"],
  Alexandrite: ["Peacock", "Greenish Blue"],
  Spinel: ["Vivid Red", "Hot Pink", "Royal Blue", "Grey-Blue"],
  Garnet: ["Vivid Red", "Honey"],
  Moonstone: ["Colourless", "Pastel Blue", "Grey-Blue"],
  Zircon: ["Honey", "Golden Yellow", "Colourless", "Pastel Blue"],
  Tourmaline: ["Greenish Blue", "Hot Pink", "Honey", "Peacock"],
};

/** Heat and diffusion belong to corundum; most other species are sold natural. */
const TREATMENT_FOR: Record<string, string[]> = {
  "Blue Sapphire": ["None (Unheated)", "Heated", "Heated, minor residue", "Diffusion"],
  Padparadscha: ["None (Unheated)", "Heated"],
  "Yellow Sapphire": ["None (Unheated)", "Heated", "Diffusion"],
  "Pink Sapphire": ["None (Unheated)", "Heated"],
  "White Sapphire": ["None (Unheated)", "Heated"],
  "Star Sapphire": ["None (Unheated)", "Heated"],
  Ruby: ["None (Unheated)", "Heated", "Heated, minor residue", "Fissure-filled"],
  "Cat's Eye Chrysoberyl": ["None (Unheated)"],
  Alexandrite: ["None (Unheated)"],
  Spinel: ["None (Unheated)"],
  Garnet: ["None (Unheated)"],
  Moonstone: ["None (Unheated)"],
  Zircon: ["None (Unheated)", "Heated"],
  Tourmaline: ["None (Unheated)", "Heated"],
};

/** Star stones and cat's eyes only show their effect when cut as a dome. */
const CABOCHON_ONLY = new Set(["Star Sapphire", "Cat's Eye Chrysoberyl"]);

const shapeFor = (v: string, shapes: { id: string; name: string }[]) =>
  CABOCHON_ONLY.has(v)
    ? pick(shapes.filter((s) => s.name === "Cabochon" || s.name === "Sugarloaf"))
    : pick(shapes.filter((s) => s.name !== "Cabochon" && s.name !== "Sugarloaf"));

const colourFor = (v: string, colours: { id: string; name: string }[]) => {
  const allowed = COLOUR_FOR[v] ?? [];
  const pool = colours.filter((c) => allowed.includes(c.name));
  return pool.length ? pick(pool) : pick(colours);
};

const treatmentFor = (v: string, treatments: { id: string; name: string }[]) => {
  const allowed = TREATMENT_FOR[v] ?? [];
  const pool = treatments.filter((t) => allowed.includes(t.name));
  return pool.length ? pick(pool) : pick(treatments);
};

const CLARITIES = ["Loupe Clean", "Eye Clean", "Slightly Included", "Included", "Heavily Included"];
const ORIGINS = ["Ratnapura, Sri Lanka", "Elahera, Sri Lanka", "Balangoda, Sri Lanka", "Okkampitiya, Sri Lanka"];
const LABS = ["NGJA", "GRS", "GIA", "Lotus", "SSEF"];

/** Rough per-carat price bands in LKR, before cutting and treatment. */
const PRICE_BAND: Record<string, [number, number]> = {
  "Blue Sapphire": [45_000, 900_000],
  Padparadscha: [250_000, 3_500_000],
  "Yellow Sapphire": [18_000, 180_000],
  "Pink Sapphire": [40_000, 400_000],
  "White Sapphire": [6_000, 40_000],
  "Star Sapphire": [15_000, 220_000],
  Ruby: [80_000, 1_200_000],
  "Cat's Eye Chrysoberyl": [90_000, 1_400_000],
  Alexandrite: [200_000, 2_500_000],
  Spinel: [25_000, 300_000],
  Garnet: [4_000, 45_000],
  Moonstone: [1_500, 18_000],
  Zircon: [3_000, 28_000],
  Tourmaline: [8_000, 90_000],
};

/**
 * Per-carat price is not linear in weight — it steps up at size thresholds.
 * A 2.05 ct stone is worth materially more per carat than a 1.95 ct one.
 */
function sizeMultiplier(weight: number): number {
  if (weight >= 10) return 3.4;
  if (weight >= 5) return 2.4;
  if (weight >= 3) return 1.8;
  if (weight >= 2) return 1.4;
  if (weight >= 1) return 1.0;
  return 0.65;
}

const SUPPLIERS = [
  "Ratnapura Gem Traders", "K. Wijeratne (Broker)", "Elahera Mining Syndicate",
  "S. Bandara Gems", "Beruwala Gem Mart", "Pelmadulla Rough Supply",
  "M. Nizam & Sons", "Balangoda Gem Collectors",
];
const CUTTERS = ["Sunil Lapidary Works", "Ranjith Cutting Centre", "New Star Lapidary", "Perera Bros. Cutting"];
const HEATERS = ["Beruwala Heat Treatment", "A. Farook Burning Works", "Classic Thermal Enhancement"];
const LAB_PARTIES = ["NGJA Gem Testing Laboratory", "GRS Sri Lanka", "Lotus Gemology (Bangkok)"];
const CUSTOMERS = [
  "Colombo Fine Gems (Pvt) Ltd", "Bangkok Trade House", "H. Tanaka, Tokyo",
  "Emerald Bay Jewellers", "Dubai Gem Souk LLC", "R. Fernando (Retail)",
];

async function main() {
  console.log("Clearing existing data…");
  await db.auditLog.deleteMany();
  await db.memoLine.deleteMany();
  await db.memo.deleteMany();
  await db.saleLine.deleteMany();
  await db.sale.deleteMany();
  await db.jobLine.deleteMany();
  await db.job.deleteMany();
  await db.media.deleteMany();
  await db.custodyEvent.deleteMany();
  await db.transformationLine.deleteMany();
  await db.transformation.deleteMany();
  await db.costEntry.deleteMany();
  await db.stone.deleteMany();
  await db.purchase.deleteMany();
  await db.location.deleteMany();
  await db.party.deleteMany();
  await db.refVariety.deleteMany();
  await db.refShape.deleteMany();
  await db.refColour.deleteMany();
  await db.refTreatment.deleteMany();
  await db.appUser.deleteMany();

  // ------------------------------------------------------------------ users
  const hash = await bcrypt.hash("ruwanpura123", 10);
  const [owner, manager, clerk] = await Promise.all([
    db.appUser.create({ data: { email: "owner@ruwanpura.lk", name: "Nimal Perera", passwordHash: hash, role: Role.OWNER } }),
    db.appUser.create({ data: { email: "manager@ruwanpura.lk", name: "Chaminda Silva", passwordHash: hash, role: Role.MANAGER } }),
    db.appUser.create({ data: { email: "clerk@ruwanpura.lk", name: "Dilani Fernando", passwordHash: hash, role: Role.CLERK } }),
  ]);
  console.log("Users: owner / manager / clerk  (password: ruwanpura123)");

  // -------------------------------------------------------------- reference
  const varieties = await Promise.all(
    VARIETIES.map(([name, species], i) =>
      db.refVariety.create({ data: { name, species, sortKey: i } }),
    ),
  );
  const shapes = await Promise.all(
    SHAPES.map((name, i) => db.refShape.create({ data: { name, sortKey: i } })),
  );
  const colours = await Promise.all(
    COLOURS.map((name, i) => db.refColour.create({ data: { name, sortKey: i } })),
  );
  const treatments = await Promise.all(
    TREATMENTS.map(([name, disclosure], i) =>
      db.refTreatment.create({ data: { name, disclosure, sortKey: i } }),
    ),
  );

  // -------------------------------------------------------------- locations
  const mainSafe = await db.location.create({ data: { name: "Main Safe — Colombo" } });
  const trays = await Promise.all(
    ["Tray A — Blue", "Tray B — Fancy", "Tray C — Rough", "Tray D — Certified"].map((name) =>
      db.location.create({ data: { name, parentId: mainSafe.id } }),
    ),
  );
  const showroom = await db.location.create({ data: { name: "Showroom Display" } });
  const beruwala = await db.location.create({ data: { name: "Beruwala Office Safe" } });
  const inHouseLocations = [...trays, showroom, beruwala];

  // ----------------------------------------------------------------- people
  const suppliers = await Promise.all(
    SUPPLIERS.map((name) => db.party.create({ data: { name, isSupplier: true, phone: `+94 ${intBetween(70, 78)} ${intBetween(1000000, 9999999)}` } })),
  );
  const cutters = await Promise.all(
    CUTTERS.map((name) => db.party.create({ data: { name, isVendor: true, note: "Cutting & polishing" } })),
  );
  const heaters = await Promise.all(
    HEATERS.map((name) => db.party.create({ data: { name, isVendor: true, note: "Heat treatment" } })),
  );
  const labs = await Promise.all(
    LAB_PARTIES.map((name) => db.party.create({ data: { name, isVendor: true, note: "Gemmological laboratory" } })),
  );
  const customers = await Promise.all(
    CUSTOMERS.map((name) => db.party.create({ data: { name, isCustomer: true } })),
  );

  // -------------------------------------------------------------- inventory
  let stoneSeq = 0;
  const nextStoneNo = (prefix: string) =>
    `${prefix}-2026-${String(++stoneSeq).padStart(4, "0")}`;

  const allStoneIds: string[] = [];
  let lotSeq = 0;

  // 16 parcel purchases, most of which get sorted into individual stones.
  for (let p = 0; p < 16; p++) {
    const supplier = pick(suppliers);
    const [vName] = pick(VARIETIES);
    const variety = varieties.find((v) => v.name === vName)!;
    const purchasedOn = daysAgo(intBetween(20, 900));
    const lotWeight = ct(between(40, 400));
    const perCt = between(...(PRICE_BAND[vName] ?? [10_000, 100_000])) * 0.12; // rough is cheap
    const totalMinor = rupees(Math.round(lotWeight * perCt));

    const purchase = await db.purchase.create({
      data: {
        purchaseNo: `PUR-2026-${String(++lotSeq).padStart(3, "0")}`,
        supplierId: supplier.id,
        purchasedOn,
        description: `${vName} rough parcel`,
        weightCt: lotWeight,
        totalMinor,
        currency: "LKR",
        brokerName: rnd() < 0.45 ? pick(["K. Wijeratne", "S. Rajapaksa", "M. Haleem"]) : null,
      },
    });

    const lot = await db.stone.create({
      data: {
        stoneNo: nextStoneNo("LOT"),
        kind: StoneKind.LOT,
        status: StoneStatus.IN_STOCK,
        weightCt: lotWeight,
        pieceCount: intBetween(30, 200),
        varietyId: variety.id,
        origin: pick(ORIGINS),
        locationId: trays[2].id,
        purchaseId: purchase.id,
        createdById: manager.id,
        createdAt: purchasedOn,
        note: `Rough parcel from ${supplier.name}`,
      },
    });
    await db.costEntry.create({
      data: {
        stoneId: lot.id, kind: CostKind.PURCHASE,
        amountMinor: totalMinor, baseMinor: totalMinor, currency: "LKR",
        incurredOn: purchasedOn, sourceDoc: purchase.purchaseNo,
        note: "Parcel purchase",
      },
    });
    await db.custodyEvent.create({
      data: {
        stoneId: lot.id, reason: CustodyReason.RECEIPT, weightCt: lotWeight,
        toLocationId: trays[2].id, occurredAt: purchasedOn, createdById: manager.id,
      },
    });
    allStoneIds.push(lot.id);

    // 12 of 16 parcels get sorted and cut into individual stones.
    if (p >= 12) continue;

    const childCount = intBetween(14, 62);
    const children: { id: string; weight: number }[] = [];
    // Cut yield: polished output is a fraction of rough weight.
    const yieldPct = between(0.18, 0.38);
    const outputTotal = lotWeight * yieldPct;
    const splitDate = new Date(purchasedOn.getTime() + intBetween(10, 90) * 86_400_000);

    // Distribute the output weight across children with a long tail —
    // a few good stones and many small ones, which is how parcels behave.
    const rawShares = Array.from({ length: childCount }, () => Math.pow(rnd(), 2.2) + 0.05);
    const shareSum = rawShares.reduce((a, b) => a + b, 0);

    for (let c = 0; c < childCount; c++) {
      const weight = ct(Math.max(0.15, (rawShares[c] / shareSum) * outputTotal));
      const treatment = treatmentFor(vName, treatments);
      const isUnheated = treatment.name.startsWith("None");
      const shape = shapeFor(vName, shapes);
      const colour = colourFor(vName, colours);
      const certified = weight > 1.5 && rnd() < 0.45;
      // A child stone comes into existence at the split, which is also when
      // its share of the parcel cost is allocated. Dating it later made every
      // allocation look like it predated the stone.
      const created = splitDate;

      const askPerCt =
        between(...(PRICE_BAND[vName] ?? [10_000, 100_000])) *
        sizeMultiplier(weight) *
        (isUnheated ? 2.1 : 1) *
        (certified ? 1.25 : 1);

      const child = await db.stone.create({
        data: {
          stoneNo: nextStoneNo(vName.slice(0, 2).toUpperCase()),
          kind: StoneKind.STONE,
          status: StoneStatus.IN_STOCK,
          weightCt: weight,
          varietyId: variety.id,
          shapeId: shape.id,
          colourId: colour.id,
          treatmentId: treatment.id,
          clarity: pick(CLARITIES),
          lengthMm: Number((Math.cbrt(weight) * 6.2 + between(-0.4, 0.4)).toFixed(2)),
          widthMm: Number((Math.cbrt(weight) * 5.1 + between(-0.4, 0.4)).toFixed(2)),
          depthMm: Number((Math.cbrt(weight) * 3.6 + between(-0.3, 0.3)).toFixed(2)),
          origin: pick(ORIGINS),
          certLab: certified ? pick(LABS) : null,
          certNo: certified ? `${intBetween(100000, 999999)}` : null,
          locationId: pick(inHouseLocations).id,
          purchaseId: purchase.id,
          askingPriceMinor: rupees(Math.round(askPerCt * weight)),
          createdById: pick([manager, clerk]).id,
          createdAt: created,
        },
      });
      children.push({ id: child.id, weight });
      allStoneIds.push(child.id);
    }

    // The split itself: input the lot, output the children, with the lost
    // weight recorded so that sum(in) == sum(out) + loss holds exactly.
    const outWeight = children.reduce((a, c) => a + c.weight, 0);
    const loss = ct(lotWeight - outWeight);
    const transformation = await db.transformation.create({
      data: {
        kind: TransformKind.SPLIT,
        occurredAt: splitDate,
        lossCt: loss,
        costAllocMethod: "by_weight",
        note: `Sorted and cut into ${childCount} stones`,
        lines: {
          create: [
            { direction: "input", stoneId: lot.id, weightCt: lotWeight, costShareMinor: totalMinor },
            ...children.map((c) => ({
              direction: "output" as const,
              stoneId: c.id,
              weightCt: c.weight,
              costShareMinor: BigInt(Math.round(Number(totalMinor) * (c.weight / outWeight))),
            })),
          ],
        },
      },
      include: { lines: true },
    });

    // Push the parcel's cost down onto the children, then mark the parcel
    // consumed so valuation does not count the same money twice.
    for (const line of transformation.lines.filter((l) => l.direction === "output")) {
      await db.costEntry.create({
        data: {
          stoneId: line.stoneId, kind: CostKind.ALLOCATION,
          amountMinor: line.costShareMinor!, baseMinor: line.costShareMinor!,
          currency: "LKR", incurredOn: splitDate,
          sourceDoc: purchase.purchaseNo, note: "Share of parcel cost (by weight)",
        },
      });
    }
    await db.stone.update({
      where: { id: lot.id },
      data: { status: StoneStatus.CONSUMED, locationId: null },
    });

    // Processing costs and lab fees on a subset of the children.
    for (const c of children) {
      const cutCost = rupees(Math.round(between(1200, 9000)));
      await db.costEntry.create({
        data: {
          stoneId: c.id, kind: CostKind.CUTTING, amountMinor: cutCost, baseMinor: cutCost,
          currency: "LKR", incurredOn: splitDate, note: `Cutting — ${pick(cutters).name}`,
        },
      });
      // Heating and laboratory charges are posted by the job records below,
      // so that the cost ledger and the job history reconcile.
    }
  }

  // A handful of single-stone purchases — the other way stock arrives.
  for (let i = 0; i < 60; i++) {
    const supplier = pick(suppliers);
    const [vName] = pick(VARIETIES);
    const variety = varieties.find((v) => v.name === vName)!;
    const weight = ct(between(0.5, 12));
    const treatment = treatmentFor(vName, treatments);
    const isUnheated = treatment.name.startsWith("None");
    const purchasedOn = daysAgo(intBetween(10, 720));
    const perCt = between(...(PRICE_BAND[vName] ?? [10_000, 100_000])) * sizeMultiplier(weight) * (isUnheated ? 1.8 : 1);
    const cost = rupees(Math.round(perCt * weight * 0.62));

    const purchase = await db.purchase.create({
      data: {
        purchaseNo: `PUR-2026-${String(++lotSeq).padStart(3, "0")}`,
        supplierId: supplier.id, purchasedOn,
        description: `Single ${vName}, ${weight.toFixed(2)} ct`,
        weightCt: weight, totalMinor: cost, currency: "LKR",
      },
    });

    const certified = weight > 2 && rnd() < 0.6;
    const stone = await db.stone.create({
      data: {
        stoneNo: nextStoneNo(vName.slice(0, 2).toUpperCase()),
        kind: StoneKind.STONE, status: StoneStatus.IN_STOCK,
        weightCt: weight, varietyId: variety.id,
        shapeId: shapeFor(vName, shapes).id,
        colourId: colourFor(vName, colours).id,
        treatmentId: treatment.id,
        clarity: pick(CLARITIES),
        lengthMm: Number((Math.cbrt(weight) * 6.2).toFixed(2)),
        widthMm: Number((Math.cbrt(weight) * 5.1).toFixed(2)),
        depthMm: Number((Math.cbrt(weight) * 3.6).toFixed(2)),
        origin: pick(ORIGINS),
        certLab: certified ? pick(LABS) : null,
        certNo: certified ? `${intBetween(100000, 999999)}` : null,
        locationId: pick(inHouseLocations).id,
        purchaseId: purchase.id,
        askingPriceMinor: rupees(Math.round(perCt * weight)),
        createdById: pick([owner, manager, clerk]).id,
        createdAt: purchasedOn,
      },
    });
    await db.costEntry.create({
      data: {
        stoneId: stone.id, kind: CostKind.PURCHASE, amountMinor: cost, baseMinor: cost,
        currency: "LKR", incurredOn: purchasedOn, sourceDoc: purchase.purchaseNo,
      },
    });
    await db.custodyEvent.create({
      data: {
        stoneId: stone.id, reason: CustodyReason.RECEIPT, weightCt: weight,
        toLocationId: stone.locationId, occurredAt: purchasedOn, createdById: manager.id,
      },
    });
    allStoneIds.push(stone.id);
  }

  // ------------------------------------------------------ job history
  // Each vendor is given a characteristic yield and loss rate. Without that
  // signal the performance report is noise, and the whole point of the module
  // is to answer "which cutter is actually best?" with evidence.
  const CUTTER_YIELD: Record<string, number> = {
    "Sunil Lapidary Works": 0.86,
    "Ranjith Cutting Centre": 0.8,
    "New Star Lapidary": 0.74,
    "Perera Bros. Cutting": 0.68,
  };
  const HEATER_LOSS: Record<string, number> = {
    "Beruwala Heat Treatment": 0.02,
    "A. Farook Burning Works": 0.06,
    "Classic Thermal Enhancement": 0.11,
  };

  let jobSeq = 0;
  const jobNo = (prefix: string) =>
    `${prefix}-2026-${String(++jobSeq).padStart(4, "0")}`;

  /**
   * Closed jobs are written retrospectively: the stone's current weight is the
   * weight that came back, and the issued weight is derived from it. That keeps
   * the inventory consistent while still producing a real yield history.
   */
  async function closedJob(
    kind: "CUTTING" | "HEATING" | "LAB",
    vendor: { id: string; name: string },
    batch: { id: string; weightCt: number; createdAt: Date }[],
    prefix: string,
  ) {
    if (batch.length === 0) return;
    // Work cannot predate the stone. Without this the cost breakdown showed a
    // stone being cut months before it was bought, which is the first thing a
    // client notices in a demo.
    const earliest = Math.max(...batch.map((b) => b.createdAt.getTime()));
    const latest = Date.now() - 3 * 86_400_000;
    if (earliest >= latest) return;
    const issuedOn = new Date(earliest + rnd() * (latest - earliest));
    const turnaround = intBetween(6, 45);
    const returnedOn = new Date(issuedOn.getTime() + turnaround * 86_400_000);
    if (returnedOn > new Date()) return;

    const lines = batch.map((st) => {
      let weightOut = st.weightCt;
      let outcome: "RETURNED" | "LOST" | "BROKEN" = "RETURNED";
      let weightIn = st.weightCt;

      if (kind === "CUTTING") {
        // A recut: it went out heavier than it came back.
        weightOut = ct(st.weightCt / (CUTTER_YIELD[vendor.name] ?? 0.78));
      } else if (kind === "HEATING") {
        weightOut = ct(st.weightCt / between(0.995, 1.0));
        if (rnd() < (HEATER_LOSS[vendor.name] ?? 0.05)) {
          outcome = rnd() < 0.5 ? "LOST" : "BROKEN";
          weightIn = 0;
        }
      }

      const charge =
        kind === "LAB"
          ? rupees(Math.round(between(6000, 45000)))
          : kind === "HEATING"
            ? rupees(Math.round(between(2000, 14000)))
            : rupees(Math.round(between(1500, 11000)));

      return { stoneId: st.id, weightOut, weightIn, outcome, charge };
    });

    const job = await db.job.create({
      data: {
        jobNo: jobNo(prefix),
        kind,
        status: "CLOSED",
        vendorId: vendor.id,
        issuedOn,
        expectedBack: new Date(issuedOn.getTime() + intBetween(10, 30) * 86_400_000),
        returnedOn,
        chargeBasis: kind === "LAB" ? "per_stone" : pick(["per_stone", "per_carat"]),
        createdById: manager.id,
        lines: {
          create: lines.map((l) => ({
            stoneId: l.stoneId,
            weightOutCt: l.weightOut,
            weightInCt: l.weightIn,
            outcome: l.outcome,
            chargeMinor: l.charge,
          })),
        },
      },
    });

    for (const l of lines) {
      await db.costEntry.create({
        data: {
          stoneId: l.stoneId,
          kind:
            kind === "LAB"
              ? CostKind.LAB
              : kind === "HEATING"
                ? CostKind.HEATING
                : CostKind.CUTTING,
          amountMinor: l.charge,
          baseMinor: l.charge,
          currency: "LKR",
          incurredOn: returnedOn,
          sourceDoc: job.jobNo,
          note: `${kind === "LAB" ? "Certification" : kind === "HEATING" ? "Heat treatment" : "Recut"} — ${vendor.name}`,
        },
      });
      if (l.outcome !== "RETURNED") {
        await db.stone.update({
          where: { id: l.stoneId },
          data: { status: StoneStatus.WRITTEN_OFF, locationId: null, heldById: null },
        });
      }
    }
  }

  const chunk = <T,>(xs: T[], lo: number, hi: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < xs.length; ) {
      const n = intBetween(lo, hi);
      out.push(xs.slice(i, i + n));
      i += n;
    }
    return out;
  };

  const heatable = await db.stone.findMany({
    where: { status: StoneStatus.IN_STOCK, kind: StoneKind.STONE, treatment: { name: { startsWith: "Heat" } } },
    select: { id: true, weightCt: true, createdAt: true },
  });
  for (const batch of chunk(heatable, 3, 11)) {
    await closedJob(
      "HEATING",
      pick(heaters),
      batch.map((b) => ({ id: b.id, weightCt: Number(b.weightCt.toString()), createdAt: b.createdAt })),
      "HEAT",
    );
  }

  const certified = await db.stone.findMany({
    where: { status: StoneStatus.IN_STOCK, kind: StoneKind.STONE, certLab: { not: null } },
    select: { id: true, weightCt: true, createdAt: true },
  });
  for (const batch of chunk(certified, 2, 6)) {
    await closedJob(
      "LAB",
      pick(labs),
      batch.map((b) => ({ id: b.id, weightCt: Number(b.weightCt.toString()), createdAt: b.createdAt })),
      "LAB",
    );
  }

  const recut = (
    await db.stone.findMany({
      where: { status: StoneStatus.IN_STOCK, kind: StoneKind.STONE },
      select: { id: true, weightCt: true, createdAt: true },
    })
  ).filter(() => rnd() < 0.22);
  for (const batch of chunk(recut, 2, 8)) {
    await closedJob(
      "CUTTING",
      pick(cutters),
      batch.map((b) => ({ id: b.id, weightCt: Number(b.weightCt.toString()), createdAt: b.createdAt })),
      "CUT",
    );
  }

  // ------------------------------------------------- goods currently out
  // A real gem business always has a slice of its stock somewhere else.
  // Work sent to a vendor gets an open job; goods on memo are custody only,
  // because the memo module is not built yet.
  const inStock = await db.stone.findMany({
    where: { status: StoneStatus.IN_STOCK, kind: StoneKind.STONE },
    select: { id: true, weightCt: true },
  });

  const going = inStock.filter(() => rnd() < 0.14);
  const memoGoing = going.filter(() => rnd() < 0.35);
  const workGoing = going.filter((g) => !memoGoing.includes(g));
  let outCount = 0;

  async function openJob(
    kind: "CUTTING" | "HEATING" | "LAB",
    vendor: { id: string; name: string },
    batch: { id: string; weightCt: Prisma.Decimal }[],
    prefix: string,
  ) {
    if (!batch.length) return;
    const issuedOn = daysAgo(intBetween(3, 70));
    // Roughly a third of open work should be genuinely late. Deriving the due
    // date purely from the issue date made every open job overdue, which reads
    // as a broken report rather than a business problem.
    const expectedBack =
      rnd() < 0.65
        ? new Date(Date.now() + intBetween(3, 28) * 86_400_000)
        : new Date(issuedOn.getTime() + intBetween(10, 30) * 86_400_000);
    const job = await db.job.create({
      data: {
        jobNo: jobNo(prefix),
        kind,
        status: "OPEN",
        vendorId: vendor.id,
        issuedOn,
        expectedBack,
        chargeBasis: pick(["per_stone", "per_carat"]),
        createdById: pick([owner, manager]).id,
        lines: { create: batch.map((b) => ({ stoneId: b.id, weightOutCt: b.weightCt })) },
      },
    });
    for (const b of batch) {
      await db.custodyEvent.create({
        data: {
          stoneId: b.id,
          reason:
            kind === "CUTTING"
              ? CustodyReason.CUTTING
              : kind === "HEATING"
                ? CustodyReason.HEATING
                : CustodyReason.LAB,
          weightCt: b.weightCt,
          toPartyId: vendor.id,
          occurredAt: issuedOn,
          expectedBack: job.expectedBack,
          voucherNo: job.jobNo,
          createdById: manager.id,
        },
      });
      await db.stone.update({
        where: { id: b.id },
        data: { status: StoneStatus.OUT, heldById: vendor.id, locationId: null },
      });
      outCount++;
    }
  }

  const thirds = Math.ceil(workGoing.length / 3);
  const forCutting = workGoing.slice(0, thirds);
  const forHeating = workGoing.slice(thirds, thirds * 2);
  const forLab = workGoing.slice(thirds * 2);

  for (const batch of chunk(forCutting, 2, 7)) await openJob("CUTTING", pick(cutters), batch, "CUT");
  for (const batch of chunk(forHeating, 2, 7)) await openJob("HEATING", pick(heaters), batch, "HEAT");
  for (const batch of chunk(forLab, 1, 4)) await openJob("LAB", pick(labs), batch, "LAB");

  // Memos: real records rather than bare custody events, so the register,
  // the aging and the settle flow all have history to work with. A slice are
  // partly settled — a dealer returning four of six and keeping two is the
  // normal shape of a memo, not the exception.
  let memoSeq = 0;
  for (const batch of chunk(memoGoing, 1, 5)) {
    if (!batch.length) continue;
    const customer = pick(customers);
    const issuedOn = daysAgo(intBetween(4, 80));
    const dueBack =
      rnd() < 0.6
        ? new Date(Date.now() + intBetween(3, 30) * 86_400_000)
        : new Date(issuedOn.getTime() + intBetween(10, 30) * 86_400_000);

    const priced = await db.stone.findMany({
      where: { id: { in: batch.map((b) => b.id) } },
      select: { id: true, weightCt: true, askingPriceMinor: true },
    });

    const memo = await db.memo.create({
      data: {
        memoNo: `MEMO-2026-${String(++memoSeq).padStart(4, "0")}`,
        partyId: customer.id,
        issuedOn,
        dueBack,
        extensionNote:
          rnd() < 0.18
            ? `${daysAgo(intBetween(1, 20)).toISOString().slice(0, 10)}: extended at buyer's request`
            : null,
        createdById: pick([owner, manager]).id,
        lines: {
          create: priced.map((p) => ({
            stoneId: p.id,
            weightOutCt: p.weightCt,
            quotedPriceMinor: p.askingPriceMinor,
          })),
        },
      },
      include: { lines: true },
    });

    for (const line of memo.lines) {
      await db.custodyEvent.create({
        data: {
          stoneId: line.stoneId,
          reason: CustodyReason.MEMO,
          weightCt: line.weightOutCt,
          toPartyId: customer.id,
          occurredAt: issuedOn,
          expectedBack: dueBack,
          voucherNo: memo.memoNo,
          createdById: manager.id,
        },
      });
      await db.stone.update({
        where: { id: line.stoneId },
        data: { status: StoneStatus.OUT, heldById: customer.id, locationId: null },
      });
      outCount++;
    }

    // Partly settle roughly a third of memos by returning some of the goods.
    if (memo.lines.length > 1 && rnd() < 0.35) {
      const backCount = intBetween(1, memo.lines.length - 1);
      for (const line of memo.lines.slice(0, backCount)) {
        const settledOn = new Date(
          issuedOn.getTime() + intBetween(3, 25) * 86_400_000,
        );
        if (settledOn > new Date()) continue;
        await db.memoLine.update({
          where: { id: line.id },
          data: { outcome: "RETURNED", settledOn },
        });
        await db.custodyEvent.create({
          data: {
            stoneId: line.stoneId,
            reason: CustodyReason.RETURN,
            weightCt: line.weightOutCt,
            toLocationId: pick(inHouseLocations).id,
            occurredAt: settledOn,
            voucherNo: memo.memoNo,
            createdById: manager.id,
          },
        });
        await db.stone.update({
          where: { id: line.stoneId },
          data: {
            status: StoneStatus.IN_STOCK,
            heldById: null,
            locationId: pick(inHouseLocations).id,
          },
        });
        outCount--;
      }
    }
  }

  // Real sales, so margin reporting has something to work with. Price is
  // derived from cost with a spread, which is roughly how the trade prices —
  // and a few deals lose money, because a few deals always do.
  const sellable = await db.stone.findMany({
    where: { status: StoneStatus.IN_STOCK, kind: StoneKind.STONE },
    select: { id: true, weightCt: true },
    take: 90,
  });

  let saleSeq = 0;
  let soldCount = 0;
  const forSale = sellable.filter(() => rnd() < 0.42);

  for (const batch of chunk(forSale, 1, 4)) {
    if (!batch.length) continue;
    const customer = pick(customers);
    const soldOn = daysAgo(intBetween(5, 400));
    const foreign = rnd() < 0.35;
    const currency = foreign ? pick(["USD", "EUR", "THB"]) : "LKR";
    const fxRate = currency === "USD" ? 302 : currency === "EUR" ? 328 : currency === "THB" ? 8.6 : 1;

    const lines = [];
    for (const st of batch) {
      const costAgg = await db.costEntry.aggregate({
        where: { stoneId: st.id },
        _sum: { baseMinor: true },
      });
      const cost = costAgg._sum.baseMinor ?? 0n;
      // Most deals clear a healthy spread; roughly one in seven does not.
      const multiple = rnd() < 0.14 ? between(0.7, 0.98) : between(1.25, 2.4);
      const baseTotal = BigInt(Math.max(1, Math.round(Number(cost) * multiple)));
      const total = BigInt(Math.round(Number(baseTotal) / fxRate));
      const weight = Number(st.weightCt.toString());
      lines.push({
        stoneId: st.id,
        weightCt: st.weightCt,
        perCaratMinor: weight > 0 ? BigInt(Math.round(Number(total) / weight)) : null,
        totalMinor: total,
        baseMinor: baseTotal,
        costAtSaleMinor: cost,
      });
    }

    const sale = await db.sale.create({
      data: {
        saleNo: `SAL-2026-${String(++saleSeq).padStart(4, "0")}`,
        customerId: customer.id,
        soldOn,
        currency,
        fxRate,
        brokerName: rnd() < 0.3 ? pick(["K. Wijeratne", "S. Rajapaksa", "M. Haleem"]) : null,
        createdById: pick([owner, manager]).id,
        lines: { create: lines },
      },
    });

    for (const l of lines) {
      await db.stone.update({
        where: { id: l.stoneId },
        data: { status: StoneStatus.SOLD, heldById: customer.id, locationId: null },
      });
      await db.custodyEvent.create({
        data: {
          stoneId: l.stoneId,
          reason: CustodyReason.SALE,
          weightCt: l.weightCt,
          toPartyId: customer.id,
          occurredAt: soldOn,
          voucherNo: sale.saleNo,
          createdById: manager.id,
        },
      });
      soldCount++;
    }
  }

  // -------------------------------------------------------------- summary
  const [stones, costs, events, transforms, jobsClosed, jobsOpen] = await Promise.all([
    db.stone.count(),
    db.costEntry.count(),
    db.custodyEvent.count(),
    db.transformation.count(),
    db.job.count({ where: { status: "CLOSED" } }),
    db.job.count({ where: { status: "OPEN" } }),
  ]);
  const salesCount = await db.sale.count();
  const memoCount = await db.memo.count();
  const memoOut = await db.memoLine.count({ where: { outcome: null } });
  console.log(`
  Seeded:
    stones/lots        ${stones}
    cost entries       ${costs}
    custody events     ${events}
    transformations    ${transforms}
    jobs closed/open   ${jobsClosed} / ${jobsOpen}
    currently out      ${outCount}
    sales / stones     ${salesCount} / ${soldCount}
    memos / out        ${memoCount} / ${memoOut}
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
