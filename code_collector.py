import os
from datetime import datetime

# A kimeneti fájl neve
OUTPUT_FILE = "teljes_projekt_kod.txt"

# Csak ezeket a kiterjesztéseket veszi figyelembe (Whitelist)
ALLOWED_EXTENSIONS = {'.py', '.js', '.jsx', '.ts', '.tsx', '.sql', '.css', '.txt','.toml','.rs', '.md', '.tex','.cs'}

INCLUDE_MARKDOWN = False
INCLUDE_LATEX = False
MARKDOWN_ONLY = False

# Ezeket mindenképp KIZÁRJA (Blacklist - biztonsági háló)
IGNORED_EXTENSIONS = {'.json', '.log', '.html', '.pyc','.txt','.css'}

# Milyen mappákat HAGYJON KI a keresésből?
EXCLUDE_DIRS = {
    'node_modules', '.git', '__pycache__', 'venv', 'env', 
    'build', 'dist', 'coverage', '.idea', '.vscode', 
    'clusters', 'data' # Feltételezem, itt vannak az adatmentések
}

EXCLUDE_PATHS = {
    "frontend/public/documentation",
}

# A script saját magát és a kimeneti fájlt is kihagyja
EXCLUDE_FILES = {'package-lock.json', 'yarn.lock', OUTPUT_FILE, os.path.basename(__file__)}

def collect_code():
    print("Kódok összegyűjtése folyamatban...")
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as outfile:
        # Végigsétál a mappákon
        for root, dirs, files in os.walk("."):
            relative_root = os.path.relpath(root, ".")
            clean_root = relative_root.replace("\\", "/")
            if clean_root == ".":
                clean_root = ""

            if clean_root in EXCLUDE_PATHS:
                dirs[:] = []
                continue

            # Helyben módosítjuk a dirs listát, hogy a tiltott mappákba be se lépjen
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            dirs[:] = [
                d for d in dirs
                if (f"{clean_root}/{d}" if clean_root else d).replace("\\", "/") not in EXCLUDE_PATHS
            ]
            
            for file in files:
                file_ext = os.path.splitext(file)[1].lower()
                
                # Szűrés
                if MARKDOWN_ONLY:
                    if file_ext != '.md':
                        continue
                else:
                    if not INCLUDE_MARKDOWN and file_ext == '.md':
                        continue
                    if not INCLUDE_LATEX and file_ext == '.tex':
                        continue

                # Csak akkor dolgozza fel, ha engedélyezett ÉS nem tiltott
                if file_ext in ALLOWED_EXTENSIONS and file_ext not in IGNORED_EXTENSIONS and file not in EXCLUDE_FILES:
                    file_path = os.path.join(root, file)
                    
                    # Útvonal normalizálása (hogy szép "backend/file.py" formátum legyen)
                    relative_path = os.path.relpath(file_path, ".")
                    clean_path = relative_path.replace("\\", "/") # Windows path fix
                    if clean_path.startswith("./"):
                        clean_path = clean_path[2:]
                    
                    try:
                        # Beolvassuk a fájlt
                        with open(file_path, 'r', encoding='utf-8') as infile:
                            content = infile.read()
                        
                        # Időbélyegek lekérdezése
                        ctime = os.path.getctime(file_path)
                        mtime = os.path.getmtime(file_path)
                        date_created = datetime.fromtimestamp(ctime).strftime("%Y-%m-%d %H:%M:%S")
                        date_modified = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
                            
                        # A kért fejléc formátum
                        header = f"\n### {clean_path} | Date Created: {date_created} | Date Modified: {date_modified} #####\n"
                        
                        outfile.write(header)
                        outfile.write(content)
                        outfile.write("\n") # Kis elválasztás
                        
                        print(f"Hozzáadva: {clean_path}")
                        
                    except Exception as e:
                        print(f"Skipping (read error): {clean_path} - {e}")

    print(f"\nKész! A fájl létrehozva: {OUTPUT_FILE}")

if __name__ == "__main__":
    collect_code()
