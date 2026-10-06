"""
Downloads images from BING for every salon service:
5 images per service (52 x 5 = 260), saved by service name inside
its category folder. Standalone: no other file needed.

Every image is automatically resized/compressed to ~100-250 KB (hard max 500 KB)
so web pages load fast even on mobile 4G.

Install:  pip install icrawler pillow
Run:      python get_images_google.py

Result:
  images_google/ongles/ongles_gel_naturel_1.jpg ... _5.jpg
  images_google/massage/massage_dos_nuque_1.jpg ... _5.jpg
"""
import os
import shutil
from icrawler.builtin import BingImageCrawler   # Google's parser in icrawler is broken, Bing works
from PIL import Image

OUTPUT = "images_google"
PER_SERVICE = 5           # 52 services x 5 = 260 images
COMMERCIAL_ONLY = True    # True  = only Creative Commons images allowed for commercial use (safer, fewer results)
                          # False = normal Bing results (more images, but usually copyrighted)
FALLBACK_ANY_LICENSE = False  # True = if a service gets nothing with the license filter,
                              # retry WITHOUT it (images may be copyrighted: check before publishing)

TARGET_KB = 250           # ideal maximum size per image
HARD_MAX_KB = 500         # never exceed this
MAX_WIDTH = 1600          # px, plenty for web pages
MIN_WIDTH = 600           # never shrink below this

# folder name (French service)  ->  search query
SERVICES = {
    # 1. ONGLES
    "ongles_vernis_permanent_mains": "gel nail polish manicure",
    "ongles_vernis_permanent_pieds": "pedicure toenails polish",
    "ongles_design_french": "french manicure nail art",
    "ongles_gel_naturel": "natural gel nails",
    "ongles_capsule_gel_vernis": "acrylic nail extensions",
    "ongles_baby_boomer": "ombre nails",
    "ongles_reparation": "nail repair manicure",
    "ongles_soin_mains": "hand care spa",
    "ongles_soin_pieds": "foot care spa",
    # 2. CHEVEUX
    "cheveux_brushing": "hair blow dry salon",
    "cheveux_coloration": "hair coloring salon",
    "cheveux_coloration_racine": "hair roots dye",
    "cheveux_coloration_meche": "hair highlights balayage",
    "cheveux_proteine_keratine": "keratin hair treatment",
    "cheveux_soins": "hair care treatment mask",
    # 3. CILS & SOURCILS
    "cils_extension_naturel": "eyelash extensions natural",
    "cils_extension_glamour": "volume eyelash extensions",
    "cils_extension_bouquet": "eyelash extensions close up",
    "cils_lash_lift": "lash lift",
    "sourcils_brow_lift": "eyebrow lamination",
    # 4. SOINS DU VISAGE
    "visage_soin_basique": "facial treatment spa",
    "visage_soin_specifique": "skin care facial mask",
    "visage_hydrafacial": "hydrafacial",
    "visage_oxygeneo": "oxygen facial treatment",
    "visage_micro_needling": "microneedling face",
    "visage_mesotherapie": "mesotherapy face",
    "visage_fil_collagene": "face lifting skincare",
    # 5. MAQUILLAGE
    "maquillage_invitee_simple": "makeup artist natural look",
    "maquillage_invitee_soiree": "evening makeup glam",
    "maquillage_fiancailles": "bridal makeup engagement",
    "maquillage_mariee": "bride makeup wedding",
    # 6. COIFFURE & CHIGNON
    "chignon_tresser_enfant": "child hair braids",
    "chignon_wavy": "wavy hairstyle",
    "chignon_bien_coiffee": "updo bun hairstyle",
    # 7. EPILATION & HAMMAM
    "epilation_cire_corps": "waxing hair removal",
    "epilation_cire_jambes": "leg waxing",
    "epilation_cire_bras": "arm waxing",
    "epilation_cire_aisselles": "underarm waxing",
    "epilation_sucre": "sugaring hair removal",
    "epilation_visage": "facial hair removal",
    "sourcils_moustache": "eyebrow threading",
    "sourcils_tracage": "eyebrow shaping",
    "hammam": "hammam spa steam",
    "hammam_harza": "moroccan bath scrub",
    # 8. MASSAGE
    "massage_relaxant_corps": "relaxing body massage",
    "massage_dos_nuque": "back neck massage",
    "massage_jambes": "leg massage",
    "massage_visage_tete": "head face massage",
    "massage_ventre": "abdominal massage",
    "massage_cuisse": "thigh massage",
    # 9. AMINCISSEMENT
    "amincissement_forfait_12_seances": "body slimming treatment",
    "amincissement_platre": "body wrap treatment",
}

