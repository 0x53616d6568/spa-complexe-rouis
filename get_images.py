import os
import time
import requests

API_KEY = "57898946-200fcc8d59e50f1901ff54d25"  # Pixabay key
PER_SERVICE = 5                   # images per service
OUTPUT = "images_rouis"

# folder name (French service)  ->  English search query (better results)
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


def download(folder, query):
    path = os.path.join(OUTPUT, folder)
    os.makedirs(path, exist_ok=True)
    base = {
        "key": API_KEY,
        "q": query,
        "image_type": "photo",
        "safesearch": "true",
        "order": "popular",
        "per_page": 20,
    }
    # strictest first: best quality, then relax if too few results
    attempts = [
        {"editors_choice": "true", "min_width": 1600, "min_height": 1000},
        {"min_width": 1600, "min_height": 1000},
        {"min_width": 1200},
    ]
    hits = []
    for extra in attempts:
        r = requests.get("https://pixabay.com/api/", params={**base, **extra}, timeout=30)
        r.raise_for_status()
        hits = r.json().get("hits", [])
        if len(hits) >= PER_SERVICE:
            break
    for i, photo in enumerate(hits[:PER_SERVICE], 1):
        img = requests.get(photo["largeImageURL"], timeout=60).content
        with open(os.path.join(path, f"{folder}_{i}.jpg"), "wb") as f:
            f.write(img)
    print(f"OK  {folder}")


if __name__ == "__main__":
    for folder, query in SERVICES.items():
        try:
            download(folder, query)
        except Exception as e:
            print(f"ERR {folder}: {e}")
        time.sleep(0.5)