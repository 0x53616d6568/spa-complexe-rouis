import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });

import { eq } from "drizzle-orm";
import {
  db,
  pool,
  serviceCategoriesTable,
  servicesTable,
  spaSettingsTable,
  staffProfilesTable,
  staffServicesTable,
  workingHoursTable,
} from "@workspace/db";
import { logger } from "../lib/logger";

const demoSettingsId = "00000000-0000-4000-8000-000000000001";

interface SeedService {
  name: string;
  category: string;
  slug: string;
  shortDescription: string;
  description: string;
  durationMinutes: number;
  priceAmount: number; // in cents (e.g. 20 DT = 2000)
  currency: string;
  isFeatured?: boolean;
}

const CATEGORIES = [
  { name: "Ongles", slug: "ongles", sortOrder: 1 },
  { name: "Cheveux", slug: "cheveux", sortOrder: 2 },
  { name: "Cils & Sourcils", slug: "cils-sourcils", sortOrder: 3 },
  { name: "Soins du visage", slug: "soins-visage", sortOrder: 4 },
  { name: "Maquillage", slug: "maquillage", sortOrder: 5 },
  { name: "Coiffure & Chignon", slug: "coiffure-chignon", sortOrder: 6 },
  { name: "Épilation", slug: "epilation", sortOrder: 7 },
  { name: "Massage", slug: "massage", sortOrder: 8 },
  { name: "Amincissement", slug: "amincissement", sortOrder: 9 },
];