CATEGORY = {
    "ongles": "ongles",
    "cheveux": "cheveux",
    "cils": "cils_sourcils",
    "visage": "soins_visage",
    "maquillage": "maquillage",
    "chignon": "coiffure_chignon",
    "epilation": "epilation_hammam",
    "hammam": "epilation_hammam",
    "massage": "massage",
    "amincissement": "amincissement",
}
SPECIAL = {
    "sourcils_brow_lift": "cils_sourcils",
    "sourcils_moustache": "epilation_hammam",
    "sourcils_tracage": "epilation_hammam",
}


def optimize(src, dst):
    """Convert to JPEG, resize to MAX_WIDTH, lower quality until <= TARGET_KB."""
    img = Image.open(src).convert("RGB")
    if img.width > MAX_WIDTH:
        img = img.resize((MAX_WIDTH, int(img.height * MAX_WIDTH / img.width)), Image.LANCZOS)
    while True:
        for q in (88, 82, 76, 70, 64, 58, 52):
            img.save(dst, "JPEG", quality=q, optimize=True, progressive=True)
            if os.path.getsize(dst) <= TARGET_KB * 1024:
                return
        if img.width <= MIN_WIDTH:          # cannot shrink more
            break
        img = img.resize((int(img.width * 0.9), int(img.height * 0.9)), Image.LANCZOS)
    if os.path.getsize(dst) > HARD_MAX_KB * 1024:
        os.remove(dst)
        raise ValueError("still above hard limit")


def category_of(name):
    return SPECIAL.get(name) or CATEGORY[name.split("_")[0]]


tmp = os.path.join(OUTPUT, "_tmp")


def fetch(query, extra):
    """Run one Bing search with the given filters; return downloaded file names."""
    shutil.rmtree(tmp, ignore_errors=True)
    filters = dict(type="photo", **extra)
    try:
        crawler = BingImageCrawler(storage={"root_dir": tmp}, log_level=30)
        crawler.crawl(keyword=query, max_num=PER_SERVICE, filters=filters, min_size=(800, 500))
    except Exception as e:
        print("   crawl error:", e)
    return sorted(os.listdir(tmp)) if os.path.exists(tmp) else []


# filter attempts, strictest first; the first one that returns images is used
if COMMERCIAL_ONLY:
    ATTEMPTS = [
        dict(size="large", license="commercial,modify"),
        dict(license="commercial,modify"),
    ]
    if FALLBACK_ANY_LICENSE:
        ATTEMPTS += [dict(size="large"), dict()]
else:
    ATTEMPTS = [dict(size="large"), dict()]

for name, query in SERVICES.items():
    cat_dir = os.path.join(OUTPUT, category_of(name))
    os.makedirs(cat_dir, exist_ok=True)

    files = []
    for extra in ATTEMPTS:
        files = fetch(query, extra)
        if files:
            break

    saved = 0
    for f in files:
        try:
            optimize(os.path.join(tmp, f), os.path.join(cat_dir, f"{name}_{saved + 1}.jpg"))
            saved += 1
        except Exception as e:
            print("   skipped", f, "-", e)
    print("OK   " if saved else "EMPTY", name, f"({saved}/{PER_SERVICE})")

shutil.rmtree(tmp, ignore_errors=True)