const ROUIS_SERVICES_SEED: SeedService[] = [
  // Ongles
  {
    name: "Vernis permanent — Mains",
    category: "Ongles",
    slug: "vernis-permanent-mains",
    shortDescription: "Pose de vernis permanent sur les mains.",
    description: "Pose soignée et durable de vernis semi-permanent pour des mains élégantes et impeccables.",
    durationMinutes: 45,
    priceAmount: 2000,
    currency: "TND",
    isFeatured: true,
  },
  {
    name: "Vernis permanent — Pieds",
    category: "Ongles",
    slug: "vernis-permanent-pieds",
    shortDescription: "Pose de vernis permanent sur les pieds.",
    description: "Application professionnelle de vernis semi-permanent pour des pieds soignés et éclatants.",
    durationMinutes: 45,
    priceAmount: 2000,
    currency: "TND",
  },
  {
    name: "Vernis permanent — Design / French",
    category: "Ongles",
    slug: "vernis-permanent-design-french",
    shortDescription: "Décoration d'ongles, nail art ou french manucure.",
    description: "Finition stylisée selon vos envies : french classique, baby boomer délicat ou motifs personnalisés.",
    durationMinutes: 20,
    priceAmount: 500,
    currency: "TND",
  },
  {
    name: "Gel naturel",
    category: "Ongles",
    slug: "gel-naturel",
    shortDescription: "Renforcement des ongles au gel naturel.",
    description: "Application de gel protecteur pour fortifier l'ongle naturel avec une brillance durable.",
    durationMinutes: 60,
    priceAmount: 3500,
    currency: "TND",
  },
  {
    name: "Capsule + Gel + Vernis",
    category: "Ongles",
    slug: "capsule-gel-vernis",
    shortDescription: "Rallongement aux capsules avec gel et vernis.",
    description: "Extension d'ongles complète avec pose de capsules, modelage au gel et finition vernis.",
    durationMinutes: 90,
    priceAmount: 5000,
    currency: "TND",
    isFeatured: true,
  },
  {
    name: "Baby Boomer",
    category: "Ongles",
    slug: "baby-boomer",
    shortDescription: "Dégradé élégant rose et blanc sur ongles.",
    description: "Technique moderne de dégradé subtil entre le rose et le blanc pour un rendu chic et naturel.",
    durationMinutes: 75,
    priceAmount: 7000,
    currency: "TND",
  },
  {
    name: "Ongles cassés (par ongle)",
    category: "Ongles",
    slug: "ongles-casses",
    shortDescription: "Réparation ou reconstruction d'un ongle cassé.",
    description: "Reconstruction précise de l'ongle abîmé au gel ou à la soie.",
    durationMinutes: 15,
    priceAmount: 500,
    currency: "TND",
  },
  {
    name: "Soins — Mains",
    category: "Ongles",
    slug: "soins-mains",
    shortDescription: "Soin complet et manucure des mains.",
    description: "Gommage, cuticules, limage, modelage hydratant pour des mains douces et soignées.",
    durationMinutes: 45,
    priceAmount: 3000,
    currency: "TND",
  },
  {
    name: "Soins — Pieds",
    category: "Ongles",
    slug: "soins-pieds",
    shortDescription: "Pédicure et soin complet des pieds.",
    description: "Beauté des pieds avec bain relaxant, gommage, retrait des callosités et hydratation intense.",
    durationMinutes: 60,
    priceAmount: 4000,
    currency: "TND",
  },

  // Cheveux
  {
    name: "Brushing",
    category: "Cheveux",
    slug: "brushing",
    shortDescription: "Brushing professionnel adapté à votre longueur.",
    description: "Mise en forme soignée de vos cheveux : lisse, souple ou volumineux, à partir de 10 dt selon la longueur.",
    durationMinutes: 30,
    priceAmount: 1000,
    currency: "TND",
    isFeatured: true,
  },
  {
    name: "Coloration",
    category: "Cheveux",
    slug: "coloration",
    shortDescription: "Coloration complète, reflets intenses et brillance.",
    description: "Coloration sur mesure avec des produits de haute qualité, à partir de 50 dt.",
    durationMinutes: 90,
    priceAmount: 5000,
    currency: "TND",
  },
  {
    name: "Coloration racine",
    category: "Cheveux",
    slug: "coloration-racine",
    shortDescription: "Retouche des repousses et racines.",
    description: "Application ciblée sur les racines pour une parfaite harmonie de votre couleur.",
    durationMinutes: 60,
    priceAmount: 4000,
    currency: "TND",
  },
  {
    name: "Coloration + Mèche",
    category: "Cheveux",
    slug: "coloration-meche",
    shortDescription: "Coloration complète combinée à un balayage / mèches.",
    description: "Technique d'illumination et de contraste sur mesure, à partir de 120 dt.",
    durationMinutes: 120,
    priceAmount: 12000,
    currency: "TND",
  },
  {
    name: "Protéine + Kératine",
    category: "Cheveux",
    slug: "proteine-keratine",
    shortDescription: "Lissage et soin profond à la protéine et kératine.",
    description: "Traitement restructurant et lissant en profondeur pour des cheveux soyeux et disciplinés, à partir de 150 dt.",
    durationMinutes: 120,
    priceAmount: 15000,
    currency: "TND",
  },
  {
    name: "Soins cheveux",
    category: "Cheveux",
    slug: "soins-cheveux",
    shortDescription: "Soin réparateur et nutritif profond pour cheveux.",
    description: "Bain de nutrition intense pour revitaliser la fibre capillaire, à partir de 150 dt.",
    durationMinutes: 60,
    priceAmount: 15000,
    currency: "TND",
  },

  // Cils & Sourcils
  {
    name: "Cil à cil — Naturel",
    category: "Cils & Sourcils",
    slug: "cil-a-cil-naturel",
    shortDescription: "Extension de cils effet naturel et discret.",
    description: "Pose cil à cil délicate pour souligner le regard tout en subtilité.",
    durationMinutes: 75,
    priceAmount: 7000,
    currency: "TND",
    isFeatured: true,
  },
  {
    name: "Cil à cil — Glamour",
    category: "Cils & Sourcils",
    slug: "cil-a-cil-glamour",
    shortDescription: "Extension de cils volume intense et glamour.",
    description: "Pose cil à cil densifiée pour un regard captivant et sophistiqué.",
    durationMinutes: 90,
    priceAmount: 10000,
    currency: "TND",
  },
  {
    name: "Cil à cil — Bouquet",
    category: "Cils & Sourcils",
    slug: "cil-a-cil-bouquet",
    shortDescription: "Extension de cils en bouquets pour un volume russe.",
    description: "Technique en bouquets soyeux pour un volume dense et aérien.",
    durationMinutes: 90,
    priceAmount: 10000,
    currency: "TND",
  },
  {
    name: "Lash Lift",
    category: "Cils & Sourcils",
    slug: "lash-lift",
    shortDescription: "Rehaussement de cils naturel et durable.",
    description: "Recourbement semi-permanent des cils naturels pour ouvrir et illuminer le regard.",
    durationMinutes: 45,
    priceAmount: 4000,
    currency: "TND",
  },
  {
    name: "Brow Lift",
    category: "Cils & Sourcils",
    slug: "brow-lift",
    shortDescription: "Rehaussement et restructuration des sourcils.",
    description: "Discipline et rehausse les poils des sourcils pour une ligne plus fournie et structurée.",
    durationMinutes: 45,
    priceAmount: 4000,
    currency: "TND",
  },

  // Soins du visage
  {
    name: "Soin du visage — Basique",
    category: "Soins du visage",
    slug: "soin-visage-basique",
    shortDescription: "Nettoyage de peau essentiel et hydratation.",
    description: "Nettoyage en profondeur, désincrustation douce et masque hydratant pour raviver l'éclat.",
    durationMinutes: 45,
    priceAmount: 5000,
    currency: "TND",
  },
  {
    name: "Soin du visage — Spécifique",
    category: "Soins du visage",
    slug: "soin-visage-specifique",
    shortDescription: "Soin ciblé selon votre type de peau.",
    description: "Protocole personnalisé pour traiter les imperfections, l'excès de sébum ou la sécheresse.",
    durationMinutes: 60,
    priceAmount: 9000,
    currency: "TND",
  },
  {
    name: "Soin du visage — Hydrafacial",
    category: "Soins du visage",
    slug: "soin-visage-hydrafacial",
    shortDescription: "Nettoyage par hydro-aspiration et infusion d'actifs.",
    description: "Technologie de pointe alliant nettoyage, exfoliation, extraction et hydratation intense par sérums.",
    durationMinutes: 60,
    priceAmount: 20000,
    currency: "TND",
    isFeatured: true,
  },
  {
    name: "Soin du visage — Oxygeneo",
    category: "Soins du visage",
    slug: "soin-visage-oxygeneo",
    shortDescription: "Oxygénation cutanée, exfoliation et revitalisation.",
    description: "Stimule l'oxygénation naturelle de la peau pour un effet coup d'éclat et lissant immédiat.",
    durationMinutes: 60,
    priceAmount: 25000,
    currency: "TND",
  },
  {
    name: "Soin du visage — Micro Needling",
    category: "Soins du visage",
    slug: "soin-visage-micro-needling",
    shortDescription: "Régénération cutanée et stimulation du collagène.",
    description: "Micro-perforations contrôlées pour stimuler la production de collagène et estomper cicatrices et ridules.",
    durationMinutes: 60,
    priceAmount: 30000,
    currency: "TND",
  },
  {
    name: "Soin du visage — Mésothérapie",
    category: "Soins du visage",
    slug: "soin-visage-mesotherapie",
    shortDescription: "Infusion de vitamines et actifs anti-âge.",
    description: "Apport direct en nutriments essentiels et acide hyaluronique pour repulper la peau.",
    durationMinutes: 60,
    priceAmount: 15000,
    currency: "TND",
  },
  {
    name: "Soin du visage — Fil collagène",
    category: "Soins du visage",
    slug: "soin-visage-fil-collagene",
    shortDescription: "Comblement sans aiguille aux fils de collagène résorbables.",
    description: "Application de fils de collagène fondus pour lifter les traits et lisser les rides ciblées.",
    durationMinutes: 60,
    priceAmount: 18000,
    currency: "TND",
  },

  // Maquillage
  {
    name: "Maquillage — Invitée simple",
    category: "Maquillage",
    slug: "maquillage-invitee-simple",
    shortDescription: "Maquillage de jour ou d'événement subtil.",
    description: "Mise en beauté fraîche et élégante pour vos sorties et célébrations.",
    durationMinutes: 45,
    priceAmount: 8000,
    currency: "TND",
  },
  {
    name: "Maquillage — Invitée soirée",
    category: "Maquillage",
    slug: "maquillage-invitee-soiree",
    shortDescription: "Maquillage sophistiqué de soirée avec travail des yeux.",
    description: "Teint travaillé, contouring harmonieux et regard intense pour vos soirées festives.",
    durationMinutes: 60,
    priceAmount: 10000,
    currency: "TND",
    isFeatured: true,
  },
  {
    name: "Maquillage — Fiançailles ou Zdek",
    category: "Maquillage",
    slug: "maquillage-fiancailles-zdek",
    shortDescription: "Mise en beauté prestigieuse pour fiançailles et contrat.",
    description: "Maquillage haute tenue, lumineux et photographique pour vos grands moments.",
    durationMinutes: 75,
    priceAmount: 25000,
    currency: "TND",
  },
  {
    name: "Maquillage — Mariée (Hijeb ou chignon inclus)",
    category: "Maquillage",
    slug: "maquillage-mariee",
    shortDescription: "Forfait mariée haute couture avec coiffure / voile.",
    description: "Prestation complète d'exception comprenant le maquillage de mariée sur mesure et la pose du hijeb ou le chignon.",
    durationMinutes: 120,
    priceAmount: 60000,
    currency: "TND",
    isFeatured: true,
  },

  // Coiffure & Chignon
  {
    name: "Chignon — Tresser enfant",
    category: "Coiffure & Chignon",
    slug: "chignon-tresser-enfant",
    shortDescription: "Tresses et attaches festives pour enfants.",
    description: "Coiffure tressée soignée et confortable pour enfants, à partir de 30 dt.",
    durationMinutes: 30,
    priceAmount: 3000,
    currency: "TND",
  },
  {
    name: "Chignon — Wavy",
    category: "Coiffure & Chignon",
    slug: "chignon-wavy",
    shortDescription: "Ondulations wavy glamour et attaches légères.",
    description: "Mouvement wavy moderne et texturé pour un style chic et décontracté, à partir de 40 dt.",
    durationMinutes: 45,
    priceAmount: 4000,
    currency: "TND",
  },
  {
    name: "Chignon — Bien coiffée",
    category: "Coiffure & Chignon",
    slug: "chignon-bien-coiffee",
    shortDescription: "Chignon structuré et élégant pour événements.",
    description: "Chignon haut, bas ou travaillé selon votre morphologie et tenue, à partir de 50 dt.",
    durationMinutes: 60,
    priceAmount: 5000,
    currency: "TND",
  },

  // Épilation
  {
    name: "Épilation à la cire — Corps complet",
    category: "Épilation",
    slug: "epilation-cire-corps-complet",
    shortDescription: "Forfait complet d'épilation à la cire.",
    description: "Épilation intégrale des zones clés pour une peau douce et lisse durablement.",
    durationMinutes: 90,
    priceAmount: 10000,
    currency: "TND",
  },
  {
    name: "Épilation à la cire — Jambes",
    category: "Épilation",
    slug: "epilation-cire-jambes",
    shortDescription: "Épilation des jambes complètes à la cire.",
    description: "Épilation soignée à la cire tiède ou chaude avec soin apaisant.",
    durationMinutes: 30,
    priceAmount: 3000,
    currency: "TND",
  },
  {
    name: "Épilation à la cire — Bras",
    category: "Épilation",
    slug: "epilation-cire-bras",
    shortDescription: "Épilation des bras à la cire.",
    description: "Épilation des bras avec finition douce et hydratante.",
    durationMinutes: 20,
    priceAmount: 2500,
    currency: "TND",
  },
  {
    name: "Épilation à la cire — Aisselles",
    category: "Épilation",
    slug: "epilation-cire-aisselles",
    shortDescription: "Épilation rapide et nette des aisselles.",
    description: "Épilation hygiénique et rapide à la cire délicate.",
    durationMinutes: 15,
    priceAmount: 1000,
    currency: "TND",
  },
  {
    name: "Épilation au sucre traditionnelle — Jambes",
    category: "Épilation",
    slug: "epilation-sucre-jambes",
    shortDescription: "Épilation orientale au sucre (halawa) des jambes.",
    description: "Méthode ancestrale 100% naturelle laissant la peau infiniment douce.",
    durationMinutes: 45,
    priceAmount: 2500,
    currency: "TND",
  },
  {
    name: "Épilation au sucre traditionnelle — Bras",
    category: "Épilation",
    slug: "epilation-sucre-bras",
    shortDescription: "Épilation orientale au sucre des bras.",
    description: "Épilation douce et naturelle au sucre pour les bras.",
    durationMinutes: 30,
    priceAmount: 2000,
    currency: "TND",
  },
  {
    name: "Épilation visage",
    category: "Épilation",
    slug: "epilation-visage",
    shortDescription: "Épilation complète des zones du visage.",
    description: "Sourcils, lèvre supérieure, menton et joues pour un grain de peau net.",
    durationMinutes: 30,
    priceAmount: 2500,
    currency: "TND",
  },
  {
    name: "Sourcils + Moustache",
    category: "Épilation",
    slug: "sourcils-moustache",
    shortDescription: "Épilation ciblée des sourcils et de la lèvre supérieure.",
    description: "Ligne de sourcils nette et épilation de la lèvre (10 dt + 4 dt).",
    durationMinutes: 20,
    priceAmount: 1400,
    currency: "TND",
  },
  {
    name: "Traçage sourcils",
    category: "Épilation",
    slug: "tracage-sourcils",
    shortDescription: "Dessin et restructuration de la ligne des sourcils.",
    description: "Redéfinition de l'arc du sourcil pour mettre en valeur votre regard.",
    durationMinutes: 15,
    priceAmount: 1000,
    currency: "TND",
  },
  {
    name: "Hammam",
    category: "Épilation",
    slug: "hammam",
    shortDescription: "Bain de vapeur et détente au hammam.",
    description: "Bain de vapeur relaxant traditionnel pour purifier le corps et libérer les tensions.",
    durationMinutes: 45,
    priceAmount: 2000,
    currency: "TND",
  },
  {
    name: "Hammam + Hârza",
    category: "Épilation",
    slug: "hammam-harza",
    shortDescription: "Hammam avec gommage traditionnel complet par une hârza.",
    description: "Séance de hammam suivie d'un gommage en profondeur au gant kessa pour faire peau neuve.",
    durationMinutes: 60,
    priceAmount: 2500,
    currency: "TND",
  },

  // Massage
  {
    name: "Massage relaxant — Corps complet",
    category: "Massage",
    slug: "massage-relaxant-corps-complet",
    shortDescription: "Massage enveloppant et délassant sur l'ensemble du corps.",
    description: "Mouvements fluides et huiles bienfaisantes pour dénouer les tensions musculaires et apaiser l'esprit.",
    durationMinutes: 60,
    priceAmount: 4500,
    currency: "TND",
    isFeatured: true,
  },
  {
    name: "Massage — Dos + Nuque",
    category: "Massage",
    slug: "massage-dos-nuque",
    shortDescription: "Massage ciblé pour soulager les tensions du dos et du cou.",
    description: "Pression adaptée sur les trapèzes et la colonne pour un soulagement rapide du stress quotidien.",
    durationMinutes: 30,
    priceAmount: 2500,
    currency: "TND",
  },
  {
    name: "Massage — Jambes",
    category: "Massage",
    slug: "massage-jambes",
    shortDescription: "Massage drainant et relaxant pour jambes légères.",
    description: "Idéal pour stimuler la circulation et procurer une sensation immédiate de légèreté.",
    durationMinutes: 30,
    priceAmount: 2500,
    currency: "TND",
  },
  {
    name: "Massage — Visage + Tête",
    category: "Massage",
    slug: "massage-visage-tete",
    shortDescription: "Modelage crânien et décompression faciale.",
    description: "Massage doux des points réflexes du visage et du cuir chevelu pour une relaxation totale.",
    durationMinutes: 30,
    priceAmount: 2500,
    currency: "TND",
  },
  {
    name: "Massage — Ventre",
    category: "Massage",
    slug: "massage-ventre",
    shortDescription: "Massage drainant et détoxifiant de la zone abdominale.",
    description: "Modelage doux favorisant le confort digestif et la détoxification.",
    durationMinutes: 45,
    priceAmount: 8000,
    currency: "TND",
  },
  {
    name: "Massage — Cuisse",
    category: "Massage",
    slug: "massage-cuisse",
    shortDescription: "Massage raffermissant et tonifiant des cuisses.",
    description: "Technique de palper-rouler et remodelage pour lisser l'aspect de la peau.",
    durationMinutes: 45,
    priceAmount: 10000,
    currency: "TND",
  },

  // Amincissement
  {
    name: "Amincissement — Forfait 12 séances",
    category: "Amincissement",
    slug: "amincissement-12-seances",
    shortDescription: "Programme complet de 12 séances amincissantes.",
    description: "Cure personnalisée combinant modelage, drainage et technologies amincissantes pour sculpter la silhouette.",
    durationMinutes: 60,
    priceAmount: 30000,
    currency: "TND",
  },
  {
    name: "Amincissement au plâtre (par séance)",
    category: "Amincissement",
    slug: "amincissement-platre",
    shortDescription: "Soin thermo-amincissant au plâtre gainant.",
    description: "Enveloppement minéral raffermissant et réducteur de centimètres en séance ciblée.",
    durationMinutes: 60,
    priceAmount: 8000,
    currency: "TND",
  },
];

async function seedRouis() {
  logger.info("Démarrage du seed Complexe Rouis...");

  // 1. Settings
  await db
    .insert(spaSettingsTable)
    .values({
      id: demoSettingsId,
      name: "Complexe Rouis d'esthétique",
      tagline: "Votre institut de beauté d'exception.",
      address: "Complexe Rouis",
      city: "Tunis",
      region: "Tunisie",
      contactEmail: "contact@complexe-rouis.tn",
      contactPhone: "+216 00 000 000",
      timezone: "Africa/Tunis",
      currency: "TND",
      cancellationPolicy: "Annulation gratuite jusqu'à 2 heures avant votre rendez-vous.",
      bookingWindowDays: 60,
      minimumNoticeHours: 1,
      isDemo: false,
    })
    .onConflictDoUpdate({
      target: spaSettingsTable.id,
      set: {
        name: "Complexe Rouis d'esthétique",
        tagline: "Votre institut de beauté d'exception.",
        timezone: "Africa/Tunis",
        currency: "TND",
        minimumNoticeHours: 1,
        isDemo: false,
      },
    });

  // 2. Categories
  const categoryIdMap = new Map<string, string>();

  for (const cat of CATEGORIES) {
    let [found] = await db
      .select()
      .from(serviceCategoriesTable)
      .where(eq(serviceCategoriesTable.slug, cat.slug))
      .limit(1);

    if (!found) {
      [found] = await db
        .insert(serviceCategoriesTable)
        .values({
          name: cat.name,
          slug: cat.slug,
          sortOrder: cat.sortOrder,
          isActive: true,
        })
        .returning();
    } else {
      await db
        .update(serviceCategoriesTable)
        .set({ name: cat.name, sortOrder: cat.sortOrder, isActive: true })
        .where(eq(serviceCategoriesTable.id, found.id));
    }
    categoryIdMap.set(cat.name, found.id);
  }

  // 3. Services
  const allServiceIds: string[] = [];

  for (const serv of ROUIS_SERVICES_SEED) {
    const categoryId = categoryIdMap.get(serv.category);
    if (!categoryId) {
      logger.warn({ category: serv.category }, "Catégorie non trouvée pour le service");
      continue;
    }

    let [existing] = await db
      .select()
      .from(servicesTable)
      .where(eq(servicesTable.slug, serv.slug))
      .limit(1);

    let serviceId: string;

    if (!existing) {
      const [created] = await db
        .insert(servicesTable)
        .values({
          categoryId,
          name: serv.name,
          slug: serv.slug,
          shortDescription: serv.shortDescription,
          description: serv.description,
          durationMinutes: serv.durationMinutes,
          priceAmount: serv.priceAmount,
          currency: serv.currency,
          isFeatured: serv.isFeatured ?? false,
          isActive: true,
        })
        .returning();
      serviceId = created.id;
    } else {
      await db
        .update(servicesTable)
        .set({
          categoryId,
          name: serv.name,
          shortDescription: serv.shortDescription,
          description: serv.description,
          durationMinutes: serv.durationMinutes,
          priceAmount: serv.priceAmount,
          currency: serv.currency,
          isFeatured: serv.isFeatured ?? false,
          isActive: true,
        })
        .where(eq(servicesTable.id, existing.id));
      serviceId = existing.id;
    }
    allServiceIds.push(serviceId);
  }

  // 4. Staff profiles (link to all services for booking availability)
  let [staff] = await db
    .select()
    .from(staffProfilesTable)
    .where(eq(staffProfilesTable.displayName, "Équipe Rouis"))
    .limit(1);

  if (!staff) {
    [staff] = await db
      .insert(staffProfilesTable)
      .values({
        displayName: "Équipe Rouis",
        bio: "Esthéticiennes et coiffeuses qualifiées du Complexe Rouis.",
        isBookable: true,
        isActive: true,
      })
      .returning();
  }

  for (const serviceId of allServiceIds) {
    await db
      .insert(staffServicesTable)
      .values({ staffId: staff.id, serviceId })
      .onConflictDoNothing();
  }

  // 5. Working hours (every day 09:00 - 19:00)
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
    await db
      .insert(workingHoursTable)
      .values({
        dayOfWeek,
        openTime: "09:00",
        closeTime: "19:00",
        isClosed: false,
      })
      .onConflictDoNothing();
  }

  logger.info("Base de données synchronisée avec succès avec tous les services Rouis !");
}

seedRouis()
  .catch((error: unknown) => {
    logger.error({ error }, "Échec du seed Rouis");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
